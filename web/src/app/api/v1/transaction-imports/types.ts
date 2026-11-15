import type {
  DecimalString,
  Page,
  PageParams,
  WithId,
  WithMessage
} from '@/types';

import type { PortfolioScopeParams } from '../portfolio';
import type { TransactionType } from '../transactions';

export type ImportFormatId =
  'b3-trades' | 'b3-income' | 'b3-movements' | 'ex3-template';

export type ImportRowStatus =
  | 'ready'
  | 'review'
  | 'possible-duplicate'
  | 'duplicate'
  | 'unresolved'
  | 'refused'
  | 'ignored'
  | 'rejected';

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

export type UnresolvedReason =
  | 'not-listed'
  | 'not-found'
  | 'market-data-unavailable'
  | 'too-many-new-assets'
  | 'currency-unknown'
  | 'currency-mismatch';

export type RefusalReason = 'oversold' | 'currency-mismatch' | 'out-of-range';

export type ImportRowReason =
  ImportIgnoreReason | ImportReviewReason | UnresolvedReason | RefusalReason;

export type ImportedEntry = Record<'symbol' | 'tradeDate', string> &
  Record<'type', TransactionType> &
  Record<'quantity' | 'unitPrice' | 'fees' | 'taxes', DecimalString> &
  Record<'currency' | 'broker' | 'notes', string | null>;

export type ImportPreviewRow = Record<'key', string | null> &
  Record<'format', ImportFormatId> &
  Record<'entry', ImportedEntry | null> &
  Record<'status', ImportRowStatus> &
  Record<'isSelected', boolean> &
  Record<'warnings', Array<ImportWarning>> &
  Record<'problems', Array<ImportProblem>> &
  Record<'reason', ImportRowReason | null> &
  Record<'matchedTransactionId', string | null> &
  Record<'sheet', string> &
  Record<'rowNumber', number> &
  Record<'cells', Record<string, string>>;

export type PositionFigures = Record<
  'quantity' | 'averageCost' | 'investedValue' | 'realizedProfitLoss',
  DecimalString
>;

export type ImportAssetResolution =
  'held' | 'tracked' | 'listed' | 'unresolved';

export type ImportAssetRefusal = Record<'reason', RefusalReason> &
  Record<'tradeDate', string | null> &
  Record<'row', (Record<'sheet', string> & Record<'rowNumber', number>) | null>;

export type ImportPreviewAsset = Record<'symbol', string> &
  Record<'resolution', ImportAssetResolution> &
  Record<'name' | 'currency', string | null> &
  Record<'rowCount' | 'selectedCount', number> &
  Record<'before' | 'after', PositionFigures | null> &
  Record<'netIncome', DecimalString> &
  Record<'refusal', ImportAssetRefusal | null>;

export type ImportPreview = Record<
  'file',
  Record<'name', string> & Record<'formats', Array<ImportFormatId>>
> &
  Record<'counts', Record<ImportRowStatus, number>> &
  Record<'selectedKeys', Array<string>> &
  Record<'assets', Array<ImportPreviewAsset>> &
  Record<'rows', Array<ImportPreviewRow>>;

export type ImportFilePayload = Record<'name' | 'content', string>;

export type PreviewTransactionImportRequestPayload = PortfolioScopeParams &
  Record<'file', ImportFilePayload> &
  Partial<Record<'selectedKeys', Array<string>>>;

export type PreviewTransactionImportResponseData = Record<
  'preview',
  ImportPreview
>;

export type CreateTransactionImportRequestPayload = PortfolioScopeParams &
  Record<'file', ImportFilePayload> &
  Record<'selectedKeys', Array<string>>;

export type TransactionImport = WithId &
  Record<'fileName' | 'portfolioId' | 'createdAt', string> &
  Record<'formats', Array<ImportFormatId>> &
  Record<'openedInstrumentIds', Array<string>> &
  Record<'rowCount' | 'importedCount' | 'transactionCount', number> &
  Record<'undoneAt', string | null>;

export type CreateTransactionImportResponseData = WithMessage &
  Record<'transactionImport', TransactionImport> &
  Record<'result', ImportPreview>;

export type GetTransactionImportsRequestParams = PortfolioScopeParams &
  PageParams;

export type GetTransactionImportsResponseData = Page<TransactionImport>;

export type UndoTransactionImportResponseData = WithMessage;
