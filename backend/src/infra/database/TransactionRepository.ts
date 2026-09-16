import type { Prisma, Transaction as TransactionRow } from '@prisma/client';

import type {
  Instrument,
  Transaction,
  TransactionEntry
} from '@/domain/models';
import {
  type LedgerRefusal,
  type RebuiltPosition,
  rebuildPosition
} from '@/domain/PositionLedger';
import type { Page } from '@/interfaces';

import { PrismaClient } from './PrismaClient';

const toTransaction = ({
  sequence,
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

const ledgerOf = (
  transactionClient: Prisma.TransactionClient,
  { portfolioId, instrumentId }: TransactionRepository.AssetScope
) =>
  transactionClient.transaction.findMany({
    where: { portfolioId, instrumentId },
    select: {
      id: true,
      sequence: true,
      type: true,
      quantity: true,
      unitPrice: true,
      fees: true,
      taxes: true,
      currency: true,
      executedAt: true
    }
  });

/**
 * Deleting or moving a position takes its transactions along, so a ledger
 * without its position is a broken invariant, surfaced by the update instead of
 * answered as a missing row.
 */
const storePosition = (
  transactionClient: Prisma.TransactionClient,
  { portfolioId, instrumentId }: TransactionRepository.AssetScope,
  { quantity, averageCost, investedValue }: RebuiltPosition
) =>
  transactionClient.position.update({
    where: { portfolioId_instrumentId: { portfolioId, instrumentId } },
    data: { quantity, averageCost, investedValue }
  });

export type TransactionListQuery = Pick<Transaction, 'portfolioId'> &
  Partial<
    Pick<Transaction, 'type'> &
      Record<'symbol' | 'broker', string> &
      Record<'dateFrom' | 'dateTo', Date>
  > &
  Record<'page' | 'pageSize', number>;

export type ListedTransaction = Transaction & Pick<Instrument, 'symbol'>;

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

  async countByType(
    params: TransactionRepository.CountByTypeParams
  ): Promise<Array<TransactionRepository.TypeCount>> {
    const { portfolioId, instrumentIds } = params;

    const groups = await this.prismaClient.transaction.groupBy({
      by: ['instrumentId', 'type'],
      where: { portfolioId, instrumentId: { in: instrumentIds } },
      _count: { _all: true }
    });

    return groups.map(({ instrumentId, type, _count }) => ({
      instrumentId,
      type,
      count: _count._all
    }));
  }

  /** Newest first, the reverse of ledger order, with inclusive execution time bounds. */
  async getAll(params: TransactionListQuery): Promise<Page<ListedTransaction>> {
    const {
      portfolioId,
      symbol,
      type,
      broker,
      dateFrom,
      dateTo,
      page,
      pageSize
    } = params;

    const where: Prisma.TransactionWhereInput = {
      portfolioId,
      type,
      instrument: symbol === undefined ? undefined : { symbol },
      broker,
      executedAt: { gte: dateFrom, lte: dateTo }
    };

    const [total, rows] = await Promise.all([
      this.prismaClient.transaction.count({ where }),
      this.prismaClient.transaction.findMany({
        where,
        include: { instrument: { select: { symbol: true } } },
        orderBy: [{ executedAt: 'desc' }, { sequence: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      items: rows.map(({ instrument, ...row }) => ({
        ...toTransaction(row),
        symbol: instrument.symbol
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  /**
   * Every transaction of the portfolio executed before `to`, in ledger order,
   * with the instrument each one moves. The whole ledger is read at once so a
   * position can be replayed at each day of a range without a query per day.
   */
  async getLedgerUpTo(
    params: Pick<Transaction, 'portfolioId'> & Record<'to', Date>
  ) {
    const { portfolioId, to } = params;

    return this.prismaClient.transaction.findMany({
      where: { portfolioId, executedAt: { lt: to } },
      orderBy: [{ executedAt: 'asc' }, { sequence: 'asc' }],
      select: {
        instrumentId: true,
        sequence: true,
        type: true,
        quantity: true,
        unitPrice: true,
        fees: true,
        taxes: true,
        currency: true,
        executedAt: true
      }
    });
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
   * touches nothing. The new row has no sequence until it is recorded, so it is
   * replayed after every row executed at the same time, which is where the
   * sequence the database assigns places it.
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
        const rebuild = rebuildPosition([...ledger, entry]);

        if (rebuild.outcome !== 'rebuilt') return rebuild;

        const transaction = await transactionClient.transaction.create({
          data: { ...entry, portfolioId, instrumentId: position.instrumentId }
        });
        await storePosition(transactionClient, position, rebuild.position);

        return {
          outcome: 'recorded',
          transaction: toTransaction(transaction)
        };
      }
    );
  }

  /** Replaces the row, keeping its recording order, under the guarantees of `add`. */
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
        const rebuild = rebuildPosition(
          ledger.map((row) => (row.id === id ? { ...row, ...entry } : row))
        );

        if (rebuild.outcome !== 'rebuilt') return rebuild;

        await transactionClient.transaction.update({
          where: { id },
          data: entry
        });
        await storePosition(transactionClient, previous, rebuild.position);

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
        const rebuild = rebuildPosition(ledger.filter((row) => row.id !== id));

        if (rebuild.outcome !== 'rebuilt') return rebuild;

        await transactionClient.transaction.delete({ where: { id } });
        await storePosition(transactionClient, previous, rebuild.position);

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
  export type CountByTypeParams = Pick<Transaction, 'portfolioId'> &
    Record<'instrumentIds', Array<Transaction['instrumentId']>>;
  export type TypeCount = Pick<Transaction, 'instrumentId' | 'type'> &
    Record<'count', number>;
  export type GetByIdParams = Pick<Transaction, 'id'> &
    Record<'userId', string>;
  export type UpdateParams = TransactionEntry & GetByIdParams;
  /** `not-found` answers a transaction or asset outside the caller's portfolios exactly like a missing one. */
  export type LedgerRejection = { outcome: 'not-found' } | LedgerRefusal;
  export type LedgerWrite = { outcome: 'recorded' } | LedgerRejection;
  export type LedgerAddition =
    { outcome: 'recorded'; transaction: Transaction } | LedgerRejection;
}
