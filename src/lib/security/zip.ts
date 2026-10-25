export type ZipInspection = { entries: string[]; compressedBytes: number; uncompressedBytes: number };

export function inspectZipArchive(buffer: Buffer, limits: { maxEntries: number; maxUncompressedBytes: number }): ZipInspection {
  const minimumEocd = 22;
  if (buffer.length < minimumEocd) throw new Error('Invalid ZIP container');
  const searchStart = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let offset = buffer.length - minimumEocd; offset >= searchStart; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('Invalid ZIP container');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralSize = buffer.readUInt32LE(eocd + 12);
  const centralOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) throw new Error('ZIP64 containers are not supported');
  if (entryCount > limits.maxEntries || centralOffset + centralSize > eocd) throw new Error('ZIP container exceeds safe limits');
  const entries: string[] = [];
  let compressedBytes = 0;
  let uncompressedBytes = 0;
  let offset = centralOffset;
  for (let index = 0; index < entryCount; index++) {
    if (offset + 46 > eocd || buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('Invalid ZIP directory');
    const flags = buffer.readUInt16LE(offset + 8);
    if ((flags & 0x1) !== 0) throw new Error('Encrypted ZIP entries are not supported');
    const compressed = buffer.readUInt32LE(offset + 20);
    const uncompressed = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) throw new Error('ZIP64 entries are not supported');
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > eocd) throw new Error('Invalid ZIP directory');
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString((flags & 0x800) !== 0 ? 'utf8' : 'latin1').replace(/\\/g, '/');
    if (!name || name.startsWith('/') || name.split('/').some((part) => part === '..')) throw new Error('Unsafe ZIP entry path');
    entries.push(name);
    compressedBytes += compressed;
    uncompressedBytes += uncompressed;
    if (uncompressedBytes > limits.maxUncompressedBytes) throw new Error('ZIP container expands beyond the safe limit');
    offset = next;
  }
  if (offset !== centralOffset + centralSize) throw new Error('Invalid ZIP directory size');
  return { entries, compressedBytes, uncompressedBytes };
}

export function containsOfficeMacros(entries: readonly string[]) {
  return entries.some((entry) => /(?:^|\/)vbaProject\.bin$/i.test(entry) || /^(?:xl\/macroSheets|xl\/dialogSheets|word\/activeX|ppt\/activeX)\//i.test(entry));
}
