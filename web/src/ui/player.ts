import type { App, ScreenResult } from "./app";
import type { RomRecord, SaveStateRecord } from "../core/types";
import { idbDelete, idbGet, idbPut, STORE_STATES } from "../core/db";
import { PlayerBridge } from "../emulator/bridge";
import type { SaveStateResult, ScreenshotResult } from "../emulator/protocol";
import type { ControlBinding } from "../core/controls";
import { formatDate, h, icon } from "./dom";
import { confirmDialog, openModal } from "./modal";
import { toast } from "./toast";
import { renderControlsTable } from "./controls";

const SLOTS = [1, 2, 3];

export function renderPlayer(app: App, rom: RomRecord): ScreenResult {
  const stage = h("div", { class: "player" });
  const frame = h("div", { class: "player__frame" });
  const iframe = h("iframe", {
    class: "player__iframe",
    attrs: {
      src: new URL("player.html", location.href).toString(),
      title: `Emulador — ${rom.title}`,
      allow: "fullscreen; gamepad; autoplay; clipboard-write",
      scrolling: "no",
    },
  });
  const scanlines = h("div", { class: "player__scanlines", attrs: { "aria-hidden": "true" } });
  frame.append(iframe, scanlines);

  const status = h("span", { class: "hud__status", text: "Carregando núcleo…" });
  const pauseButton = hudButton("pause", "Pausar (Esc)", () => togglePause());
  pauseButton.disabled = true;

  const ffButton = hudButton("forward", "Avanço rápido (F)", () => void toggleFastForward());
  ffButton.hidden = true;
  ffButton.setAttribute("aria-pressed", "false");

  const hud = h(
    "header",
    { class: "hud" },
    h(
      "div",
      { class: "hud__left" },
      h(
        "button",
        {
          class: "hud__back",
          attrs: { type: "button", title: "Voltar (Esc)" },
          on: { click: () => void exit() },
        },
        icon("back", 18),
      ),
      h(
        "div",
        { class: "hud__titles" },
        h("span", { class: "hud__title", text: rom.title }),
        status,
      ),
    ),
    h(
      "div",
      { class: "hud__right" },
      pauseButton,
      hudButton("save", "Salvar estado (F5)", () => void openSlots("save")),
      hudButton("load", "Carregar estado (F8)", () => void openSlots("load")),
      hudButton("camera", "Capturar tela", () => void screenshot()),
      hudButton("settings", "Ajustes rápidos", () => openQuickSettings()),
      ffButton,
      hudButton("expand", "Tela cheia (F11)", () => void toggleFullscreen()),
      hudButton("close", "Sair do jogo", () => void exit()),
    ),
  );

  const pauseShot = h("img", {
    class: "pause-overlay__shot",
    attrs: { alt: "", "aria-hidden": "true" },
  });

  const pauseOverlay = h(
    "div",
    { class: "pause-overlay", attrs: { hidden: true } },
    pauseShot,
    h(
      "div",
      { class: "pause-overlay__card" },
      h("p", { class: "eyebrow", text: "Pausado" }),
      h("h2", { text: rom.title }),
      h(
        "div",
        { class: "pause-overlay__actions" },
        h(
          "button",
          {
            class: "btn btn--primary btn--lg",
            attrs: { type: "button" },
            on: { click: () => togglePause() },
          },
          icon("play", 18),
          "Continuar",
        ),
        h(
          "button",
          {
            class: "btn btn--ghost",
            attrs: { type: "button" },
            on: { click: () => void restart() },
          },
          icon("restart", 16),
          "Reiniciar",
        ),
        h(
          "button",
          {
            class: "btn btn--ghost",
            attrs: { type: "button" },
            on: { click: () => void exit() },
          },
          icon("close", 16),
          "Sair",
        ),
      ),
      h("p", { class: "pause-overlay__hint", text: "Esc para continuar" }),
    ),
  );

  const hints = h(
    "div",
    { class: "hints" },
    hint("Esc", "pausar"),
    hint("F5", "salvar"),
    hint("F8", "carregar"),
    hint("F", "avanço"),
    hint("F11", "tela cheia"),
    hint("M", "mudo"),
  );

  stage.append(h("div", { class: "player__stage" }, frame), hud, hints, pauseOverlay);

  let bridge: PlayerBridge | null = null;
  let startedAt = 0;
  let paused = false;
  let started = false;
  let hudTimer = 0;
  let autosaveTimer = 0;
  let disposed = false;
  let fullscreen = false;
  let fastForward = false;

  /* ------------------------------------------------------------- lifecycle */

  const bridgeReady = new PlayerBridge(iframe);
  bridge = bridgeReady;

  bridgeReady.on("progress", (text) => {
    if (!disposed) status.textContent = String(text ?? "Carregando…");
  });

  bridgeReady.on("error", (message) => {
    if (disposed) return;
    status.textContent = "Erro";
    toast(String(message ?? "Falha no núcleo"), "error", 7000);
  });

  bridgeReady.on("started", () => {
    if (disposed || started) return;
    started = true;
    startedAt = Date.now();
    status.textContent = "Em execução";
    pauseButton.disabled = false;
    iframe.focus();
    scheduleHudHide();
    applyAutosave();
    void setFastForward(false).catch(() => {
      ffButton.hidden = true;
    });
  });

  const bootPromise = bridgeReady.boot(rom.data.slice(0), rom.id.slice(0, 16), safeName(rom.title), {
    volume: app.settings.volume,
    muted: app.settings.muted,
    filter: app.settings.filter,
    controls: app.settings.controls,
  });

  void bootPromise
    .then(() => {
      if (disposed) return;
      status.textContent = "Pronto — clique em iniciar";
    })
    .catch((error: unknown) => {
      if (disposed) return;
      status.textContent = "Falha ao carregar";
      toast(error instanceof Error ? error.message : "Falha ao iniciar o núcleo.", "error", 8000);
    });

  /* -------------------------------------------------------------- commands */

  async function togglePause(): Promise<void> {
    if (!bridge || !started) return;
    paused = !paused;
    if (paused && fastForward) await setFastForward(false).catch(() => undefined);
    // Show the overlay immediately; the snapshot arrives a frame later.
    pauseOverlay.hidden = !paused;
    pauseButton.replaceChildren(icon(paused ? "play" : "pause", 18));
    if (paused) {
      showHud(true);
    } else {
      pauseShot.removeAttribute("src");
      scheduleHudHide();
    }
    try {
      if (paused) {
        // Capture while the core is still drawing: the retroarch screenshot
        // needs the main loop alive, and a paused canvas can be blank.
        const shot = await captureFrame();
        if (!paused) return;
        if (shot?.dataUrl) pauseShot.src = shot.dataUrl;
        await bridge.call("pause");
        // Persist cartridge SRAM whenever play stops, so progress is not lost
        // if the window is closed while paused.
        await bridge.call("flush").catch(() => undefined);
      } else {
        await bridge.call("resume");
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function restart(): Promise<void> {
    if (!bridge) return;
    try {
      await bridge.call("restart");
      paused = false;
      pauseOverlay.hidden = true;
      pauseShot.removeAttribute("src");
      pauseButton.replaceChildren(icon("pause", 18));
      await setFastForward(false).catch(() => undefined);
      startedAt = Date.now();
      toast("Jogo reiniciado.", "info", 1800);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao reiniciar.", "error");
    }
  }

  /**
   * Fast-forward is a libretro helper; older/simpler builds do not expose it,
   * so the button only appears once the core confirms support.
   */
  async function setFastForward(enabled: boolean): Promise<boolean> {
    if (!bridge) return false;
    const result = await bridge.call<{ supported: boolean; enabled: boolean }>("fastForward", {
      enabled,
    });
    if (!result.supported) {
      ffButton.hidden = true;
      fastForward = false;
      return false;
    }
    ffButton.hidden = false;
    fastForward = Boolean(result.enabled);
    ffButton.classList.toggle("is-active", fastForward);
    ffButton.setAttribute("aria-pressed", String(fastForward));
    return true;
  }

  async function toggleFastForward(): Promise<void> {
    if (!bridge || !started) return;
    if (paused) {
      toast("Continue o jogo para usar o avanço rápido.", "info", 2000);
      return;
    }
    try {
      const supported = await setFastForward(!fastForward);
      if (!supported) {
        toast("Este núcleo não suporta avanço rápido.", "info", 2600);
        return;
      }
      toast(fastForward ? "Avanço rápido ligado." : "Avanço rápido desligado.", "info", 1600);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao alternar avanço rápido.", "error");
    }
  }

  async function exit(): Promise<void> {
    if (app.settings.confirmExit && started) {
      const ok = await confirmDialog(
        "Sair do jogo?",
        "O progresso que o próprio jogo não salvou será perdido. Seus save states continuam disponíveis.",
        "Sair",
      );
      if (!ok) return;
    }
    if (paused) {
      paused = false;
      await bridge?.call("pause").catch(() => undefined);
    }
    // Flush battery-backed SRAM before the iframe is destroyed.
    await bridge?.call("flush").catch(() => undefined);
    if (startedAt) {
      await app.markPlayed(rom, Date.now() - startedAt);
      startedAt = 0;
    }
    if (fullscreen && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => undefined);
    }
    app.go("library");
  }

  async function screenshot(): Promise<void> {
    if (!bridge) return;
    try {
      const result = await captureFrame();
      if (!result) throw new Error("Falha ao capturar.");
      const anchor = h("a", {
        attrs: { href: result.dataUrl, download: `${safeName(rom.title)}-${Date.now()}.${result.extension}` },
      });
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      toast("Screenshot salvo.", "success", 2000);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao capturar.", "error");
    }
  }

  /**
   * A WebGL canvas is cleared as soon as the frame is composited, so sampling
   * it can return an all-black image depending on where the draw lands. Retry
   * a few times and keep the first frame with real pixels.
   */
  async function captureFrame(): Promise<ScreenshotResult | null> {
    if (!bridge) return null;
    let last: ScreenshotResult | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const shot = await bridge.call<ScreenshotResult>("screenshot").catch(() => null);
      if (!shot) return last;
      last = shot;
      if (await hasVisiblePixels(shot.dataUrl)) return shot;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return last;
  }

  async function openSlots(mode: "save" | "load"): Promise<void> {
    if (!bridge || !started) {
      toast("Inicie o jogo primeiro.", "info", 2200);
      return;
    }
    const states = new Map<number, SaveStateRecord | null>();
    for (const slot of SLOTS) {
      states.set(slot, (await idbGet<SaveStateRecord>(STORE_STATES, `${rom.id}:${slot}`)) ?? null);
    }

    const grid = h("div", { class: "slots" });
    let close: () => void = () => undefined;

    const renderSlots = (): void => {
      grid.replaceChildren();
      for (const slot of SLOTS) {
        const state = states.get(slot) ?? null;
        const preview = state?.thumbnail
          ? h("img", { class: "slot__preview", attrs: { src: state.thumbnail, alt: "" } })
          : h("div", { class: "slot__preview slot__preview--empty" }, icon("save", 22));

        const card = h(
          "div",
          { class: `slot${state ? " has-state" : ""}` },
          preview,
          h(
            "div",
            { class: "slot__meta" },
            h("span", { class: "slot__name", text: `Slot ${slot}` }),
            h("span", {
              class: "slot__time",
              text: state ? formatDate(state.createdAt) : "vazio",
            }),
          ),
          h(
            "div",
            { class: "slot__actions" },
            h(
              "button",
              {
                class: "btn btn--ghost btn--sm",
                attrs: { type: "button" },
                on: {
                  click: async () => {
                    if (state) {
                      const ok = await confirmDialog(
                        "Sobrescrever slot?",
                        `O save do Slot ${slot} será substituído pelo estado atual.`,
                        "Sobrescrever",
                      );
                      if (!ok) return;
                    }
                    await saveToSlot(slot);
                    states.set(slot, (await idbGet<SaveStateRecord>(STORE_STATES, `${rom.id}:${slot}`)) ?? null);
                    renderSlots();
                  },
                },
              },
              state ? "Sobrescrever" : "Salvar",
            ),
            h(
              "button",
              {
                class: "btn btn--ghost btn--sm",
                attrs: { type: "button", disabled: !state },
                on: {
                  click: async () => {
                    await loadFromSlot(slot);
                    close();
                  },
                },
              },
              "Carregar",
            ),
            state
              ? h(
                  "button",
                  {
                    class: "icon-btn icon-btn--danger",
                    attrs: { type: "button", title: "Apagar slot" },
                    on: {
                      click: async () => {
                        const ok = await confirmDialog(
                          "Apagar slot?",
                          `O save do Slot ${slot} será removido deste dispositivo.`,
                          "Apagar",
                          true,
                        );
                        if (!ok) return;
                        await idbDelete(STORE_STATES, `${rom.id}:${slot}`);
                        states.set(slot, null);
                        renderSlots();
                      },
                    },
                  },
                  icon("trash", 16),
                )
              : null,
          ),
        );
        grid.append(card);
      }
    };

    renderSlots();

    close = openModal({
      title: mode === "save" ? "Salvar estado" : "Carregar estado",
      subtitle: "Save states guardam o ponto exato, inclusive dentro de fases.",
      body: grid,
      actions: [{ label: "Fechar", kind: "ghost" }],
    });
  }

  async function saveToSlot(slot: number): Promise<void> {
    if (!bridge) return;
    try {
      const result = await bridge.call<SaveStateResult>("saveState", undefined, 30_000);
      const record: SaveStateRecord = {
        id: `${rom.id}:${slot}`,
        romId: rom.id,
        slot,
        data: result.data,
        thumbnail: result.thumbnail,
        createdAt: Date.now(),
      };
      await idbPut(STORE_STATES, record);
      toast(`Estado salvo no slot ${slot}.`, "success", 2000);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao salvar estado.", "error");
    }
  }

  async function loadFromSlot(slot: number): Promise<void> {
    if (!bridge) return;
    try {
      const state = await idbGet<SaveStateRecord>(STORE_STATES, `${rom.id}:${slot}`);
      if (!state) {
        toast("Slot vazio.", "info", 1800);
        return;
      }
      await bridge.call("loadState", { data: state.data.slice(0) }, 30_000);
      paused = false;
      pauseOverlay.hidden = true;
      pauseButton.replaceChildren(icon("pause", 18));
      toast(`Estado do slot ${slot} carregado.`, "success", 2000);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao carregar estado.", "error");
    }
  }

  function openQuickSettings(): void {
    if (!bridge) return;

    const volume = h("input", {
      class: "range",
      attrs: { type: "range", min: "0", max: "100", step: "1", value: String(Math.round(app.settings.volume * 100)) },
    });
    const volumeValue = h("span", { class: "range__value", text: `${Math.round(app.settings.volume * 100)}%` });
    volume.addEventListener("input", () => {
      const value = Number(volume.value) / 100;
      volumeValue.textContent = `${Math.round(value * 100)}%`;
      app.updateSettings({ volume: value, muted: value === 0 ? true : app.settings.muted });
      void bridge?.call("setVolume", { volume: app.settings.muted ? 0 : value });
    });

    const scaleRow = h(
      "div",
      { class: "segmented" },
      ...[
        ["integer", "Inteira"],
        ["fit", "Ajustar"],
      ].map(([value, label]) => {
        const button = h("button", {
          class: `segmented__item${app.settings.scale === value ? " is-active" : ""}`,
          attrs: { type: "button" },
          text: label,
        });
        button.addEventListener("click", () => {
          for (const item of scaleRow.querySelectorAll(".segmented__item")) {
            item.classList.toggle("is-active", item === button);
          }
          app.updateSettings({ scale: value as "integer" | "fit" });
          applyScale();
        });
        return button;
      }),
    );

    const aspectRow = h(
      "div",
      { class: "segmented" },
      ...[
        ["8:7", "8:7"],
        ["4:3", "4:3"],
      ].map(([value, label]) => {
        const button = h("button", {
          class: `segmented__item${app.settings.aspect === value ? " is-active" : ""}`,
          attrs: { type: "button" },
          text: label,
        });
        button.addEventListener("click", () => {
          for (const item of aspectRow.querySelectorAll(".segmented__item")) {
            item.classList.toggle("is-active", item === button);
          }
          app.updateSettings({ aspect: value as "4:3" | "8:7" });
          applyScale();
        });
        return button;
      }),
    );

    const filterRow = h(
      "div",
      { class: "segmented" },
      ...[
        ["pixelated", "Nítido"],
        ["smooth", "Suave"],
      ].map(([value, label]) => {
        const button = h("button", {
          class: `segmented__item${app.settings.filter === value ? " is-active" : ""}`,
          attrs: { type: "button" },
          text: label,
        });
        button.addEventListener("click", () => {
          for (const item of filterRow.querySelectorAll(".segmented__item")) {
            item.classList.toggle("is-active", item === button);
          }
          app.updateSettings({ filter: value as "pixelated" | "smooth" });
          void bridge?.call("setFilter", { filter: value });
        });
        return button;
      }),
    );

    const scanInput = h("input", { class: "switch__input", attrs: { type: "checkbox" } });
    scanInput.checked = app.settings.scanlines;
    scanInput.addEventListener("change", () => {
      app.updateSettings({ scanlines: scanInput.checked });
      applyScanlines();
    });

    const controlsHost = h("div", {});
    const rebuildControls = (): void => {
      controlsHost.replaceChildren(
        renderControlsTable(app, {
          onChange: (index: number, binding: ControlBinding) => {
            void bridge?.call("setControl", { index, key: binding.key, gamepad: binding.gamepad });
          },
          onReset: () => {
            rebuildControls();
            void bridge?.call("resetControls", { controls: app.settings.controls });
          },
        }),
      );
    };
    rebuildControls();

    openModal({
      title: "Ajustes rápidos",
      subtitle: "As mudanças valem imediatamente.",
      width: 560,
      body: h(
        "div",
        { class: "quick" },
        h("div", { class: "quick__row" }, h("span", { text: "Volume" }), h("div", { class: "range-row" }, volume, volumeValue)),
        h("div", { class: "quick__row" }, h("span", { text: "Escala" }), scaleRow),
        h("div", { class: "quick__row" }, h("span", { text: "Proporção" }), aspectRow),
        h("div", { class: "quick__row" }, h("span", { text: "Filtro" }), filterRow),
        h(
          "div",
          { class: "quick__row" },
          h("span", { text: "Scanlines" }),
          h("label", { class: "switch" }, scanInput, h("span", { class: "switch__track" })),
        ),
        h("h3", { class: "quick__heading", text: "Controles" }),
        controlsHost,
      ),
      actions: [{ label: "Pronto", kind: "primary" }],
    });
  }

  async function toggleFullscreen(): Promise<void> {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Tela cheia indisponível.", "error");
    }
  }

  /* ----------------------------------------------------------------- layout */

  function applyScale(): void {
    const stageEl = stage.querySelector<HTMLElement>(".player__stage");
    if (!stageEl) return;
    const { width, height } = stageEl.getBoundingClientRect();
    if (width < 2 || height < 2) return;

    // 8:7 is the raw framebuffer; 4:3 is the shape the console had on a TV.
    const aspect = app.settings.aspect === "4:3" ? 4 / 3 : 8 / 7;

    if (app.settings.scale === "fit") {
      const w = Math.min(width, height * aspect);
      frame.style.width = `${Math.floor(w)}px`;
      frame.style.height = `${Math.floor(w / aspect)}px`;
      return;
    }

    const scale = Math.max(
      1,
      Math.min(Math.floor(height / 224), Math.floor(width / (224 * aspect))),
    );
    const frameHeight = 224 * scale;
    frame.style.height = `${frameHeight}px`;
    frame.style.width = `${Math.round(frameHeight * aspect)}px`;
  }

  function applyScanlines(): void {
    scanlines.style.display = app.settings.scanlines ? "block" : "none";
  }

  /**
   * snes9x only writes cartridge SRAM on exit; the shell also flushes on pause
   * and on a timer, so a crash or a closed window loses at most one interval.
   */
  function applyAutosave(): void {
    window.clearInterval(autosaveTimer);
    autosaveTimer = 0;
    const seconds = app.settings.sramAutosave;
    if (!seconds) return;
    autosaveTimer = window.setInterval(() => {
      if (!started || paused || !bridge) return;
      void bridge.call("flush").catch(() => undefined);
    }, seconds * 1000);
  }

  function showHud(force = false): void {
    hud.classList.remove("is-hidden");
    hints.classList.remove("is-hidden");
    stage.classList.remove("is-idle");
    if (force || paused || !started) return;
    scheduleHudHide();
  }

  function scheduleHudHide(): void {
    window.clearTimeout(hudTimer);
    if (paused || !started) return;
    const delay = app.settings.hudAutoHide;
    if (delay <= 0) return;
    hudTimer = window.setTimeout(() => {
      if (paused) return;
      hud.classList.add("is-hidden");
      hints.classList.add("is-hidden");
      stage.classList.add("is-idle");
    }, delay);
  }

  stage.addEventListener("mousemove", () => showHud());
  stage.addEventListener("touchstart", () => showHud(), { passive: true });
  stage.addEventListener("pointerdown", () => showHud());

  const resizeObserver = new ResizeObserver(() => applyScale());
  resizeObserver.observe(stage);
  applyScale();
  applyScanlines();

  /* --------------------------------------------------------------- keyboard */

  const onKey = (event: KeyboardEvent): void => {
    // A dialog owns the keyboard while it is open (Esc must close it, not
    // pause the game behind it).
    if (document.querySelector(".modal-overlay")) return;
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
        else void togglePause();
        break;
      case "F5":
        event.preventDefault();
        void saveToSlot(1);
        break;
      case "F8":
        event.preventDefault();
        void loadFromSlot(1);
        break;
      case "f":
      case "F":
        event.preventDefault();
        void toggleFastForward();
        break;
      case "F11":
        event.preventDefault();
        void toggleFullscreen();
        break;
      case "m":
      case "M": {
        const next = !app.settings.muted;
        app.updateSettings({ muted: next });
        void bridge?.call("setMuted", { muted: next });
        toast(next ? "Áudio silenciado." : "Áudio ativado.", "info", 1500);
        break;
      }
      default:
        break;
    }
  };

  window.addEventListener("keydown", onKey);

  /**
   * Pointer and key events over the game land in the iframe document, so the
   * shell never sees them. Mirroring them here is what makes the auto-hiding
   * HUD reachable again after it fades out.
   */
  function onFramePointer(): void {
    showHud();
  }

  function onFrameKey(event: KeyboardEvent): void {
    showHud();
    onKey(event);
  }

  let frameDoc: Document | null = null;

  const attachFrameListeners = (): void => {
    const doc = iframe.contentDocument;
    if (!doc || doc === frameDoc) return;
    frameDoc = doc;
    doc.addEventListener("mousemove", onFramePointer, { passive: true });
    doc.addEventListener("touchstart", onFramePointer, { passive: true });
    doc.addEventListener("pointerdown", onFramePointer, { passive: true });
    doc.addEventListener("keydown", onFrameKey, true);
  };

  iframe.addEventListener("load", attachFrameListeners);
  attachFrameListeners();

  const onFullscreenChange = (): void => {
    fullscreen = Boolean(document.fullscreenElement);
    requestAnimationFrame(() => applyScale());
  };
  document.addEventListener("fullscreenchange", onFullscreenChange);

  const onVisibility = (): void => {
    if (!app.settings.pauseOnBlur || !started || paused) return;
    if (document.hidden) void togglePause();
  };
  document.addEventListener("visibilitychange", onVisibility);

  const onBlur = (): void => {
    // Moving focus into the game iframe must not pause; only a real window
    // focus loss should. Give the browser a tick to settle focus first.
    window.setTimeout(() => {
      if (!app.settings.pauseOnBlur || !started || paused) return;
      if (document.hasFocus()) return;
      void togglePause();
    }, 300);
  };
  window.addEventListener("blur", onBlur);

  const cleanup = (): void => {
    disposed = true;
    window.clearTimeout(hudTimer);
    window.clearInterval(autosaveTimer);
    window.removeEventListener("keydown", onKey);
    window.removeEventListener("blur", onBlur);
    document.removeEventListener("fullscreenchange", onFullscreenChange);
    document.removeEventListener("visibilitychange", onVisibility);
    iframe.removeEventListener("load", attachFrameListeners);
    if (frameDoc) {
      frameDoc.removeEventListener("mousemove", onFramePointer);
      frameDoc.removeEventListener("touchstart", onFramePointer);
      frameDoc.removeEventListener("pointerdown", onFramePointer);
      frameDoc.removeEventListener("keydown", onFrameKey, true);
      frameDoc = null;
    }
    resizeObserver.disconnect();
    bridge?.dispose();
    bridge = null;
    iframe.removeAttribute("src");
    if (startedAt) void app.markPlayed(rom, Date.now() - startedAt);
    startedAt = 0;
  };

  return { el: stage, cleanup };
}

/* ------------------------------------------------------------------ helpers */

function hudButton(iconName: string, label: string, onClick: () => void): HTMLButtonElement {
  return h(
    "button",
    {
      class: "hud__btn",
      attrs: { type: "button", title: label, "aria-label": label },
      on: { click: onClick },
    },
    icon(iconName, 18),
  );
}

/** True when the decoded frame is not a black canvas sample. */
function hasVisiblePixels(dataUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 32;
        canvas.height = 24;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          resolve(true);
          return;
        }
        context.drawImage(image, 0, 0, 32, 24);
        const { data } = context.getImageData(0, 0, 32, 24);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
        resolve(sum / (data.length / 4) > 6);
      } catch {
        resolve(true);
      }
    };
    image.onerror = () => resolve(false);
    image.src = dataUrl;
  });
}

function hint(key: string, label: string): HTMLElement {
  return h(
    "span",
    { class: "hint" },
    h("kbd", { text: key }),
    h("span", { text: label }),
  );
}

function safeName(title: string): string {
  return title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "snes";
}
