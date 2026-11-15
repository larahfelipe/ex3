import { FinanceLimits } from '@/config/Constants';
import { addMonths } from '@/domain/CalendarDay';
import type { RecurringExpenseRepository } from '@/infra/database';

export const occurrenceHorizonOf = (today: Date) =>
  addMonths(today, FinanceLimits.OCCURRENCE_HORIZON_MONTHS);

export const generateDueOccurrences = (
  recurringExpenseRepository: RecurringExpenseRepository,
  { userId, today }: { userId: string; today: Date }
) =>
  recurringExpenseRepository.generateDue({
    userId,
    through: occurrenceHorizonOf(today)
  });
