import { TransactionImportMessages } from '@/config';
import { ConflictError, DomainError, NotFoundError } from '@/errors';
import type { TransactionImportRepository } from '@/infra/database';

import { ledgerRefusalError } from '../transaction/LedgerRefusalError';

export class UndoTransactionImportService {
  private static INSTANCE: UndoTransactionImportService;
  private readonly transactionImportRepository: TransactionImportRepository;

  private constructor(
    transactionImportRepository: TransactionImportRepository
  ) {
    this.transactionImportRepository = transactionImportRepository;
  }

  static getInstance(transactionImportRepository: TransactionImportRepository) {
    if (!UndoTransactionImportService.INSTANCE)
      UndoTransactionImportService.INSTANCE = new UndoTransactionImportService(
        transactionImportRepository
      );

    return UndoTransactionImportService.INSTANCE;
  }

  async execute({
    id,
    userId
  }: UndoTransactionImportService.DTO): Promise<UndoTransactionImportService.Result> {
    const undo = await this.transactionImportRepository.undo({ id, userId });

    if (undo.outcome === 'not-found')
      throw new NotFoundError(TransactionImportMessages.NOT_FOUND);

    if (undo.outcome === 'already-undone')
      throw new ConflictError(TransactionImportMessages.ALREADY_UNDONE);

    if (undo.outcome === 'negative-amount')
      throw new DomainError(TransactionImportMessages.UNDO_OVERSOLD);

    if (undo.outcome !== 'undone') throw ledgerRefusalError(undo);

    return { message: TransactionImportMessages.UNDONE };
  }
}

namespace UndoTransactionImportService {
  export type DTO = Record<'id' | 'userId', string>;
  export type Result = Record<'message', string>;
}
