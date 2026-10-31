/** Message contract between the app shell and the emulator iframe. */

import type { ControlBinding } from "../core/controls";
import type { FilterMode } from "../core/settings";

export interface PlayerSettings {
  volume: number;
  muted: boolean;
  filter: FilterMode;
  controls: Record<number, ControlBinding>;
}

export type PlayerCommand =
  | "pause"
  | "resume"
  | "restart"
  | "flush"
  | "saveState"
  | "loadState"
  | "screenshot"
  | "setVolume"
  | "setMuted"
  | "setFilter"
  | "getControls"
  | "setControl"
  | "resetControls"
  | "toggleFullscreen"
  | "fastForward"
  | "status";

export type MainMessage =
  | {
      kind: "init";
      rom: ArrayBuffer;
      gameId: string;
      gameName: string;
      settings: PlayerSettings;
    }
  | { kind: "cmd"; id: number; cmd: PlayerCommand; payload?: unknown };

export type PlayerMessage =
  | { kind: "ready" }
  | { kind: "started" }
  | { kind: "progress"; text: string }
  | { kind: "error"; message: string }
  | { kind: "reply"; id: number; ok: boolean; result?: unknown; error?: string };

export interface SaveStateResult {
  data: ArrayBuffer;
  thumbnail: string | null;
}

export interface ScreenshotResult {
  dataUrl: string;
  extension: string;
}

export interface StatusResult {
  started: boolean;
  paused: boolean;
}
