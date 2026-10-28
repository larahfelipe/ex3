import type { Request, Response } from 'express';

import { PortfolioRepository, TransactionRepository } from '@/infra/database';
import {
  CreateTransactionService,
  DeleteTransactionService,
  GetAllTransactionsService,
  GetTransactionService,
  UpdateTransactionService
} from '@/services/transaction';

import { CreateTransactionController } from './CreateTransactionController';
import { DeleteTransactionController } from './DeleteTransactionController';
import { GetAllTransactionsController } from './GetAllTransactionsController';
import { GetTransactionController } from './GetTransactionController';
import { UpdateTransactionController } from './UpdateTransactionController';

export const createTransactionControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionRepository = TransactionRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const createTransactionService = CreateTransactionService.getInstance(
    transactionRepository,
    portfolioRepository
  );

  const createTransactionController = CreateTransactionController.getInstance(
    createTransactionService
  );

  return createTransactionController.handle(req, res);
};

export const deleteTransactionControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionRepository = TransactionRepository.getInstance();

  const deleteTransactionService = DeleteTransactionService.getInstance(
    transactionRepository
  );

  const deleteTransactionController = DeleteTransactionController.getInstance(
    deleteTransactionService
  );

  return deleteTransactionController.handle(req, res);
};

export const getAllTransactionsControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionRepository = TransactionRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const getAllTransactionsService = GetAllTransactionsService.getInstance(
    transactionRepository,
    portfolioRepository
  );

  const getAllTransactionsController = GetAllTransactionsController.getInstance(
    getAllTransactionsService
  );

  return getAllTransactionsController.handle(req, res);
};

export const getTransactionControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionRepository = TransactionRepository.getInstance();

  const getTransactionService = GetTransactionService.getInstance(
    transactionRepository
  );

  const getTransactionController = GetTransactionController.getInstance(
    getTransactionService
  );

  return getTransactionController.handle(req, res);
};

export const updateTransactionControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionRepository = TransactionRepository.getInstance();

  const updateTransactionService = UpdateTransactionService.getInstance(
    transactionRepository
  );

  const updateTransactionController = UpdateTransactionController.getInstance(
    updateTransactionService
  );

  return updateTransactionController.handle(req, res);
};
