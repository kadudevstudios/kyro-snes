import type { App } from "./app";
import type { ControlBinding } from "../core/controls";
import {
  DEFAULT_CONTROLS,
  SNES_BUTTONS,
  cloneDefaults,
  gamepadButtonLabel,
  gamepadLabel,
  keyLabel,
} from "../core/controls";
import { h } from "./dom";
import { openModal } from "./modal";

export interface ControlsTableOptions {
  onChange?: (index: number, binding: ControlBinding) => void;
  onReset?: () => void;
}

export function renderControlsTable(app: App, options: ControlsTableOptions = {}): HTMLElement {
  const wrapper = h("div", { class: "controls" });

  for (const button of SNES_BUTTONS) {
    const binding = app.settings.controls[button.index] ?? DEFAULT_CONTROLS[button.index];

    const keyChip = h("button", {
      class: "key-chip",
      attrs: { type: "button", title: "Clique para redefinir a tecla" },
      text: keyLabel(binding.key),
    });

    const padChip = h("button", {
      class: "key-chip key-chip--pad",
      attrs: { type: "button", title: "Clique para redefinir o botão do controle" },
      text: gamepadLabel(binding.gamepad),
    });

    keyChip.addEventListener("click", async () => {
      const code = await captureKey(button.label);
      if (code === null) return;
      const next: ControlBinding = { ...app.settings.controls[button.index], key: code };
      app.updateSettings({ controls: { ...app.settings.controls, [button.index]: next } });
      keyChip.textContent = keyLabel(code);
      options.onChange?.(button.index, next);
    });

    padChip.addEventListener("click", async () => {
      const label = await captureGamepad(button.label);
      if (!label) return;
      const next: ControlBinding = { ...app.settings.controls[button.index], gamepad: label };
      app.updateSettings({ controls: { ...app.settings.controls, [button.index]: next } });
      padChip.textContent = gamepadLabel(label);
      options.onChange?.(button.index, next);
    });

    wrapper.append(
      h(
        "div",
        { class: "control-row" },
        h(
          "div",
          { class: "control-row__label" },
          h("span", { class: "control-row__name", text: button.label }),
          h("span", { class: "control-row__hint", text: button.hint }),
        ),
        h("div", { class: "control-row__binds" }, keyChip, padChip),
      ),
    );
  }

  const reset = h(
    "button",
    {
      class: "btn btn--ghost",
      attrs: { type: "button" },
      on: {
        click: () => {
          const defaults = cloneDefaults();
          app.updateSettings({ controls: defaults });
          if (options.onReset) options.onReset();
          else app.refresh();
        },
      },
    },
    "Restaurar controles",
  );

  wrapper.append(h("div", { class: "controls__foot" }, reset));
  return wrapper;
}

function captureKey(buttonLabel: string): Promise<number | null> {
  return new Promise((resolve) => {
    let done = false;
    let close: () => void = () => undefined;

    const finish = (value: number | null): void => {
      if (done) return;
      done = true;
      window.removeEventListener("keydown", onKey, true);
      close();
      resolve(value);
    };

    const onKey = (event: KeyboardEvent): void => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        finish(null);
        return;
      }
      finish(event.keyCode);
    };

    close = openModal({
      title: "Definir tecla",
      subtitle: `Pressione a tecla para "${buttonLabel}". Esc cancela.`,
      body: h(
        "div",
        { class: "capture" },
        h("span", { class: "capture__pulse", attrs: { "aria-hidden": "true" } }),
        h("p", { text: "Aguardando tecla…" }),
      ),
      actions: [{ label: "Cancelar", kind: "ghost", onClick: () => finish(null) }],
      onClose: () => {
        if (!done) {
          done = true;
          window.removeEventListener("keydown", onKey, true);
          resolve(null);
        }
      },
    });

    window.addEventListener("keydown", onKey, true);
  });
}

function captureGamepad(buttonLabel: string): Promise<string | null> {
  return new Promise((resolve) => {
    let done = false;
    let raf = 0;
    let close: () => void = () => undefined;

    const finish = (value: string | null): void => {
      if (done) return;
      done = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey, true);
      close();
      resolve(value);
    };

    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      finish(null);
    };

    const poll = (): void => {
      const pads = navigator.getGamepads?.() ?? [];
      for (const pad of pads) {
        if (!pad) continue;
        for (let i = 0; i < pad.buttons.length; i += 1) {
          if (!pad.buttons[i]?.pressed) continue;
          const label = gamepadButtonLabel(i);
          if (label) {
            finish(label);
            return;
          }
        }
      }
      raf = requestAnimationFrame(poll);
    };

    close = openModal({
      title: "Definir botão do controle",
      subtitle: `Pressione um botão para "${buttonLabel}". Esc cancela.`,
      body: h(
        "div",
        { class: "capture" },
        h("span", { class: "capture__pulse", attrs: { "aria-hidden": "true" } }),
        h("p", { text: navigator.getGamepads?.().some(Boolean) ? "Aguardando botão…" : "Nenhum controle detectado. Conecte um e pressione um botão." }),
      ),
      actions: [{ label: "Cancelar", kind: "ghost", onClick: () => finish(null) }],
      onClose: () => {
        if (!done) {
          done = true;
          cancelAnimationFrame(raf);
          window.removeEventListener("keydown", onKey, true);
          resolve(null);
        }
      },
    });

    window.addEventListener("keydown", onKey, true);
    raf = requestAnimationFrame(poll);
  });
}
