import { crc32, inflateRawSync } from 'node:zlib';

import { SheetFormatError } from './Sheet';

export type ZipLimits = Record<
  'maxEntries' | 'maxEntryBytes' | 'maxTotalBytes',
  number
>;

export type ZipEntryReader = {
  /** The entry's bytes, or null when the archive has no entry of that name. */
  read: (name: string) => Buffer | null;
};

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;
const END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const MAX_COMMENT_SIZE = 0xffff;
const ZIP64_MARKER = 0xffffffff;
const ENCRYPTED_FLAG = 0x1;
const STORED = 0;
const DEFLATED = 8;

type CentralEntry = Record<
  'flags' | 'method' | 'crc' | 'compressedSize' | 'size' | 'offset',
  number
>;

const malformed = (message: string) =>
  new SheetFormatError('malformed', message);

const findEndOfCentralDirectory = (bytes: Buffer) => {
  const lowest = Math.max(
    0,
    bytes.length - END_OF_CENTRAL_DIRECTORY_SIZE - MAX_COMMENT_SIZE
  );

  for (
    let offset = bytes.length - END_OF_CENTRAL_DIRECTORY_SIZE;
    offset >= lowest;
    offset -= 1
  )
    if (bytes.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) return offset;

  throw malformed('The archive has no central directory');
};

const requireWithin = (bytes: Buffer, offset: number, length: number) => {
  if (offset < 0 || length < 0 || offset + length > bytes.length)
    throw malformed('The archive points outside itself');
};

/**
 * Reads only what the central directory declares, so a local header cannot
 * point at another entry's bytes unnoticed: every entry is inflated against its
 * declared size, under the per-entry and total budgets, and checked against its
 * CRC. Encrypted entries, ZIP64 archives and methods other than stored and
 * deflate are refused; none of them is written by a spreadsheet application
 * for a file this small.
 */
export const openZipArchive = (
  bytes: Buffer,
  { maxEntries, maxEntryBytes, maxTotalBytes }: ZipLimits
): ZipEntryReader => {
  if (bytes.length < END_OF_CENTRAL_DIRECTORY_SIZE)
    throw malformed('The archive is truncated');

  const end = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(end + 10);
  const directorySize = bytes.readUInt32LE(end + 12);
  const directoryOffset = bytes.readUInt32LE(end + 16);

  if (directorySize === ZIP64_MARKER || directoryOffset === ZIP64_MARKER)
    throw malformed('ZIP64 archives are not supported');

  if (entryCount > maxEntries)
    throw new SheetFormatError('too-large', 'The archive has too many entries');

  requireWithin(bytes, directoryOffset, directorySize);

  const entries = new Map<string, CentralEntry>();
  let cursor = directoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    requireWithin(bytes, cursor, 46);

    if (bytes.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_ENTRY)
      throw malformed('The central directory is corrupt');

    const nameLength = bytes.readUInt16LE(cursor + 28);
    const extraLength = bytes.readUInt16LE(cursor + 30);
    const commentLength = bytes.readUInt16LE(cursor + 32);

    requireWithin(bytes, cursor + 46, nameLength);

    entries.set(bytes.toString('utf8', cursor + 46, cursor + 46 + nameLength), {
      flags: bytes.readUInt16LE(cursor + 8),
      method: bytes.readUInt16LE(cursor + 10),
      crc: bytes.readUInt32LE(cursor + 16),
      compressedSize: bytes.readUInt32LE(cursor + 20),
      size: bytes.readUInt32LE(cursor + 24),
      offset: bytes.readUInt32LE(cursor + 42)
    });
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  let extractedBytes = 0;

  const read = (name: string) => {
    const entry = entries.get(name);

    if (entry === undefined) return null;

    const { flags, method, crc, compressedSize, size, offset } = entry;

    if (flags & ENCRYPTED_FLAG)
      throw malformed('Encrypted archives are not supported');

    if (size > maxEntryBytes || extractedBytes + size > maxTotalBytes)
      throw new SheetFormatError(
        'too-large',
        'The archive expands beyond the size limit'
      );

    requireWithin(bytes, offset, 30);

    if (bytes.readUInt32LE(offset) !== LOCAL_FILE_HEADER)
      throw malformed('A local file header is corrupt');

    const dataOffset =
      offset +
      30 +
      bytes.readUInt16LE(offset + 26) +
      bytes.readUInt16LE(offset + 28);

    requireWithin(bytes, dataOffset, compressedSize);

    const data = bytes.subarray(dataOffset, dataOffset + compressedSize);
    let content: Buffer;

    if (method === STORED) content = data;
    else if (method === DEFLATED)
      try {
        content = inflateRawSync(data, { maxOutputLength: Math.max(size, 1) });
      } catch {
        throw malformed('An entry does not inflate to its size');
      }
    else throw malformed('The compression method is not supported');

    if (content.length !== size || crc32(content) !== crc)
      throw malformed('An entry does not match its checksum');

    extractedBytes += size;

    return content;
  };

  return { read };
};
