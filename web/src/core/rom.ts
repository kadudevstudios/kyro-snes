/**
 * SNES ROM inspection.
 *
 * Pure, dependency-free parsing of the internal cartridge header plus a few
 * structural measurements. Everything here is read-only: the ROM bytes are
 * never modified, only measured.
 */

export type Mapping = "LoROM" | "HiROM";

export interface BankEntropy {
  bank: number;
  /** Shannon entropy in bits per byte (0..8). */
  entropy: number;
  /** Offset of the 16 KiB window inside the payload. */
  offset: number;
}

export interface RomHeaderInfo {
  title: string;
  mapping: Mapping;
  mapModeByte: number;
  fastRom: boolean;
  cartTypeByte: number;
  cartTypeLabel: string;
  romSizeKb: number;
  sramKb: number;
  hasBattery: boolean;
  regionCode: number;
  regionLabel: string;
  version: number;
  checksum: number;
  checksumComplement: number;
  checksumPairValid: boolean;
  computedChecksum: number;
  checksumMatches: boolean;
}

export interface ParsedRom {
  /** SHA-256 of the original file (including any copier header). */
  sha256: string;
  /** CRC-32 of the original file. */
  crc32: number;
  /** Size of the file as provided by the user. */
  fileBytes: number;
  /** Size of the ROM payload after stripping a copier header. */
  payloadBytes: number;
  hasCopierHeader: boolean;
  headerOffset: number;
  header: RomHeaderInfo;
  banks: BankEntropy[];
  /** Distinct byte values used across the payload. */
  distinctBytes: number;
  /** First 512 bytes of the copier header, as hex, when present. */
  copierHeaderHex: string | null;
}

const REGIONS: Record<number, string> = {
  0x00: "Japão (NTSC)",
  0x01: "EUA / Canadá (NTSC)",
  0x02: "Europa / Oceania / Ásia (PAL)",
  0x03: "Suécia (PAL)",
  0x04: "Finlândia (PAL)",
  0x05: "Dinamarca (PAL)",
  0x06: "França (PAL)",
  0x07: "Holanda (PAL)",
  0x08: "Espanha (PAL)",
  0x09: "Alemanha (PAL)",
  0x0a: "Itália (PAL)",
  0x0b: "China / Hong Kong (PAL)",
  0x0c: "Indonésia (PAL)",
  0x0d: "Coreia (NTSC)",
  0x0e: "Brasil (PAL-M)",
  0x0f: "Austrália (PAL)",
};

const CART_TYPES: Record<number, string> = {
  0x00: "ROM",
  0x01: "ROM + RAM",
  0x02: "ROM + RAM + bateria",
  0x03: "ROM + coprocessador",
  0x04: "ROM + coprocessador + RAM",
  0x05: "ROM + coprocessador + RAM + bateria",
  0x13: "ROM + SuperFX + RAM + bateria",
};

const HEADER_OFFSET = 0x7fc0;
const COPIER_HEADER_SIZE = 0x200;

/** Strip a 512-byte copier/SMC header when present. */
export function stripCopierHeader(bytes: Uint8Array): {
  payload: Uint8Array;
  stripped: boolean;
} {
  if (bytes.length > COPIER_HEADER_SIZE && bytes.length % 0x400 === 0x200) {
    return { payload: bytes.subarray(COPIER_HEADER_SIZE), stripped: true };
  }
  return { payload: bytes, stripped: false };
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    const c = bytes[offset + i];
    if (c === 0x00) break;
    out += c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : " ";
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Sum of every payload byte, excluding the 4 checksum bytes. */
export function computeChecksum(payload: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < payload.length; i += 1) {
    if (i >= 0x7fdc && i <= 0x7fdf) continue;
    sum += payload[i];
  }
  return sum & 0xffff;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function shannonEntropy(bytes: Uint8Array): number {
  const counts = new Uint32Array(256);
  for (let i = 0; i < bytes.length; i += 1) counts[bytes[i]] += 1;
  let entropy = 0;
  for (let i = 0; i < 256; i += 1) {
    if (!counts[i]) continue;
    const p = counts[i] / bytes.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

export function parseHeader(payload: Uint8Array): RomHeaderInfo {
  if (payload.length < HEADER_OFFSET + 0x20) {
    throw new Error("Arquivo pequeno demais para conter um header SNES.");
  }

  const mapModeByte = payload[HEADER_OFFSET + 0x15];
  const mapping: Mapping = mapModeByte & 0x01 ? "HiROM" : "LoROM";
  const cartTypeByte = payload[HEADER_OFFSET + 0x16];
  const romSizeByte = payload[HEADER_OFFSET + 0x17];
  const sramByte = payload[HEADER_OFFSET + 0x18];
  const regionCode = payload[HEADER_OFFSET + 0x19];
  const version = payload[HEADER_OFFSET + 0x1b];

  const checksum = payload[HEADER_OFFSET + 0x1c] | (payload[HEADER_OFFSET + 0x1d] << 8);
  const checksumComplement =
    payload[HEADER_OFFSET + 0x1e] | (payload[HEADER_OFFSET + 0x1f] << 8);
  const computedChecksum = computeChecksum(payload);

  return {
    title: readAscii(payload, HEADER_OFFSET, 21) || "(sem título)",
    mapping,
    mapModeByte,
    fastRom: (mapModeByte & 0x10) !== 0,
    cartTypeByte,
    cartTypeLabel: CART_TYPES[cartTypeByte] ?? `desconhecido (0x${cartTypeByte.toString(16)})`,
    romSizeKb: 1 << romSizeByte,
    sramKb: sramByte === 0 ? 0 : 1 << sramByte,
    hasBattery: cartTypeByte === 0x02 || cartTypeByte === 0x05 || cartTypeByte === 0x13,
    regionCode,
    regionLabel: REGIONS[regionCode] ?? `desconhecida (0x${regionCode.toString(16)})`,
    version,
    checksum,
    checksumComplement,
    checksumPairValid: (checksum ^ checksumComplement) === 0xffff,
    computedChecksum,
    checksumMatches: computedChecksum === checksum,
  };
}

export async function inspectRom(bytes: Uint8Array): Promise<ParsedRom> {
  const { payload, stripped } = stripCopierHeader(bytes);
  const header = parseHeader(payload);

  const banks: BankEntropy[] = [];
  for (let offset = 0; offset < payload.length; offset += 0x4000) {
    const chunk = payload.subarray(offset, Math.min(offset + 0x4000, payload.length));
    banks.push({ bank: offset / 0x4000, entropy: shannonEntropy(chunk), offset });
  }

  const seen = new Uint8Array(256);
  for (let i = 0; i < payload.length; i += 1) seen[payload[i]] = 1;
  let distinctBytes = 0;
  for (let i = 0; i < 256; i += 1) distinctBytes += seen[i];

  const copierHeaderHex = stripped
    ? [...bytes.subarray(0, 0x40)].map((b) => b.toString(16).padStart(2, "0")).join(" ")
    : null;

  return {
    sha256: await sha256Hex(bytes),
    crc32: crc32(bytes),
    fileBytes: bytes.length,
    payloadBytes: payload.length,
    hasCopierHeader: stripped,
    headerOffset: HEADER_OFFSET,
    header,
    banks,
    distinctBytes,
    copierHeaderHex,
  };
}

/** Human friendly byte count. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes % 1024 === 0 ? 0 : 1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function hex(value: number, width = 2): string {
  return value.toString(16).toUpperCase().padStart(width, "0");
}

/** A sane file name for exports (screenshots, states). */
export function slugify(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "rom"
  );
}
