import type { Request, Response } from 'express';

import {
  PortfolioRepository,
  TransactionImportRepository
} from '@/infra/database';
import { CatalogListingSource } from '@/infra/market-data';
import {
  CreateTransactionImportService,
  GetAllTransactionImportsService,
  PreviewTransactionImportService,
  UndoTransactionImportService
} from '@/services/transaction-import';

import { CreateTransactionImportController } from './CreateTransactionImportController';
import { GetAllTransactionImportsController } from './GetAllTransactionImportsController';
import { PreviewTransactionImportController } from './PreviewTransactionImportController';
import { UndoTransactionImportController } from './UndoTransactionImportController';

export const previewTransactionImportControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionImportRepository = TransactionImportRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const listingSource = CatalogListingSource.getInstance();

  const previewTransactionImportService =
    PreviewTransactionImportService.getInstance(
      transactionImportRepository,
      portfolioRepository,
      listingSource
    );

  const previewTransactionImportController =
    PreviewTransactionImportController.getInstance(
      previewTransactionImportService
    );

  return previewTransactionImportController.handle(req, res);
};

export const createTransactionImportControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionImportRepository = TransactionImportRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();
  const listingSource = CatalogListingSource.getInstance();

  const createTransactionImportService =
    CreateTransactionImportService.getInstance(
      transactionImportRepository,
      portfolioRepository,
      listingSource
    );

  const createTransactionImportController =
    CreateTransactionImportController.getInstance(
      createTransactionImportService
    );

  return createTransactionImportController.handle(req, res);
};

export const getAllTransactionImportsControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionImportRepository = TransactionImportRepository.getInstance();
  const portfolioRepository = PortfolioRepository.getInstance();

  const getAllTransactionImportsService =
    GetAllTransactionImportsService.getInstance(
      transactionImportRepository,
      portfolioRepository
    );

  const getAllTransactionImportsController =
    GetAllTransactionImportsController.getInstance(
      getAllTransactionImportsService
    );

  return getAllTransactionImportsController.handle(req, res);
};

export const undoTransactionImportControllerHandler = (
  req: Request,
  res: Response
) => {
  const transactionImportRepository = TransactionImportRepository.getInstance();

  const undoTransactionImportService = UndoTransactionImportService.getInstance(
    transactionImportRepository
  );

  const undoTransactionImportController =
    UndoTransactionImportController.getInstance(undoTransactionImportService);

  return undoTransactionImportController.handle(req, res);
};
