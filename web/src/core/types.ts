import type { ParsedRom } from "./rom";

export interface RomRecord {
  /** SHA-256 of the original file; stable identity across sessions. */
  id: string;
  fileName: string;
  title: string;
  /** Raw file bytes, copier header included. */
  data: ArrayBuffer;
  info: ParsedRom;
  addedAt: number;
  lastPlayedAt: number | null;
  playtimeMs: number;
}

export interface SaveStateRecord {
  /** `${romId}:${slot}` */
  id: string;
  romId: string;
  slot: number;
  data: ArrayBuffer;
  thumbnail: string | null;
  createdAt: number;
}

export interface LibraryStats {
  romCount: number;
  totalBytes: number;
}
