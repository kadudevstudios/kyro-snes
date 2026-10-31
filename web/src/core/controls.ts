/**
 * Keyboard / gamepad bindings for the 12 SNES buttons, using the RetroArch
 * button order understood by the emulator core.
 */

export interface ControlBinding {
  /** KeyboardEvent.keyCode */
  key: number;
  /** EmulatorJS gamepad label, e.g. "BUTTON_2" or "DPAD_UP". */
  gamepad: string;
}

export interface SnesButton {
  index: number;
  id: string;
  label: string;
  hint: string;
}

export const SNES_BUTTONS: SnesButton[] = [
  { index: 0, id: "b", label: "B", hint: "Face inferior" },
  { index: 1, id: "y", label: "Y", hint: "Face esquerda" },
  { index: 2, id: "select", label: "Select", hint: "Selecionar" },
  { index: 3, id: "start", label: "Start", hint: "Iniciar / pausar" },
  { index: 4, id: "up", label: "↑", hint: "Direcional" },
  { index: 5, id: "down", label: "↓", hint: "Direcional" },
  { index: 6, id: "left", label: "←", hint: "Direcional" },
  { index: 7, id: "right", label: "→", hint: "Direcional" },
  { index: 8, id: "a", label: "A", hint: "Face direita" },
  { index: 9, id: "x", label: "X", hint: "Face superior" },
  { index: 10, id: "l", label: "L", hint: "Ombro esquerdo" },
  { index: 11, id: "r", label: "R", hint: "Ombro direito" },
];

export const DEFAULT_CONTROLS: Record<number, ControlBinding> = {
  0: { key: 90, gamepad: "BUTTON_2" }, // Z -> B
  1: { key: 65, gamepad: "BUTTON_4" }, // A -> Y
  2: { key: 9, gamepad: "SELECT" }, // Tab -> Select
  3: { key: 13, gamepad: "START" }, // Enter -> Start
  4: { key: 38, gamepad: "DPAD_UP" },
  5: { key: 40, gamepad: "DPAD_DOWN" },
  6: { key: 37, gamepad: "DPAD_LEFT" },
  7: { key: 39, gamepad: "DPAD_RIGHT" },
  8: { key: 88, gamepad: "BUTTON_1" }, // X -> A
  9: { key: 83, gamepad: "BUTTON_3" }, // S -> X
  10: { key: 81, gamepad: "LEFT_TOP_SHOULDER" }, // Q -> L
  11: { key: 87, gamepad: "RIGHT_TOP_SHOULDER" }, // W -> R
};

const KEY_LABELS: Record<number, string> = {
  8: "Backspace",
  9: "Tab",
  13: "Enter",
  16: "Shift",
  17: "Ctrl",
  18: "Alt",
  19: "Pause",
  20: "Caps Lock",
  27: "Esc",
  32: "Espaço",
  33: "Page Up",
  34: "Page Down",
  35: "End",
  36: "Home",
  37: "←",
  38: "↑",
  39: "→",
  40: "↓",
  45: "Insert",
  46: "Delete",
  186: ";",
  187: "=",
  188: ",",
  189: "-",
  190: ".",
  191: "/",
  192: "`",
  219: "[",
  220: "\\",
  221: "]",
  222: "'",
};

export function keyLabel(code: number): string {
  if (KEY_LABELS[code]) return KEY_LABELS[code];
  if (code >= 48 && code <= 57) return String.fromCharCode(code);
  if (code >= 65 && code <= 90) return String.fromCharCode(code);
  if (code >= 96 && code <= 105) return `Num ${code - 96}`;
  if (code >= 112 && code <= 123) return `F${code - 111}`;
  return `Tecla ${code}`;
}

const GAMEPAD_LABELS: Record<string, string> = {
  BUTTON_1: "Botão 1 (A)",
  BUTTON_2: "Botão 2 (B)",
  BUTTON_3: "Botão 3 (X)",
  BUTTON_4: "Botão 4 (Y)",
  LEFT_TOP_SHOULDER: "LB",
  RIGHT_TOP_SHOULDER: "RB",
  LEFT_BOTTOM_SHOULDER: "LT",
  RIGHT_BOTTOM_SHOULDER: "RT",
  SELECT: "Select / Back",
  START: "Start",
  LEFT_STICK: "Stick L",
  RIGHT_STICK: "Stick R",
  DPAD_UP: "D-pad ↑",
  DPAD_DOWN: "D-pad ↓",
  DPAD_LEFT: "D-pad ←",
  DPAD_RIGHT: "D-pad →",
};

export function gamepadLabel(value: string): string {
  return GAMEPAD_LABELS[value] ?? value;
}

/** Maps a standard-mapping gamepad button index to an EmulatorJS label. */
export function gamepadButtonLabel(index: number): string | null {
  const table: Record<number, string> = {
    0: "BUTTON_1",
    1: "BUTTON_2",
    2: "BUTTON_3",
    3: "BUTTON_4",
    4: "LEFT_TOP_SHOULDER",
    5: "RIGHT_TOP_SHOULDER",
    6: "LEFT_BOTTOM_SHOULDER",
    7: "RIGHT_BOTTOM_SHOULDER",
    8: "SELECT",
    9: "START",
    10: "LEFT_STICK",
    11: "RIGHT_STICK",
    12: "DPAD_UP",
    13: "DPAD_DOWN",
    14: "DPAD_LEFT",
    15: "DPAD_RIGHT",
  };
  return table[index] ?? null;
}

export function cloneDefaults(): Record<number, ControlBinding> {
  return JSON.parse(JSON.stringify(DEFAULT_CONTROLS)) as Record<number, ControlBinding>;
}

/** Converts our bindings to the object shape EmulatorJS expects. */
export function toEmulatorControls(
  controls: Record<number, ControlBinding>,
): Record<string, Record<string, { value: number; value2: string }>> {
  // EmulatorJS always expects four player slots, even for a single-player core.
  const out: Record<string, Record<string, { value: number; value2: string }>> = {
    0: {},
    1: {},
    2: {},
    3: {},
  };
  for (const button of SNES_BUTTONS) {
    const binding = controls[button.index];
    if (!binding) continue;
    out[0][String(button.index)] = { value: binding.key, value2: binding.gamepad };
  }
  return out;
}
