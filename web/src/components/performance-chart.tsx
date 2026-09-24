import { useId, useMemo, useState, type FC } from 'react';

import { useSearchParams } from 'next/navigation';

import type {
  PerformancePoint,
  PerformanceRange,
  PortfolioPerformance
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { updateUrlQuery } from '@/common/utils';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Money, Trend } from '@/components/financial';
import { InfoTip } from '@/components/info-tip';
import { QuerySection } from '@/components/query-section';
import { MAX_PLOTTED_POINTS, SeriesChart } from '@/components/series-chart';
import {
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import { usePerformance } from '@/hooks/use-portfolio';
import { formatSeriesDay } from '@/lib/dates';

type PerformanceChartProps = Record<'portfolio', Portfolio> &
  Partial<Record<'symbol', string>>;

type PerformanceSeriesProps = Pick<
  PortfolioPerformance,
  'series' | 'baseCurrency'
> &
  Record<'period', string>;

const RANGE_PARAM = 'range';
const DEFAULT_RANGE: PerformanceRange = '1Y';
const HISTORY_RANGE: PerformanceRange = 'MAX';

const PERFORMANCE_RANGES: PerformanceRange[] = [
  '1W',
  '1M',
  '3M',
  '6M',
  '1Y',
  'YTD',
  'MAX'
];

const PERFORMANCE_RANGE_LABELS: Record<
  PerformanceRange,
  Record<'name' | 'period', string>
> = {
  '1W': { name: '1W', period: 'in the last week' },
  '1M': { name: '1M', period: 'in the last month' },
  '3M': { name: '3M', period: 'in the last three months' },
  '6M': { name: '6M', period: 'in the last six months' },
  '1Y': { name: '1Y', period: 'in the last year' },
  YTD: { name: 'YTD', period: 'this year' },
  MAX: { name: 'All', period: 'since the first transaction' }
};

/**
 * Keeps the last point whatever the stride: it is the current value, the one
 * the headline reads while the pointer is away.
 */
const plottedSeriesOf = (
  series: ReadonlyArray<PerformancePoint>
): ReadonlyArray<PerformancePoint> => {
  if (series.length <= MAX_PLOTTED_POINTS) return series;

  const stride = Math.ceil(series.length / MAX_PLOTTED_POINTS);
  const sampled = series.filter((_, index) => index % stride === 0);
  const last = series.at(-1);

  return last === undefined || sampled.at(-1) === last
    ? sampled
    : [...sampled, last];
};

/**
 * Holds the hovered point so that moving the pointer redraws the headline and
 * the chart alone, leaving the period selector and the table untouched.
 */
const PerformanceSeries: FC<PerformanceSeriesProps> = ({
  series,
  baseCurrency,
  period
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const plotted = useMemo(() => plottedSeriesOf(series), [series]);
  const values = useMemo(() => plotted.map(({ value }) => value), [plotted]);

  const readPoint = plotted.at(activeIndex ?? -1) ?? plotted[0];

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold">
          <Money value={readPoint.value} currency={baseCurrency} />
        </p>

        <p className="flex items-center gap-0.5 text-sm font-medium">
          <Trend value={readPoint.twr} />

          <InfoTip label="About this return">
            Time-weighted return: money added or withdrawn does not count as a
            gain or a loss, so it can differ from profit/loss.
          </InfoTip>
        </p>

        <p className="text-sm text-muted-foreground">
          {activeIndex === null ? period : formatSeriesDay(readPoint.date)}
        </p>
      </div>

      <SeriesChart
        values={values}
        activeIndex={activeIndex}
        onActiveIndexChange={setActiveIndex}
        className="h-48"
        tooltip={
          <>
            <p className="font-medium">{formatSeriesDay(readPoint.date)}</p>

            <p>
              <Money value={readPoint.value} currency={baseCurrency} />
            </p>

            <p>
              <Trend value={readPoint.twr} />
            </p>
          </>
        }
      />
    </>
  );
};

export const PerformanceChart: FC<PerformanceChartProps> = ({
  portfolio,
  symbol
}) => {
  const searchParams = useSearchParams();
  const selectedRange =
    PERFORMANCE_RANGES.find(
      (range) => range === searchParams.get(RANGE_PARAM)
    ) ?? DEFAULT_RANGE;
  const [isTableOpen, setIsTableOpen] = useState(false);
  const performanceQuery = usePerformance(portfolio, {
    range: selectedRange,
    symbol
  });
  const { data: performance, isError, isPlaceholderData } = performanceQuery;
  const isSelectedRangeEmpty =
    performance !== undefined &&
    !isPlaceholderData &&
    performance.series.length === 0;

  /**
   * Every period ends today, so one comes back empty while the history does not
   * only when no trading day of it has a value yet, as the year to date early in
   * January. The whole history is asked for then, and only then.
   */
  const historyQuery = usePerformance(
    isSelectedRangeEmpty && selectedRange !== HISTORY_RANGE ? portfolio : null,
    { range: HISTORY_RANGE, symbol }
  );

  /** A failed period keeps the selector, so another one can still be chosen. */
  const hasRangesToChoose =
    isError ||
    (performance !== undefined && performance.series.length > 0) ||
    (historyQuery.data !== undefined && historyQuery.data.series.length > 0);

  const rangeInputName = useId();

  const selectRange = (range: PerformanceRange) => {
    const params = new URLSearchParams(searchParams);

    if (range === DEFAULT_RANGE) params.delete(RANGE_PARAM);
    else params.set(RANGE_PARAM, range);

    updateUrlQuery(params);
  };

  return (
    <QuerySection
      title="Performance"
      query={performanceQuery}
      errorMessage="The performance could not be loaded"
      action={
        hasRangesToChoose && (
          <fieldset>
            <legend className="sr-only">Period</legend>

            <SegmentedControl className="flex-wrap">
              {PERFORMANCE_RANGES.map((range) => (
                <SegmentedControlItem
                  key={range}
                  name={rangeInputName}
                  value={range}
                  checked={range === selectedRange}
                  onChange={() => selectRange(range)}
                >
                  {PERFORMANCE_RANGE_LABELS[range].name}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </fieldset>
        )
      }
      loading={
        <LoadingState label="Loading the performance">
          <div className="space-y-4">
            <Skeleton aria-hidden="true" className="h-8 w-56" />

            <Skeleton aria-hidden="true" className="h-48 w-full" />
          </div>
        </LoadingState>
      }
      empty={
        <EmptyState
          message={
            hasRangesToChoose
              ? 'No performance to display for this period'
              : 'No performance to display yet'
          }
        />
      }
      isEmpty={({ series }) => series.length === 0}
    >
      {({ series, baseCurrency }) => {
        const { period } = PERFORMANCE_RANGE_LABELS[selectedRange];
        const caption = `${symbol ?? 'Portfolio'} value and return on each trading day ${period}`;

        return (
          <div className="space-y-4">
            <PerformanceSeries
              key={selectedRange}
              series={series}
              baseCurrency={baseCurrency}
              period={period}
            />

            <details
              open={isTableOpen}
              onToggle={({ currentTarget }) =>
                setIsTableOpen(currentTarget.open)
              }
            >
              <summary className="cursor-pointer rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
                Performance as a table
              </summary>

              {isTableOpen && (
                <Table
                  label="Performance table"
                  regionClassName="mt-3 max-h-72"
                >
                  <TableCaption className="sr-only">{caption}</TableCaption>

                  <TableHeader>
                    <TableRow>
                      <TableHead>Day</TableHead>

                      <TableHead className="text-right">Value</TableHead>

                      <TableHead className="text-right">Invested</TableHead>

                      <TableHead className="text-right">
                        Net contribution
                      </TableHead>

                      <TableHead className="text-right">Return</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {series.map(
                      ({
                        date,
                        value,
                        investedValue,
                        netContribution,
                        twr
                      }) => (
                        <TableRow key={date}>
                          <TableRowHeader>
                            {formatSeriesDay(date)}
                          </TableRowHeader>

                          <TableCell className="text-right font-medium">
                            <Money value={value} currency={baseCurrency} />
                          </TableCell>

                          <TableCell className="text-right">
                            <Money
                              value={investedValue}
                              currency={baseCurrency}
                            />
                          </TableCell>

                          <TableCell className="text-right">
                            <Money
                              signed
                              value={netContribution}
                              currency={baseCurrency}
                            />
                          </TableCell>

                          <TableCell className="text-right">
                            <Trend value={twr} />
                          </TableCell>
                        </TableRow>
                      )
                    )}
                  </TableBody>
                </Table>
              )}
            </details>
          </div>
        );
      }}
    </QuerySection>
  );
};
