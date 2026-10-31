/**
 * Minimal ZIP reader so the user can drop a `.zip` straight onto the app.
 * Supports stored (0) and deflate (8) entries, which covers every ROM archive
 * in practice.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const ROM_EXTENSIONS = /\.(smc|sfc|fig|bin|swc)$/i;

export interface ExtractedFile {
  name: string;
  data: ArrayBuffer;
}

function findEndOfCentralDirectory(view: DataView): number {
  const min = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) return offset;
  }
  return -1;
}

async function inflateRaw(data: Uint8Array): Promise<ArrayBuffer> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Este navegador não suporta descompactação ZIP.");
  }
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).arrayBuffer();
}

export async function extractRomFromZip(buffer: ArrayBuffer): Promise<ExtractedFile | null> {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  if (eocd < 0) return null;

  const entryCount = view.getUint16(eocd + 10, true);
  let pointer = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let i = 0; i < entryCount; i += 1) {
    if (pointer + 46 > view.byteLength) break;
    if (view.getUint32(pointer, true) !== CENTRAL_SIGNATURE) break;

    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localOffset = view.getUint32(pointer + 42, true);

    const nameBytes = new Uint8Array(buffer, pointer + 46, nameLength);
    const name = decoder.decode(nameBytes);

    if (ROM_EXTENSIONS.test(name) && !name.endsWith("/")) {
      const localNameLength = view.getUint16(localOffset + 26, true);
      const localExtraLength = view.getUint16(localOffset + 28, true);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const slice = new Uint8Array(buffer, dataStart, compressedSize);

      const data = method === 0 ? slice.slice().buffer : await inflateRaw(slice);
      return { name: name.split("/").pop() ?? name, data };
    }

    pointer += 46 + nameLength + extraLength + commentLength;
  }

  return null;
}
