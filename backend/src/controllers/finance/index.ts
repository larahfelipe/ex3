import type { Request, Response } from 'express';

import {
  ExpenseRepository,
  FinanceReportRepository,
  InstallmentPlanRepository,
  RecurringExpenseRepository
} from '@/infra/database';
import {
  CancelInstallmentPlanService,
  CancelRecurringExpenseService,
  CreateExpenseService,
  CreateInstallmentPlanService,
  CreateRecurringExpenseService,
  DeleteExpenseService,
  DeleteInstallmentPlanService,
  DeleteRecurringExpenseService,
  GetAllExpensesService,
  GetAllInstallmentPlansService,
  GetAllPaymentsService,
  GetAllRecurringExpensesService,
  GetExpenseService,
  GetFinanceAlertsService,
  GetFinanceCalendarService,
  GetFinanceReportService,
  GetFinanceSettingsService,
  GetFinanceSummaryService,
  GetInstallmentPlanService,
  GetRecurringExpenseService,
  RecordPaymentService,
  RescheduleInstallmentPlanService,
  UpdateExpenseService,
  UpdateFinanceSettingsService,
  UpdateInstallmentPlanService,
  UpdatePaymentService,
  UpdateRecurringExpenseService,
  VoidPaymentService
} from '@/services/finance';

import { CancelInstallmentPlanController } from './CancelInstallmentPlanController';
import { CancelRecurringExpenseController } from './CancelRecurringExpenseController';
import { CreateExpenseController } from './CreateExpenseController';
import { CreateInstallmentPlanController } from './CreateInstallmentPlanController';
import { CreateRecurringExpenseController } from './CreateRecurringExpenseController';
import { DeleteExpenseController } from './DeleteExpenseController';
import { DeleteInstallmentPlanController } from './DeleteInstallmentPlanController';
import { DeleteRecurringExpenseController } from './DeleteRecurringExpenseController';
import { GetAllExpensesController } from './GetAllExpensesController';
import { GetAllInstallmentPlansController } from './GetAllInstallmentPlansController';
import { GetAllPaymentsController } from './GetAllPaymentsController';
import { GetAllRecurringExpensesController } from './GetAllRecurringExpensesController';
import { GetExpenseController } from './GetExpenseController';
import { GetFinanceAlertsController } from './GetFinanceAlertsController';
import { GetFinanceCalendarController } from './GetFinanceCalendarController';
import { GetFinanceReportController } from './GetFinanceReportController';
import { GetFinanceSettingsController } from './GetFinanceSettingsController';
import { GetFinanceSummaryController } from './GetFinanceSummaryController';
import { GetInstallmentPlanController } from './GetInstallmentPlanController';
import { GetRecurringExpenseController } from './GetRecurringExpenseController';
import { RecordPaymentController } from './RecordPaymentController';
import { RescheduleInstallmentPlanController } from './RescheduleInstallmentPlanController';
import { UpdateExpenseController } from './UpdateExpenseController';
import { UpdateFinanceSettingsController } from './UpdateFinanceSettingsController';
import { UpdateInstallmentPlanController } from './UpdateInstallmentPlanController';
import { UpdatePaymentController } from './UpdatePaymentController';
import { UpdateRecurringExpenseController } from './UpdateRecurringExpenseController';
import { VoidPaymentController } from './VoidPaymentController';

export const cancelInstallmentPlanControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const cancelInstallmentPlanService = CancelInstallmentPlanService.getInstance(
    installmentPlanRepository
  );

  const cancelInstallmentPlanController =
    CancelInstallmentPlanController.getInstance(cancelInstallmentPlanService);

  return cancelInstallmentPlanController.handle(req, res);
};

export const cancelRecurringExpenseControllerHandler = (
  req: Request,
  res: Response
) => {
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const cancelRecurringExpenseService =
    CancelRecurringExpenseService.getInstance(recurringExpenseRepository);

  const cancelRecurringExpenseController =
    CancelRecurringExpenseController.getInstance(cancelRecurringExpenseService);

  return cancelRecurringExpenseController.handle(req, res);
};

export const createExpenseControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const createExpenseService =
    CreateExpenseService.getInstance(expenseRepository);

  const createExpenseController =
    CreateExpenseController.getInstance(createExpenseService);

  return createExpenseController.handle(req, res);
};

export const createInstallmentPlanControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const createInstallmentPlanService = CreateInstallmentPlanService.getInstance(
    installmentPlanRepository
  );

  const createInstallmentPlanController =
    CreateInstallmentPlanController.getInstance(createInstallmentPlanService);

  return createInstallmentPlanController.handle(req, res);
};

export const createRecurringExpenseControllerHandler = (
  req: Request,
  res: Response
) => {
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const createRecurringExpenseService =
    CreateRecurringExpenseService.getInstance(recurringExpenseRepository);

  const createRecurringExpenseController =
    CreateRecurringExpenseController.getInstance(createRecurringExpenseService);

  return createRecurringExpenseController.handle(req, res);
};

export const deleteExpenseControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const deleteExpenseService =
    DeleteExpenseService.getInstance(expenseRepository);

  const deleteExpenseController =
    DeleteExpenseController.getInstance(deleteExpenseService);

  return deleteExpenseController.handle(req, res);
};

export const deleteInstallmentPlanControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const deleteInstallmentPlanService = DeleteInstallmentPlanService.getInstance(
    installmentPlanRepository
  );

  const deleteInstallmentPlanController =
    DeleteInstallmentPlanController.getInstance(deleteInstallmentPlanService);

  return deleteInstallmentPlanController.handle(req, res);
};

export const deleteRecurringExpenseControllerHandler = (
  req: Request,
  res: Response
) => {
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const deleteRecurringExpenseService =
    DeleteRecurringExpenseService.getInstance(recurringExpenseRepository);

  const deleteRecurringExpenseController =
    DeleteRecurringExpenseController.getInstance(deleteRecurringExpenseService);

  return deleteRecurringExpenseController.handle(req, res);
};

export const getAllExpensesControllerHandler = (
  req: Request,
  res: Response
) => {
  const expenseRepository = ExpenseRepository.getInstance();
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getAllExpensesService = GetAllExpensesService.getInstance(
    expenseRepository,
    recurringExpenseRepository
  );

  const getAllExpensesController = GetAllExpensesController.getInstance(
    getAllExpensesService
  );

  return getAllExpensesController.handle(req, res);
};

export const getAllInstallmentPlansControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const getAllInstallmentPlansService =
    GetAllInstallmentPlansService.getInstance(installmentPlanRepository);

  const getAllInstallmentPlansController =
    GetAllInstallmentPlansController.getInstance(getAllInstallmentPlansService);

  return getAllInstallmentPlansController.handle(req, res);
};

export const getAllPaymentsControllerHandler = (
  req: Request,
  res: Response
) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const getAllPaymentsService =
    GetAllPaymentsService.getInstance(expenseRepository);

  const getAllPaymentsController = GetAllPaymentsController.getInstance(
    getAllPaymentsService
  );

  return getAllPaymentsController.handle(req, res);
};

export const getAllRecurringExpensesControllerHandler = (
  req: Request,
  res: Response
) => {
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getAllRecurringExpensesService =
    GetAllRecurringExpensesService.getInstance(recurringExpenseRepository);

  const getAllRecurringExpensesController =
    GetAllRecurringExpensesController.getInstance(
      getAllRecurringExpensesService
    );

  return getAllRecurringExpensesController.handle(req, res);
};

export const getExpenseControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const getExpenseService = GetExpenseService.getInstance(expenseRepository);

  const getExpenseController =
    GetExpenseController.getInstance(getExpenseService);

  return getExpenseController.handle(req, res);
};

export const getFinanceAlertsControllerHandler = (
  req: Request,
  res: Response
) => {
  const financeReportRepository = FinanceReportRepository.getInstance();
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getFinanceAlertsService = GetFinanceAlertsService.getInstance(
    financeReportRepository,
    recurringExpenseRepository
  );

  const getFinanceAlertsController = GetFinanceAlertsController.getInstance(
    getFinanceAlertsService
  );

  return getFinanceAlertsController.handle(req, res);
};

export const getFinanceCalendarControllerHandler = (
  req: Request,
  res: Response
) => {
  const financeReportRepository = FinanceReportRepository.getInstance();
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getFinanceCalendarService = GetFinanceCalendarService.getInstance(
    financeReportRepository,
    recurringExpenseRepository
  );

  const getFinanceCalendarController = GetFinanceCalendarController.getInstance(
    getFinanceCalendarService
  );

  return getFinanceCalendarController.handle(req, res);
};

export const getFinanceReportControllerHandler = (
  req: Request,
  res: Response
) => {
  const financeReportRepository = FinanceReportRepository.getInstance();
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getFinanceReportService = GetFinanceReportService.getInstance(
    financeReportRepository,
    recurringExpenseRepository
  );

  const getFinanceReportController = GetFinanceReportController.getInstance(
    getFinanceReportService
  );

  return getFinanceReportController.handle(req, res);
};

export const getFinanceSettingsControllerHandler = (
  req: Request,
  res: Response
) => {
  const financeReportRepository = FinanceReportRepository.getInstance();

  const getFinanceSettingsService = GetFinanceSettingsService.getInstance(
    financeReportRepository
  );

  const getFinanceSettingsController = GetFinanceSettingsController.getInstance(
    getFinanceSettingsService
  );

  return getFinanceSettingsController.handle(req, res);
};

export const getFinanceSummaryControllerHandler = (
  req: Request,
  res: Response
) => {
  const financeReportRepository = FinanceReportRepository.getInstance();
  const expenseRepository = ExpenseRepository.getInstance();
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getFinanceSummaryService = GetFinanceSummaryService.getInstance(
    financeReportRepository,
    expenseRepository,
    recurringExpenseRepository
  );

  const getFinanceSummaryController = GetFinanceSummaryController.getInstance(
    getFinanceSummaryService
  );

  return getFinanceSummaryController.handle(req, res);
};

export const getInstallmentPlanControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const getInstallmentPlanService = GetInstallmentPlanService.getInstance(
    installmentPlanRepository
  );

  const getInstallmentPlanController = GetInstallmentPlanController.getInstance(
    getInstallmentPlanService
  );

  return getInstallmentPlanController.handle(req, res);
};

export const getRecurringExpenseControllerHandler = (
  req: Request,
  res: Response
) => {
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const getRecurringExpenseService = GetRecurringExpenseService.getInstance(
    recurringExpenseRepository
  );

  const getRecurringExpenseController =
    GetRecurringExpenseController.getInstance(getRecurringExpenseService);

  return getRecurringExpenseController.handle(req, res);
};

export const recordPaymentControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const recordPaymentService =
    RecordPaymentService.getInstance(expenseRepository);

  const recordPaymentController =
    RecordPaymentController.getInstance(recordPaymentService);

  return recordPaymentController.handle(req, res);
};

export const rescheduleInstallmentPlanControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const rescheduleInstallmentPlanService =
    RescheduleInstallmentPlanService.getInstance(installmentPlanRepository);

  const rescheduleInstallmentPlanController =
    RescheduleInstallmentPlanController.getInstance(
      rescheduleInstallmentPlanService
    );

  return rescheduleInstallmentPlanController.handle(req, res);
};

export const updateExpenseControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const updateExpenseService =
    UpdateExpenseService.getInstance(expenseRepository);

  const updateExpenseController =
    UpdateExpenseController.getInstance(updateExpenseService);

  return updateExpenseController.handle(req, res);
};

export const updateFinanceSettingsControllerHandler = (
  req: Request,
  res: Response
) => {
  const financeReportRepository = FinanceReportRepository.getInstance();

  const updateFinanceSettingsService = UpdateFinanceSettingsService.getInstance(
    financeReportRepository
  );

  const updateFinanceSettingsController =
    UpdateFinanceSettingsController.getInstance(updateFinanceSettingsService);

  return updateFinanceSettingsController.handle(req, res);
};

export const updateInstallmentPlanControllerHandler = (
  req: Request,
  res: Response
) => {
  const installmentPlanRepository = InstallmentPlanRepository.getInstance();

  const updateInstallmentPlanService = UpdateInstallmentPlanService.getInstance(
    installmentPlanRepository
  );

  const updateInstallmentPlanController =
    UpdateInstallmentPlanController.getInstance(updateInstallmentPlanService);

  return updateInstallmentPlanController.handle(req, res);
};

export const updatePaymentControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const updatePaymentService =
    UpdatePaymentService.getInstance(expenseRepository);

  const updatePaymentController =
    UpdatePaymentController.getInstance(updatePaymentService);

  return updatePaymentController.handle(req, res);
};

export const updateRecurringExpenseControllerHandler = (
  req: Request,
  res: Response
) => {
  const recurringExpenseRepository = RecurringExpenseRepository.getInstance();

  const updateRecurringExpenseService =
    UpdateRecurringExpenseService.getInstance(recurringExpenseRepository);

  const updateRecurringExpenseController =
    UpdateRecurringExpenseController.getInstance(updateRecurringExpenseService);

  return updateRecurringExpenseController.handle(req, res);
};

export const voidPaymentControllerHandler = (req: Request, res: Response) => {
  const expenseRepository = ExpenseRepository.getInstance();

  const voidPaymentService = VoidPaymentService.getInstance(expenseRepository);

  const voidPaymentController =
    VoidPaymentController.getInstance(voidPaymentService);

  return voidPaymentController.handle(req, res);
};
