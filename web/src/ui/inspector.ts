import type { App, ScreenResult } from "./app";
import type { RomRecord } from "../core/types";
import { formatBytes, hex } from "../core/rom";
import { confirmDialog } from "./modal";
import { toast } from "./toast";
import { formatDate, formatDuration, h, icon } from "./dom";

export function renderInspector(app: App, rom: RomRecord): ScreenResult {
  const section = h("section", { class: "screen screen--inspector" });
  const info = rom.info;
  const header = info.header;

  section.append(
    h(
      "div",
      { class: "page-head" },
      h(
        "button",
        {
          class: "btn btn--ghost",
          attrs: { type: "button" },
          on: { click: () => app.go("library") },
        },
        icon("back", 16),
        "Biblioteca",
      ),
      h(
        "div",
        { class: "page-head__actions" },
        h(
          "button",
          {
            class: "btn btn--ghost",
            attrs: { type: "button" },
            on: { click: () => exportReport(rom) },
          },
          icon("download", 16),
          "Exportar relatório",
        ),
        h(
          "button",
          {
            class: "btn btn--primary",
            attrs: { type: "button" },
            on: { click: () => app.go("play", rom.id) },
          },
          icon("play", 16),
          "Jogar",
        ),
      ),
    ),
  );

  section.append(
    h(
      "header",
      { class: "detail-head" },
      h("p", { class: "eyebrow", text: "Inspeção técnica" }),
      h("h1", { class: "detail-head__title", text: rom.title }),
      h(
        "p",
        { class: "detail-head__sub" },
        `${rom.fileName} · ${formatBytes(info.fileBytes)} · ${header.regionLabel}`,
      ),
    ),
  );

  const grid = h("div", { class: "detail-grid" });

  grid.append(
    card(
      "Cartucho",
      "cartridge",
      [
        row("Título interno", header.title),
        row("Região", `${header.regionLabel} (0x${hex(header.regionCode)})`),
        row("Mapeamento", `${header.mapping}${header.fastRom ? " · FastROM" : ""}`),
        row("Tipo", `${header.cartTypeLabel} (0x${hex(header.cartTypeByte)})`),
        row("ROM declarada", `${header.romSizeKb} KB`),
        row("SRAM", header.sramKb ? `${header.sramKb} KB` : "nenhuma"),
        row("Bateria", header.hasBattery ? "sim" : "não"),
        row("Revisão", `1.${header.version}`),
      ],
      "O header interno fica em 0x7FC0 do payload e descreve como o cartucho mapeia memória.",
    ),
  );

  grid.append(
    card(
      "Arquivo",
      "save",
      [
        row("Nome", rom.fileName),
        row("Tamanho do arquivo", formatBytes(info.fileBytes)),
        row("Payload", formatBytes(info.payloadBytes)),
        row("Header de copier", info.hasCopierHeader ? "presente (512 bytes)" : "ausente"),
        row("Bancos de 16 KB", String(info.banks.length)),
        row("Bytes distintos", `${info.distinctBytes} / 256`),
        row("Adicionada", formatDate(rom.addedAt)),
        row("Tempo de jogo", formatDuration(rom.playtimeMs)),
      ],
      info.hasCopierHeader
        ? "O header de 512 bytes foi descartado antes da leitura do cartucho."
        : "Nenhum header de copier foi encontrado.",
    ),
  );

  const checksumOk = header.checksumMatches;
  grid.append(
    card(
      "Integridade",
      "check",
      [
        row("Checksum interno", `0x${hex(header.checksum, 4)}`),
        row("Complemento", `0x${hex(header.checksumComplement, 4)}`),
        row("Par válido", header.checksumPairValid ? "sim" : "não"),
        row("Checksum calculado", `0x${hex(header.computedChecksum, 4)}`),
        row("Resultado", checksumOk ? "confere" : "divergente"),
        row("CRC-32", `0x${hex(info.crc32, 8)}`),
        row("SHA-256", info.sha256),
      ],
      checksumOk
        ? "O checksum declarado confere com a soma de bytes do payload."
        : "O checksum declarado não confere com a soma de bytes. Isso não impede a execução: o núcleo não valida esse campo.",
      checksumOk ? "ok" : "warn",
    ),
  );

  grid.append(entropyCard(info.banks));

  section.append(grid);

  const danger = h(
    "div",
    { class: "danger-zone" },
    h(
      "div",
      {},
      h("h3", { text: "Remover da biblioteca" }),
      h("p", { text: "Apaga a ROM e os save states deste dispositivo. O arquivo original não é tocado." }),
    ),
    h(
      "button",
      {
        class: "btn btn--danger",
        attrs: { type: "button" },
        on: {
          click: async () => {
            const ok = await confirmDialog(
              "Remover ROM",
              `Remover "${rom.title}" e todos os save states?`,
              "Remover",
              true,
            );
            if (ok) await app.removeRom(rom.id);
          },
        },
      },
      icon("trash", 16),
      "Remover",
    ),
  );
  section.append(danger);

  return { el: section };
}

function row(label: string, value: string, mono = false): HTMLElement {
  return h(
    "div",
    { class: "kv" },
    h("span", { class: "kv__k", text: label }),
    h("span", { class: `kv__v${mono ? " kv__v--mono" : ""}`, text: value }),
  );
}

function card(
  title: string,
  iconName: string,
  rows: HTMLElement[],
  note?: string,
  tone: "ok" | "warn" | null = null,
): HTMLElement {
  return h(
    "article",
    { class: "panel" },
    h(
      "div",
      { class: "panel__head" },
      h("span", { class: `panel__icon${tone ? ` panel__icon--${tone}` : ""}` }, icon(iconName, 18)),
      h("h2", { text: title }),
    ),
    h("div", { class: "panel__rows" }, ...rows),
    note ? h("p", { class: "panel__note", text: note }) : null,
  );
}

function entropyCard(banks: { bank: number; entropy: number }[]): HTMLElement {
  const chart = h("div", { class: "entropy" });
  for (const bank of banks) {
    const pct = Math.round((bank.entropy / 8) * 100);
    chart.append(
      h("div", {
        class: "entropy__bar",
        style: `--h:${pct}%`,
        attrs: {
          title: `Banco ${String(bank.bank).padStart(2, "0")} · ${bank.entropy.toFixed(2)} bits/byte`,
        },
      }),
    );
  }

  return h(
    "article",
    { class: "panel panel--wide" },
    h(
      "div",
      { class: "panel__head" },
      h("span", { class: "panel__icon" }, icon("chip", 18)),
      h("h2", { text: "Estrutura" }),
    ),
    h(
      "div",
      { class: "entropy__wrap" },
      chart,
      h(
        "div",
        { class: "entropy__legend" },
        h("span", { text: "0 bits/byte" }),
        h("span", { text: "entropia por banco de 16 KB" }),
        h("span", { text: "8 bits/byte" }),
      ),
    ),
    h("p", {
      class: "panel__note",
      text: "Bancos com entropia alta costumam conter código e gráficos comprimidos; bancos baixos tendem a ser tabelas, padding ou dados esparsos.",
    }),
  );
}

function exportReport(rom: RomRecord): void {
  const payload = {
    file: rom.fileName,
    title: rom.title,
    sha256: rom.info.sha256,
    crc32: `0x${hex(rom.info.crc32, 8)}`,
    sizeBytes: rom.info.fileBytes,
    payloadBytes: rom.info.payloadBytes,
    copierHeader: rom.info.hasCopierHeader,
    header: rom.info.header,
    banks: rom.info.banks,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = h("a", { attrs: { href: url, download: `${rom.title.replace(/\W+/g, "-")}-report.json` } });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast("Relatório exportado.", "success");
}
