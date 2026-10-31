import { h } from "./dom";

type ToastKind = "info" | "success" | "error";

let root: HTMLElement | null = null;

/** Older toasts are dropped instead of piling up over the content. */
const MAX_VISIBLE = 3;

function ensureRoot(): HTMLElement {
  if (!root) {
    root = h("div", { class: "toasts", attrs: { role: "status", "aria-live": "polite" } });
    document.body.append(root);
  }
  return root;
}

export function toast(message: string, kind: ToastKind = "info", timeout = 4200): void {
  const container = ensureRoot();
  while (container.children.length >= MAX_VISIBLE) {
    container.firstElementChild?.remove();
  }
  const node = h(
    "div",
    { class: `toast toast--${kind}` },
    h("span", { class: "toast__dot" }),
    h("span", { class: "toast__text", text: message }),
  );
  container.append(node);
  requestAnimationFrame(() => node.classList.add("is-visible"));
  window.setTimeout(() => {
    node.classList.remove("is-visible");
    window.setTimeout(() => node.remove(), 220);
  }, timeout);
}
