import { Router, type Application } from 'express';

import {
  createTransactionControllerHandler,
  deleteTransactionControllerHandler,
  getAllTransactionsControllerHandler,
  getTransactionControllerHandler,
  getTransactionsCountControllerHandler,
  updateTransactionControllerHandler
} from '@/controllers/transaction';
import { authMiddleware } from '@/middleware';

const transactionRouter = Router();

transactionRouter.get(
  '/v1/transaction/:id',
  authMiddleware,
  getTransactionControllerHandler as Application
);

transactionRouter.get(
  '/v1/transactions/:assetSymbol',
  authMiddleware,
  getAllTransactionsControllerHandler as Application
);

transactionRouter.get(
  '/v1/transactions/:assetSymbol/count',
  authMiddleware,
  getTransactionsCountControllerHandler as Application
);

transactionRouter.post(
  '/v1/transaction',
  authMiddleware,
  createTransactionControllerHandler as Application
);

transactionRouter.patch(
  '/v1/transaction/:id',
  authMiddleware,
  updateTransactionControllerHandler as Application
);

transactionRouter.delete(
  '/v1/transaction/:id',
  authMiddleware,
  deleteTransactionControllerHandler as Application
);

export { transactionRouter };
