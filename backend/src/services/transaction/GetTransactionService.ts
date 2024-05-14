import { TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { TransactionRepository } from '@/infra/database';

export class GetTransactionService {
  private static INSTANCE: GetTransactionService;
  private readonly transactionRepository: TransactionRepository;

  private constructor(transactionRepository: TransactionRepository) {
    this.transactionRepository = transactionRepository;
  }

  static getInstance(transactionRepository: TransactionRepository) {
    if (!GetTransactionService.INSTANCE)
      GetTransactionService.INSTANCE = new GetTransactionService(
        transactionRepository
      );

    return GetTransactionService.INSTANCE;
  }

  async execute({
    id
  }: GetTransactionService.DTO): Promise<GetTransactionService.Result> {
    const transactionExists = await this.transactionRepository.getById(id);

    if (!transactionExists)
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    return { ...(transactionExists as Transaction) };
  }
}

namespace GetTransactionService {
  export type DTO = Pick<Transaction, 'id'>;
  export type Result = Transaction;
}
