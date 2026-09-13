import type { Prisma, Transaction as TransactionRow } from '@prisma/client';

import { TransactionTypes } from '@/config';
import type { Position, Transaction } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

type LedgerEntry = Pick<TransactionRow, 'type' | 'amount' | 'price'>;
type LedgerScope = Pick<TransactionRow, 'portfolioId' | 'instrumentId'>;
type RebuiltPosition = Pick<Position, 'quantity' | 'averageCost' | 'balance'>;

const EMPTY_POSITION: RebuiltPosition = {
  quantity: 0,
  averageCost: 0,
  balance: 0
};

/**
 * A BUY weights the average cost by its quantity; a SELL leaves it unchanged,
 * back to zero once nothing is held, and is refused when it exceeds what the
 * ledger holds at that point. `balance` keeps its legacy meaning, the running
 * sum of ±amount × price. The migration that created `positions` repeats these
 * operations in this order, so both produce the same floating-point values.
 */
const replayLedger = (ledger: ReadonlyArray<LedgerEntry>) => {
  let position = EMPTY_POSITION;

  for (const { type, amount, price } of ledger) {
    const { quantity, averageCost, balance } = position;

    if (type === TransactionTypes.BUY) {
      position = {
        quantity: quantity + amount,
        averageCost:
          (quantity * averageCost + amount * price) / (quantity + amount),
        balance: balance + amount * price
      };
    } else if (amount > quantity) {
      return null;
    } else {
      const remaining = quantity - amount;

      position = {
        quantity: remaining,
        averageCost: remaining > 0 ? averageCost : 0,
        balance: balance - amount * price
      };
    }
  }

  return position;
};

const ledgerOf = (
  transactionClient: Prisma.TransactionClient,
  { portfolioId, instrumentId }: LedgerScope
) =>
  transactionClient.transaction.findMany({
    where: { portfolioId, instrumentId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true, type: true, amount: true, price: true }
  });

/**
 * Deleting or moving a position takes its transactions along, so a ledger
 * without its position is a broken invariant, surfaced by the update instead of
 * answered as a missing row.
 */
const storePosition = (
  transactionClient: Prisma.TransactionClient,
  { portfolioId, instrumentId }: LedgerScope,
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
      docs,
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

    return this.prismaClient.transaction.findFirst({
      where: { id, portfolio: { userId } }
    });
  }

  /**
   * The position is rebuilt from the ledger as it will stand after the write,
   * and both are written in one serializable transaction, so the ledger a SELL
   * is checked against cannot change before the write commits. A refused write
   * touches nothing. A new row goes after every row already in the ledger,
   * which is where its creation time places it.
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
        const rebuilt = replayLedger([...ledger, entry]);

        if (!rebuilt) return { outcome: 'negative-amount' };

        const transaction = await transactionClient.transaction.create({
          data: { ...entry, portfolioId, instrumentId: position.instrumentId }
        });
        await storePosition(transactionClient, position, rebuilt);

        // The column is a plain string; the value just stored is the validated type.
        return {
          outcome: 'recorded',
          transaction: { ...transaction, type: entry.type }
        };
      }
    );
  }

  /** Replaces the row in its place in the ledger, under the guarantees of `add`. */
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
        const rebuilt = replayLedger(
          ledger.map((row) => (row.id === id ? entry : row))
        );

        if (!rebuilt) return { outcome: 'negative-amount' };

        await transactionClient.transaction.update({
          where: { id },
          data: entry
        });
        await storePosition(transactionClient, previous, rebuilt);

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
        const rebuilt = replayLedger(ledger.filter((row) => row.id !== id));

        if (!rebuilt) return { outcome: 'negative-amount' };

        await transactionClient.transaction.delete({ where: { id } });
        await storePosition(transactionClient, previous, rebuilt);

        return { outcome: 'recorded' };
      }
    );
  }
}

namespace TransactionRepository {
  export type AssetScope = Pick<Transaction, 'instrumentId' | 'portfolioId'>;
  export type AddParams = Pick<
    Transaction,
    'type' | 'amount' | 'price' | 'portfolioId'
  > &
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
  export type UpdateParams = Pick<
    Transaction,
    'id' | 'type' | 'amount' | 'price'
  > &
    Record<'userId', string>;
  /** `not-found` answers a transaction or asset outside the caller's portfolios exactly like a missing one. */
  export type LedgerRejection =
    { outcome: 'not-found' } | { outcome: 'negative-amount' };
  export type LedgerWrite = { outcome: 'recorded' } | LedgerRejection;
  export type LedgerAddition =
    { outcome: 'recorded'; transaction: Transaction } | LedgerRejection;
}
