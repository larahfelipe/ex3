import { Router, type Application } from 'express';

import {
  cancelInstallmentPlanControllerHandler,
  cancelRecurringExpenseControllerHandler,
  createExpenseControllerHandler,
  createInstallmentPlanControllerHandler,
  createRecurringExpenseControllerHandler,
  deleteExpenseControllerHandler,
  deleteInstallmentPlanControllerHandler,
  deleteRecurringExpenseControllerHandler,
  getAllExpensesControllerHandler,
  getAllInstallmentPlansControllerHandler,
  getAllPaymentsControllerHandler,
  getAllRecurringExpensesControllerHandler,
  getExpenseControllerHandler,
  getFinanceAlertsControllerHandler,
  getFinanceCalendarControllerHandler,
  getFinanceReportControllerHandler,
  getFinanceSettingsControllerHandler,
  getFinanceSummaryControllerHandler,
  getInstallmentPlanControllerHandler,
  getRecurringExpenseControllerHandler,
  recordPaymentControllerHandler,
  rescheduleInstallmentPlanControllerHandler,
  updateExpenseControllerHandler,
  updateFinanceSettingsControllerHandler,
  updateInstallmentPlanControllerHandler,
  updatePaymentControllerHandler,
  updateRecurringExpenseControllerHandler,
  voidPaymentControllerHandler
} from '@/controllers/finance';
import { authMiddleware } from '@/middleware';

const financeRouter = Router();

financeRouter.get(
  '/v1/finances/summary',
  authMiddleware,
  getFinanceSummaryControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/calendar',
  authMiddleware,
  getFinanceCalendarControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/reports',
  authMiddleware,
  getFinanceReportControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/alerts',
  authMiddleware,
  getFinanceAlertsControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/settings',
  authMiddleware,
  getFinanceSettingsControllerHandler as Application
);

financeRouter.put(
  '/v1/finances/settings',
  authMiddleware,
  updateFinanceSettingsControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/expenses',
  authMiddleware,
  getAllExpensesControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/expenses',
  authMiddleware,
  createExpenseControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/expenses/:id',
  authMiddleware,
  getExpenseControllerHandler as Application
);

financeRouter.patch(
  '/v1/finances/expenses/:id',
  authMiddleware,
  updateExpenseControllerHandler as Application
);

financeRouter.delete(
  '/v1/finances/expenses/:id',
  authMiddleware,
  deleteExpenseControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/expenses/:id/payments',
  authMiddleware,
  recordPaymentControllerHandler as Application
);

financeRouter.patch(
  '/v1/finances/expenses/:id/payments/:paymentId',
  authMiddleware,
  updatePaymentControllerHandler as Application
);

financeRouter.delete(
  '/v1/finances/expenses/:id/payments/:paymentId',
  authMiddleware,
  voidPaymentControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/payments',
  authMiddleware,
  getAllPaymentsControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/installment-plans',
  authMiddleware,
  getAllInstallmentPlansControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/installment-plans',
  authMiddleware,
  createInstallmentPlanControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/installment-plans/:id',
  authMiddleware,
  getInstallmentPlanControllerHandler as Application
);

financeRouter.patch(
  '/v1/finances/installment-plans/:id',
  authMiddleware,
  updateInstallmentPlanControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/installment-plans/:id/reschedule',
  authMiddleware,
  rescheduleInstallmentPlanControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/installment-plans/:id/cancel',
  authMiddleware,
  cancelInstallmentPlanControllerHandler as Application
);

financeRouter.delete(
  '/v1/finances/installment-plans/:id',
  authMiddleware,
  deleteInstallmentPlanControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/recurring-expenses',
  authMiddleware,
  getAllRecurringExpensesControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/recurring-expenses',
  authMiddleware,
  createRecurringExpenseControllerHandler as Application
);

financeRouter.get(
  '/v1/finances/recurring-expenses/:id',
  authMiddleware,
  getRecurringExpenseControllerHandler as Application
);

financeRouter.patch(
  '/v1/finances/recurring-expenses/:id',
  authMiddleware,
  updateRecurringExpenseControllerHandler as Application
);

financeRouter.post(
  '/v1/finances/recurring-expenses/:id/cancel',
  authMiddleware,
  cancelRecurringExpenseControllerHandler as Application
);

financeRouter.delete(
  '/v1/finances/recurring-expenses/:id',
  authMiddleware,
  deleteRecurringExpenseControllerHandler as Application
);

export { financeRouter };
