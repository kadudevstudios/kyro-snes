import { h, icon } from "./dom";

export interface ModalAction {
  label: string;
  kind?: "primary" | "ghost" | "danger";
  onClick?: () => void | Promise<void>;
  close?: boolean;
}

export interface ModalOptions {
  title: string;
  subtitle?: string;
  body?: Node;
  actions?: ModalAction[];
  width?: number;
  onClose?: () => void;
}

// Modals can stack: a confirmation dialog is opened on top of a slot list, and
// the list must survive so its UI can refresh afterwards.
const stack: Array<{ close: () => void }> = [];

export function closeModal(): void {
  stack[stack.length - 1]?.close();
}

export function openModal(options: ModalOptions): () => void {
  const overlay = h("div", { class: "modal-overlay" });
  const dialog = h("div", {
    class: "modal",
    attrs: { role: "dialog", "aria-modal": "true", "aria-label": options.title },
    style: options.width ? `max-width:${options.width}px` : undefined,
  });

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    const index = stack.findIndex((item) => item.close === close);
    if (index >= 0) stack.splice(index, 1);
    overlay.classList.remove("is-open");
    window.removeEventListener("keydown", onKey);
    window.setTimeout(() => overlay.remove(), 180);
    options.onClose?.();
  };

  const onKey = (event: KeyboardEvent): void => {
    // Only the top-most dialog owns Escape.
    if (stack[stack.length - 1]?.close !== close) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  const header = h(
    "div",
    { class: "modal__header" },
    h(
      "div",
      {},
      h("h2", { class: "modal__title", text: options.title }),
      options.subtitle ? h("p", { class: "modal__subtitle", text: options.subtitle }) : null,
    ),
    h(
      "button",
      {
        class: "icon-btn",
        attrs: { type: "button", "aria-label": "Fechar" },
        on: { click: close },
      },
      icon("close"),
    ),
  );

  const body = h("div", { class: "modal__body" });
  if (options.body) body.append(options.body);

  const footer = h("div", { class: "modal__footer" });
  for (const action of options.actions ?? []) {
    const button = h(
      "button",
      {
        class: `btn ${action.kind === "primary" ? "btn--primary" : action.kind === "danger" ? "btn--danger" : "btn--ghost"}`,
        attrs: { type: "button" },
        on: {
          click: async () => {
            // Run the action before closing: confirmDialog settles on click,
            // and closing first would fire onClose ("cancel") ahead of it.
            try {
              await action.onClick?.();
            } finally {
              if (action.close !== false) close();
            }
          },
        },
      },
      action.label,
    );
    footer.append(button);
  }

  dialog.append(header, body, footer);
  overlay.append(dialog);
  overlay.addEventListener("mousedown", (event) => {
    if (event.target === overlay) close();
  });
  document.body.append(overlay);
  window.addEventListener("keydown", onKey);
  requestAnimationFrame(() => overlay.classList.add("is-open"));

  stack.push({ close });
  return close;
}

export function confirmDialog(
  title: string,
  message: string,
  confirmLabel = "Confirmar",
  danger = false,
): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: boolean): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    openModal({
      title,
      body: h("p", { class: "modal__text", text: message }),
      actions: [
        { label: "Cancelar", kind: "ghost", onClick: () => finish(false) },
        {
          label: confirmLabel,
          kind: danger ? "danger" : "primary",
          onClick: () => finish(true),
        },
      ],
      onClose: () => finish(false),
    });
  });
}
