import { Router, type Application } from 'express';

import { UploadRoutes } from '@/config/Constants';
import {
  createTransactionImportControllerHandler,
  getAllTransactionImportsControllerHandler,
  previewTransactionImportControllerHandler,
  undoTransactionImportControllerHandler
} from '@/controllers/transaction-import';
import {
  authMiddleware,
  transactionImportRateLimitMiddleware,
  uploadBodyMiddleware
} from '@/middleware';

const transactionImportRouter = Router();

transactionImportRouter.post(
  UploadRoutes.TRANSACTION_IMPORT_PREVIEW,
  authMiddleware,
  transactionImportRateLimitMiddleware,
  uploadBodyMiddleware,
  previewTransactionImportControllerHandler as Application
);

transactionImportRouter.post(
  UploadRoutes.TRANSACTION_IMPORT,
  authMiddleware,
  transactionImportRateLimitMiddleware,
  uploadBodyMiddleware,
  createTransactionImportControllerHandler as Application
);

transactionImportRouter.get(
  '/v1/transaction-imports',
  authMiddleware,
  getAllTransactionImportsControllerHandler as Application
);

transactionImportRouter.delete(
  '/v1/transaction-import/:id',
  authMiddleware,
  undoTransactionImportControllerHandler as Application
);

export { transactionImportRouter };
