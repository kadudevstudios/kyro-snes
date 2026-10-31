/**
 * Emulator iframe entry point.
 *
 * Owns the EmulatorJS runtime lifecycle for exactly one ROM and exposes a
 * small RPC surface to the parent shell. Everything here runs inside the
 * sandboxed player document.
 */

import "../styles/player.css";
import { SNES_BUTTONS, toEmulatorControls } from "../core/controls";
import type { ControlBinding } from "../core/controls";
import type {
  MainMessage,
  PlayerCommand,
  PlayerMessage,
  PlayerSettings,
  SaveStateResult,
  ScreenshotResult,
  StatusResult,
} from "../emulator/protocol";

const EMU_BASE = new URL("emu/", location.href).toString();

let settings: PlayerSettings | null = null;
let started = false;
let booted = false;
let lastProgress = "";
let errorSent = false;
let watchTimer = 0;

function post(message: PlayerMessage, transfer: Transferable[] = []): void {
  parent.postMessage(message, location.origin === "null" ? "*" : location.origin, transfer);
}

function instance() {
  const ejs = window.EJS_emulator;
  if (!ejs) throw new Error("Núcleo de emulação não carregado.");
  return ejs;
}

window.addEventListener("message", (event: MessageEvent) => {
  if (event.source !== parent) return;
  const data = event.data as MainMessage | null;
  if (!data || typeof data !== "object") return;
  if (data.kind === "init") {
    void boot(data);
    return;
  }
  if (data.kind === "cmd") {
    void handleCommand(data.id, data.cmd, data.payload);
  }
});

async function boot(message: Extract<MainMessage, { kind: "init" }>): Promise<void> {
  if (booted) {
    post({ kind: "error", message: "O player já foi inicializado." });
    return;
  }
  booted = true;
  settings = message.settings;

  const blob = new Blob([message.rom], { type: "application/octet-stream" });
  const gameUrl = URL.createObjectURL(blob);

  window.EJS_player = "#game";
  window.EJS_core = "snes";
  window.EJS_gameUrl = gameUrl;
  window.EJS_gameName = message.gameName;
  window.EJS_gameID = message.gameId;
  window.EJS_pathtodata = EMU_BASE;
  window.EJS_startOnLoaded = false;
  window.EJS_startButtonName = "Iniciar jogo";
  window.EJS_language = "pt-BR";
  window.EJS_disableAutoLang = false;
  window.EJS_volume = settings.muted ? 0 : settings.volume;
  window.EJS_backgroundColor = "#000000";
  window.EJS_alignStartButton = "center";
  window.EJS_threads = false;
  window.EJS_defaultControls = toEmulatorControls(settings.controls);

  window.EJS_ready = () => post({ kind: "ready" });
  window.EJS_onGameStart = () => {
    started = true;
    applySettings();
    startGamepadSync();
    post({ kind: "started" });
  };

  observeRuntime();

  const script = document.createElement("script");
  script.src = `${EMU_BASE}loader.js`;
  script.onerror = () => post({ kind: "error", message: "Não foi possível carregar o runtime." });
  document.head.appendChild(script);

  // Fallback in case the runtime emits "start" before our hook is wired.
  watchTimer = window.setInterval(() => {
    const ejs = window.EJS_emulator;
    if (!ejs) return;
    if (ejs.started && !started) {
      started = true;
      applySettings();
      startGamepadSync();
      post({ kind: "started" });
    }
    if (started) window.clearInterval(watchTimer);
  }, 300);
}

let gamepadTimer = 0;

function startGamepadSync(): void {
  if (gamepadTimer) return;
  syncGamepad();
  window.addEventListener("gamepadconnected", syncGamepad);
  // Cheap poll: Chrome only exposes a pad after the first button press.
  gamepadTimer = window.setInterval(syncGamepad, 1500);
}

function observeRuntime(): void {
  const observer = new MutationObserver(() => {
    const loading = document.querySelector(".ejs_loading_text")?.textContent?.trim() ?? "";
    if (loading && loading !== lastProgress) {
      lastProgress = loading;
      post({ kind: "progress", text: loading });
    }
    const error = document.querySelector(".ejs_error_text")?.textContent?.trim() ?? "";
    if (error && !errorSent) {
      errorSent = true;
      post({ kind: "error", message: error });
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function applySettings(): void {
  const ejs = window.EJS_emulator;
  if (!ejs || !settings) return;

  ejs.setVolume(settings.muted ? 0 : settings.volume);
  ejs.muted = settings.muted;

  for (const button of SNES_BUTTONS) {
    const binding = settings.controls[button.index];
    if (!binding) continue;
    ejs.controls["0"] = ejs.controls["0"] ?? {};
    ejs.controls["0"][String(button.index)] = {
      value: binding.key,
      value2: binding.gamepad,
    };
  }
  try {
    ejs.saveSettings();
  } catch {
    /* persistence is best-effort inside the iframe */
  }

  const canvas = document.querySelector<HTMLCanvasElement>(".ejs_canvas") ?? ejs.canvas;
  if (canvas) {
    canvas.style.imageRendering = settings.filter === "pixelated" ? "pixelated" : "auto";
  }
}

/**
 * EmulatorJS only assigns a physical gamepad to player 1 when its own control
 * menu is opened (that is where `gamepadSelection` is initialised). The shell
 * hides that menu, so the assignment is done here instead.
 */
function syncGamepad(): void {
  const ejs = window.EJS_emulator;
  if (!ejs) return;

  const pads = navigator.getGamepads?.() ?? [];
  const connected = [...pads].filter((pad): pad is Gamepad => Boolean(pad));
  if (connected.length === 0) return;

  const selection = ejs.gamepadSelection ?? [];
  ejs.gamepadSelection = selection;
  for (let i = 0; i < 4; i += 1) selection[i] = selection[i] ?? "";
  if (!selection[0]) {
    const pad = connected[0];
    selection[0] = `${pad.id}_${pad.index}`;
  }
}

function captureScreenshot(): Promise<ScreenshotResult> {
  const ejs = instance();
  return new Promise((resolve, reject) => {
    try {
      // Capture the canvas while the core is still drawing: a paused WebGL
      // canvas has no drawable buffer and would produce a black image.
      ejs.screenshot((blob, extension) => {
        const reader = new FileReader();
        reader.onload = () =>
          resolve({ dataUrl: String(reader.result), extension: extension || "png" });
        reader.onerror = () => reject(new Error("Falha ao ler o screenshot."));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error("Falha ao capturar a tela."));
    }
  });
}

async function handleCommand(
  id: number,
  cmd: PlayerCommand,
  payload: unknown,
): Promise<void> {
  try {
    const result = await runCommand(cmd, payload);
    if (result && typeof result === "object" && "transfer" in result) {
      const { transfer, value } = result as { transfer: Transferable[]; value: unknown };
      post({ kind: "reply", id, ok: true, result: value }, transfer);
    } else {
      post({ kind: "reply", id, ok: true, result });
    }
  } catch (error) {
    post({
      kind: "reply",
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
}

async function runCommand(
  cmd: PlayerCommand,
  payload: unknown,
): Promise<unknown> {
  const ejs = instance();

  switch (cmd) {
    case "pause":
      ejs.pause();
      return null;
    case "resume":
      ejs.play();
      return null;
    case "restart":
      ejs.gameManager.restart();
      ejs.play();
      return null;
    case "flush":
      // Writes the cartridge SRAM into the IDBFS mount so progress survives
      // the iframe teardown (snes9x otherwise only flushes on exit).
      try {
        ejs.gameManager.saveSaveFiles();
      } catch {
        /* cores without battery-backed RAM have nothing to flush */
      }
      return null;
    case "fastForward": {
      // Not every libretro core exposes the fast-forward helper; report it so
      // the shell can hide the control instead of failing silently.
      const enabled = Boolean((payload as { enabled?: boolean } | undefined)?.enabled);
      const toggle = ejs.gameManager.toggleFastForward;
      if (typeof toggle !== "function") return { supported: false, enabled: false };
      try {
        ejs.gameManager.toggleFastForward?.(enabled);
        return { supported: true, enabled };
      } catch {
        return { supported: false, enabled: false };
      }
    }
    case "saveState": {
      const raw = ejs.gameManager.getState();
      const bytes = raw instanceof Uint8Array ? new Uint8Array(raw) : new Uint8Array(raw);
      let thumbnail: string | null = null;
      try {
        thumbnail = (await captureScreenshot()).dataUrl;
      } catch {
        thumbnail = null;
      }
      const value: SaveStateResult = { data: bytes.buffer, thumbnail };
      return { value, transfer: [bytes.buffer] };
    }
    case "loadState": {
      const data = (payload as { data: ArrayBuffer } | null)?.data;
      if (!data) throw new Error("Estado inválido.");
      ejs.gameManager.loadState(new Uint8Array(data));
      ejs.play();
      return null;
    }
    case "screenshot":
      return captureScreenshot();
    case "setVolume": {
      const volume = Number((payload as { volume?: number } | null)?.volume ?? 0.7);
      ejs.setVolume(Math.min(1, Math.max(0, volume)));
      if (settings) settings.volume = volume;
      return null;
    }
    case "setMuted": {
      const muted = Boolean((payload as { muted?: boolean } | null)?.muted);
      if (settings) settings.muted = muted;
      ejs.muted = muted;
      ejs.setVolume(muted ? 0 : (settings?.volume ?? 0.7));
      return null;
    }
    case "setFilter": {
      const filter = (payload as { filter?: string } | null)?.filter === "smooth" ? "smooth" : "pixelated";
      if (settings) settings.filter = filter;
      const canvas = document.querySelector<HTMLCanvasElement>(".ejs_canvas") ?? ejs.canvas;
      if (canvas) canvas.style.imageRendering = filter === "pixelated" ? "pixelated" : "auto";
      return null;
    }
    case "getControls": {
      const out: Record<number, ControlBinding> = {};
      const player = ejs.controls["0"] ?? {};
      for (const button of SNES_BUTTONS) {
        const entry = player[String(button.index)];
        if (!entry) continue;
        out[button.index] = {
          key: Number(entry.value ?? 0),
          gamepad: String(entry.value2 ?? ""),
        };
      }
      return out;
    }
    case "setControl": {
      const data = payload as { index: number; key: number; gamepad?: string } | null;
      if (!data) throw new Error("Binding inválido.");
      ejs.controls["0"] = ejs.controls["0"] ?? {};
      const previous = ejs.controls["0"][String(data.index)];
      ejs.controls["0"][String(data.index)] = {
        value: data.key,
        value2: data.gamepad ?? previous?.value2 ?? "",
      };
      ejs.saveSettings();
      return null;
    }
    case "resetControls": {
      const controls = (payload as { controls?: Record<number, ControlBinding> } | null)?.controls;
      if (controls) {
        for (const button of SNES_BUTTONS) {
          const binding = controls[button.index];
          if (!binding) continue;
          ejs.controls["0"] = ejs.controls["0"] ?? {};
          ejs.controls["0"][String(button.index)] = {
            value: binding.key,
            value2: binding.gamepad,
          };
        }
      }
      ejs.saveSettings();
      return null;
    }
    case "toggleFullscreen":
      ejs.toggleFullscreen(true);
      return null;
    case "status": {
      const status: StatusResult = { started, paused: Boolean(ejs.paused) };
      return status;
    }
    default:
      throw new Error(`Comando desconhecido: ${String(cmd)}`);
  }
}
