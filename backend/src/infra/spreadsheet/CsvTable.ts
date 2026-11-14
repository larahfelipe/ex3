import {
  SheetFormatError,
  type Sheet,
  type SheetLimits,
  type SheetRow
} from './Sheet';

export type CsvDelimiter = ',' | ';' | '\t';

const DELIMITERS: ReadonlyArray<CsvDelimiter> = [';', ',', '\t'];
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const UTF16LE_BOM = Buffer.from([0xff, 0xfe]);

/**
 * UTF-8 when the bytes are valid UTF-8, Windows-1252 otherwise: the encoding a
 * Brazilian spreadsheet application saves a CSV in when it is not told
 * otherwise. Excel's "Unicode text" is UTF-16 with a byte order mark.
 */
const decodeText = (bytes: Buffer) => {
  if (bytes.subarray(0, 2).equals(UTF16LE_BOM))
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));

  const content = bytes.subarray(0, 3).equals(UTF8_BOM)
    ? bytes.subarray(3)
    : bytes;

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(content);
  } catch {
    return new TextDecoder('windows-1252').decode(content);
  }
};

const delimiterOf = (text: string): CsvDelimiter => {
  const counts = new Map<CsvDelimiter, number>(
    DELIMITERS.map((delimiter) => [delimiter, 0])
  );
  let isQuoted = false;

  for (const character of text) {
    if (character === '"') isQuoted = !isQuoted;
    else if (!isQuoted && (character === '\n' || character === '\r')) break;
    else if (!isQuoted && counts.has(character as CsvDelimiter))
      counts.set(
        character as CsvDelimiter,
        (counts.get(character as CsvDelimiter) ?? 0) + 1
      );
  }

  return DELIMITERS.reduce((best, delimiter) =>
    (counts.get(delimiter) ?? 0) > (counts.get(best) ?? 0) ? delimiter : best
  );
};

export const readCsvTable = (
  bytes: Buffer,
  { maxRows, maxColumns, maxCellLength }: SheetLimits
): Record<'sheet', Sheet> & Record<'delimiter', CsvDelimiter> => {
  const text = decodeText(bytes);

  if (text.includes('\u0000'))
    throw new SheetFormatError('unsupported', 'The file is not text');

  const delimiter = delimiterOf(text);
  const rows: Array<SheetRow> = [];
  let cells: SheetRow['cells'] = [];
  let field = '';
  let isQuoted = false;
  let hasField = false;

  const finishField = () => {
    if (field.length > maxCellLength)
      throw new SheetFormatError('too-large', 'A cell is too long');

    if (cells.length < maxColumns)
      cells.push(field.trim() === '' ? null : { kind: 'text', value: field });

    field = '';
    hasField = false;
  };

  const finishRow = () => {
    finishField();

    if (rows.length >= maxRows)
      throw new SheetFormatError('too-large', 'The sheet has too many rows');

    rows.push({ number: rows.length + 1, cells });
    cells = [];
  };

  for (let at = 0; at < text.length; at += 1) {
    const character = text[at];

    if (isQuoted) {
      if (character !== '"') field += character;
      else if (text[at + 1] === '"') {
        field += '"';
        at += 1;
      } else isQuoted = false;
    } else if (character === '"' && !hasField) {
      isQuoted = true;
      hasField = true;
    } else if (character === delimiter) finishField();
    else if (character === '\r' || character === '\n') {
      if (character === '\r' && text[at + 1] === '\n') at += 1;

      finishRow();
    } else {
      field += character;
      hasField = true;
    }
  }

  if (isQuoted)
    throw new SheetFormatError('malformed', 'A quoted field is never closed');

  if (hasField || cells.length > 0) finishRow();

  return { sheet: { name: '', rows }, delimiter };
};
