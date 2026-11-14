import type { RecordableTransactionTypes } from '@/config/Constants';
import type { CalendarDay } from '@/domain/models';

import type { ImportCell } from './ImportValues';

export type ImportableType =
  (typeof RecordableTransactionTypes)[keyof typeof RecordableTransactionTypes];

export type ImportFormatId =
  'b3-trades' | 'b3-income' | 'b3-movements' | 'ex3-template';

export type SourceRow = Record<'sheet', string> &
  Record<'rowNumber', number> &
  Record<'cells', Record<string, string>>;

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

export type ImportWarning =
  | 'value-mismatch'
  | 'withholding-derived'
  | 'unit-price-derived'
  | 'bonus-cost-unknown'
  | 'split-as-bonus'
  | 'transferred-income'
  | 'broker-truncated'
  | 'notes-truncated';

export type ImportIgnoreReason =
  'settlement' | 'custody-transfer' | 'lending' | 'listed-elsewhere';

export type ImportReviewReason = 'split' | 'transferred-income';

export type MappedRow =
  | (Record<'outcome', 'entry'> &
      Record<'entry', ImportedEntry> &
      Record<'warnings', Array<ImportWarning>> &
      Record<'review', ImportReviewReason | null>)
  | (Record<'outcome', 'ignored'> & Record<'reason', ImportIgnoreReason>)
  | (Record<'outcome', 'rejected'> & Record<'problems', Array<ImportProblem>>);

export type FieldCells<Field extends string> = Record<Field, ImportCell | null>;

export type SlashedDates = 'day-first' | 'month-first' | 'ambiguous';

export type MappingContext = Record<'date1904', boolean> &
  Record<'decimalSeparator', ',' | '.'> &
  Record<'slashedDates', SlashedDates> &
  Record<'today', CalendarDay>;

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
