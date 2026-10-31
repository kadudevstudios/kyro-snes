import type { App, ScreenResult } from "./app";
import type { RomRecord } from "../core/types";
import { formatBytes } from "../core/rom";
import { coverHue, formatDuration, h, icon } from "./dom";

export function renderLibrary(app: App): ScreenResult {
  const section = h("section", { class: "screen screen--library" });

  const totalBytes = app.roms.reduce((sum, rom) => sum + rom.info.payloadBytes, 0);

  const hero = h(
    "div",
    { class: "hero" },
    h(
      "div",
      { class: "hero__copy" },
      h("p", { class: "eyebrow", text: "Biblioteca local" }),
      h("h1", { class: "hero__title", text: app.roms.length ? "Seus cartuchos" : "Comece importando uma ROM" }),
      h("p", {
        class: "hero__lead",
        text: app.roms.length
          ? `${app.roms.length} ${app.roms.length === 1 ? "jogo" : "jogos"} · ${formatBytes(totalBytes)} de dados. Tudo fica no seu dispositivo.`
          : "Arraste um arquivo .smc, .sfc ou .zip. A ROM é lida no navegador e guardada apenas no seu dispositivo.",
      }),
    ),
    h(
      "div",
      { class: "hero__stats" },
      statCard("ROMs", String(app.roms.length)),
      statCard("Dados", formatBytes(totalBytes)),
      statCard("Núcleo", "snes9x"),
    ),
  );

  section.append(hero);

  if (app.roms.length === 0) {
    section.append(emptyState(app));
    return { el: section };
  }

  const grid = h("div", { class: "rom-grid" });
  for (const rom of app.roms) grid.append(romCard(app, rom));
  section.append(grid);

  const footer = h(
    "div",
    { class: "library-foot" },
    h("p", {
      text: "As ROMs nunca saem deste dispositivo. Nada é enviado para servidores.",
    }),
    h(
      "button",
      {
        class: "btn btn--ghost",
        attrs: { type: "button" },
        on: { click: () => app.go("settings") },
      },
      icon("settings", 16),
      "Configurações",
    ),
  );
  section.append(footer);

  return { el: section };
}

function statCard(label: string, value: string): HTMLElement {
  return h(
    "div",
    { class: "stat" },
    h("span", { class: "stat__value", text: value }),
    h("span", { class: "stat__label", text: label }),
  );
}

function emptyState(app: App): HTMLElement {
  return h(
    "div",
    { class: "empty" },
    h("div", { class: "empty__icon" }, icon("cartridge", 40)),
    h("h2", { text: "Nenhuma ROM na biblioteca" }),
    h("p", {
      text: "Importe o arquivo do jogo para começar. Formatos aceitos: .smc, .sfc, .fig, .bin e .zip.",
    }),
    h(
      "button",
      {
        class: "btn btn--primary btn--lg",
        attrs: { type: "button" },
        on: { click: () => app.pickRom() },
      },
      icon("plus", 18),
      "Importar ROM",
    ),
    h("p", { class: "empty__hint", text: "Você também pode arrastar o arquivo para esta janela." }),
  );
}

function romCard(app: App, rom: RomRecord): HTMLElement {
  const hue = coverHue(rom.id);
  const header = rom.info.header;
  const playtime = formatDuration(rom.playtimeMs);

  const card = h("article", { class: "rom-card" });

  const cover = h("div", {
    class: "rom-card__cover",
    style: `--hue:${hue}`,
  });
  cover.append(
    h("div", { class: "rom-card__grid" }),
    h("span", { class: "rom-card__tag", text: header.mapping }),
    h("span", { class: "rom-card__title", text: rom.title }),
    h("span", { class: "rom-card__sub", text: `${header.regionLabel.split(" ")[0]} · ${formatBytes(rom.info.payloadBytes)}` }),
  );

  const playButton = h(
    "button",
    {
      class: "rom-card__play",
      attrs: { type: "button", "aria-label": `Jogar ${rom.title}` },
      on: { click: () => app.go("play", rom.id) },
    },
    icon("play", 20),
    h("span", { text: "Jogar" }),
  );

  const body = h(
    "div",
    { class: "rom-card__body" },
    h(
      "div",
      { class: "rom-card__meta" },
      h("span", { text: header.regionLabel }),
      h("span", { class: "dot", attrs: { "aria-hidden": "true" } }),
      h("span", { text: rom.fileName }),
    ),
    h(
      "div",
      { class: "rom-card__foot" },
      h("span", {
        class: "rom-card__playtime",
        text: rom.lastPlayedAt ? `Jogado ${playtime}` : "Ainda não jogado",
      }),
      h(
        "div",
        { class: "rom-card__tools" },
        h(
          "button",
          {
            class: "icon-btn",
            attrs: { type: "button", title: "Inspecionar ROM", "aria-label": "Inspecionar ROM" },
            on: { click: () => app.go("inspector", rom.id) },
          },
          icon("chip", 17),
        ),
      ),
    ),
  );

  card.append(cover, playButton, body);
  return card;
}
