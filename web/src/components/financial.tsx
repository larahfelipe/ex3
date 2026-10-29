import type { FC, ReactNode } from 'react';

import { useTranslations } from 'use-intl';

import { signedValueTone } from '@/common/utils';
import { InfoTip } from '@/components/info-tip';
import { useFormat } from '@/i18n/format';
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
  Partial<Record<'className' | 'valueClassName', string>> &
  Partial<Record<'info', ReactNode>>;

const NO_VALUE = '-';

export const HEADLINE_VALUE_CLASS = 'text-3xl font-bold';

export const PROMINENT_VALUE_CLASS = 'text-lg font-semibold';

const SIGNED_FORMAT: Intl.NumberFormatOptions = { signDisplay: 'exceptZero' };

export const UnavailableValue: FC = () => {
  const t = useTranslations('common.states');

  return (
    <span className="text-muted-foreground">
      <span aria-hidden="true">{NO_VALUE}</span>

      <span className="sr-only">{t('notAvailable')}</span>
    </span>
  );
};

export const Money: FC<MoneyProps> = ({ value, currency, signed }) => {
  const { formatMoney } = useFormat();

  if (value === undefined || currency === undefined)
    return <UnavailableValue />;

  return formatMoney(value, currency, signed ? SIGNED_FORMAT : undefined);
};

export const Price: FC<PriceProps> = ({ value, currency, exact }) => {
  const { formatPrice, formatUnitAmount } = useFormat();

  if (value === undefined || currency === undefined)
    return <UnavailableValue />;

  return exact
    ? formatPrice(value, currency)
    : formatUnitAmount(value, currency);
};

export const Quantity: FC<ValueProps> = ({ value }) => {
  const { formatQuantity } = useFormat();

  return value === undefined ? <UnavailableValue /> : formatQuantity(value);
};

export const Percentage: FC<ValueProps> = ({ value }) => {
  const { formatPercent } = useFormat();

  return value === undefined ? <UnavailableValue /> : formatPercent(value);
};

export const Trend: FC<ValueProps> = ({ value }) => {
  const { formatPercent } = useFormat();

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
  const { formatMoney, formatPercent } = useFormat();

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
  info,
  children
}) => {
  const t = useTranslations('common.metric');

  return (
    <div className={cn('min-w-0 space-y-1', className)}>
      <dt
        className={cn(
          'text-sm text-muted-foreground',
          info !== undefined && 'flex items-center gap-0.5'
        )}
      >
        {label}

        {info !== undefined && (
          <InfoTip label={t('about', { label })}>{info}</InfoTip>
        )}
      </dt>

      <dd className={cn('font-medium wrap-anywhere', valueClassName)}>
        {children}
      </dd>
    </div>
  );
};
