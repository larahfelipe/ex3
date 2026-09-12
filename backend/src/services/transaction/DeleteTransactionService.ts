import { TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type { TransactionRepository } from '@/infra/database';

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

    if (ledgerWrite.outcome === 'negative-amount')
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    return {
      message: TransactionMessages.DELETED
    };
  }
}

namespace DeleteTransactionService {
  export type DTO = Pick<Transaction, 'id'> & Record<'userId', string>;
  export type Result = Record<'message', string>;
}
