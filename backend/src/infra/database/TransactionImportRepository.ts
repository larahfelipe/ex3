import type {
  Prisma,
  TransactionImport as TransactionImportRow
} from '@prisma/client';

import { ImportLimits } from '@/config/Constants';
import {
  rebuildPosition,
  type LedgerRefusal,
  type RebuiltPosition
} from '@/domain/PositionLedger';
import {
  importKeysOf,
  planImport,
  resolveImportAssets,
  type ExistingTransaction,
  type ImportPlan,
  type KnownInstrument,
  type ListingResolution,
  type ReadRow
} from '@/domain/transaction-import';
import type { Page } from '@/interfaces';

import { PrismaClient } from './PrismaClient';

type Client = Prisma.TransactionClient | PrismaClient;

export type TransactionImport = Omit<TransactionImportRow, 'fileDigest'> &
  Record<'transactionCount', number>;

const IMPORT_SELECTION = {
  id: true,
  fileName: true,
  formats: true,
  rowCount: true,
  importedCount: true,
  openedInstrumentIds: true,
  createdAt: true,
  undoneAt: true,
  portfolioId: true,
  _count: { select: { transactions: true } }
} as const;

const toTransactionImport = ({
  _count,
  ...row
}: Prisma.TransactionImportGetPayload<{
  select: typeof IMPORT_SELECTION;
}>): TransactionImport => ({ ...row, transactionCount: _count.transactions });

const LEDGER_SELECTION = {
  id: true,
  instrumentId: true,
  sequence: true,
  type: true,
  quantity: true,
  unitPrice: true,
  fees: true,
  taxes: true,
  currency: true,
  executedAt: true,
  importKey: true
} as const;

const symbolsOf = (rows: ReadonlyArray<ReadRow>) => [
  ...new Set(
    rows.flatMap(({ mapped }) =>
      mapped.outcome === 'entry' ? [mapped.entry.symbol] : []
    )
  )
];

/**
 * A private instrument shadows the catalog one of its symbol, for the
 * positions of a portfolio as for the instruments a person sees, so of two
 * rows of one symbol the private one, sorted first, is kept.
 */
const bySymbol = <Row extends Record<'symbol', string>>(
  rows: ReadonlyArray<Row>
) => {
  const instruments = new Map<string, Row>();

  for (const row of rows)
    if (!instruments.has(row.symbol)) instruments.set(row.symbol, row);

  return instruments;
};

const PRIVATE_FIRST = { ownerId: { sort: 'asc', nulls: 'last' } } as const;

const readPlanningState = async (
  client: Client,
  { portfolioId, userId, rows }: TransactionImportRepository.PlanningScope
) => {
  const symbols = symbolsOf(rows);
  const keys = importKeysOf(rows).filter((key) => key !== null);

  const [positions, instruments, imported] = await Promise.all([
    client.position.findMany({
      where: { portfolioId, instrument: { symbol: { in: symbols } } },
      orderBy: { instrument: PRIVATE_FIRST },
      select: {
        instrumentId: true,
        instrument: { select: { symbol: true, name: true, currency: true } }
      }
    }),
    client.instrument.findMany({
      where: {
        symbol: { in: symbols },
        OR: [{ ownerId: userId }, { ownerId: null }]
      },
      orderBy: PRIVATE_FIRST,
      select: { id: true, symbol: true, name: true, currency: true }
    }),
    client.transaction.findMany({
      where: { portfolioId, importKey: { in: keys } },
      select: { importKey: true }
    })
  ]);

  const held = new Map<string, KnownInstrument>(
    [
      ...bySymbol(
        positions.map(({ instrumentId, instrument }) => ({
          instrumentId,
          ...instrument
        }))
      )
    ].map(([symbol, { instrumentId, name, currency }]) => [
      symbol,
      { instrumentId, name, currency }
    ])
  );
  const tracked = new Map<string, KnownInstrument>(
    [...bySymbol(instruments)]
      .filter(([symbol]) => !held.has(symbol))
      .map(([symbol, { id, name, currency }]) => [
        symbol,
        { instrumentId: id, name, currency }
      ])
  );
  const transactions: Array<ExistingTransaction> =
    held.size === 0
      ? []
      : await client.transaction.findMany({
          where: {
            portfolioId,
            instrumentId: {
              in: [...held.values()].map(({ instrumentId }) => instrumentId)
            }
          },
          select: LEDGER_SELECTION
        });

  return {
    symbols,
    held,
    tracked,
    transactions,
    existingKeys: new Set(imported.flatMap(({ importKey }) => importKey ?? []))
  };
};

const planWith = (
  state: Awaited<ReturnType<typeof readPlanningState>>,
  {
    rows,
    listings,
    selection
  }: Pick<TransactionImportRepository.PlanParams, 'rows' | 'listings'> &
    Record<'selection', ReadonlySet<string> | null>
) =>
  planImport({
    rows,
    assets: resolveImportAssets(state.symbols, { ...state, listings }),
    transactions: state.transactions,
    existingKeys: state.existingKeys,
    selection
  });

const isSameSelection = (plan: ImportPlan, selection: ReadonlySet<string>) =>
  plan.recorded.length === selection.size &&
  plan.recorded.every(({ key }) => selection.has(key));

const storePosition = (
  transactionClient: Prisma.TransactionClient,
  where: Prisma.PositionPortfolioIdInstrumentIdCompoundUniqueInput,
  { quantity, averageCost, investedValue }: RebuiltPosition
) =>
  transactionClient.position.update({
    where: { portfolioId_instrumentId: where },
    data: { quantity, averageCost, investedValue }
  });

export class TransactionImportRepository {
  private static INSTANCE: TransactionImportRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!TransactionImportRepository.INSTANCE)
      TransactionImportRepository.INSTANCE = new TransactionImportRepository();

    return TransactionImportRepository.INSTANCE;
  }

  async getUnknownSymbols(params: TransactionImportRepository.PlanningScope) {
    const { symbols, held, tracked } = await readPlanningState(
      this.prismaClient,
      params
    );

    return symbols.filter(
      (symbol) => !held.has(symbol) && !tracked.has(symbol)
    );
  }

  async plan(params: TransactionImportRepository.PlanParams) {
    const { selection = null, ...scope } = params;

    return planWith(await readPlanningState(this.prismaClient, scope), {
      ...scope,
      selection
    });
  }

  async record(
    params: TransactionImportRepository.RecordParams
  ): Promise<TransactionImportRepository.RecordOutcome> {
    const { portfolioId, userId, rows, listings, selection, file } = params;

    try {
      return await this.prismaClient.runSerializable(
        async (transactionClient) => {
          const state = await readPlanningState(transactionClient, {
            portfolioId,
            userId,
            rows
          });
          const plan = planWith(state, { rows, listings, selection });

          if (!isSameSelection(plan, selection))
            return { outcome: 'changed', plan };

          const recordedSymbols = new Set(
            plan.recorded.map(({ entry }) => entry.symbol)
          );
          const instrumentIds = new Map(
            [...state.held, ...state.tracked].map(
              ([symbol, { instrumentId }]) => [symbol, instrumentId]
            )
          );
          const openedInstrumentIds: Array<string> = [];

          for (const asset of plan.assets) {
            if (
              !recordedSymbols.has(asset.symbol) ||
              asset.resolution === 'held'
            )
              continue;

            const lookup = listings.get(asset.symbol);
            const instrumentId =
              asset.resolution === 'tracked'
                ? instrumentIds.get(asset.symbol)
                : lookup?.outcome === 'listed'
                  ? (
                      await transactionClient.instrument.create({
                        data: {
                          symbol: lookup.listing.symbol,
                          name: lookup.listing.name,
                          type: lookup.listing.type,
                          market: lookup.listing.market,
                          currency: lookup.listing.currency,
                          ...(typeof lookup.listing.sector === 'string' && {
                            sector: lookup.listing.sector
                          }),
                          ownerId: userId
                        },
                        select: { id: true }
                      })
                    ).id
                  : undefined;

            if (instrumentId === undefined)
              throw new Error(`No instrument resolved for ${asset.symbol}`);

            await transactionClient.position.create({
              data: { portfolioId, instrumentId }
            });
            instrumentIds.set(asset.symbol, instrumentId);
            openedInstrumentIds.push(instrumentId);
          }

          const created = await transactionClient.transactionImport.create({
            data: {
              portfolioId,
              fileName: file.name,
              fileDigest: file.digest,
              formats: file.formats,
              rowCount: rows.length,
              importedCount: plan.recorded.length,
              openedInstrumentIds
            },
            select: { id: true }
          });

          const recorded =
            await transactionClient.transaction.createManyAndReturn({
              data: plan.recorded.map(
                ({ key, format, entry, executedAt, source }) => {
                  const instrumentId = instrumentIds.get(entry.symbol);

                  if (instrumentId === undefined)
                    throw new Error(
                      `No instrument resolved for ${entry.symbol}`
                    );

                  return {
                    portfolioId,
                    instrumentId,
                    importId: created.id,
                    importKey: key,
                    importedRow: { format, ...source },
                    type: entry.type,
                    quantity: entry.quantity,
                    unitPrice: entry.unitPrice,
                    fees: entry.fees,
                    taxes: entry.taxes,
                    currency: entry.currency,
                    executedAt,
                    broker: entry.broker,
                    notes: entry.notes
                  };
                }
              ),
              select: { importKey: true, sequence: true }
            });
          const sequenceByKey = new Map(
            recorded.map(({ importKey, sequence }) => [importKey, sequence])
          );
          const sequences = plan.recorded.map(({ key }) =>
            sequenceByKey.get(key)
          );

          if (
            sequences.some(
              (sequence, index) =>
                sequence === undefined ||
                (index > 0 && sequence <= (sequences[index - 1] ?? sequence))
            )
          )
            throw new Error(
              'Imported transactions were not sequenced in order'
            );

          for (const asset of plan.assets) {
            const instrumentId = instrumentIds.get(asset.symbol);

            if (
              !recordedSymbols.has(asset.symbol) ||
              instrumentId === undefined
            )
              continue;

            if (asset.after === null)
              throw new Error(`No position rebuilt for ${asset.symbol}`);

            await storePosition(
              transactionClient,
              { portfolioId, instrumentId },
              asset.after
            );
          }

          const transactionImport =
            await transactionClient.transactionImport.findUniqueOrThrow({
              where: { id: created.id },
              select: IMPORT_SELECTION
            });

          return {
            outcome: 'recorded',
            transactionImport: toTransactionImport(transactionImport),
            plan
          };
        },
        { timeout: ImportLimits.RECORD_TIMEOUT_MS }
      );
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error))
        return { outcome: 'conflict' };

      throw error;
    }
  }

  async getAll(
    params: TransactionImportRepository.GetAllParams
  ): Promise<Page<TransactionImport>> {
    const { portfolioId, page, pageSize } = params;
    const where = { portfolioId };

    const [total, rows] = await Promise.all([
      this.prismaClient.transactionImport.count({ where }),
      this.prismaClient.transactionImport.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: IMPORT_SELECTION
      })
    ]);

    return {
      items: rows.map(toTransactionImport),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async undo(
    params: TransactionImportRepository.UndoParams
  ): Promise<TransactionImportRepository.UndoOutcome> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable(
      async (transactionClient) => {
        const transactionImport =
          await transactionClient.transactionImport.findFirst({
            where: { id, portfolio: { userId } },
            select: {
              portfolioId: true,
              openedInstrumentIds: true,
              undoneAt: true
            }
          });

        if (!transactionImport) return { outcome: 'not-found' };
        if (transactionImport.undoneAt !== null)
          return { outcome: 'already-undone' };

        const { portfolioId, openedInstrumentIds } = transactionImport;
        const imported = await transactionClient.transaction.findMany({
          where: { importId: id },
          distinct: ['instrumentId'],
          select: { instrumentId: true }
        });
        const instrumentIds = [
          ...new Set([
            ...imported.map(({ instrumentId }) => instrumentId),
            ...openedInstrumentIds
          ])
        ];
        const ledger = await transactionClient.transaction.findMany({
          where: { portfolioId, instrumentId: { in: instrumentIds } },
          select: { ...LEDGER_SELECTION, importId: true }
        });
        const remainingByInstrument = Map.groupBy(
          ledger.filter(({ importId }) => importId !== id),
          ({ instrumentId }) => instrumentId
        );
        const rebuilt = new Map<string, RebuiltPosition>();

        for (const instrumentId of instrumentIds) {
          const rebuild = rebuildPosition(
            remainingByInstrument.get(instrumentId) ?? []
          );

          if (rebuild.outcome !== 'rebuilt') return rebuild;

          rebuilt.set(instrumentId, rebuild.position);
        }

        await transactionClient.transaction.deleteMany({
          where: { importId: id }
        });

        for (const [instrumentId, position] of rebuilt) {
          const isEmptied = !remainingByInstrument.has(instrumentId);

          if (isEmptied && openedInstrumentIds.includes(instrumentId))
            await transactionClient.position.deleteMany({
              where: { portfolioId, instrumentId }
            });
          else
            await transactionClient.position.updateMany({
              where: { portfolioId, instrumentId },
              data: position
            });
        }

        await transactionClient.transactionImport.update({
          where: { id },
          data: { undoneAt: new Date() }
        });

        return { outcome: 'undone' };
      },
      { timeout: ImportLimits.RECORD_TIMEOUT_MS }
    );
  }
}

namespace TransactionImportRepository {
  export type PlanningScope = Record<'portfolioId' | 'userId', string> &
    Record<'rows', ReadonlyArray<ReadRow>>;
  export type PlanParams = PlanningScope &
    Record<'listings', ReadonlyMap<string, ListingResolution>> &
    Partial<Record<'selection', ReadonlySet<string> | null>>;
  export type RecordParams = PlanningScope &
    Record<'listings', ReadonlyMap<string, ListingResolution>> &
    Record<'selection', ReadonlySet<string>> &
    Record<
      'file',
      Record<'name' | 'digest', string> & Record<'formats', Array<string>>
    >;
  export type RecordOutcome =
    | (Record<'outcome', 'recorded'> &
        Record<'transactionImport', TransactionImport> &
        Record<'plan', ImportPlan>)
    | (Record<'outcome', 'changed'> & Record<'plan', ImportPlan>)
    | Record<'outcome', 'conflict'>;
  export type GetAllParams = Record<'portfolioId', string> &
    Record<'page' | 'pageSize', number>;
  export type UndoParams = Record<'id' | 'userId', string>;
  export type UndoOutcome =
    | { outcome: 'undone' }
    | { outcome: 'not-found' }
    | { outcome: 'already-undone' }
    | LedgerRefusal;
}
