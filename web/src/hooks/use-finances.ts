import { useCallback } from 'react';

import {
  keepPreviousData,
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey
} from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';

import type {
  CancelRecurringExpenseRequestPayload,
  CreateExpenseRequestPayload,
  CreateExpenseResponseData,
  CreateInstallmentPlanRequestPayload,
  CreateInstallmentPlanResponseData,
  CreateRecurringExpenseRequestPayload,
  CreateRecurringExpenseResponseData,
  DeleteExpenseResponseData,
  ExpenseFilters,
  FinanceCalendarParams,
  FinanceReportParams,
  FinanceSummaryParams,
  GetExpenseResponseData,
  GetExpensesRequestParams,
  GetExpensesResponseData,
  GetFinanceAlertsResponseData,
  GetFinanceCalendarResponseData,
  GetFinanceReportResponseData,
  GetFinanceSettingsResponseData,
  GetFinanceSummaryResponseData,
  GetInstallmentPlanResponseData,
  GetInstallmentPlansResponseData,
  GetPaymentsResponseData,
  GetRecurringExpenseResponseData,
  GetRecurringExpensesResponseData,
  InstallmentPlanChangeResponseData,
  InstallmentPlanFilters,
  PaymentEntryPayload,
  PaymentFilters,
  RecordPaymentResponseData,
  RecurringExpenseChangeResponseData,
  RecurringExpenseFilters,
  ReferenceDayParams,
  RescheduleInstallmentPlanRequestPayload,
  UpdateExpenseRequestPayload,
  UpdateExpenseResponseData,
  UpdateFinanceSettingsRequestPayload,
  UpdateFinanceSettingsResponseData,
  UpdateInstallmentPlanRequestPayload,
  UpdatePaymentRequestPayload,
  UpdatePaymentResponseData,
  UpdateRecurringExpenseRequestPayload,
  VoidPaymentResponseData
} from '@/app/api/v1/finances';
import type { Translator } from '@/i18n/translator';
import api, { type ApiProxyErrorData } from '@/lib/axios';
import { calendarDayOf, currentInstant } from '@/lib/dates';
import { queryKeys } from '@/lib/react-query';
import type { Maybe, WithId } from '@/types';

type FinanceChangeAnnouncement = Record<'title', string> &
  Partial<Record<'description', string>>;

type FinanceQuery<Data> = {
  queryKey: QueryKey;
  request: Maybe<() => Promise<AxiosResponse<Data>>>;
  keepsPreviousData?: boolean;
};

type PaymentTarget = Record<'expenseId' | 'paymentId', string>;

/**
 * What is overdue is decided by the browser's own day, not the server's UTC
 * one: a bill due today stays due until the person's midnight.
 */
export const useReferenceDay = () => calendarDayOf(currentInstant());

const referenceDayParams = (today: string): ReferenceDayParams => ({ today });

const useFinanceQuery = <Data>({
  queryKey,
  request,
  keepsPreviousData
}: FinanceQuery<Data>) =>
  useQuery<AxiosResponse<Data>, ApiProxyErrorData, Data>({
    queryKey,
    queryFn: request ?? skipToken,
    select: ({ data }) => data,
    placeholderData: keepsPreviousData ? keepPreviousData : undefined
  });

/** Every finance figure is derived from the same records, so a write refreshes the whole scope. */
const useAnnounceFinanceChange = () => {
  const queryClient = useQueryClient();

  return useCallback(
    ({ title, description }: FinanceChangeAnnouncement) => {
      toast.success(title, { description });

      void queryClient.invalidateQueries({ queryKey: queryKeys.finances() });
    },
    [queryClient]
  );
};

/** The toast is written here, not taken from the response: the API answers in English. */
const useFinanceMutation = <Variables, Data>(
  request: (variables: Variables) => Promise<AxiosResponse<Data>>,
  announcementOf: (
    t: Translator<'finances.notifications'>,
    data: Data,
    variables: Variables
  ) => FinanceChangeAnnouncement
) => {
  const t = useTranslations('finances.notifications');
  const announceChange = useAnnounceFinanceChange();

  return useMutation<AxiosResponse<Data>, ApiProxyErrorData, Variables>({
    mutationFn: request,
    onSuccess: ({ data }, variables) =>
      announceChange(announcementOf(t, data, variables))
  });
};

const expensePath = (expenseId: string) =>
  `/v1/finances/expenses/${encodeURIComponent(expenseId)}`;

const paymentPath = ({ expenseId, paymentId }: PaymentTarget) =>
  `${expensePath(expenseId)}/payments/${encodeURIComponent(paymentId)}`;

const installmentPlanPath = (planId: string) =>
  `/v1/finances/installment-plans/${encodeURIComponent(planId)}`;

const recurringExpensePath = (seriesId: string) =>
  `/v1/finances/recurring-expenses/${encodeURIComponent(seriesId)}`;

export const useFinanceSummary = (currency: Maybe<string>) => {
  const today = useReferenceDay();
  const params: FinanceSummaryParams = currency
    ? { today, currency }
    : { today };

  return useFinanceQuery<GetFinanceSummaryResponseData>({
    queryKey: queryKeys.financeSummary(params),
    request: () => api.getInstance().get('/v1/finances/summary', { params }),
    keepsPreviousData: true
  });
};

export const useFinanceAlerts = () => {
  const today = useReferenceDay();

  return useFinanceQuery<GetFinanceAlertsResponseData>({
    queryKey: queryKeys.financeAlerts(today),
    request: () =>
      api
        .getInstance()
        .get('/v1/finances/alerts', { params: referenceDayParams(today) })
  });
};

export const useFinanceSettings = () =>
  useFinanceQuery<GetFinanceSettingsResponseData>({
    queryKey: queryKeys.financeSettings(),
    request: () => api.getInstance().get('/v1/finances/settings')
  });

export const useFinanceCalendar = (
  params: Omit<FinanceCalendarParams, 'today'>
) => {
  const today = useReferenceDay();
  const calendarParams: FinanceCalendarParams = { ...params, today };

  return useFinanceQuery<GetFinanceCalendarResponseData>({
    queryKey: queryKeys.financeCalendar(calendarParams),
    request: () =>
      api
        .getInstance()
        .get('/v1/finances/calendar', { params: calendarParams }),
    keepsPreviousData: true
  });
};

export const useFinanceReport = (
  params: Maybe<Omit<FinanceReportParams, 'today'>>
) => {
  const today = useReferenceDay();
  const reportParams: Maybe<FinanceReportParams> = params && {
    ...params,
    today
  };

  return useFinanceQuery<GetFinanceReportResponseData>({
    queryKey: queryKeys.financeReport(
      reportParams ?? { today, from: '', to: '' }
    ),
    request: reportParams
      ? () =>
          api
            .getInstance()
            .get('/v1/finances/reports', { params: reportParams })
      : null,
    keepsPreviousData: true
  });
};

export const useExpenses = (filters: ExpenseFilters) => {
  const today = useReferenceDay();

  return useFinanceQuery<GetExpensesResponseData>({
    queryKey: queryKeys.expenses(filters, today),
    request: () =>
      api.getInstance().get('/v1/finances/expenses', {
        params: { ...filters, today } satisfies GetExpensesRequestParams
      }),
    keepsPreviousData: true
  });
};

export const useExpense = (expenseId: Maybe<string>) => {
  const today = useReferenceDay();

  return useFinanceQuery<GetExpenseResponseData>({
    queryKey: queryKeys.expense(expenseId ?? '', today),
    request: expenseId
      ? () =>
          api
            .getInstance()
            .get(expensePath(expenseId), { params: referenceDayParams(today) })
      : null
  });
};

export const usePayments = (filters: PaymentFilters) =>
  useFinanceQuery<GetPaymentsResponseData>({
    queryKey: queryKeys.payments(filters),
    request: () =>
      api.getInstance().get('/v1/finances/payments', { params: filters }),
    keepsPreviousData: true
  });

export const useInstallmentPlans = (filters: InstallmentPlanFilters) =>
  useFinanceQuery<GetInstallmentPlansResponseData>({
    queryKey: queryKeys.installmentPlans(filters),
    request: () =>
      api
        .getInstance()
        .get('/v1/finances/installment-plans', { params: filters }),
    keepsPreviousData: true
  });

export const useInstallmentPlan = (planId: Maybe<string>) => {
  const today = useReferenceDay();

  return useFinanceQuery<GetInstallmentPlanResponseData>({
    queryKey: queryKeys.installmentPlan(planId ?? '', today),
    request: planId
      ? () =>
          api.getInstance().get(installmentPlanPath(planId), {
            params: referenceDayParams(today)
          })
      : null
  });
};

export const useRecurringExpenses = (filters: RecurringExpenseFilters) => {
  const today = useReferenceDay();

  return useFinanceQuery<GetRecurringExpensesResponseData>({
    queryKey: queryKeys.recurringExpenses(filters, today),
    request: () =>
      api.getInstance().get('/v1/finances/recurring-expenses', {
        params: { ...filters, today }
      }),
    keepsPreviousData: true
  });
};

export const useRecurringExpense = (seriesId: Maybe<string>) => {
  const today = useReferenceDay();

  return useFinanceQuery<GetRecurringExpenseResponseData>({
    queryKey: queryKeys.recurringExpense(seriesId ?? '', today),
    request: seriesId
      ? () =>
          api.getInstance().get(recurringExpensePath(seriesId), {
            params: referenceDayParams(today)
          })
      : null
  });
};

export const useCreateExpense = () =>
  useFinanceMutation<CreateExpenseRequestPayload, CreateExpenseResponseData>(
    (payload) =>
      api.getInstance().post('/v1/finances/expenses/create', payload),
    (t, _data, { description }) => ({ title: t('billAdded'), description })
  );

export const useUpdateExpense = () =>
  useFinanceMutation<
    UpdateExpenseRequestPayload & WithId,
    UpdateExpenseResponseData
  >(
    ({ id, ...payload }) =>
      api
        .getInstance()
        .patch(expensePath(id), payload satisfies UpdateExpenseRequestPayload),
    (t, _data, { cancelled }) => {
      if (cancelled === true) return { title: t('billCancelled') };
      if (cancelled === false) return { title: t('billRestored') };

      return { title: t('billUpdated') };
    }
  );

export const useDeleteExpense = () =>
  useFinanceMutation<WithId, DeleteExpenseResponseData>(
    ({ id }) => api.getInstance().delete(expensePath(id)),
    (t) => ({ title: t('billDeleted') })
  );

export const useRecordPayment = () =>
  useFinanceMutation<
    PaymentEntryPayload & Record<'expenseId', string>,
    RecordPaymentResponseData
  >(
    ({ expenseId, ...payload }) =>
      api
        .getInstance()
        .post(
          `${expensePath(expenseId)}/payments/create`,
          payload satisfies PaymentEntryPayload
        ),
    (t) => ({ title: t('paymentRecorded') })
  );

export const useUpdatePayment = () =>
  useFinanceMutation<
    UpdatePaymentRequestPayload & PaymentTarget,
    UpdatePaymentResponseData
  >(
    ({ expenseId, paymentId, ...payload }) =>
      api
        .getInstance()
        .patch(
          paymentPath({ expenseId, paymentId }),
          payload satisfies UpdatePaymentRequestPayload
        ),
    (t) => ({ title: t('paymentUpdated') })
  );

export const useVoidPayment = () =>
  useFinanceMutation<PaymentTarget, VoidPaymentResponseData>(
    (target) => api.getInstance().delete(paymentPath(target)),
    (t) => ({ title: t('paymentVoided') })
  );

export const useCreateInstallmentPlan = () =>
  useFinanceMutation<
    CreateInstallmentPlanRequestPayload,
    CreateInstallmentPlanResponseData
  >(
    (payload) =>
      api.getInstance().post('/v1/finances/installment-plans/create', payload),
    (t, _data, { description, installmentCount }) => ({
      title: t('planAdded'),
      description: t('planAddedDetail', {
        description,
        count: installmentCount
      })
    })
  );

export const useUpdateInstallmentPlan = () =>
  useFinanceMutation<
    UpdateInstallmentPlanRequestPayload & WithId,
    InstallmentPlanChangeResponseData
  >(
    ({ id, ...payload }) =>
      api
        .getInstance()
        .patch(
          installmentPlanPath(id),
          payload satisfies UpdateInstallmentPlanRequestPayload
        ),
    (t) => ({ title: t('planUpdated') })
  );

export const useRescheduleInstallmentPlan = () =>
  useFinanceMutation<
    RescheduleInstallmentPlanRequestPayload & WithId,
    InstallmentPlanChangeResponseData
  >(
    ({ id, ...payload }) =>
      api
        .getInstance()
        .post(
          `${installmentPlanPath(id)}/reschedule`,
          payload satisfies RescheduleInstallmentPlanRequestPayload
        ),
    (t) => ({ title: t('planRescheduled') })
  );

export const useCancelInstallmentPlan = () =>
  useFinanceMutation<WithId, InstallmentPlanChangeResponseData>(
    ({ id }) => api.getInstance().post(`${installmentPlanPath(id)}/cancel`, {}),
    (t) => ({ title: t('planCancelled') })
  );

export const useDeleteInstallmentPlan = () =>
  useFinanceMutation<WithId, InstallmentPlanChangeResponseData>(
    ({ id }) => api.getInstance().delete(installmentPlanPath(id)),
    (t) => ({ title: t('planDeleted') })
  );

export const useCreateRecurringExpense = () =>
  useFinanceMutation<
    CreateRecurringExpenseRequestPayload,
    CreateRecurringExpenseResponseData
  >(
    (payload) =>
      api.getInstance().post('/v1/finances/recurring-expenses/create', payload),
    (t, _data, { description }) => ({ title: t('seriesAdded'), description })
  );

export const useUpdateRecurringExpense = () =>
  useFinanceMutation<
    UpdateRecurringExpenseRequestPayload & WithId,
    RecurringExpenseChangeResponseData
  >(
    ({ id, ...payload }) =>
      api
        .getInstance()
        .patch(
          recurringExpensePath(id),
          payload satisfies UpdateRecurringExpenseRequestPayload
        ),
    (t) => ({ title: t('seriesUpdated') })
  );

export const useCancelRecurringExpense = () =>
  useFinanceMutation<
    CancelRecurringExpenseRequestPayload & WithId,
    RecurringExpenseChangeResponseData
  >(
    ({ id, ...payload }) =>
      api
        .getInstance()
        .post(
          `${recurringExpensePath(id)}/cancel`,
          payload satisfies CancelRecurringExpenseRequestPayload
        ),
    (t) => ({ title: t('seriesStopped') })
  );

export const useDeleteRecurringExpense = () =>
  useFinanceMutation<WithId, RecurringExpenseChangeResponseData>(
    ({ id }) => api.getInstance().delete(recurringExpensePath(id)),
    (t) => ({ title: t('seriesDeleted') })
  );

export const useUpdateFinanceSettings = () =>
  useFinanceMutation<
    UpdateFinanceSettingsRequestPayload,
    UpdateFinanceSettingsResponseData
  >(
    (payload) => api.getInstance().put('/v1/finances/settings', payload),
    (t, { settings }) => {
      const { reminderLeadDays, remindOverdue } = settings;
      const remindsUpcoming =
        settings.remindUpcomingBills || settings.remindUpcomingInstallments;

      return {
        title: t('remindersUpdated'),
        description: !remindsUpcoming
          ? remindOverdue
            ? t('remindersOverdueOnly')
            : t('remindersOff')
          : reminderLeadDays === 0
            ? t('remindersOnDueDay')
            : t('remindersLeadDays', { days: reminderLeadDays })
      };
    }
  );
