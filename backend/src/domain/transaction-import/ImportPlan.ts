import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

import { DecimalColumn, IncomeTransactionTypes } from '@/config/Constants';
import { formatCalendarDay } from '@/domain/CalendarDay';
import type { CalendarDay, TransactionType } from '@/domain/models';
import {
  locateLedgerRefusal,
  realizeProfitLoss,
  rebuildPosition,
  type LedgerEntry
} from '@/domain/PositionLedger';

import type { ReadRow } from './ImportReading';
import type {
  ImportedEntry,
  ImportFormatId,
  ImportProblem,
  ImportWarning,
  SourceRow
} from './ImportRecord';
import {
  isWithin,
  saoPauloDayOf,
  settlementDaysOf,
  startOfTradingDay,
  tradeDaysOf,
  type DayRange
} from './ImportValues';

const PlanDecimal = Prisma.Decimal.clone({
  precision: 2 * DecimalColumn.PRECISION + 1
});

export type ImportRowStatus =
  | 'ready'
  | 'review'
  | 'possible-duplicate'
  | 'duplicate'
  | 'unresolved'
  | 'refused'
  | 'ignored'
  | 'rejected';

export type UnresolvedReason =
  | 'not-listed'
  | 'not-found'
  | 'market-data-unavailable'
  | 'too-many-new-assets'
  | 'currency-unknown'
  | 'currency-mismatch';

export type RefusalReason = 'oversold' | 'currency-mismatch' | 'out-of-range';

export type AssetResolution =
  | (Record<'status', 'held' | 'tracked'> &
      Record<'instrumentId' | 'name', string> &
      Record<'currency', string | null>)
  | (Record<'status', 'listed'> & Record<'name' | 'currency', string>)
  | (Record<'status', 'unresolved'> & Record<'reason', UnresolvedReason>);

export type ExistingTransaction = Pick<
  LedgerEntry,
  | 'type'
  | 'currency'
  | 'executedAt'
  | 'quantity'
  | 'unitPrice'
  | 'fees'
  | 'taxes'
> &
  Record<'id' | 'instrumentId', string> &
  Record<'sequence', bigint> &
  Record<'importKey', string | null>;

export type ImportPlanInput = Record<'rows', ReadonlyArray<ReadRow>> &
  Record<'assets', ReadonlyMap<string, AssetResolution>> &
  Record<'transactions', ReadonlyArray<ExistingTransaction>> &
  Record<'existingKeys', ReadonlySet<string>> &
  Record<'selection', ReadonlySet<string> | null>;

export type PlannedRow = Record<'key', string | null> &
  Record<'format', ImportFormatId> &
  Record<'source', SourceRow> &
  Record<'entry', ImportedEntry | null> &
  Record<'status', ImportRowStatus> &
  Record<'isSelected', boolean> &
  Record<'warnings', Array<ImportWarning>> &
  Record<'problems', Array<ImportProblem>> &
  Record<'reason', string | null> &
  Record<'matchedTransactionId', string | null>;

export type PositionFigures = Record<
  'quantity' | 'averageCost' | 'investedValue' | 'realizedProfitLoss',
  string
>;

export type PlannedAsset = Record<'symbol', string> &
  Record<'resolution', AssetResolution['status']> &
  Record<'name' | 'currency', string | null> &
  Record<'rowCount' | 'selectedCount', number> &
  Record<'before' | 'after', PositionFigures | null> &
  Record<'netIncome', string> &
  Record<
    'refusal',
    | (Record<'reason', RefusalReason> &
        Record<'tradeDate', CalendarDay | null> &
        Record<'row', Pick<SourceRow, 'sheet' | 'rowNumber'> | null>)
    | null
  >;

export type RecordedEntry = Record<'key', string> &
  Record<'format', ImportFormatId> &
  Record<'entry', ImportedEntry & Record<'currency', string>> &
  Record<'executedAt', Date> &
  Record<'source', SourceRow>;

type SelectedRow = RecordedEntry &
  Record<'row', PlannedRow> &
  Record<'index', number>;

export type ImportPlan = Record<'rows', Array<PlannedRow>> &
  Record<'assets', Array<PlannedAsset>> &
  Record<'counts', Record<ImportRowStatus, number>> &
  Record<'recorded', Array<RecordedEntry>>;

const SELECTABLE_STATUSES = new Set<ImportRowStatus>([
  'ready',
  'review',
  'possible-duplicate',
  'refused'
]);

const REFUSAL_REASONS = {
  'negative-amount': 'oversold',
  'currency-mismatch': 'currency-mismatch',
  'out-of-range': 'out-of-range'
} as const satisfies Record<string, RefusalReason>;

/**
 * B3 reports days, not times, so trades of one day are recorded acquisitions
 * first: a position opened and closed the same day is then never sold before
 * it is bought. Income comes last, as it changes no position.
 */
const RECORDING_RANK: Partial<Record<TransactionType, number>> = {
  BUY: 0,
  BONUS: 0,
  SELL: 1
};
const INCOME_RANK = 2;

const recordingRankOf = (type: TransactionType) =>
  RECORDING_RANK[type] ?? INCOME_RANK;

const canonicalOf = (value: Prisma.Decimal | string) =>
  new PlanDecimal(value).toFixed();

/**
 * The key of a row is a digest of what it records, not of where it sits in
 * the file, so the same statement exported again, over a longer period or
 * with its rows in another order, yields the same keys. Rows that record the
 * same thing, as two equal trades in one day, are told apart by their count
 * among the rows like them.
 */
const keyTupleOf = (namespace: string, entry: ImportedEntry) =>
  [
    namespace,
    entry.symbol,
    entry.type,
    entry.tradeDate,
    canonicalOf(entry.quantity),
    canonicalOf(entry.unitPrice),
    canonicalOf(entry.fees),
    canonicalOf(entry.taxes),
    entry.currency ?? '',
    entry.broker ?? ''
  ].join('\u001f');

const digestOf = (text: string) =>
  createHash('sha256').update(text).digest('hex');

export const importKeysOf = (rows: ReadonlyArray<ReadRow>) => {
  const occurrences = new Map<string, number>();

  return rows.map(({ keyNamespace, mapped }) => {
    if (mapped.outcome !== 'entry') return null;

    const tuple = keyTupleOf(keyNamespace, mapped.entry);
    const occurrence = occurrences.get(tuple) ?? 0;

    occurrences.set(tuple, occurrence + 1);

    return digestOf(`${tuple}\u001f${occurrence}`);
  });
};

type MatchCandidate = Record<'id' | 'unitPrice', string> &
  Record<'day' | 'utcDay', CalendarDay>;

const likenessOf = (
  instrumentId: string,
  type: string,
  quantity: Prisma.Decimal | string
) => [instrumentId, type, canonicalOf(quantity)].join('\u001f');

const isSameDay = ({ day, utcDay }: MatchCandidate, tradeDate: CalendarDay) =>
  day === tradeDate || utcDay === tradeDate;

const sameTradeDaysOf = (
  format: ImportFormatId,
  entry: ImportedEntry
): DayRange | null =>
  entry.type !== 'BUY' && entry.type !== 'SELL'
    ? null
    : format === 'b3-movements'
      ? tradeDaysOf(entry.tradeDate)
      : format === 'b3-trades'
        ? settlementDaysOf(entry.tradeDate)
        : null;

const figuresOf = (
  ledger: ReadonlyArray<LedgerEntry>
): PositionFigures | null => {
  const rebuild = rebuildPosition(ledger);
  const realization = realizeProfitLoss(ledger);

  return rebuild.outcome === 'rebuilt' && realization.outcome === 'realized'
    ? {
        ...rebuild.position,
        realizedProfitLoss: realization.realizedProfitLoss
      }
    : null;
};

const netIncomeOf = (entries: ReadonlyArray<ImportedEntry>) =>
  entries
    .filter(({ type }) => Object.hasOwn(IncomeTransactionTypes, type))
    .reduce(
      (total, { quantity, unitPrice, fees, taxes }) =>
        total.add(
          new PlanDecimal(quantity).mul(unitPrice).sub(fees).sub(taxes)
        ),
      new PlanDecimal(0)
    )
    .toFixed();

const emptyCounts = (): Record<ImportRowStatus, number> => ({
  ready: 0,
  review: 0,
  'possible-duplicate': 0,
  duplicate: 0,
  unresolved: 0,
  refused: 0,
  ignored: 0,
  rejected: 0
});

export const planImport = ({
  rows,
  assets,
  transactions,
  existingKeys,
  selection
}: ImportPlanInput): ImportPlan => {
  const keys = importKeysOf(rows);
  const fileKeys = new Set(keys.filter((key) => key !== null));
  const transactionsByInstrument = Map.groupBy(
    transactions,
    ({ instrumentId }) => instrumentId
  );
  const matchCandidates = new Map(
    [
      ...Map.groupBy(
        transactions.filter(
          ({ importKey }) => importKey === null || !fileKeys.has(importKey)
        ),
        ({ instrumentId, type, quantity }) =>
          likenessOf(instrumentId, type, quantity)
      )
    ].map(([likeness, ledger]) => [
      likeness,
      ledger.map(({ id, executedAt, unitPrice }): MatchCandidate => ({
        id,
        unitPrice: canonicalOf(unitPrice),
        day: saoPauloDayOf(executedAt),
        utcDay: formatCalendarDay(executedAt)
      }))
    ])
  );

  const assetCurrencyOf = (resolution: AssetResolution) =>
    resolution.status === 'unresolved'
      ? null
      : resolution.status === 'listed'
        ? resolution.currency
        : (resolution.currency ??
          transactionsByInstrument.get(resolution.instrumentId)?.[0]
            ?.currency ??
          null);

  const planned = rows.map((row, index): PlannedRow => {
    const key = keys[index];
    const base = {
      key,
      format: row.format,
      source: row.source,
      matchedTransactionId: null,
      isSelected: false
    };

    if (row.mapped.outcome === 'ignored')
      return {
        ...base,
        entry: null,
        status: 'ignored',
        warnings: [],
        problems: [],
        reason: row.mapped.reason
      };

    if (row.mapped.outcome === 'rejected' || key === null)
      return {
        ...base,
        entry: null,
        status: 'rejected',
        warnings: [],
        problems: row.mapped.outcome === 'rejected' ? row.mapped.problems : [],
        reason: null
      };

    const { entry, warnings, review } = row.mapped;
    const withStatus = (
      status: ImportRowStatus,
      reason: string | null,
      resolvedEntry: ImportedEntry = entry
    ): PlannedRow => ({
      ...base,
      entry: resolvedEntry,
      status,
      warnings,
      problems: [],
      reason
    });

    if (existingKeys.has(key)) return withStatus('duplicate', null);

    const resolution = assets.get(entry.symbol);

    if (resolution === undefined) return withStatus('unresolved', 'not-found');
    if (resolution.status === 'unresolved')
      return withStatus('unresolved', resolution.reason);

    const assetCurrency = assetCurrencyOf(resolution);
    const currency = entry.currency ?? assetCurrency;

    if (currency === null) return withStatus('unresolved', 'currency-unknown');
    if (assetCurrency !== null && currency !== assetCurrency)
      return withStatus('unresolved', 'currency-mismatch');

    const resolvedEntry = { ...entry, currency };
    const candidates =
      resolution.status === 'listed'
        ? undefined
        : matchCandidates.get(
            likenessOf(resolution.instrumentId, entry.type, entry.quantity)
          );
    const sameDayIndex =
      candidates?.findIndex((candidate) =>
        isSameDay(candidate, entry.tradeDate)
      ) ?? -1;
    const sameTradeDays =
      candidates === undefined || sameDayIndex !== -1
        ? null
        : sameTradeDaysOf(row.format, entry);
    const unitPrice =
      sameTradeDays === null ? null : canonicalOf(entry.unitPrice);
    const matchIndex =
      sameTradeDays === null
        ? sameDayIndex
        : (candidates?.findIndex(
            (candidate) =>
              candidate.unitPrice === unitPrice &&
              isWithin(candidate.day, sameTradeDays)
          ) ?? -1);

    if (candidates !== undefined && matchIndex !== -1) {
      const [match] = candidates.splice(matchIndex, 1);

      return {
        ...withStatus('possible-duplicate', review, resolvedEntry),
        matchedTransactionId: match.id
      };
    }

    return review === null
      ? withStatus('ready', null, resolvedEntry)
      : withStatus('review', review, resolvedEntry);
  });

  for (const row of planned)
    row.isSelected =
      SELECTABLE_STATUSES.has(row.status) &&
      (selection === null
        ? row.status === 'ready'
        : row.key !== null && selection.has(row.key));

  const recordingOrder = planned
    .flatMap((row, index): Array<SelectedRow> => {
      const { key, entry } = row;

      return row.isSelected && key !== null && entry?.currency
        ? [
            {
              key,
              format: row.format,
              entry: { ...entry, currency: entry.currency },
              executedAt: startOfTradingDay(entry.tradeDate),
              source: row.source,
              row,
              index
            }
          ]
        : [];
    })
    .toSorted(
      (a, b) =>
        a.entry.tradeDate.localeCompare(b.entry.tradeDate) ||
        recordingRankOf(a.entry.type) - recordingRankOf(b.entry.type) ||
        a.index - b.index
    );

  const symbols = [
    ...new Set(
      planned.flatMap(({ entry, status }) =>
        entry === null || status === 'rejected' || status === 'ignored'
          ? []
          : [entry.symbol]
      )
    )
  ].toSorted();

  const plannedAssets = symbols.map((symbol): PlannedAsset => {
    const resolution = assets.get(symbol) ?? {
      status: 'unresolved',
      reason: 'not-found'
    };
    const ledger =
      resolution.status === 'held'
        ? (transactionsByInstrument.get(resolution.instrumentId) ?? [])
        : [];
    const symbolRows = planned.filter(({ entry }) => entry?.symbol === symbol);
    const selectedRows = recordingOrder.filter(
      ({ entry }) => entry.symbol === symbol
    );
    const newEntries = selectedRows.map(({ row, entry, executedAt }) => ({
      row,
      type: entry.type,
      currency: entry.currency,
      executedAt,
      quantity: entry.quantity,
      unitPrice: entry.unitPrice,
      fees: entry.fees,
      taxes: entry.taxes
    }));
    const before = resolution.status === 'held' ? figuresOf(ledger) : null;
    const refusal =
      newEntries.length === 0
        ? null
        : locateLedgerRefusal<LedgerEntry & Partial<Record<'row', PlannedRow>>>(
            [...ledger, ...newEntries]
          );

    if (refusal !== null)
      for (const { row } of selectedRows) {
        row.status = 'refused';
        row.reason = REFUSAL_REASONS[refusal.outcome];
        row.isSelected = false;
      }

    const isRecorded = refusal === null && newEntries.length > 0;

    return {
      symbol,
      resolution: resolution.status,
      name: resolution.status === 'unresolved' ? null : resolution.name,
      currency: assetCurrencyOf(resolution),
      rowCount: symbolRows.length,
      selectedCount: isRecorded ? selectedRows.length : 0,
      before,
      after: isRecorded ? figuresOf([...ledger, ...newEntries]) : before,
      netIncome: netIncomeOf(
        isRecorded ? selectedRows.map(({ entry }) => entry) : []
      ),
      refusal:
        refusal === null
          ? null
          : {
              reason: REFUSAL_REASONS[refusal.outcome],
              tradeDate:
                refusal.entry === null
                  ? null
                  : saoPauloDayOf(refusal.entry.executedAt),
              row:
                refusal.entry?.row === undefined
                  ? null
                  : {
                      sheet: refusal.entry.row.source.sheet,
                      rowNumber: refusal.entry.row.source.rowNumber
                    }
            }
    };
  });

  const counts = emptyCounts();

  for (const { status } of planned) counts[status] += 1;

  return {
    rows: planned,
    assets: plannedAssets,
    counts,
    recorded: recordingOrder
      .filter(({ row }) => row.isSelected)
      .map(({ key, format, entry, executedAt, source }) => ({
        key,
        format,
        entry,
        executedAt,
        source
      }))
  };
};
