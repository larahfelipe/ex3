import { FinanceMessages } from '@/config/Constants';
import type { FinanceRecordType } from '@/domain/models';
import { ConflictError, DomainError, ValidationError } from '@/errors';

/** Every outcome a finance write is refused with, short of the record not existing. */
export type FinanceRefusal =
  | { outcome: 'imprecise-amount'; field: string }
  | { outcome: 'due-before-kept'; lastKeptDueDate: string }
  | { outcome: 'effective-after-horizon'; latestEffectiveFrom: string }
  | {
      outcome:
        | 'already-settled'
        | 'below-settled'
        | 'cancelled'
        | 'empty-payment'
        | 'end-before-paid-occurrence'
        | 'end-before-start'
        | 'exceeds-outstanding'
        | 'has-payments'
        | 'managed-by-origin'
        | 'origin-cancelled'
        | 'split-too-small';
    };

const CANCELLED_MESSAGES = {
  EXPENSE: FinanceMessages.EXPENSE_CANCELLED,
  INSTALLMENT_PLAN: FinanceMessages.PLAN_CANCELLED,
  RECURRING_EXPENSE: FinanceMessages.SERIES_CANCELLED
} satisfies Record<FinanceRecordType, string>;

const HAS_PAYMENTS_MESSAGES = {
  EXPENSE: FinanceMessages.EXPENSE_HAS_PAYMENTS,
  INSTALLMENT_PLAN: FinanceMessages.PLAN_HAS_PAYMENTS,
  RECURRING_EXPENSE: FinanceMessages.SERIES_HAS_PAYMENTS
} satisfies Record<FinanceRecordType, string>;

const fieldError = (path: string, message: string) =>
  new ValidationError(message, [{ path, message }]);

/**
 * A refusal over a field's value answers 400 under that field, one over the
 * record's state 409, and one a rule of the domain makes 422.
 */
export const financeRefusalError = (
  refusal: FinanceRefusal,
  recordType: FinanceRecordType
) => {
  switch (refusal.outcome) {
    case 'imprecise-amount':
      return fieldError(refusal.field, FinanceMessages.AMOUNT_PRECISION);
    case 'empty-payment':
      return fieldError('amount', FinanceMessages.PAYMENT_EMPTY);
    case 'end-before-start':
      return fieldError('endDate', FinanceMessages.END_BEFORE_START);
    case 'effective-after-horizon':
      return fieldError(
        'effectiveFrom',
        `${FinanceMessages.EFFECTIVE_FROM_AFTER_HORIZON} (${refusal.latestEffectiveFrom})`
      );
    case 'cancelled':
      return new ConflictError(CANCELLED_MESSAGES[recordType]);
    case 'has-payments':
      return new ConflictError(HAS_PAYMENTS_MESSAGES[recordType]);
    case 'already-settled':
      return new ConflictError(FinanceMessages.ALREADY_SETTLED);
    case 'origin-cancelled':
      return new ConflictError(FinanceMessages.EXPENSE_ORIGIN_CANCELLED);
    case 'end-before-paid-occurrence':
      return new ConflictError(FinanceMessages.END_BEFORE_PAID_OCCURRENCE);
    case 'below-settled':
      return new DomainError(FinanceMessages.AMOUNT_BELOW_SETTLED);
    case 'exceeds-outstanding':
      return new DomainError(FinanceMessages.PAYMENT_EXCEEDS_OUTSTANDING);
    case 'managed-by-origin':
      return new DomainError(FinanceMessages.EXPENSE_MANAGED_BY_ORIGIN);
    case 'split-too-small':
      return new DomainError(FinanceMessages.INSTALLMENT_SPLIT_TOO_SMALL);
    case 'due-before-kept':
      return new DomainError(
        `${FinanceMessages.RESCHEDULE_BEFORE_KEPT} (${refusal.lastKeptDueDate})`
      );
  }
};
