import { Prisma, type Transaction as TransactionRow } from '@prisma/client';

import { DecimalColumn, TransactionTypes } from '@/config/Constants';
import type { Position, Transaction, TransactionEntry } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

type LedgerEntry = Pick<Transaction, 'type' | 'currency'> &
  Record<'quantity' | 'unitPrice' | 'fees' | 'taxes', Prisma.Decimal | string>;
type LedgerPlacement = Pick<Transaction, 'id' | 'executedAt' | 'createdAt'>;
type RebuiltPosition = Pick<Position, 'quantity' | 'averageCost' | 'balance'>;
type LedgerReplay =
  | { outcome: 'rebuilt'; position: RebuiltPosition }
  | TransactionRepository.LedgerRefusal;

/**
 * No operation of a replay rounds at this precision. Every position it passes
 * through fits the columns, so a product of two column values has at most
 * 2 × PRECISION significant digits, adding the rest of a BUY's cost carries at
 * most one more, and the average cost is the integer quotient of that cost,
 * shifted by the scale, by a quantity of at least one unit of the scale.
 */
const LEDGER_ARITHMETIC_PRECISION = 2 * DecimalColumn.PRECISION + 1;

const LedgerDecimal = Prisma.Decimal.clone({
  precision: LEDGER_ARITHMETIC_PRECISION
});

const ZERO = new LedgerDecimal(0);
const COLUMN_SCALE_FACTOR = new LedgerDecimal(10).pow(DecimalColumn.SCALE);
const COLUMN_MAGNITUDE_BOUND = new LedgerDecimal(10).pow(
  DecimalColumn.PRECISION - DecimalColumn.SCALE
);

const toTransaction = ({
  quantity,
  unitPrice,
  fees,
  taxes,
  ...row
}: TransactionRow): Transaction => ({
  ...row,
  quantity: quantity.toFixed(),
  unitPrice: unitPrice.toFixed(),
  fees: fees.toFixed(),
  taxes: taxes.toFixed()
});

/**
 * A ledger holds one currency, since costs in different currencies do not add
 * up. A BUY adds its quantity and its cost, quantity × unit price plus fees and
 * taxes, and truncates the new average cost to the column scale; a SELL leaves
 * the average cost unchanged, back to zero once nothing is held, and is refused
 * when it exceeds what the ledger holds at that point. `balance` keeps its
 * legacy meaning, the running sum of ±quantity × unit price, truncated to the
 * column scale at the end. A ledger passing through a position that does not
 * fit the columns is refused. The migration that converted the ledger to
 * decimals repeats these operations, so both reach the same values.
 */
const replayLedger = (ledger: ReadonlyArray<LedgerEntry>): LedgerReplay => {
  if (new Set(ledger.map(({ currency }) => currency)).size > 1)
    return { outcome: 'currency-mismatch' };

  let quantity = ZERO;
  let averageCost = ZERO;
  let balance = ZERO;

  for (const entry of ledger) {
    const entryQuantity = new LedgerDecimal(entry.quantity);
    const grossValue = entryQuantity.mul(entry.unitPrice);

    if (entry.type === TransactionTypes.BUY) {
      const heldQuantity = quantity.add(entryQuantity);
      const totalCost = quantity
        .mul(averageCost)
        .add(grossValue)
        .add(entry.fees)
        .add(entry.taxes);

      averageCost = totalCost
        .mul(COLUMN_SCALE_FACTOR)
        .divToInt(heldQuantity)
        .div(COLUMN_SCALE_FACTOR);
      quantity = heldQuantity;
      balance = balance.add(grossValue);
    } else if (entry.type === TransactionTypes.SELL) {
      if (entryQuantity.gt(quantity)) return { outcome: 'negative-amount' };

      quantity = quantity.sub(entryQuantity);
      averageCost = quantity.isZero() ? ZERO : averageCost;
      balance = balance.sub(grossValue);
    } else {
      throw new Error(`The ledger replay does not implement ${entry.type}`);
    }

    if (
      [quantity, averageCost, balance.abs()].some((value) =>
        value.gte(COLUMN_MAGNITUDE_BOUND)
      )
    )
      return { outcome: 'out-of-range' };
  }

  return {
    outcome: 'rebuilt',
    position: {
      quantity: quantity.toFixed(),
      averageCost: averageCost.toFixed(),
      balance: balance
        .toDecimalPlaces(DecimalColumn.SCALE, LedgerDecimal.ROUND_DOWN)
        .toFixed()
    }
  };
};

const ledgerOf = (
  transactionClient: Prisma.TransactionClient,
  { portfolioId, instrumentId }: TransactionRepository.AssetScope
) =>
  transactionClient.transaction.findMany({
    where: { portfolioId, instrumentId },
    orderBy: [{ executedAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      type: true,
      quantity: true,
      unitPrice: true,
      fees: true,
      taxes: true,
      currency: true,
      executedAt: true,
      createdAt: true
    }
  });

const byLedgerOrder = (a: LedgerPlacement, b: LedgerPlacement) =>
  a.executedAt.getTime() - b.executedAt.getTime() ||
  a.createdAt.getTime() - b.createdAt.getTime() ||
  (a.id < b.id ? -1 : Number(a.id > b.id));

/**
 * Deleting or moving a position takes its transactions along, so a ledger
 * without its position is a broken invariant, surfaced by the update instead of
 * answered as a missing row.
 */
const storePosition = (
  transactionClient: Prisma.TransactionClient,
  { portfolioId, instrumentId }: TransactionRepository.AssetScope,
  position: RebuiltPosition
) =>
  transactionClient.position.update({
    where: { portfolioId_instrumentId: { portfolioId, instrumentId } },
    data: position
  });

/**
 * Lookups by asset are filtered by a portfolio the caller already proved to own,
 * and lookups by transaction id by the owner of the transaction's portfolio, so
 * an id or a symbol taken from a request never reaches another user's rows.
 * Writes by id follow such a lookup inside the same database transaction.
 */
export class TransactionRepository {
  private static INSTANCE: TransactionRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!TransactionRepository.INSTANCE)
      TransactionRepository.INSTANCE = new TransactionRepository();

    return TransactionRepository.INSTANCE;
  }

  async count(params: TransactionRepository.CountParams) {
    const { type, instrumentId, portfolioId } = params;

    return this.prismaClient.transaction.count({
      where: { type, instrumentId, portfolioId }
    });
  }

  async getAll(params: TransactionRepository.GetAllParams) {
    const { instrumentId, portfolioId, limit, lastId, page = 1 } = params;

    const limitPerPage = limit || limit === 0 ? limit : 10;
    const ownedByAsset = { instrumentId, portfolioId };

    const [total, docs] = await Promise.all([
      this.prismaClient.transaction.count({ where: ownedByAsset }),
      this.prismaClient.transaction.findMany({
        ...(limit !== 0 && { take: limitPerPage }),
        where: { ...ownedByAsset, ...(lastId && { id: { lt: lastId } }) },
        orderBy: { id: 'desc' }
      })
    ]);

    const totalPages = Math.ceil(total / limitPerPage);

    return {
      docs: docs.map(toTransaction),
      pagination: {
        page,
        total,
        limit: limitPerPage,
        totalPages: totalPages !== Infinity ? totalPages : 1,
        lastId: docs.length > 0 ? docs[docs.length - 1].id : null
      }
    };
  }

  async getById(params: TransactionRepository.GetByIdParams) {
    const { id, userId } = params;

    const transaction = await this.prismaClient.transaction.findFirst({
      where: { id, portfolio: { userId } }
    });

    return transaction && toTransaction(transaction);
  }

  /**
   * The position is rebuilt from the ledger as it will stand after the write,
   * and both are written in one serializable transaction, so the ledger a SELL
   * is checked against cannot change before the write commits. A refused write
   * touches nothing. A new row goes after every row executed at or before its
   * execution time, which is where its creation time places it.
   */
  async add(
    params: TransactionRepository.AddParams
  ): Promise<TransactionRepository.LedgerAddition> {
    const { assetSymbol, portfolioId, ...entry } = params;

    return this.prismaClient.runSerializable<TransactionRepository.LedgerAddition>(
      async (transactionClient) => {
        const position = await transactionClient.position.findFirst({
          where: { portfolioId, instrument: { symbol: assetSymbol } }
        });

        if (!position) return { outcome: 'not-found' };

        const ledger = await ledgerOf(transactionClient, position);
        const insertAt =
          ledger.findLastIndex(
            ({ executedAt }) =>
              executedAt.getTime() <= entry.executedAt.getTime()
          ) + 1;
        const replay = replayLedger([
          ...ledger.slice(0, insertAt),
          entry,
          ...ledger.slice(insertAt)
        ]);

        if (replay.outcome !== 'rebuilt') return replay;

        const transaction = await transactionClient.transaction.create({
          data: { ...entry, portfolioId, instrumentId: position.instrumentId }
        });
        await storePosition(transactionClient, position, replay.position);

        return {
          outcome: 'recorded',
          transaction: toTransaction(transaction)
        };
      }
    );
  }

  /** Replaces the row and moves it to its place in the ledger, under the guarantees of `add`. */
  async update(
    params: TransactionRepository.UpdateParams
  ): Promise<TransactionRepository.LedgerWrite> {
    const { id, userId, ...entry } = params;

    return this.prismaClient.runSerializable<TransactionRepository.LedgerWrite>(
      async (transactionClient) => {
        const previous = await transactionClient.transaction.findFirst({
          where: { id, portfolio: { userId } }
        });

        if (!previous) return { outcome: 'not-found' };

        const ledger = await ledgerOf(transactionClient, previous);
        const replay = replayLedger(
          ledger
            .map((row) => (row.id === id ? { ...row, ...entry } : row))
            .toSorted(byLedgerOrder)
        );

        if (replay.outcome !== 'rebuilt') return replay;

        await transactionClient.transaction.update({
          where: { id },
          data: entry
        });
        await storePosition(transactionClient, previous, replay.position);

        return { outcome: 'recorded' };
      }
    );
  }

  /** Removes the row from the ledger, under the guarantees of `add`. */
  async delete(
    params: TransactionRepository.GetByIdParams
  ): Promise<TransactionRepository.LedgerWrite> {
    const { id, userId } = params;

    return this.prismaClient.runSerializable<TransactionRepository.LedgerWrite>(
      async (transactionClient) => {
        const previous = await transactionClient.transaction.findFirst({
          where: { id, portfolio: { userId } }
        });

        if (!previous) return { outcome: 'not-found' };

        const ledger = await ledgerOf(transactionClient, previous);
        const replay = replayLedger(ledger.filter((row) => row.id !== id));

        if (replay.outcome !== 'rebuilt') return replay;

        await transactionClient.transaction.delete({ where: { id } });
        await storePosition(transactionClient, previous, replay.position);

        return { outcome: 'recorded' };
      }
    );
  }
}

namespace TransactionRepository {
  export type AssetScope = Pick<Transaction, 'instrumentId' | 'portfolioId'>;
  export type AddParams = TransactionEntry &
    Pick<Transaction, 'portfolioId'> &
    Record<'assetSymbol', string>;
  export type CountParams = AssetScope &
    Record<'type', keyof typeof TransactionTypes>;
  export type GetAllParams = AssetScope & {
    lastId?: string;
    page?: number;
    limit?: number;
  };
  export type GetByIdParams = Pick<Transaction, 'id'> &
    Record<'userId', string>;
  export type UpdateParams = TransactionEntry & GetByIdParams;
  export type LedgerRefusal =
    | { outcome: 'negative-amount' }
    | { outcome: 'currency-mismatch' }
    | { outcome: 'out-of-range' };
  /** `not-found` answers a transaction or asset outside the caller's portfolios exactly like a missing one. */
  export type LedgerRejection = { outcome: 'not-found' } | LedgerRefusal;
  export type LedgerWrite = { outcome: 'recorded' } | LedgerRejection;
  export type LedgerAddition =
    { outcome: 'recorded'; transaction: Transaction } | LedgerRejection;
}
