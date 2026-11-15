import type { FC } from 'react';

import { useTranslations } from 'use-intl';

import type {
  FundamentalFigure,
  FundamentalRatio,
  PositionFundamentals,
  ReportedFundamentals
} from '@/app/api/v1/portfolio';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { Metric, Percentage, Trend } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import type { usePositionFundamentals } from '@/hooks/use-portfolio';
import { useFormat } from '@/i18n/format';

type FundamentalsSectionProps = Record<
  'query',
  ReturnType<typeof usePositionFundamentals>
>;

type FundamentalsGapProps = Record<
  'outcome',
  Exclude<PositionFundamentals['outcome'], 'reported'>
> &
  Record<'onRetry', VoidFunction>;

type RatioFormat = 'multiple' | 'share' | 'growth';

const RATIO_FORMATS: Record<FundamentalRatio, RatioFormat> = {
  priceToEarnings: 'multiple',
  debtToEquity: 'multiple',
  dividendYield: 'share',
  returnOnEquity: 'share',
  profitMargin: 'share',
  revenueGrowth: 'growth',
  earningsGrowth: 'growth'
};

const MULTIPLE_FRACTION_DIGITS = 2;

const CASH_FLOW_FORMAT: Intl.NumberFormatOptions = {
  notation: 'compact',
  maximumFractionDigits: 2
};

const SOURCE_NAMES: ReadonlyMap<string, string> = new Map([
  ['yahoo-finance', 'Yahoo Finance']
]);

const ABSENCE_MESSAGE_KEYS = {
  'not-applicable': 'notApplicable',
  'not-found': 'notFound'
} as const satisfies Record<
  Exclude<PositionFundamentals['outcome'], 'reported' | 'unavailable'>,
  string
>;

const NotReported: FC = () => {
  const t = useTranslations('investments.asset.fundamentals');

  return <span className="text-muted-foreground">{t('notReported')}</span>;
};

const FigureValue: FC<Record<'figure', FundamentalFigure>> = ({ figure }) => {
  const { formatDecimal, formatMoney } = useFormat();

  if (figure.metric === 'freeCashFlow')
    return figure.value === undefined ? (
      <NotReported />
    ) : (
      formatMoney(figure.value, figure.currency, CASH_FLOW_FORMAT)
    );

  if (figure.value === undefined) return <NotReported />;

  switch (RATIO_FORMATS[figure.metric]) {
    case 'multiple':
      return `${formatDecimal(figure.value, MULTIPLE_FRACTION_DIGITS)}×`;
    case 'share':
      return <Percentage value={figure.value} />;
    case 'growth':
      return <Trend value={figure.value} />;
  }
};

const FundamentalFigures: FC<Record<'fundamentals', ReportedFundamentals>> = ({
  fundamentals: { source, figures }
}) => {
  const t = useTranslations('investments.asset.fundamentals');

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {figures.map((figure) => (
          <Metric
            key={figure.metric}
            label={t(`metrics.${figure.metric}.label`)}
            info={t(`metrics.${figure.metric}.explanation`)}
          >
            <FigureValue figure={figure} />
          </Metric>
        ))}
      </dl>

      <p className="text-xs text-muted-foreground">
        {t('source', { source: SOURCE_NAMES.get(source) ?? source })}
      </p>
    </div>
  );
};

const FundamentalsGap: FC<FundamentalsGapProps> = ({ outcome, onRetry }) => {
  const t = useTranslations('investments.asset.fundamentals');

  return outcome === 'unavailable' ? (
    <ErrorState message={t('unavailable')} onRetry={onRetry} />
  ) : (
    <EmptyState message={t(ABSENCE_MESSAGE_KEYS[outcome])} />
  );
};

export const FundamentalsSection: FC<FundamentalsSectionProps> = ({
  query
}) => {
  const t = useTranslations('investments.asset.fundamentals');
  const { data, refetch } = query;

  return (
    <QuerySection
      title={t('title')}
      query={query}
      errorMessage={t('loadFailed')}
      loading={<LoadingState label={t('loading')} className="h-32" />}
      isEmpty={({ outcome }) => outcome !== 'reported'}
      empty={
        data !== undefined &&
        data.outcome !== 'reported' && (
          <FundamentalsGap outcome={data.outcome} onRetry={refetch} />
        )
      }
    >
      {(fundamentals) =>
        fundamentals.outcome === 'reported' && (
          <FundamentalFigures fundamentals={fundamentals} />
        )
      }
    </QuerySection>
  );
};
