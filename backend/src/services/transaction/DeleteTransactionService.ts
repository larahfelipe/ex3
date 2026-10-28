import { TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { TransactionRepository } from '@/infra/database';

import { ledgerRefusalError } from './LedgerRefusalError';

export class DeleteTransactionService {
  private static INSTANCE: DeleteTransactionService;
  private readonly transactionRepository: TransactionRepository;

  private constructor(transactionRepository: TransactionRepository) {
    this.transactionRepository = transactionRepository;
  }

  static getInstance(transactionRepository: TransactionRepository) {
    if (!DeleteTransactionService.INSTANCE)
      DeleteTransactionService.INSTANCE = new DeleteTransactionService(
        transactionRepository
      );

    return DeleteTransactionService.INSTANCE;
  }

  async execute({
    id,
    userId
  }: DeleteTransactionService.DTO): Promise<DeleteTransactionService.Result> {
    const ledgerWrite = await this.transactionRepository.delete({ id, userId });

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    if (ledgerWrite.outcome !== 'recorded')
      throw ledgerRefusalError(ledgerWrite);

    return {
      message: TransactionMessages.DELETED
    };
  }
}

namespace DeleteTransactionService {
  export type DTO = Pick<Transaction, 'id'> & Record<'userId', string>;
  export type Result = Record<'message', string>;
}
