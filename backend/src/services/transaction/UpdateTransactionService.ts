import { TransactionMessages } from '@/config';
import type { Transaction, TransactionEntry } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { TransactionRepository } from '@/infra/database';

import { ledgerRefusalError } from './LedgerRefusalError';

export class UpdateTransactionService {
  private static INSTANCE: UpdateTransactionService;
  private readonly transactionRepository: TransactionRepository;

  private constructor(transactionRepository: TransactionRepository) {
    this.transactionRepository = transactionRepository;
  }

  static getInstance(transactionRepository: TransactionRepository) {
    if (!UpdateTransactionService.INSTANCE)
      UpdateTransactionService.INSTANCE = new UpdateTransactionService(
        transactionRepository
      );

    return UpdateTransactionService.INSTANCE;
  }

  async execute(
    transaction: UpdateTransactionService.DTO
  ): Promise<UpdateTransactionService.Result> {
    const ledgerWrite = await this.transactionRepository.update(transaction);

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    if (ledgerWrite.outcome !== 'recorded')
      throw ledgerRefusalError(ledgerWrite);

    return {
      message: TransactionMessages.UPDATED
    };
  }
}

namespace UpdateTransactionService {
  export type DTO = TransactionEntry &
    Pick<Transaction, 'id'> &
    Record<'userId', string>;
  export type Result = Record<'message', string>;
}
