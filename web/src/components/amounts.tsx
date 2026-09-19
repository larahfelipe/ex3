import type { FC } from 'react';

import { formatMoney, formatPercent, signedValueTone } from '@/common/utils';
import type { DecimalString } from '@/types';

type AmountProps = Record<'currency', string> &
  Partial<Record<'amount', DecimalString>>;

type SignedAmountProps = AmountProps &
  Partial<Record<'percent', DecimalString>>;

const NO_VALUE = '-';

const SIGNED_FORMAT: Intl.NumberFormatOptions = { signDisplay: 'exceptZero' };

export const UnavailableValue: FC = () => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">{NO_VALUE}</span>

    <span className="sr-only">Not available</span>
  </span>
);

export const Amount: FC<AmountProps> = ({ amount, currency }) =>
  amount === undefined ? <UnavailableValue /> : formatMoney(amount, currency);

export const SignedAmount: FC<SignedAmountProps> = ({
  amount,
  percent,
  currency
}) => {
  if (amount === undefined) return <UnavailableValue />;

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-2 ${signedValueTone(amount)}`}
    >
      <span>{formatMoney(amount, currency, SIGNED_FORMAT)}</span>

      {percent !== undefined && (
        <span className="text-xs">{formatPercent(percent, SIGNED_FORMAT)}</span>
      )}
    </span>
  );
};
