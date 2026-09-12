import { TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { BadRequestError, NotFoundError } from '@/errors';
import type { TransactionRepository } from '@/infra/database';

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

  async execute({
    id,
    type,
    price,
    amount,
    userId
  }: UpdateTransactionService.DTO): Promise<UpdateTransactionService.Result> {
    const ledgerWrite = await this.transactionRepository.update({
      id,
      type,
      price,
      amount,
      userId
    });

    if (ledgerWrite.outcome === 'not-found')
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    if (ledgerWrite.outcome === 'negative-amount')
      throw new BadRequestError(TransactionMessages.ACC_NEGATIVE_AMOUNT);

    return {
      message: TransactionMessages.UPDATED
    };
  }
}

namespace UpdateTransactionService {
  export type DTO = Pick<Transaction, 'id' | 'type' | 'amount' | 'price'> &
    Record<'userId', string>;
  export type Result = Record<'message', string>;
}
