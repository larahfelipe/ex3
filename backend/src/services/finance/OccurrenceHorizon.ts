import { FinanceLimits } from '@/config/Constants';
import { addMonths } from '@/domain/CalendarDay';
import type { RecurringExpenseRepository } from '@/infra/database';

/** The last day recurring occurrences exist through, counted from the reference day. */
export const occurrenceHorizonOf = (today: Date) =>
  addMonths(today, FinanceLimits.OCCURRENCE_HORIZON_MONTHS);

/**
 * Brings the user's series up to the horizon before a read that lists or sums
 * expenses, so an occurrence that came within reach since the last read is in
 * the result.
 */
export const generateDueOccurrences = (
  recurringExpenseRepository: RecurringExpenseRepository,
  { userId, today }: { userId: string; today: Date }
) =>
  recurringExpenseRepository.generateDue({
    userId,
    through: occurrenceHorizonOf(today)
  });
