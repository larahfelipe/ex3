import type { FC } from 'react';

import {
  formatMoney,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatUnitAmount,
  signedValueTone
} from '@/common/utils';
import { cn } from '@/lib/utils';
import type { Children, DecimalString } from '@/types';

type ValueProps = Partial<Record<'value', DecimalString>>;

type CurrencyValueProps = ValueProps & Partial<Record<'currency', string>>;

type MoneyProps = CurrencyValueProps & Partial<Record<'signed', boolean>>;

type PriceProps = CurrencyValueProps & Partial<Record<'exact', boolean>>;

type ProfitLossProps = CurrencyValueProps &
  Partial<Record<'percent', DecimalString>>;

type MetricProps = Children &
  Record<'label', string> &
  Partial<Record<'className' | 'valueClassName', string>>;

const NO_VALUE = '-';

/** The value a card leads with, such as a total or a price. */
export const HEADLINE_VALUE_CLASS = 'text-3xl font-bold';

/** A value that stands beside the headline one. */
export const PROMINENT_VALUE_CLASS = 'text-lg font-semibold';

const SIGNED_FORMAT: Intl.NumberFormatOptions = { signDisplay: 'exceptZero' };

export const UnavailableValue: FC = () => (
  <span className="text-muted-foreground">
    <span aria-hidden="true">{NO_VALUE}</span>

    <span className="sr-only">Not available</span>
  </span>
);

export const Money: FC<MoneyProps> = ({ value, currency, signed }) => {
  if (value === undefined || currency === undefined)
    return <UnavailableValue />;

  return formatMoney(value, currency, signed ? SIGNED_FORMAT : undefined);
};

export const Price: FC<PriceProps> = ({ value, currency, exact }) => {
  if (value === undefined || currency === undefined)
    return <UnavailableValue />;

  return exact
    ? formatPrice(value, currency)
    : formatUnitAmount(value, currency);
};

export const Quantity: FC<ValueProps> = ({ value }) =>
  value === undefined ? <UnavailableValue /> : formatQuantity(value);

export const Percentage: FC<ValueProps> = ({ value }) =>
  value === undefined ? <UnavailableValue /> : formatPercent(value);

export const Trend: FC<ValueProps> = ({ value }) => {
  if (value === undefined) return <UnavailableValue />;

  return (
    <span className={signedValueTone(value)}>
      {formatPercent(value, SIGNED_FORMAT)}
    </span>
  );
};

export const ProfitLoss: FC<ProfitLossProps> = ({
  value,
  percent,
  currency
}) => {
  if (value === undefined || currency === undefined)
    return <UnavailableValue />;

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-baseline gap-x-2',
        signedValueTone(value)
      )}
    >
      <span>{formatMoney(value, currency, SIGNED_FORMAT)}</span>

      {percent !== undefined && (
        <span className="text-xs">{formatPercent(percent, SIGNED_FORMAT)}</span>
      )}
    </span>
  );
};

export const Metric: FC<MetricProps> = ({
  label,
  className,
  valueClassName,
  children
}) => (
  <div className={cn('min-w-0 space-y-1', className)}>
    <dt className="text-sm text-muted-foreground">{label}</dt>

    <dd className={cn('font-medium wrap-anywhere', valueClassName)}>
      {children}
    </dd>
  </div>
);
