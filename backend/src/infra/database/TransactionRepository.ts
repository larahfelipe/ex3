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

  async getAll() {
    const transactions = await this.prismaClient.transaction.findMany();

    return transactions;
  }

  async getAllByAssetId(assetId: string) {
    const transactions = await this.prismaClient.transaction.findMany({
      where: {
        assetId
      }
    });

    return transactions;
  }

  async getById(id: string) {
    const transaction = await this.prismaClient.transaction.findUnique({
      where: {
        id
      }
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
      where: {
        id
      },
      data: {
        ...rest
      }
    });

    return updatedTransaction;
  }

  async delete(id: string) {
    await this.prismaClient.transaction.delete({
      where: {
        id
      }
    });
  }
}

namespace TransactionRepository {
  export type AddParams = Pick<
    Transaction,
    'assetId' | 'type' | 'amount' | 'price'
  >;
  export type UpdateParams = Pick<
    Transaction,
    'id' | 'type' | 'amount' | 'price'
  >;
}
