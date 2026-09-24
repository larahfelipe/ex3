import type { InstrumentType } from './models';

/** A multiple, as `12.5` for 12.5 times, or a share of one, as `0.12` for 12%. */
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

/** What a source reports of each metric; one it leaves out is not reported. */
export type ReportedFundamentals = Partial<Record<FundamentalRatio, string>> &
  Partial<Record<'freeCashFlow', ReportedAmount>>;

/** A figure without a value is one the source does not report for the instrument. */
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

/**
 * The metrics that read something of each class, in the order they are shown.
 * A real estate trust depreciates its properties, which distorts its earnings,
 * so its earnings multiple, returns and margins misread it; a fund's multiples
 * are its holdings', so only its yield is its own. Crypto, fixed income, cash
 * and an unclassified instrument have no company behind them.
 */
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

/** One figure per metric, in the order given, whether the source reports it or not. */
export const describeFundamentals = (
  metrics: ReadonlyArray<FundamentalMetric>,
  reported: ReportedFundamentals,
  source: string
): PositionFundamentals => ({
  outcome: 'reported',
  source,
  figures: metrics.map((metric) => figureOf(metric, reported))
});
