import { createHash } from 'node:crypto';

import { ImportLimits, TransactionImportMessages } from '@/config/Constants';
import { formatCalendarDay } from '@/domain/CalendarDay';
import type { ListingSource } from '@/domain/MarketDataProvider';
import {
  importCurrenciesOf,
  pickListing,
  readImportRows,
  type ImportPlan,
  type ImportReading,
  type ImportWorkbook,
  type ListingResolution,
  type ReadRow
} from '@/domain/transaction-import';
import { DomainError } from '@/errors';
import {
  readSpreadsheet,
  SheetFormatError,
  type Spreadsheet
} from '@/infra/spreadsheet';

const SPREADSHEET_LIMITS = {
  maxSheets: ImportLimits.SHEETS,
  maxRows: ImportLimits.SHEET_ROWS,
  maxColumns: ImportLimits.COLUMNS,
  maxCellLength: ImportLimits.CELL_LENGTH,
  maxEntries: ImportLimits.ZIP_ENTRIES,
  maxEntryBytes: ImportLimits.ZIP_ENTRY_BYTES,
  maxTotalBytes: ImportLimits.ZIP_TOTAL_BYTES
};

const EXTENSIONS = {
  xlsx: '.xlsx',
  csv: '.csv'
} satisfies Record<Spreadsheet['format'], string>;

const FORMAT_MESSAGES = {
  unsupported: TransactionImportMessages.FILE_UNSUPPORTED,
  legacy: TransactionImportMessages.FILE_LEGACY,
  malformed: TransactionImportMessages.FILE_MALFORMED,
  'too-large': TransactionImportMessages.FILE_TOO_LARGE
} satisfies Record<SheetFormatError['reason'], string>;

const READING_MESSAGES = {
  unrecognized: TransactionImportMessages.FORMAT_UNRECOGNIZED,
  empty: TransactionImportMessages.NO_ROWS,
  'too-many-rows': TransactionImportMessages.TOO_MANY_ROWS
} satisfies Record<Exclude<ImportReading['outcome'], 'read'>, string>;

/**
 * The decimal separator of a file's text numbers when its layout does not fix
 * one. A CSV separated by commas cannot write decimals with them; one
 * separated otherwise, and a workbook, follow the Brazilian convention EX3's
 * template is written in.
 */
const decimalSeparatorOf = (spreadsheet: Spreadsheet): ',' | '.' =>
  spreadsheet.format === 'csv' && spreadsheet.delimiter === ',' ? '.' : ',';

export type ImportFile = Record<'name' | 'digest', string> &
  Record<'formats', Array<string>> &
  Record<'rows', Array<ReadRow>>;

/**
 * The rows of an uploaded file, in memory only: what the file is, a spreadsheet
 * EX3 reads and a layout it recognizes, is decided from its content, and the
 * file itself is never stored. Its name must then end in the extension of what
 * the content is. A day after today, in UTC, which is never behind São Paulo,
 * is refused.
 */
export const readImportFile = (
  { name, content }: Record<'name', string> & Record<'content', Buffer>,
  now: Date = new Date()
): ImportFile => {
  if (content.length === 0)
    throw new DomainError(TransactionImportMessages.NO_ROWS);

  if (content.length > ImportLimits.FILE_BYTES)
    throw new DomainError(TransactionImportMessages.FILE_TOO_LARGE);

  let spreadsheet: Spreadsheet;

  try {
    spreadsheet = readSpreadsheet(content, SPREADSHEET_LIMITS);
  } catch (error) {
    if (error instanceof SheetFormatError)
      throw new DomainError(FORMAT_MESSAGES[error.reason]);

    throw error;
  }

  if (!name.toLowerCase().endsWith(EXTENSIONS[spreadsheet.format]))
    throw new DomainError(TransactionImportMessages.FILE_UNSUPPORTED);

  const workbook: ImportWorkbook = {
    sheets: spreadsheet.sheets,
    date1904: spreadsheet.format === 'xlsx' && spreadsheet.date1904,
    decimalSeparator: decimalSeparatorOf(spreadsheet)
  };
  const reading = readImportRows(workbook, {
    today: formatCalendarDay(now),
    maxRows: ImportLimits.DATA_ROWS
  });

  if (reading.outcome !== 'read')
    throw new DomainError(READING_MESSAGES[reading.outcome]);

  return {
    name,
    digest: createHash('sha256').update(content).digest('hex'),
    formats: reading.formats,
    rows: reading.rows
  };
};

const inBatches = async <Item, Result>(
  items: ReadonlyArray<Item>,
  size: number,
  task: (item: Item) => Promise<Result>
) => {
  const results: Array<Result> = [];

  for (let start = 0; start < items.length; start += size)
    results.push(
      ...(await Promise.all(items.slice(start, start + size).map(task)))
    );

  return results;
};

/**
 * Asks the listing source about the symbols no known instrument has, no more
 * than an import looks up, all in one search; those past the limit, in symbol
 * order, are not asked about. A symbol is looked up only where it is quoted in
 * the currency its rows name, the one a listing is picked by. Searches are
 * cached by the source; the listing picked for a symbol about to be recorded
 * is described too, a few at a time, with its sector, as registering an asset
 * by hand does.
 */
export const lookUpListings = async (
  listingSource: ListingSource,
  {
    symbols,
    rows,
    described = new Set()
  }: Record<'symbols', ReadonlyArray<string>> &
    Record<'rows', ReadonlyArray<ReadRow>> &
    Partial<Record<'described', ReadonlySet<string>>>
): Promise<ReadonlyMap<string, ListingResolution>> => {
  const currencies = importCurrenciesOf(rows);
  const ordered = symbols.toSorted();
  const asked = ordered.slice(0, ImportLimits.NEW_ASSETS);
  const searches = await listingSource.findListings(
    new Map(asked.map((symbol) => [symbol, currencies.get(symbol) ?? null]))
  );

  const lookUp = async (symbol: string): Promise<ListingResolution> => {
    const search = searches.get(symbol);

    if (search === undefined || search.outcome === 'unavailable')
      return { outcome: 'unavailable' };

    const picked = pickListing(search.listings, currencies.get(symbol) ?? null);

    if (picked.outcome !== 'listed' || !described.has(symbol)) return picked;

    const description = await listingSource.describeListing(picked.listing);

    if (description.outcome === 'listed')
      return { outcome: 'listed', listing: description.listing };

    return description.outcome === 'not-found'
      ? { outcome: 'not-listed' }
      : { outcome: 'unavailable' };
  };

  const resolutions = await inBatches(
    asked,
    ImportLimits.LISTING_LOOKUP_CONCURRENCY,
    lookUp
  );

  return new Map<string, ListingResolution>([
    ...asked.map((symbol, index): [string, ListingResolution] => [
      symbol,
      resolutions[index]
    ]),
    ...ordered
      .slice(ImportLimits.NEW_ASSETS)
      .map((symbol): [string, ListingResolution] => [
        symbol,
        { outcome: 'skipped' }
      ])
  ]);
};

/** A plan as the API answers it: rows and assets, and the keys a confirmation sends back. */
export const previewOf = (file: ImportFile, plan: ImportPlan) => ({
  file: { name: file.name, formats: file.formats },
  counts: plan.counts,
  selectedKeys: plan.recorded.map(({ key }) => key),
  assets: plan.assets,
  rows: plan.rows.map(({ source, ...row }) => ({
    ...row,
    sheet: source.sheet,
    rowNumber: source.rowNumber,
    cells: source.cells
  }))
});

export type ImportPreview = ReturnType<typeof previewOf>;
