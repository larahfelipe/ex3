import type { FC, ReactNode } from 'react';

import Link from 'next/link';

import { CircleAlert, Clock } from 'lucide-react';

import type { Change, CurrencyAmount } from '@/app/api/v1/finances';
import { Card, CardContent } from '@/components/ui';
import { type Format, useFormat } from '@/i18n/format';
import type { Translator } from '@/i18n/translator';
import { isNonzeroDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';

type AlertTone = 'negative' | 'warning';

type LinkedMetricProps = Record<'label' | 'href', string> &
  Record<'children', ReactNode> &
  Partial<Record<'detail' | 'className', string>> &
  Partial<Record<'tone', 'negative'>>;

const ALERT_TONES: Record<AlertTone, string> = {
  negative: 'border-negative/40 bg-negative/5',
  warning: 'border-warning/40 bg-warning/5'
};

const ALERT_ICONS = {
  negative: { Icon: CircleAlert, className: 'text-negative' },
  warning: { Icon: Clock, className: 'text-warning' }
} as const;

export const totalsText = (
  totals: ReadonlyArray<CurrencyAmount>,
  { formatMoney }: Format
) =>
  totals
    .map(({ amount, currency }) => formatMoney(amount, currency))
    .join(' · ');

/** Overdue or due-soon bills, each currency apart: amounts in two currencies never add up. */
export const AlertTotals: FC<
  Record<'tone', AlertTone> &
    Record<'title', string> &
    Record<'totals', ReadonlyArray<CurrencyAmount>> &
    Partial<Record<'href', string>>
> = ({ tone, title, totals, href }) => {
  const format = useFormat();
  const { Icon, className } = ALERT_ICONS[tone];
  const content = (
    <>
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-4 shrink-0', className)}
      />

      <span className="min-w-0 space-y-0.5">
        <span className="block text-sm font-semibold">{title}</span>

        <span className="block text-sm text-muted-foreground tabular-nums wrap-anywhere">
          {totalsText(totals, format)}
        </span>
      </span>
    </>
  );
  const boxClass = cn(
    'flex items-start gap-3 rounded-lg border px-4 py-3',
    ALERT_TONES[tone]
  );

  return href === undefined ? (
    <div className={boxClass}>{content}</div>
  ) : (
    <Link
      href={href}
      className={cn(
        boxClass,
        'ring-offset-background transition-colors outline-hidden hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2'
      )}
    >
      {content}
    </Link>
  );
};

const UNSIGNED: Intl.NumberFormatOptions = { signDisplay: 'never' };

/**
 * More or less than the previous period, in words: spending more is neither
 * good nor bad by itself, so the change carries no gain or loss color. The
 * period is `lastMonth`, or a phrase for the previous one, such as
 * "em out. de 2026".
 */
export const changeTextOf = (
  { amount, percent }: Change,
  currency: string,
  period: string,
  t: Translator<'finances.summary'>,
  { formatMoney, formatPercent }: Format
) => {
  if (!isNonzeroDecimal(amount)) return t('same', { period });

  const money = formatMoney(amount, currency, UNSIGNED);
  const amountText =
    percent === null
      ? money
      : t('withPercent', {
          amount: money,
          percent: formatPercent(percent, UNSIGNED)
        });

  return amount.startsWith('-')
    ? t('less', { amount: amountText, period })
    : t('more', { amount: amountText, period });
};

/** A headline figure that opens the records it counts. */
export const LinkedMetric: FC<LinkedMetricProps> = ({
  label,
  href,
  detail,
  tone,
  className,
  children
}) => (
  <Link
    href={href}
    className={cn(
      'group block rounded-xl ring-offset-background outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
      className
    )}
  >
    <Card className="h-full transition-colors group-hover:border-primary/40">
      <CardContent className="space-y-1 p-5">
        <p className="text-sm text-muted-foreground group-hover:text-foreground">
          {label}
        </p>

        <p
          className={cn(
            'text-2xl font-semibold wrap-anywhere',
            tone === 'negative' && 'text-negative'
          )}
        >
          {children}
        </p>

        {detail !== undefined && (
          <p className="text-xs text-muted-foreground">{detail}</p>
        )}
      </CardContent>
    </Card>
  </Link>
);
