import type { CalendarDay } from '@/domain/models';

import { IMPORT_FORMATS } from './ImportFormats';
import type {
  ImportedEntry,
  ImportFormat,
  ImportFormatId,
  MappedRow,
  MappingContext,
  SlashedDates,
  SourceRow
} from './ImportRecord';
import {
  isWithin,
  normalizeLabel,
  slashedDateOrderOf,
  textOf,
  tradeDaysOf,
  writtenDecimalSeparatorOf,
  type DecimalSeparator,
  type ImportCell
} from './ImportValues';

export type ImportSheet = Record<'name', string> &
  Record<
    'rows',
    ReadonlyArray<
      Record<'number', number> &
        Record<'cells', ReadonlyArray<ImportCell | null>>
    >
  >;

/**
 * The sheets of an uploaded file. `decimalSeparator` is the convention its
 * text numbers are written in when the layout does not fix one: a CSV
 * delimited by commas writes its decimals with a point.
 */
export type ImportWorkbook = Record<'sheets', ReadonlyArray<ImportSheet>> &
  Record<'date1904', boolean> &
  Record<'decimalSeparator', ',' | '.'>;

export type ReadRow = Record<'format', ImportFormatId> &
  Record<'keyNamespace', string> &
  Record<'source', SourceRow> &
  Record<'mapped', MappedRow>;

export type ImportReading =
  | (Record<'outcome', 'read'> &
      Record<'formats', Array<ImportFormatId>> &
      Record<'rows', Array<ReadRow>>)
  | Record<'outcome', 'unrecognized' | 'empty' | 'too-many-rows'>;

/** A statement's header row sits under a title and the period it covers, never far down. */
const HEADER_SEARCH_ROWS = 20;

const columnLabelOf = (index: number) => `#${index + 1}`;

/** Each field of the format at the column of the first header it may appear under, or null when a required one is missing. */
const columnsOf = (
  format: ImportFormat,
  headers: ReadonlyArray<string>
): Record<string, number> | null => {
  const columns: Record<string, number> = {};

  for (const [field, aliases] of Object.entries(format.columns)) {
    const index = headers.findIndex((header) => aliases.includes(header));

    if (index !== -1) columns[field] = index;
  }

  return format.required.every((field) => field in columns) ? columns : null;
};

const recognizedHeaderOf = (sheet: ImportSheet) => {
  for (const [rowIndex, row] of sheet.rows
    .slice(0, HEADER_SEARCH_ROWS)
    .entries()) {
    const headers = row.cells.map((cell) => normalizeLabel(textOf(cell) ?? ''));

    for (const format of IMPORT_FORMATS) {
      const columns = columnsOf(format, headers);

      if (columns !== null)
        return {
          format,
          columns,
          rowIndex,
          labels: row.cells.map(
            (cell, index) => textOf(cell) ?? columnLabelOf(index)
          )
        };
    }
  }

  return null;
};

type DataRows = ImportSheet['rows'];

/**
 * How the sheet's own values are written, where they all agree: the decimal
 * separator of its text numbers, and the order of its slashed dates once one
 * of them could not be read the other way. A file saved again by a spreadsheet
 * set to another language may write a B3 statement's numbers its way; a date
 * order that contradicts the one the layout fixes makes slashed dates
 * ambiguous rather than read either way.
 */
const conventionsOf = (
  rows: DataRows,
  columns: Record<string, number>,
  expected: Pick<MappingContext, 'decimalSeparator' | 'slashedDates'>
): Pick<MappingContext, 'decimalSeparator' | 'slashedDates'> => {
  const separators = new Set<DecimalSeparator>();
  const dateOrders = new Set<Exclude<SlashedDates, 'ambiguous'>>();
  const fieldColumns = Object.values(columns);

  for (const { cells } of rows) {
    for (const column of fieldColumns) {
      const separator = writtenDecimalSeparatorOf(cells[column] ?? null);

      if (separator !== null) separators.add(separator);
    }

    const order =
      'date' in columns
        ? slashedDateOrderOf(cells[columns.date] ?? null)
        : null;

    if (order !== null) dateOrders.add(order);
  }

  const [separator] = separators;
  const [dateOrder] = dateOrders;

  return {
    decimalSeparator:
      separators.size === 1 ? separator : expected.decimalSeparator,
    slashedDates:
      dateOrders.size !== 1 || dateOrder === expected.slashedDates
        ? expected.slashedDates
        : expected.slashedDates === 'ambiguous'
          ? dateOrder
          : 'ambiguous'
  };
};

/** The row's cells by the header above each, a header repeated getting its column after it. */
const sourceOf = (
  sheet: ImportSheet,
  labels: ReadonlyArray<string>,
  row: ImportSheet['rows'][number]
): SourceRow => {
  const cells: Record<string, string> = {};

  row.cells.forEach((cell, index) => {
    const text = textOf(cell);

    if (text === null) return;

    const label = labels[index] ?? columnLabelOf(index);

    cells[label in cells ? `${label} ${columnLabelOf(index)}` : label] = text;
  });

  return { sheet: sheet.name, rowNumber: row.number, cells };
};

const isTrade = ({ type }: ImportedEntry) => type === 'BUY' || type === 'SELL';

const tradeOf = ({ mapped }: ReadRow) =>
  mapped.outcome === 'entry' && isTrade(mapped.entry) ? mapped.entry : null;

const sameTradeOf = ({ symbol, type, quantity, unitPrice }: ImportedEntry) =>
  [symbol, type, quantity, unitPrice].join('|');

/**
 * The movement statement lists each trade of the trading statement again, as
 * the transfer that settled it days later. Within one file the trading
 * statement's row is kept, since it has the day the trade was made: a
 * settlement of the same asset, side, quantity and price in the days after a
 * trade gives way to it, each trade matched once.
 */
const ignoreTradesListedElsewhere = (rows: Array<ReadRow>) => {
  const trades = Map.groupBy(
    rows.flatMap((row) =>
      row.format === 'b3-trades' ? (tradeOf(row) ?? []) : []
    ),
    sameTradeOf
  );

  return rows.map((row): ReadRow => {
    const settlement = row.format === 'b3-movements' ? tradeOf(row) : null;
    const candidates =
      settlement === null ? undefined : trades.get(sameTradeOf(settlement));

    if (settlement === null || candidates === undefined) return row;

    const tradeDays = tradeDaysOf(settlement.tradeDate);
    const matchIndex = candidates.findIndex(({ tradeDate }) =>
      isWithin(tradeDate, tradeDays)
    );

    if (matchIndex === -1) return row;

    candidates.splice(matchIndex, 1);

    return {
      ...row,
      mapped: { outcome: 'ignored', reason: 'listed-elsewhere' }
    };
  });
};

const incomeTupleOf = ({ mapped }: ReadRow) =>
  mapped.outcome === 'entry'
    ? [
        mapped.entry.symbol,
        mapped.entry.type,
        mapped.entry.tradeDate,
        mapped.entry.quantity
      ].join('|')
    : null;

/**
 * B3 reports one payment in more than one place: the income statement and the
 * movement statement both list it, and the movement statement may list it
 * again as transferred. Within one file the income statement's row is the one
 * kept, and a transferred credit gives way to the plain one beside it.
 */
const ignoreIncomeListedElsewhere = (rows: Array<ReadRow>) => {
  const tuplesOf = (isSource: (row: ReadRow) => boolean) =>
    new Set(rows.filter(isSource).flatMap((row) => incomeTupleOf(row) ?? []));
  const isMovementIncome = (row: ReadRow) =>
    row.format === 'b3-movements' &&
    row.mapped.outcome === 'entry' &&
    row.mapped.entry.type !== 'BONUS';
  const statementIncome = tuplesOf((row) => row.format === 'b3-income');
  const plainMovementIncome = tuplesOf(
    (row) =>
      isMovementIncome(row) &&
      row.mapped.outcome === 'entry' &&
      row.mapped.review === null
  );

  return rows.map((row): ReadRow => {
    const tuple = incomeTupleOf(row);

    if (!isMovementIncome(row) || tuple === null) return row;

    const isTransferred =
      row.mapped.outcome === 'entry' &&
      row.mapped.review === 'transferred-income';

    return statementIncome.has(tuple) ||
      (isTransferred && plainMovementIncome.has(tuple))
      ? { ...row, mapped: { outcome: 'ignored', reason: 'listed-elsewhere' } }
      : row;
  });
};

/**
 * Every data row of the sheets whose header row a format recognizes, mapped
 * by that format, in file order. A sheet no format recognizes is skipped, so a
 * workbook may carry a cover or a summary sheet; blank rows and totals are not
 * data. More data rows than `maxRows` are refused whole rather than imported in
 * part.
 */
export const readImportRows = (
  workbook: ImportWorkbook,
  { today, maxRows }: Record<'today', CalendarDay> & Record<'maxRows', number>
): ImportReading => {
  const rows: Array<ReadRow> = [];
  const formats = new Set<ImportFormatId>();

  for (const sheet of workbook.sheets) {
    const header = recognizedHeaderOf(sheet);

    if (header === null) continue;

    const { format, columns, rowIndex, labels } = header;
    const dataRows = sheet.rows.slice(rowIndex + 1);
    const dateHeader =
      'date' in columns ? normalizeLabel(labels[columns.date] ?? '') : '';
    const context: MappingContext = {
      today,
      date1904: workbook.date1904,
      ...conventionsOf(dataRows, columns, {
        decimalSeparator:
          format.decimalSeparator === 'file'
            ? workbook.decimalSeparator
            : format.decimalSeparator,
        slashedDates:
          format.dayFirstDateHeaders === undefined ||
          format.dayFirstDateHeaders.includes(dateHeader)
            ? 'day-first'
            : 'ambiguous'
      })
    };

    formats.add(format.id);

    for (const row of dataRows) {
      const fieldCells = Object.fromEntries(
        Object.keys(format.columns).map((field) => [
          field,
          field in columns ? (row.cells[columns[field]] ?? null) : null
        ])
      );
      const mapped = format.mapRow(fieldCells, context);

      if (mapped === null) continue;

      if (rows.length >= maxRows) return { outcome: 'too-many-rows' };

      rows.push({
        format: format.id,
        keyNamespace: format.keyNamespace,
        source: sourceOf(sheet, labels, row),
        mapped
      });
    }
  }

  if (formats.size === 0) return { outcome: 'unrecognized' };
  if (rows.length === 0) return { outcome: 'empty' };

  return {
    outcome: 'read',
    formats: [...formats],
    rows: ignoreTradesListedElsewhere(ignoreIncomeListedElsewhere(rows))
  };
};
