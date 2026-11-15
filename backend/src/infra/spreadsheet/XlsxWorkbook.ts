import { plainDecimalOf } from './PlainDecimal';
import {
  SheetFormatError,
  type Sheet,
  type SheetCell,
  type SheetLimits,
  type SheetRow
} from './Sheet';
import { xmlEventsOf } from './XmlEvents';
import {
  openZipArchive,
  type ZipEntryReader,
  type ZipLimits
} from './ZipArchive';

const PACKAGE_RELATIONSHIPS_PATH = '_rels/.rels';
const DEFAULT_WORKBOOK_PATH = 'xl/workbook.xml';
const OFFICE_DOCUMENT_RELATIONSHIP = /\/officeDocument$/;
const WORKSHEET_RELATIONSHIP = /\/worksheet$/;
const SHARED_STRINGS_RELATIONSHIP = /\/sharedStrings$/;
const MAX_NUMBER_LENGTH = 64;

const malformed = (message: string) =>
  new SheetFormatError('malformed', message);

/** Spreadsheet applications write a character XML cannot hold, such as a carriage return, as `_xHHHH_`. */
const decodeEscapedCharacters = (text: string) =>
  text.includes('_x')
    ? text.replace(/_x([0-9a-f]{4})_/gi, (_, code: string) =>
        String.fromCharCode(Number.parseInt(code, 16))
      )
    : text;

const readXml = (archive: ZipEntryReader, path: string) => {
  const content = archive.read(path);

  return content === null ? null : content.toString('utf8');
};

const requireXml = (archive: ZipEntryReader, path: string) => {
  const xml = readXml(archive, path);

  if (xml === null) throw malformed(`The workbook has no ${path}`);

  return xml;
};

const directoryOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1);

const resolvePartPath = (fromDirectory: string, target: string) => {
  const segments: Array<string> = [];

  for (const segment of (target.startsWith('/')
    ? target.slice(1)
    : fromDirectory + target
  ).split('/'))
    if (segment === '..') segments.pop();
    else if (segment !== '.' && segment !== '') segments.push(segment);

  return segments.join('/');
};

const relationshipsOf = (xml: string | null) => {
  const relationships: Array<Record<'id' | 'type' | 'target', string>> = [];

  if (xml === null) return relationships;

  for (const event of xmlEventsOf(xml))
    if (event.kind === 'open' && event.name === 'Relationship') {
      const id = event.attributes.get('Id');
      const type = event.attributes.get('Type');
      const target = event.attributes.get('Target');

      if (
        id !== undefined &&
        type !== undefined &&
        target !== undefined &&
        event.attributes.get('TargetMode') !== 'External'
      )
        relationships.push({ id, type, target });
    }

  return relationships;
};

const relationshipsPathOf = (partPath: string) =>
  `${directoryOf(partPath)}_rels/${partPath.slice(partPath.lastIndexOf('/') + 1)}.rels`;

const sharedStringsOf = (xml: string | null) => {
  const strings: Array<string> = [];

  if (xml === null) return strings;

  let item: Array<string> | null = null;
  let phoneticDepth = 0;
  let isInText = false;

  for (const event of xmlEventsOf(xml))
    if (event.kind === 'open') {
      if (event.name === 'si')
        if (event.isEmpty) strings.push('');
        else item = [];
      else if (event.name === 'rPh' && !event.isEmpty) phoneticDepth += 1;
      else if (event.name === 't') isInText = !event.isEmpty;
    } else if (event.kind === 'close') {
      if (event.name === 'si' && item !== null) {
        strings.push(decodeEscapedCharacters(item.join('')));
        item = null;
      } else if (event.name === 'rPh')
        phoneticDepth = Math.max(0, phoneticDepth - 1);
      else if (event.name === 't') isInText = false;
    } else if (isInText && item !== null && phoneticDepth === 0)
      item.push(event.text);

  return strings;
};

const columnIndexOf = (reference: string | undefined) => {
  const letters =
    reference === undefined ? null : /^\$?([A-Z]{1,3})\$?\d+$/i.exec(reference);

  return letters
    ? [...letters[1].toUpperCase()].reduce(
        (index, letter) => index * 26 + letter.charCodeAt(0) - 64,
        0
      ) - 1
    : null;
};

type PendingCell = Record<'column', number> &
  Record<'type', string | undefined> &
  Record<'value' | 'inlineText', Array<string>>;

const cellOf = (
  { type, value, inlineText }: PendingCell,
  sharedStrings: ReadonlyArray<string>,
  maxCellLength: number
): SheetCell | null => {
  const text = (content: string): SheetCell | null => {
    if (content.length > maxCellLength)
      throw new SheetFormatError('too-large', 'A cell is too long');

    return content.trim() === '' ? null : { kind: 'text', value: content };
  };

  if (type === 'inlineStr')
    return text(decodeEscapedCharacters(inlineText.join('')));

  const stored = value.join('').trim();

  if (stored === '') return null;

  if (type === 's') {
    const sharedString = sharedStrings[Number(stored)];

    if (sharedString === undefined)
      throw malformed('A cell refers to a missing shared string');

    return text(sharedString);
  }

  if (type === 'str' || type === 'e' || type === 'd')
    return text(decodeEscapedCharacters(stored));

  if (type === 'b')
    return { kind: 'text', value: stored === '1' ? 'TRUE' : 'FALSE' };

  const number =
    stored.length <= MAX_NUMBER_LENGTH &&
    /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(stored)
      ? plainDecimalOf(Number(stored))
      : null;

  if (number === null) throw malformed('A numeric cell does not hold a number');

  return { kind: 'number', value: number };
};

const rowsOf = (
  xml: string,
  sharedStrings: ReadonlyArray<string>,
  { maxRows, maxColumns, maxCellLength }: SheetLimits
) => {
  const rows: Array<SheetRow> = [];
  let row: SheetRow | null = null;
  let cell: PendingCell | null = null;
  let collecting: Array<string> | null = null;
  let isInInlineString = false;
  let phoneticDepth = 0;

  const finishRow = (finished: SheetRow) => {
    if (rows.length >= maxRows)
      throw new SheetFormatError('too-large', 'The sheet has too many rows');

    rows.push({
      number: finished.number,
      cells: Array.from(finished.cells, (finishedCell) => finishedCell ?? null)
    });
  };

  for (const event of xmlEventsOf(xml))
    if (event.kind === 'open')
      switch (event.name) {
        case 'row': {
          const declared = Number(event.attributes.get('r'));
          const number =
            Number.isSafeInteger(declared) && declared > 0
              ? declared
              : (rows.at(-1)?.number ?? 0) + 1;

          row = { number, cells: [] };

          if (event.isEmpty) {
            finishRow(row);
            row = null;
          }

          break;
        }
        case 'c':
          if (row !== null && !event.isEmpty)
            cell = {
              column:
                columnIndexOf(event.attributes.get('r')) ?? row.cells.length,
              type: event.attributes.get('t'),
              value: [],
              inlineText: []
            };
          else if (row !== null && event.attributes.get('r') === undefined)
            row.cells.push(null);

          break;
        case 'v':
          if (cell !== null && !event.isEmpty) collecting = cell.value;

          break;
        case 'is':
          isInInlineString = !event.isEmpty;

          break;
        case 'rPh':
          if (!event.isEmpty) phoneticDepth += 1;

          break;
        case 't':
          if (
            cell !== null &&
            isInInlineString &&
            phoneticDepth === 0 &&
            !event.isEmpty
          )
            collecting = cell.inlineText;

          break;
      }
    else if (event.kind === 'close')
      switch (event.name) {
        case 'row':
          if (row !== null) finishRow(row);

          row = null;

          break;
        case 'c':
          if (row !== null && cell !== null && cell.column < maxColumns)
            row.cells[cell.column] = cellOf(cell, sharedStrings, maxCellLength);

          cell = null;

          break;
        case 'v':
        case 't':
          collecting = null;

          break;
        case 'is':
          isInInlineString = false;

          break;
        case 'rPh':
          phoneticDepth = Math.max(0, phoneticDepth - 1);

          break;
      }
    else collecting?.push(event.text);

  return rows;
};

export const readXlsxWorkbook = (
  bytes: Buffer,
  zipLimits: ZipLimits,
  sheetLimits: SheetLimits
): Record<'sheets', Array<Sheet>> & Record<'date1904', boolean> => {
  const archive = openZipArchive(bytes, zipLimits);
  const workbookPath = resolvePartPath(
    '',
    relationshipsOf(readXml(archive, PACKAGE_RELATIONSHIPS_PATH)).find(
      ({ type }) => OFFICE_DOCUMENT_RELATIONSHIP.test(type)
    )?.target ?? DEFAULT_WORKBOOK_PATH
  );
  const workbookDirectory = directoryOf(workbookPath);
  const workbook = requireXml(archive, workbookPath);
  const relationships = relationshipsOf(
    readXml(archive, relationshipsPathOf(workbookPath))
  );
  const sharedStringsTarget = relationships.find(({ type }) =>
    SHARED_STRINGS_RELATIONSHIP.test(type)
  )?.target;
  const sharedStrings = sharedStringsOf(
    sharedStringsTarget === undefined
      ? null
      : readXml(
          archive,
          resolvePartPath(workbookDirectory, sharedStringsTarget)
        )
  );
  const worksheetTargets = new Map(
    relationships
      .filter(({ type }) => WORKSHEET_RELATIONSHIP.test(type))
      .map(({ id, target }) => [id, target])
  );

  let date1904 = false;
  const declaredSheets: Array<Record<'name' | 'path', string>> = [];

  for (const event of xmlEventsOf(workbook))
    if (event.kind === 'open' && event.name === 'workbookPr')
      date1904 = ['1', 'true'].includes(event.attributes.get('date1904') ?? '');
    else if (event.kind === 'open' && event.name === 'sheet') {
      const name = event.attributes.get('name');
      const relationshipId = [...event.attributes].find(([attribute]) =>
        attribute.endsWith(':id')
      )?.[1];
      const target =
        relationshipId === undefined
          ? undefined
          : worksheetTargets.get(relationshipId);

      if (name !== undefined && target !== undefined)
        declaredSheets.push({
          name,
          path: resolvePartPath(workbookDirectory, target)
        });
    }

  if (declaredSheets.length > sheetLimits.maxSheets)
    throw new SheetFormatError('too-large', 'The workbook has too many sheets');

  const sheets = declaredSheets.flatMap(({ name, path }) => {
    const xml = readXml(archive, path);

    return xml === null
      ? []
      : [{ name, rows: rowsOf(xml, sharedStrings, sheetLimits) }];
  });

  return { sheets, date1904 };
};
