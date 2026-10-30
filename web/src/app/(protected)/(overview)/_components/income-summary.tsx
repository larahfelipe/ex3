import { useId, type FC } from 'react';

import { useTranslations } from 'use-intl';

import type { CurrencyIncome } from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Metric, Money, PROMINENT_VALUE_CLASS } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import { useIncome } from '@/hooks/use-portfolio';
import { useFormat } from '@/i18n/format';

type IncomeSummaryProps = Record<'portfolio', Portfolio>;

type CurrencyIncomeSummaryProps = Record<'income', CurrencyIncome> &
  Record<'since', string> &
  Record<'isHeaded', boolean>;

const CurrencyIncomeSummary: FC<CurrencyIncomeSummaryProps> = ({
  income: { currency, total, trailingTotal, byType },
  since,
  isHeaded
}) => {
  const headingId = useId();
  const t = useTranslations('investments.overview.income');
  const tTypes = useTranslations('transactions.types');
  const { currencyNameOf } = useFormat();

  return (
    <div
      role={isHeaded ? 'group' : undefined}
      aria-labelledby={isHeaded ? headingId : undefined}
      className="space-y-3"
    >
      {isHeaded && (
        <h3 id={headingId} className="text-sm font-medium">
          {t('inCurrency', {
            currency,
            name: currencyNameOf(currency)
          })}
        </h3>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <dl className="grid grid-cols-2 content-start gap-4 md:grid-cols-1">
          <Metric
            label={t('trailingTotal')}
            info={t('trailingExplanation', { since })}
            valueClassName={PROMINENT_VALUE_CLASS}
          >
            <Money value={trailingTotal} currency={currency} />
          </Metric>

          <Metric label={t('total')}>
            <Money value={total} currency={currency} />
          </Metric>
        </dl>

        <Table label={t('table', { currency })}>
          <TableCaption className="sr-only">
            {t('caption', { currency })}
          </TableCaption>

          <TableHeader>
            <TableRow>
              <TableHead>{t('type')}</TableHead>

              <TableHead className="text-right">{t('trailingTotal')}</TableHead>

              <TableHead className="text-right">{t('total')}</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {byType.map((typeIncome) => (
              <TableRow key={typeIncome.type}>
                <TableRowHeader>{tTypes(typeIncome.type)}</TableRowHeader>

                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  <Money value={typeIncome.trailingTotal} currency={currency} />
                </TableCell>

                <TableCell className="text-right whitespace-nowrap tabular-nums">
                  <Money value={typeIncome.total} currency={currency} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

/**
 * The income recorded in the portfolio's transactions, net of fees and taxes,
 * over the last 12 months and in all. Each currency stays apart, unconverted,
 * since no single exchange rate settles payments made on different days.
 */
export const IncomeSummary: FC<IncomeSummaryProps> = ({ portfolio }) => {
  const incomeQuery = useIncome(portfolio);
  const t = useTranslations('investments.overview.income');
  const { formatSeriesDay } = useFormat();

  return (
    <QuerySection
      title={t('title')}
      query={incomeQuery}
      errorMessage={t('loadFailed')}
      loading={<LoadingState label={t('loading')} className="h-32" />}
      isEmpty={({ byCurrency }) => byCurrency.length === 0}
      empty={<EmptyState message={t('empty')} />}
    >
      {({ trailingFrom, byCurrency }) => (
        <div className="space-y-6">
          {byCurrency.map((income) => (
            <CurrencyIncomeSummary
              key={income.currency}
              income={income}
              since={formatSeriesDay(trailingFrom)}
              isHeaded={byCurrency.length > 1}
            />
          ))}

          <p className="text-xs text-muted-foreground">
            {t('note', { currencyCount: byCurrency.length })}
          </p>
        </div>
      )}
    </QuerySection>
  );
};
