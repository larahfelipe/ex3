import { TransactionMessages } from '@/config/Constants';
import type { LedgerRefusal } from '@/domain/PositionLedger';
import { DomainError } from '@/errors';

const REFUSAL_MESSAGES = {
  'negative-amount': TransactionMessages.ACC_NEGATIVE_AMOUNT,
  'currency-mismatch': TransactionMessages.CURRENCY_MISMATCH,
  'out-of-range': TransactionMessages.POSITION_OUT_OF_RANGE
} satisfies Record<LedgerRefusal['outcome'], string>;

export const ledgerRefusalError = ({ outcome }: LedgerRefusal) =>
  new DomainError(REFUSAL_MESSAGES[outcome]);
