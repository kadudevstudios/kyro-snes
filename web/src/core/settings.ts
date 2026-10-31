import { cloneDefaults, DEFAULT_CONTROLS, type ControlBinding } from "./controls";

export type ScaleMode = "fit" | "integer";
export type FilterMode = "pixelated" | "smooth";
/** SNES output on a TV is 4:3; the raw framebuffer is 8:7 (square pixels). */
export type AspectMode = "4:3" | "8:7";

/** Milliseconds; 0 keeps the HUD on screen. */
export const HUD_DELAYS = [0, 1500, 2600, 4000] as const;
/** Seconds between cartridge SRAM flushes; 0 disables the timer. */
export const AUTOSAVE_INTERVALS = [0, 30, 60, 120] as const;

export interface Settings {
  volume: number;
  muted: boolean;
  scale: ScaleMode;
  aspect: AspectMode;
  filter: FilterMode;
  scanlines: boolean;
  pauseOnBlur: boolean;
  confirmExit: boolean;
  showHints: boolean;
  hudAutoHide: number;
  sramAutosave: number;
  controls: Record<number, ControlBinding>;
}

const STORAGE_KEY = "kyro-snes-settings-v1";

export function defaultSettings(): Settings {
  return {
    volume: 0.7,
    muted: false,
    scale: "integer",
    aspect: "8:7",
    filter: "pixelated",
    scanlines: false,
    pauseOnBlur: true,
    confirmExit: true,
    showHints: true,
    hudAutoHide: 2600,
    sramAutosave: 60,
    controls: cloneDefaults(),
  };
}

function sanitizeControls(raw: unknown): Record<number, ControlBinding> {
  const base = cloneDefaults();
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Record<string, Partial<ControlBinding>>;
  for (const key of Object.keys(DEFAULT_CONTROLS)) {
    const candidate = source[key];
    if (!candidate) continue;
    const keyCode = Number(candidate.key);
    const gamepad = String(candidate.gamepad ?? DEFAULT_CONTROLS[Number(key)].gamepad);
    if (Number.isFinite(keyCode) && keyCode > 0) {
      base[Number(key)] = { key: keyCode, gamepad };
    }
  }
  return base;
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function pickNumber(value: unknown, allowed: readonly number[], fallback: number): number {
  const numeric = Number(value);
  return allowed.includes(numeric) ? numeric : fallback;
}

/**
 * Coerces anything (localStorage, an imported JSON file, a stale schema) into a
 * complete, valid Settings object. Unknown fields are dropped and every value
 * is clamped, so a malformed import can never break the app.
 */
export function normalizeSettings(raw: unknown): Settings {
  const defaults = defaultSettings();
  if (!raw || typeof raw !== "object") return defaults;
  const parsed = raw as Partial<Settings>;

  return {
    volume: clamp01(Number(parsed.volume ?? defaults.volume)),
    muted: Boolean(parsed.muted ?? defaults.muted),
    scale: pick(parsed.scale, ["integer", "fit"] as const, defaults.scale),
    aspect: pick(parsed.aspect, ["4:3", "8:7"] as const, defaults.aspect),
    filter: pick(parsed.filter, ["pixelated", "smooth"] as const, defaults.filter),
    scanlines: Boolean(parsed.scanlines ?? defaults.scanlines),
    pauseOnBlur: Boolean(parsed.pauseOnBlur ?? defaults.pauseOnBlur),
    confirmExit: Boolean(parsed.confirmExit ?? defaults.confirmExit),
    showHints: Boolean(parsed.showHints ?? defaults.showHints),
    hudAutoHide: pickNumber(parsed.hudAutoHide, HUD_DELAYS, defaults.hudAutoHide),
    sramAutosave: pickNumber(parsed.sramAutosave, AUTOSAVE_INTERVALS, defaults.sramAutosave),
    controls: sanitizeControls(parsed.controls),
  };
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings();
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or disabled: settings stay in memory for this session */
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
