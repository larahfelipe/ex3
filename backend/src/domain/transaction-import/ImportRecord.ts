import type { RecordableTransactionTypes } from '@/config/Constants';
import type { CalendarDay } from '@/domain/models';

import type { ImportCell } from './ImportValues';

export type ImportableType =
  (typeof RecordableTransactionTypes)[keyof typeof RecordableTransactionTypes];

export type ImportFormatId =
  'b3-trades' | 'b3-income' | 'b3-movements' | 'ex3-template';

/**
 * A row as the file has it, each cell keyed by the header of its column, the
 * text a person reads in the spreadsheet. It is kept with the transaction the
 * row becomes, so what was imported can always be traced back to the file.
 */
export type SourceRow = Record<'sheet', string> &
  Record<'rowNumber', number> &
  Record<'cells', Record<string, string>>;

/**
 * A row normalized into what EX3 records. `currency` null means the currency
 * of the instrument the symbol resolves to, as a template row may leave it out.
 */
export type ImportedEntry = Record<'symbol', string> &
  Record<'type', ImportableType> &
  Record<'tradeDate', CalendarDay> &
  Record<'quantity' | 'unitPrice' | 'fees' | 'taxes', string> &
  Record<'currency' | 'broker' | 'notes', string | null>;

export type ImportField =
  | 'date'
  | 'type'
  | 'market'
  | 'symbol'
  | 'quantity'
  | 'unitPrice'
  | 'value'
  | 'fees'
  | 'taxes'
  | 'currency';

/**
 * Why a row cannot become a transaction. `unsupported-*` names what EX3 does
 * not model yet, as an option trade or a reverse split, which is recorded by
 * hand when it matters; the rest are values the row itself gets wrong.
 */
export type ImportProblemCode =
  | 'missing-value'
  | 'invalid-date'
  | 'ambiguous-date'
  | 'future-date'
  | 'invalid-number'
  | 'not-positive'
  | 'invalid-symbol'
  | 'invalid-currency'
  | 'unsupported-type'
  | 'unsupported-market'
  | 'unsupported-event'
  | 'unsupported-product'
  | 'income-debit';

export type ImportProblem = Record<'code', ImportProblemCode> &
  Record<'field', ImportField | null>;

/**
 * What a row's values needed to become a transaction, each worth a look:
 * a trade whose total disagrees with quantity × price, income whose
 * withholding or unit value was derived from its net amount, a bonus without
 * the cost the company attributed to it, a split recorded as a bonus of the
 * new units, or a text cut to the length EX3 stores.
 */
export type ImportWarning =
  | 'value-mismatch'
  | 'withholding-derived'
  | 'unit-price-derived'
  | 'bonus-cost-unknown'
  | 'split-as-bonus'
  | 'transferred-income'
  | 'broker-truncated'
  | 'notes-truncated';

/**
 * Why a row of a statement is not a transaction of its own: a purchase or sale
 * entry the movement statement also settles as a transfer, a custody transfer,
 * securities lending, and a transaction the same file lists under another
 * entry.
 */
export type ImportIgnoreReason =
  'settlement' | 'custody-transfer' | 'lending' | 'listed-elsewhere';

/** Why an entry waits for the person to include it: B3 does not say enough to be sure. */
export type ImportReviewReason = 'split' | 'transferred-income';

export type MappedRow =
  | (Record<'outcome', 'entry'> &
      Record<'entry', ImportedEntry> &
      Record<'warnings', Array<ImportWarning>> &
      Record<'review', ImportReviewReason | null>)
  | (Record<'outcome', 'ignored'> & Record<'reason', ImportIgnoreReason>)
  | (Record<'outcome', 'rejected'> & Record<'problems', Array<ImportProblem>>);

/** The cells of one data row by the field each column was recognized as. */
export type FieldCells<Field extends string> = Record<Field, ImportCell | null>;

/**
 * How a date written with slashes reads: day first, as Brazil writes it, month
 * first, when the file's own dates show it, or not at all, where either may
 * have been written.
 */
export type SlashedDates = 'day-first' | 'month-first' | 'ambiguous';

export type MappingContext = Record<'date1904', boolean> &
  Record<'decimalSeparator', ',' | '.'> &
  Record<'slashedDates', SlashedDates> &
  Record<'today', CalendarDay>;

/**
 * A statement layout the importer recognizes by its header row. `columns`
 * lists, for each field, the headers it may appear under once normalized;
 * `required` are the fields whose column must be present for a header row to
 * be this format's. `mapRow` answers null for a row that is not data, as the
 * totals at the foot of a statement. A slashed date reads day first unless
 * `dayFirstDateHeaders` is given and the date's header is not among them.
 */
export type ImportFormat<Field extends string = string> = Record<
  'id',
  ImportFormatId
> &
  Record<'keyNamespace', string> &
  Record<'columns', Record<Field, ReadonlyArray<string>>> &
  Record<'required', ReadonlyArray<Field>> &
  Record<
    'mapRow',
    (cells: FieldCells<Field>, context: MappingContext) => MappedRow | null
  > &
  Record<'decimalSeparator', ',' | '.' | 'file'> &
  Partial<Record<'dayFirstDateHeaders', ReadonlyArray<string>>>;
