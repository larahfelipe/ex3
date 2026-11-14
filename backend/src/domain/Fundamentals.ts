import type { InstrumentType } from './models';

export type FundamentalRatio =
  | 'priceToEarnings'
  | 'dividendYield'
  | 'returnOnEquity'
  | 'profitMargin'
  | 'debtToEquity'
  | 'revenueGrowth'
  | 'earningsGrowth';

export type FundamentalMetric = FundamentalRatio | 'freeCashFlow';

export type ReportedAmount = Record<'amount' | 'currency', string>;

export type ReportedFundamentals = Partial<Record<FundamentalRatio, string>> &
  Partial<Record<'freeCashFlow', ReportedAmount>>;

export type FundamentalFigure =
  | (Record<'metric', FundamentalRatio> & Partial<Record<'value', string>>)
  | (Record<'metric', 'freeCashFlow'> &
      (
        | Partial<Record<'value' | 'currency', never>>
        | Record<'value' | 'currency', string>
      ));

export type PositionFundamentals =
  | Record<'outcome', 'not-applicable' | 'not-found' | 'unavailable'>
  | (Record<'outcome', 'reported'> &
      Record<'source', string> &
      Record<'figures', Array<FundamentalFigure>>);

const COMPANY_METRICS: ReadonlyArray<FundamentalMetric> = [
  'priceToEarnings',
  'dividendYield',
  'returnOnEquity',
  'profitMargin',
  'debtToEquity',
  'revenueGrowth',
  'earningsGrowth',
  'freeCashFlow'
];

const METRICS_BY_TYPE: Record<
  InstrumentType,
  ReadonlyArray<FundamentalMetric>
> = {
  STOCK: COMPANY_METRICS,
  REIT: ['dividendYield', 'debtToEquity', 'revenueGrowth'],
  ETF: ['dividendYield'],
  FUND: ['dividendYield'],
  CRYPTO: [],
  BOND: [],
  TREASURY: [],
  CASH: [],
  OTHER: []
};

export const fundamentalMetricsOf = (type: InstrumentType) =>
  METRICS_BY_TYPE[type];

const figureOf = (
  metric: FundamentalMetric,
  reported: ReportedFundamentals
): FundamentalFigure => {
  if (metric === 'freeCashFlow') {
    const { freeCashFlow } = reported;

    return freeCashFlow === undefined
      ? { metric }
      : { metric, value: freeCashFlow.amount, currency: freeCashFlow.currency };
  }

  const value = reported[metric];

  return value === undefined ? { metric } : { metric, value };
};

export const describeFundamentals = (
  metrics: ReadonlyArray<FundamentalMetric>,
  reported: ReportedFundamentals,
  source: string
): PositionFundamentals => ({
  outcome: 'reported',
  source,
  figures: metrics.map((metric) => figureOf(metric, reported))
});
