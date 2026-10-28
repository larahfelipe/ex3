import { z } from 'zod';

import { DEFAULT_FINANCE_CURRENCY, FinanceLimits } from '@/config/Constants';

import { currencyCodeSchema } from '../CurrencyCodeSchema';
import { calendarMonthSchema, ReferenceDaySchema } from './FinanceFieldSchemas';

const MONTHS_PER_YEAR = 12;

const monthOrdinal = (month: Date) =>
  month.getUTCFullYear() * MONTHS_PER_YEAR + month.getUTCMonth();

const CurrencyQuerySchema = currencyCodeSchema('Currency').default(
  DEFAULT_FINANCE_CURRENCY
);

export const FinanceSummaryQuerySchema = z.object({
  today: ReferenceDaySchema,
  currency: CurrencyQuerySchema
});

export const FinanceCalendarQuerySchema = z.object({
  today: ReferenceDaySchema,
  month: calendarMonthSchema('Month'),
  currency: currencyCodeSchema('Currency').optional()
});

export const FinanceReportQuerySchema = z
  .object({
    today: ReferenceDaySchema,
    currency: CurrencyQuerySchema,
    from: calendarMonthSchema('From'),
    to: calendarMonthSchema('To')
  })
  .superRefine(({ from, to }, ctx) => {
    const months = monthOrdinal(to) - monthOrdinal(from) + 1;

    if (months < 1)
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: 'To must not be before from'
      });
    else if (months > FinanceLimits.REPORT_MAX_MONTHS)
      ctx.addIssue({
        code: 'custom',
        path: ['to'],
        message: `A report covers at most ${FinanceLimits.REPORT_MAX_MONTHS} months`
      });
  });

export const FinanceAlertsQuerySchema = z.object({
  today: ReferenceDaySchema
});

/** Every setting, as a `PUT` replaces them all. */
export const UpdateFinanceSettingsSchema = z.object({
  reminderLeadDays: z
    .number('Reminder lead days must be a number')
    .int('Reminder lead days must be an integer')
    .min(0, 'Reminder lead days must be at least 0')
    .max(
      FinanceLimits.REMINDER_MAX_LEAD_DAYS,
      `Reminder lead days must be at most ${FinanceLimits.REMINDER_MAX_LEAD_DAYS}`
    ),
  remindOverdue: z.boolean('Remind overdue must be a boolean'),
  remindUpcomingBills: z.boolean('Remind upcoming bills must be a boolean'),
  remindUpcomingInstallments: z.boolean(
    'Remind upcoming installments must be a boolean'
  )
});
