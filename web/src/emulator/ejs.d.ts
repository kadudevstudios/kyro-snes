/** Minimal typings for the parts of the EmulatorJS runtime we drive. */

export interface EmulatorControls {
  [player: string]: {
    [button: string]: { value?: number | string; value2?: string };
  };
}

export interface EmulatorJSInstance {
  on(event: string, cb: (...args: unknown[]) => void): void;
  play(): void;
  pause(): void;
  setVolume(volume: number): void;
  toggleFullscreen(enabled: boolean): void;
  /**
   * "retroarch" asks the core for a PNG written by the emulator itself; the
   * default ("canvas") reads a WebGL buffer that is empty unless the capture
   * happens inside the draw call, which yields black frames.
   */
  screenshot(
    cb: (blob: Blob, extension: string) => void,
    source?: "retroarch" | "canvas",
  ): void;
  saveSettings(): void;
  controls: EmulatorControls;
  canvas: HTMLCanvasElement;
  elements: { parent: HTMLElement };
  gameManager: {
    getState(): Uint8Array | ArrayBuffer;
    loadState(state: Uint8Array): void;
    restart(): void;
    /** Flushes cartridge SRAM to the mounted IDBFS directory. */
    saveSaveFiles(): void;
    /** Present on most libretro cores; absent on some builds. */
    toggleFastForward?(enabled: boolean): void;
  };
  /** EmulatorJS only fills this when its own control menu is opened. */
  gamepadSelection?: string[];
  gamepad?: { gamepads: (Gamepad | undefined)[] };
  started: boolean;
  paused: boolean;
  muted: boolean;
  volume: number;
}

declare global {
  interface Window {
    EJS_player?: string;
    EJS_core?: string;
    EJS_gameUrl?: string;
    EJS_gameName?: string;
    EJS_gameID?: string;
    EJS_pathtodata?: string;
    EJS_startOnLoaded?: boolean;
    EJS_startButtonName?: string;
    EJS_language?: string;
    EJS_disableAutoLang?: boolean;
    EJS_volume?: number;
    EJS_backgroundColor?: string;
    EJS_alignStartButton?: string;
    EJS_defaultControls?: unknown;
    EJS_threads?: boolean;
    EJS_ready?: () => void;
    EJS_onGameStart?: () => void;
    EJS_emulator?: EmulatorJSInstance;
  }
}

export {};
