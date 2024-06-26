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
  authMiddleware as Application,
  getTransactionControllerHandler as Application
);

transactionRouter.get(
  '/v1/transactions/:assetSymbol',
  authMiddleware as Application,
  getAllTransactionsControllerHandler as Application
);

transactionRouter.get(
  '/v1/transactions/:assetSymbol/count',
  authMiddleware as Application,
  getTransactionsCountControllerHandler as Application
);

transactionRouter.post(
  '/v1/transaction',
  authMiddleware as Application,
  createTransactionControllerHandler as Application
);

transactionRouter.patch(
  '/v1/transaction/:id',
  authMiddleware as Application,
  updateTransactionControllerHandler as Application
);

transactionRouter.delete(
  '/v1/transaction/:id',
  authMiddleware as Application,
  deleteTransactionControllerHandler as Application
);

export { transactionRouter };
