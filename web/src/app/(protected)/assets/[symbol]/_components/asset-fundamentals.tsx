import type { FC } from 'react';

import type {
  FundamentalFigure,
  FundamentalRatio,
  PositionFundamentals,
  ReportedFundamentals
} from '@/app/api/v1/portfolio';
import { formatDecimal, formatMoney } from '@/common/utils';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { Metric, Percentage, Trend } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import type { usePositionFundamentals } from '@/hooks/use-portfolio';

type FundamentalsSectionProps = Record<
  'query',
  ReturnType<typeof usePositionFundamentals>
>;

type FundamentalsGapProps = Record<
  'outcome',
  Exclude<PositionFundamentals['outcome'], 'reported'>
> &
  Record<'onRetry', VoidFunction>;

type MetricDescription = Record<'label' | 'explanation', string>;

/** A multiple reads as times, a share as a percent, and a growth as a signed, toned percent. */
type RatioFormat = 'multiple' | 'share' | 'growth';

const METRIC_DESCRIPTIONS: Record<
  FundamentalFigure['metric'],
  MetricDescription
> = {
  priceToEarnings: {
    label: 'P/E',
    explanation:
      'Price divided by earnings per share over the last 12 months: what the market pays for each unit of yearly profit. A lower multiple can mean a cheaper share or lower expected growth, so compare it within a sector. Sources leave it out while earnings are negative.'
  },
  dividendYield: {
    label: 'Dividend yield (12M)',
    explanation:
      'Dividends or distributions paid over the last 12 months divided by the current price. Past payouts do not promise future ones.'
  },
  returnOnEquity: {
    label: 'ROE',
    explanation:
      "Net income over the last 12 months divided by shareholders' equity: the profit made on the owners' capital. Higher is better, unless heavy debt props it up."
  },
  profitMargin: {
    label: 'Profit margin',
    explanation:
      'Net income as a share of revenue over the last 12 months: how much of each sale is left as profit. Margins differ widely across sectors.'
  },
  debtToEquity: {
    label: 'Debt to equity',
    explanation:
      "Total debt divided by shareholders' equity at the last reported quarter. Above 1× the company owes more than its owners put in; how much is prudent depends on the sector."
  },
  revenueGrowth: {
    label: 'Revenue growth',
    explanation:
      'Revenue of the last reported quarter against the same quarter a year earlier.'
  },
  earningsGrowth: {
    label: 'Earnings growth',
    explanation:
      'Earnings of the last reported quarter against the same quarter a year earlier. It swings widely when the earlier quarter earned little.'
  },
  freeCashFlow: {
    label: 'Free cash flow (12M)',
    explanation:
      'Cash the business generated over the last 12 months after its investments and interest, in the currency of its financial statements. Positive means it funds itself.'
  }
};

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

/** A company's cash flow runs to billions, which read at a glance only abbreviated. */
const CASH_FLOW_FORMAT: Intl.NumberFormatOptions = {
  notation: 'compact',
  maximumFractionDigits: 2
};

const SOURCE_NAMES: ReadonlyMap<string, string> = new Map([
  ['yahoo-finance', 'Yahoo Finance']
]);

const ABSENCE_MESSAGES: Record<'not-applicable' | 'not-found', string> = {
  'not-applicable': "Company fundamentals do not apply to this asset's class",
  'not-found': 'The market data source has no fundamentals for this asset'
};

const UNAVAILABLE_MESSAGE =
  'The market data source could not be reached for fundamentals';

const NotReported: FC = () => (
  <span className="text-muted-foreground">Not reported</span>
);

const FigureValue: FC<Record<'figure', FundamentalFigure>> = ({ figure }) => {
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
}) => (
  <div className="space-y-5">
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {figures.map((figure) => {
        const { label, explanation } = METRIC_DESCRIPTIONS[figure.metric];

        return (
          <Metric key={figure.metric} label={label} info={explanation}>
            <FigureValue figure={figure} />
          </Metric>
        );
      })}
    </dl>

    <p className="text-xs text-muted-foreground">
      {`As reported by ${SOURCE_NAMES.get(source) ?? source}; other sources may calculate them differently. Only the metrics that apply to this asset's class are shown.`}
    </p>
  </div>
);

const FundamentalsGap: FC<FundamentalsGapProps> = ({ outcome, onRetry }) =>
  outcome === 'unavailable' ? (
    <ErrorState message={UNAVAILABLE_MESSAGE} onRetry={onRetry} />
  ) : (
    <EmptyState message={ABSENCE_MESSAGES[outcome]} />
  );

export const FundamentalsSection: FC<FundamentalsSectionProps> = ({
  query
}) => {
  const { data, refetch } = query;

  return (
    <QuerySection
      title="Fundamentals"
      query={query}
      errorMessage="The fundamentals could not be loaded"
      loading={
        <LoadingState label="Loading the fundamentals" className="h-32" />
      }
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
