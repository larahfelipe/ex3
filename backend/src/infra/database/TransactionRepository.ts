import type { Transaction } from '@/domain/models';

import { PrismaClient } from './PrismaClient';

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

  async count() {
    const count = await this.prismaClient.transaction.count();

    return count;
  }

  async getAll(params: TransactionRepository.GetAllParams) {
    const { assetId, limit, page = 1 } = params;

    const limitPerPage = limit || limit === 0 ? limit : 10;

    const [total, docs] = await Promise.all([
      this.prismaClient.transaction.count({ where: { assetId } }),
      this.prismaClient.transaction.findMany({
        where: { assetId },
        take: limit !== 0 ? limitPerPage : undefined,
        skip: (page - 1) * limitPerPage || 0
      })
    ]);

    const totalPages = Math.ceil(total / limitPerPage);

    return {
      docs,
      pagination: {
        page,
        total,
        limit: limitPerPage,
        totalPages: totalPages !== Infinity ? totalPages : 1
      }
    };
  }

  async getById(id: string) {
    const transaction = await this.prismaClient.transaction.findUnique({
      where: { id }
    });

    return transaction;
  }

  async add(params: TransactionRepository.AddParams) {
    const { assetId, ...rest } = params;

    const newTransaction = await this.prismaClient.transaction.create({
      data: {
        ...rest,
        asset: {
          connect: {
            id: assetId
          }
        }
      }
    });

    return newTransaction;
  }

  async update(params: TransactionRepository.UpdateParams) {
    const { id, ...rest } = params;

    const updatedTransaction = await this.prismaClient.transaction.update({
      where: { id },
      data: {
        ...rest
      }
    });

    return updatedTransaction;
  }

  async delete(id: string) {
    await this.prismaClient.transaction.delete({
      where: { id }
    });
  }

  async deleteAllByAssetId(assetId: string) {
    const { count } = await this.prismaClient.transaction.deleteMany({
      where: { assetId }
    });

    return count;
  }
}

namespace TransactionRepository {
  export type AddParams = Pick<
    Transaction,
    'assetId' | 'type' | 'amount' | 'price'
  >;
  export type GetAllParams = Pick<Transaction, 'assetId'> & {
    page?: number;
    limit?: number;
  };
  export type UpdateParams = Pick<
    Transaction,
    'id' | 'type' | 'amount' | 'price'
  >;
}
