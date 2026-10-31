import {
  idbDelete,
  idbGetAll,
  idbPut,
  STORE_ROMS,
  STORE_STATES,
} from "../core/db";
import { extractRomFromZip } from "../core/archive";
import { inspectRom } from "../core/rom";
import { loadSettings, saveSettings, type Settings } from "../core/settings";
import type { RomRecord, SaveStateRecord } from "../core/types";
import { h, icon } from "./dom";
import { renderLibrary } from "./library";
import { renderInspector } from "./inspector";
import { renderSettingsScreen } from "./settings";
import { renderPlayer } from "./player";
import { toast } from "./toast";

export interface ScreenResult {
  el: HTMLElement;
  cleanup?: () => void;
}

const ROM_HASH = /^#\/?([a-z-]+)(?:\/(.+))?$/;

export class App {
  readonly root: HTMLElement;
  settings: Settings;
  roms: RomRecord[] = [];

  private view!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private navButtons = new Map<string, HTMLButtonElement>();
  private activeCleanup: (() => void) | null = null;
  private dragDepth = 0;
  private dropOverlay!: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.settings = loadSettings();
  }

  async init(): Promise<void> {
    this.root.replaceChildren(this.buildShell());
    this.roms = await this.loadRoms();
    this.bindGlobalEvents();
    this.route();
  }

  private async loadRoms(): Promise<RomRecord[]> {
    try {
      const records = await idbGetAll<RomRecord>(STORE_ROMS);
      return records.sort((a, b) => (b.lastPlayedAt ?? b.addedAt) - (a.lastPlayedAt ?? a.addedAt));
    } catch (error) {
      console.error(error);
      toast("Não foi possível abrir a biblioteca local.", "error");
      return [];
    }
  }

  private buildShell(): HTMLElement {
    this.fileInput = h("input", {
      attrs: { type: "file", accept: ".smc,.sfc,.fig,.bin,.swc,.zip", hidden: true },
    });
    this.fileInput.addEventListener("change", () => {
      const files = this.fileInput.files;
      if (files && files.length) void this.importFiles([...files]);
      this.fileInput.value = "";
    });

    const brand = h(
      "button",
      {
        class: "brand",
        attrs: { type: "button", "aria-label": "Kyro — início" },
        on: { click: () => this.go("library") },
      },
      h("span", { class: "brand__mark", attrs: { "aria-hidden": "true" }, text: "K" }),
      h("span", { class: "brand__text", html: "Kyro <em>SNES</em>" }),
    );

    const nav = h("nav", { class: "nav", attrs: { "aria-label": "Principal" } });
    for (const [id, label] of [
      ["library", "Biblioteca"],
      ["settings", "Configurações"],
    ] as const) {
      const button = h("button", {
        class: "nav__link",
        attrs: { type: "button" },
        text: label,
        on: { click: () => this.go(id) },
      });
      this.navButtons.set(id, button);
      nav.append(button);
    }

    const importButton = h(
      "button",
      {
        class: "btn btn--primary",
        attrs: { type: "button" },
        on: { click: () => this.fileInput.click() },
      },
      icon("plus", 16),
      "Importar ROM",
    );

    const topbar = h(
      "header",
      { class: "topbar" },
      brand,
      nav,
      h(
        "div",
        { class: "topbar__actions" },
        h("span", { class: "pill pill--muted", text: "snes9x · wasm" }),
        importButton,
      ),
    );

    this.view = h("main", { class: "view", attrs: { id: "view" } });

    this.dropOverlay = h(
      "div",
      { class: "dropzone-overlay", attrs: { hidden: true } },
      h(
        "div",
        { class: "dropzone-overlay__inner" },
        icon("upload", 34),
        h("p", { text: "Solte a ROM para importar" }),
        h("span", { text: ".smc · .sfc · .zip" }),
      ),
    );

    return h("div", { class: "shell" }, topbar, this.view, this.dropOverlay, this.fileInput);
  }

  private bindGlobalEvents(): void {
    window.addEventListener("hashchange", () => this.route());

    window.addEventListener("dragenter", (event) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      this.dragDepth += 1;
      this.dropOverlay.hidden = false;
      requestAnimationFrame(() => this.dropOverlay.classList.add("is-visible"));
    });
    window.addEventListener("dragleave", () => {
      this.dragDepth = Math.max(0, this.dragDepth - 1);
      if (this.dragDepth === 0) this.hideDropOverlay();
    });
    window.addEventListener("dragover", (event) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    });
    window.addEventListener("drop", (event) => {
      event.preventDefault();
      this.dragDepth = 0;
      this.hideDropOverlay();
      const files = event.dataTransfer?.files;
      if (files && files.length) void this.importFiles([...files]);
    });
  }

  private hideDropOverlay(): void {
    this.dropOverlay.classList.remove("is-visible");
    window.setTimeout(() => {
      if (!this.dropOverlay.classList.contains("is-visible")) this.dropOverlay.hidden = true;
    }, 160);
  }

  /** Opens the native file picker (used by the empty state). */
  pickRom(): void {
    this.fileInput.click();
  }

  go(screen: string, param?: string): void {
    const target = `#/${screen}${param ? `/${param}` : ""}`;
    if (location.hash === target) {
      this.route();
      return;
    }
    location.hash = target;
  }

  route(): void {
    const match = ROM_HASH.exec(location.hash || "#/library");
    const screen = match?.[1] ?? "library";
    const param = match?.[2] ? decodeURIComponent(match[2]) : undefined;

    this.activeCleanup?.();
    this.activeCleanup = null;
    this.view.replaceChildren();

    for (const [id, button] of this.navButtons) {
      button.classList.toggle("is-active", id === screen);
    }
    document.body.classList.toggle("is-player", screen === "play");

    let result: ScreenResult;
    switch (screen) {
      case "play": {
        const rom = this.roms.find((item) => item.id === param);
        if (!rom) {
          this.go("library");
          return;
        }
        result = renderPlayer(this, rom);
        break;
      }
      case "inspector": {
        const rom = this.roms.find((item) => item.id === param);
        if (!rom) {
          this.go("library");
          return;
        }
        result = renderInspector(this, rom);
        break;
      }
      case "settings":
        result = renderSettingsScreen(this);
        break;
      default:
        result = renderLibrary(this);
        break;
    }

    this.view.append(result.el);
    this.activeCleanup = result.cleanup ?? null;
    this.view.scrollTop = 0;
    window.scrollTo({ top: 0 });
  }

  async importFiles(files: File[]): Promise<void> {    for (const file of files) {
      try {
        await this.importFile(file);
      } catch (error) {
        console.error(error);
        toast(error instanceof Error ? error.message : "Falha ao importar o arquivo.", "error");
      }
    }
  }

  private async importFile(file: File): Promise<void> {
    let name = file.name;
    let buffer = await file.arrayBuffer();

    if (/\.zip$/i.test(name)) {
      const extracted = await extractRomFromZip(buffer);
      if (!extracted) throw new Error(`Nenhuma ROM compatível dentro de "${file.name}".`);
      name = extracted.name;
      buffer = extracted.data;
    }

    if (buffer.byteLength < 0x8000 || buffer.byteLength > 16 * 1024 * 1024) {
      throw new Error(`"${name}" não parece ser uma ROM SNES válida.`);
    }

    const info = await inspectRom(new Uint8Array(buffer));
    if (this.roms.some((rom) => rom.id === info.sha256)) {
      toast("Esta ROM já está na biblioteca.", "info");
      this.go("library");
      return;
    }

    const record: RomRecord = {
      id: info.sha256,
      fileName: name,
      title: info.header.title,
      data: buffer,
      info,
      addedAt: Date.now(),
      lastPlayedAt: null,
      playtimeMs: 0,
    };

    await idbPut(STORE_ROMS, record);
    this.roms = [record, ...this.roms];
    toast(`"${record.title}" adicionada à biblioteca.`, "success");
    this.go("library");
  }

  async removeRom(id: string): Promise<void> {
    await idbDelete(STORE_ROMS, id);
    const states = await idbGetAll<SaveStateRecord>(STORE_STATES);
    for (const state of states) {
      if (state.romId === id) await idbDelete(STORE_STATES, state.id);
    }
    this.roms = this.roms.filter((rom) => rom.id !== id);
    toast("ROM removida.", "info");
    this.go("library");
  }

  async markPlayed(rom: RomRecord, elapsedMs: number): Promise<void> {
    rom.lastPlayedAt = Date.now();
    rom.playtimeMs += Math.max(0, elapsedMs);
    try {
      await idbPut(STORE_ROMS, rom);
    } catch (error) {
      console.error(error);
    }
  }

  updateSettings(patch: Partial<Settings>): void {
    this.settings = { ...this.settings, ...patch };
    saveSettings(this.settings);
  }

  refresh(): void {
    this.route();
  }
}
