import type { TransactionTypes } from '@/config';
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

  async count(params?: TransactionRepository.GetCountParams) {
    const { type } = params ?? {};

    return type
      ? await this.prismaClient.transaction.count({ where: { type } })
      : await this.prismaClient.transaction.count();
  }

  async getAll(params: TransactionRepository.GetAllParams) {
    const { assetSymbol, limit, page = 1 } = params;

    const limitPerPage = limit || limit === 0 ? limit : 10;

    const [total, docs] = await Promise.all([
      this.prismaClient.transaction.count({ where: { assetSymbol } }),
      this.prismaClient.transaction.findMany({
        where: { assetSymbol },
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
    return this.prismaClient.transaction.findUnique({
      where: { id }
    });
  }

  async add(params: TransactionRepository.AddParams) {
    const { assetSymbol, ...rest } = params;

    return this.prismaClient.transaction.create({
      data: {
        ...rest,
        asset: { connect: { symbol: assetSymbol } }
      }
    });
  }

  async update(params: TransactionRepository.UpdateParams) {
    const { id, ...rest } = params;

    return this.prismaClient.transaction.update({
      where: { id },
      data: { ...rest }
    });
  }

  async delete(id: string) {
    return this.prismaClient.transaction.delete({
      where: { id }
    });
  }

  async deleteAllByAssetSymbol(assetSymbol: string) {
    return this.prismaClient.transaction.deleteMany({
      where: { assetSymbol }
    });
  }
}

namespace TransactionRepository {
  export type AddParams = Pick<
    Transaction,
    'type' | 'amount' | 'price' | 'assetSymbol'
  >;
  export type GetCountParams = Record<'type', keyof typeof TransactionTypes>;
  export type GetAllParams = Pick<Transaction, 'assetSymbol'> & {
    page?: number;
    limit?: number;
  };
  export type UpdateParams = Pick<
    Transaction,
    'id' | 'type' | 'amount' | 'price'
  >;
}
