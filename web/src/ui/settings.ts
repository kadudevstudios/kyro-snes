import type { App, ScreenResult } from "./app";
import { h, icon } from "./dom";
import { renderControlsTable } from "./controls";
import { toast } from "./toast";
import { confirmDialog } from "./modal";
import {
  AUTOSAVE_INTERVALS,
  defaultSettings,
  HUD_DELAYS,
  normalizeSettings,
  type AspectMode,
  type FilterMode,
  type ScaleMode,
} from "../core/settings";

export function renderSettingsScreen(app: App): ScreenResult {
  const section = h("section", { class: "screen screen--settings" });

  section.append(
    h(
      "header",
      { class: "detail-head" },
      h("p", { class: "eyebrow", text: "Preferências" }),
      h("h1", { class: "detail-head__title", text: "Configurações" }),
      h("p", {
        class: "detail-head__sub",
        text: "Vídeo, áudio, controles e dados. Tudo é salvo neste dispositivo.",
      }),
    ),
  );

  const grid = h("div", { class: "settings-grid" });

  /* ---------------------------------------------------------------- video */
  const scaleControl = segmented(
    [
      { value: "integer", label: "Inteira" },
      { value: "fit", label: "Ajustar" },
    ],
    app.settings.scale,
    (value) => {
      app.updateSettings({ scale: value as ScaleMode });
      toast(value === "integer" ? "Escala: pixels inteiros." : "Escala: ajustada à janela.", "info", 1800);
    },
  );

  const aspectControl = segmented(
    [
      { value: "8:7", label: "8:7" },
      { value: "4:3", label: "4:3" },
    ],
    app.settings.aspect,
    (value) => {
      app.updateSettings({ aspect: value as AspectMode });
      toast(value === "4:3" ? "Proporção 4:3 (TV)." : "Proporção 8:7 (pixels quadrados).", "info", 1800);
    },
  );

  const filterControl = segmented(
    [
      { value: "pixelated", label: "Nítido" },
      { value: "smooth", label: "Suave" },
    ],
    app.settings.filter,
    (value) => app.updateSettings({ filter: value as FilterMode }),
  );

  grid.append(
    panel("Vídeo", "expand", [
      field(
        "Escala",
        "Inteira mantém cada pixel do jogo em um bloco exato; Ajustar preenche o espaço disponível.",
        scaleControl,
      ),
      field(
        "Proporção",
        "8:7 é o framebuffer puro; 4:3 é como o console aparecia em TVs de tubo.",
        aspectControl,
      ),
      field("Filtro", "Interpolação aplicada ao ampliar a imagem.", filterControl),
      switchField(
        "Scanlines",
        "Sobreposição sutil que imita a varredura de um CRT.",
        app.settings.scanlines,
        (checked) => app.updateSettings({ scanlines: checked }),
      ),
    ]),
  );

  /* ---------------------------------------------------------------- audio */
  const volume = h("input", {
    class: "range",
    attrs: {
      type: "range",
      min: "0",
      max: "100",
      step: "1",
      value: String(Math.round(app.settings.volume * 100)),
      "aria-label": "Volume",
    },
  });
  const volumeLabel = h("span", {
    class: "range__value",
    text: `${Math.round(app.settings.volume * 100)}%`,
  });
  volume.addEventListener("input", () => {
    const value = Number(volume.value) / 100;
    volumeLabel.textContent = `${Math.round(value * 100)}%`;
    app.updateSettings({ volume: value, muted: value === 0 ? app.settings.muted : false });
  });

  const testButton = h(
    "button",
    {
      class: "btn btn--ghost btn--sm",
      attrs: { type: "button" },
      on: {
        click: () => {
          if (app.settings.muted) {
            toast("O áudio está silenciado.", "info", 2200);
            return;
          }
          playTestTone(app.settings.volume);
          toast("Tocando tom de teste.", "info", 1600);
        },
      },
    },
    icon("volume", 15),
    h("span", { text: "Testar" }),
  );

  grid.append(
    panel("Áudio", "volume", [
      field(
        "Volume",
        "Aplicado em tempo real durante o jogo.",
        h("div", { class: "range-row" }, volume, volumeLabel),
        true,
      ),
      switchField(
        "Silenciar",
        "Mantém o volume salvo para quando você reativar.",
        app.settings.muted,
        (checked) => app.updateSettings({ muted: checked }),
      ),
      field("Som de teste", "Confirma que a saída de áudio está funcionando.", testButton),
    ]),
  );

  /* ----------------------------------------------------------------- game */
  const hudControl = segmented(
    HUD_DELAYS.map((delay) => ({
      value: String(delay),
      label: delay === 0 ? "Nunca" : `${(delay / 1000).toFixed(1).replace(".", ",")} s`,
    })),
    String(app.settings.hudAutoHide),
    (value) => app.updateSettings({ hudAutoHide: Number(value) }),
  );

  grid.append(
    panel("Jogo", "gamepad", [
      switchField(
        "Pausar ao sair da janela",
        "Evita que o jogo continue rodando em segundo plano.",
        app.settings.pauseOnBlur,
        (checked) => app.updateSettings({ pauseOnBlur: checked }),
      ),
      switchField(
        "Confirmar ao sair do jogo",
        "Pede confirmação antes de voltar para a biblioteca.",
        app.settings.confirmExit,
        (checked) => app.updateSettings({ confirmExit: checked }),
      ),
      switchField(
        "Mostrar dicas de teclado",
        "Exibe os atalhos na tela do jogo.",
        app.settings.showHints,
        (checked) => app.updateSettings({ showHints: checked }),
      ),
      field(
        "HUD some após",
        "Tempo sem mexer o mouse antes de esconder os botões do jogo.",
        hudControl,
        true,
      ),
    ]),
  );

  section.append(grid);

  /* ------------------------------------------------------------- controls */
  section.append(
    h(
      "div",
      { class: "settings-block" },
      h(
        "div",
        { class: "settings-block__head" },
        h("h2", { text: "Controles" }),
        h("p", {
          text: "Clique em uma tecla ou botão para redefinir. Controles USB/Bluetooth usam o mapeamento padrão do navegador.",
        }),
      ),
      renderControlsTable(app),
    ),
  );

  /* ----------------------------------------------------------------- data */
  const autosave = segmented(
    AUTOSAVE_INTERVALS.map((seconds) => ({
      value: String(seconds),
      label: seconds === 0 ? "Desligado" : seconds < 60 ? `${seconds} s` : `${seconds / 60} min`,
    })),
    String(app.settings.sramAutosave),
    (value) => {
      app.updateSettings({ sramAutosave: Number(value) });
      toast(
        Number(value) === 0
          ? "Save automático desligado."
          : `Save automático a cada ${value === "60" ? "1 minuto" : value === "120" ? "2 minutos" : `${value} segundos`}.`,
        "info",
        2200,
      );
    },
  );

  const importInput = h("input", {
    attrs: { type: "file", accept: "application/json,.json" },
    style: "display:none",
  });
  importInput.addEventListener("change", async () => {
    const file = importInput.files?.[0];
    importInput.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      app.updateSettings(normalizeSettings(parsed));
      app.refresh();
      toast("Configurações importadas.", "success");
    } catch {
      toast("Arquivo de configuração inválido.", "error");
    }
  });

  const exportButton = h(
    "button",
    {
      class: "btn btn--ghost",
      attrs: { type: "button" },
      on: {
        click: () => {
          const blob = new Blob([JSON.stringify(app.settings, null, 2)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const link = h("a", {
            attrs: { href: url, download: "kyro-snes-config.json" },
            style: "display:none",
          });
          document.body.append(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
          toast("Configurações exportadas.", "success", 2400);
        },
      },
    },
    icon("download", 16),
    h("span", { text: "Exportar" }),
  );

  const importButton = h(
    "button",
    {
      class: "btn btn--ghost",
      attrs: { type: "button" },
      on: { click: () => importInput.click() },
    },
    icon("upload", 16),
    h("span", { text: "Importar" }),
  );

  const resetButton = h(
    "button",
    {
      class: "btn btn--ghost",
      attrs: { type: "button" },
      on: {
        click: async () => {
          const ok = await confirmDialog(
            "Restaurar padrões?",
            "Volume, vídeo, controles e comportamento voltam ao padrão de fábrica. ROMs e save states não são afetados.",
            "Restaurar",
          );
          if (!ok) return;
          app.updateSettings(defaultSettings());
          app.refresh();
          toast("Configurações restauradas.", "success");
        },
      },
    },
    icon("restart", 16),
    h("span", { text: "Restaurar padrões" }),
  );

  section.append(
    h(
      "div",
      { class: "settings-block" },
      h(
        "div",
        { class: "settings-block__head" },
        h("h2", { text: "Dados" }),
        h("p", {
          text: "O save do próprio jogo (SRAM) fica no armazenamento local. Exporte as configurações para levar seus ajustes a outro computador.",
        }),
      ),
      h(
        "div",
        { class: "panel__rows" },
        field(
          "Save automático do jogo",
          "Frequência com que a SRAM é gravada enquanto você joga. Pausar e sair sempre gravam.",
          autosave,
          true,
        ),
      ),
      h(
        "div",
        { class: "settings-actions" },
        exportButton,
        importButton,
        resetButton,
        importInput,
      ),
    ),
  );

  /* ---------------------------------------------------------------- about */
  section.append(
    h(
      "div",
      { class: "settings-block" },
      h(
        "div",
        { class: "settings-block__head" },
        h("h2", { text: "Sobre" }),
      ),
      h(
        "div",
        { class: "about" },
        aboutRow("Aplicativo", "Kyro SNES Port 1.1.0"),
        aboutRow("Núcleo", "snes9x (libretro) compilado para WebAssembly"),
        aboutRow("Runtime", "EmulatorJS 4.2.3, auto-hospedado"),
        aboutRow("Armazenamento", "IndexedDB + localStorage, somente local"),
        aboutRow("Licenças", "MIT (shell) + GPL (runtime e núcleo)"),
      ),
      h("p", {
        class: "about__note",
        text: "O aplicativo não inclui ROMs. Você fornece o arquivo que já possui; ele é lido e guardado apenas neste dispositivo.",
      }),
    ),
  );

  return { el: section };
}

/* ------------------------------------------------------------------ utils */

function panel(title: string, iconName: string, rows: HTMLElement[]): HTMLElement {
  return h(
    "article",
    { class: "panel" },
    h(
      "div",
      { class: "panel__head" },
      h("span", { class: "panel__icon" }, icon(iconName, 18)),
      h("h2", { text: title }),
    ),
    h("div", { class: "panel__rows" }, ...rows),
  );
}

function field(label: string, hint: string, control: HTMLElement, stack = false): HTMLElement {
  return h(
    "div",
    { class: `field${stack ? " field--stack" : ""}` },
    h(
      "div",
      { class: "field__text" },
      h("span", { class: "field__label", text: label }),
      h("span", { class: "field__hint", text: hint }),
    ),
    h("div", { class: "field__control" }, control),
  );
}

function switchField(
  label: string,
  hint: string,
  checked: boolean,
  onChange: (checked: boolean) => void,
): HTMLElement {
  const input = h("input", { class: "switch__input", attrs: { type: "checkbox" } });
  input.checked = checked;
  input.addEventListener("change", () => onChange(input.checked));
  return h(
    "div",
    { class: "field" },
    h(
      "div",
      { class: "field__text" },
      h("span", { class: "field__label", text: label }),
      h("span", { class: "field__hint", text: hint }),
    ),
    h("label", { class: "switch" }, input, h("span", { class: "switch__track" })),
  );
}

function segmented(
  options: { value: string; label: string }[],
  current: string,
  onChange: (value: string) => void,
): HTMLElement {
  const wrap = h("div", { class: "segmented", attrs: { role: "group" } });
  for (const option of options) {
    const button = h("button", {
      class: `segmented__item${option.value === current ? " is-active" : ""}`,
      attrs: { type: "button" },
      text: option.label,
    });
    button.addEventListener("click", () => {
      for (const item of wrap.querySelectorAll(".segmented__item")) {
        item.classList.toggle("is-active", item === button);
      }
      onChange(option.value);
    });
    wrap.append(button);
  }
  return wrap;
}

function aboutRow(label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "kv" },
    h("span", { class: "kv__k", text: label }),
    h("span", { class: "kv__v", text: value }),
  );
}

/** Short arpeggio so the user can confirm the output chain without a ROM. */
function playTestTone(volume: number): void {
  const Ctor = window.AudioContext;
  if (!Ctor) return;
  const ctx = new Ctor();
  const master = ctx.createGain();
  master.gain.value = Math.max(0.04, Math.min(0.3, volume * 0.3));
  master.connect(ctx.destination);

  const start = ctx.currentTime + 0.02;
  [523.25, 659.25, 783.99].forEach((frequency, index) => {
    const at = start + index * 0.14;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = frequency;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(1, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.001, at + 0.22);
    osc.connect(env);
    env.connect(master);
    osc.start(at);
    osc.stop(at + 0.24);
  });

  window.setTimeout(() => void ctx.close().catch(() => undefined), 900);
}
