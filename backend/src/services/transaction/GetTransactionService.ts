import { PortfolioMessages, TransactionMessages } from '@/config';
import type { Transaction } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type {
  PortfolioRepository,
  TransactionRepository
} from '@/infra/database';

export class GetTransactionService {
  private static INSTANCE: GetTransactionService;
  private readonly transactionRepository: TransactionRepository;
  private readonly portfolioRepository: PortfolioRepository;

  private constructor(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository
  ) {
    this.transactionRepository = transactionRepository;
    this.portfolioRepository = portfolioRepository;
  }

  static getInstance(
    transactionRepository: TransactionRepository,
    portfolioRepository: PortfolioRepository
  ) {
    if (!GetTransactionService.INSTANCE)
      GetTransactionService.INSTANCE = new GetTransactionService(
        transactionRepository,
        portfolioRepository
      );

    return GetTransactionService.INSTANCE;
  }

  async execute({
    id,
    userId
  }: GetTransactionService.DTO): Promise<GetTransactionService.Result> {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    if (!portfolioExists) throw new NotFoundError(PortfolioMessages.NOT_FOUND);

    const transactionExists = await this.transactionRepository.getById({
      id,
      portfolioId: portfolioExists.id
    });

    if (!transactionExists)
      throw new NotFoundError(TransactionMessages.NOT_FOUND);

    return { ...(transactionExists as Transaction) };
  }
}

namespace GetTransactionService {
  export type DTO = Pick<Transaction, 'id'> & Record<'userId', string>;
  export type Result = Transaction;
}
