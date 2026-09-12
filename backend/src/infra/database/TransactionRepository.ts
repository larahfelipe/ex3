import type { Prisma, Transaction as TransactionRow } from '@prisma/client';

import { TransactionTypes } from '@/config';
import type { Transaction } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

/**
 * What a transaction contributes to its asset's position: a BUY adds its
 * quantity and cost, a SELL takes them away.
 */
const positionImpactOf = ({
  type,
  amount,
  price
}: Pick<TransactionRow, 'type' | 'amount' | 'price'>) => {
  const direction = type === TransactionTypes.BUY ? 1 : -1;

  return { amount: direction * amount, balance: direction * amount * price };
};

/**
 * Deleting or moving an asset takes its transactions along in the same database
 * transaction, so a stored transaction without the asset it moves is a broken
 * invariant, surfaced instead of answered as a missing row.
 */
const assetMovedBy = (
  transactionClient: Prisma.TransactionClient,
  {
    portfolioId,
    instrumentId
  }: Pick<TransactionRow, 'portfolioId' | 'instrumentId'>
) =>
  transactionClient.asset.findUniqueOrThrow({
    where: { portfolioId_instrumentId: { portfolioId, instrumentId } }
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
   * The ledger row and the position it moves are written in one serializable
   * transaction, so the position a SELL is checked against cannot change before
   * the write commits. Nothing is written when the position would go negative.
   */
  async add(
    params: TransactionRepository.AddParams
  ): Promise<TransactionRepository.LedgerAddition> {
    const { assetSymbol, portfolioId, ...entry } = params;

    return this.prismaClient.runSerializable<TransactionRepository.LedgerAddition>(
      async (transactionClient) => {
        const asset = await transactionClient.asset.findFirst({
          where: { portfolioId, instrument: { symbol: assetSymbol } }
        });

        if (!asset) return { outcome: 'not-found' };

        const applied = positionImpactOf(entry);
        const position = {
          amount: asset.amount + applied.amount,
          balance: asset.balance + applied.balance
        };

        if (position.amount < 0) return { outcome: 'negative-amount' };

        const transaction = await transactionClient.transaction.create({
          data: { ...entry, portfolioId, instrumentId: asset.instrumentId }
        });
        await transactionClient.asset.update({
          where: { id: asset.id },
          data: position
        });

        // The column is a plain string; the value just stored is the validated type.
        return {
          outcome: 'recorded',
          transaction: { ...transaction, type: entry.type }
        };
      }
    );
  }

  /** Removes the stored impact before applying the new one, under the guarantees of `add`. */
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

        const asset = await assetMovedBy(transactionClient, previous);
        const undone = positionImpactOf(previous);
        const applied = positionImpactOf(entry);
        const position = {
          amount: asset.amount - undone.amount + applied.amount,
          balance: asset.balance - undone.balance + applied.balance
        };

        if (position.amount < 0) return { outcome: 'negative-amount' };

        await transactionClient.transaction.update({
          where: { id },
          data: entry
        });
        await transactionClient.asset.update({
          where: { id: asset.id },
          data: position
        });

        return { outcome: 'recorded' };
      }
    );
  }

  /** Removes the stored impact along with the row, under the guarantees of `add`. */
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

        const asset = await assetMovedBy(transactionClient, previous);
        const undone = positionImpactOf(previous);
        const position = {
          amount: asset.amount - undone.amount,
          balance: asset.balance - undone.balance
        };

        if (position.amount < 0) return { outcome: 'negative-amount' };

        await transactionClient.transaction.delete({ where: { id } });
        await transactionClient.asset.update({
          where: { id: asset.id },
          data: position
        });

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
