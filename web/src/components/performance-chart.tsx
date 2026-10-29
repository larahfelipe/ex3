import { useId, useMemo, useState, type FC } from 'react';

import { useSearchParams } from 'next/navigation';

import { useTranslations } from 'use-intl';

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
import { useFormat } from '@/i18n/format';
import { cn } from '@/lib/utils';

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
  const t = useTranslations('investments.performance');
  const { formatSeriesDay } = useFormat();

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

          <InfoTip label={t('returnTip')}>{t('returnExplanation')}</InfoTip>
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
  const { formatSeriesDay } = useFormat();
  const selectedRange =
    PERFORMANCE_RANGES.find(
      (range) => range === searchParams.get(RANGE_PARAM)
    ) ?? DEFAULT_RANGE;
  const [isTableOpen, setIsTableOpen] = useState(false);
  const t = useTranslations('investments.performance');
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
      title={t('title')}
      query={performanceQuery}
      errorMessage={t('loadFailed')}
      action={
        hasRangesToChoose && (
          <fieldset>
            <legend className="sr-only">{t('period')}</legend>

            <SegmentedControl className="flex-wrap">
              {PERFORMANCE_RANGES.map((range) => (
                <SegmentedControlItem
                  key={range}
                  name={rangeInputName}
                  value={range}
                  checked={range === selectedRange}
                  onChange={() => selectRange(range)}
                >
                  {t(`ranges.${range}`)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </fieldset>
        )
      }
      loading={
        <LoadingState label={t('loading')}>
          <div className="space-y-4">
            <Skeleton aria-hidden="true" className="h-8 w-56" />

            <Skeleton aria-hidden="true" className="h-48 w-full" />
          </div>
        </LoadingState>
      }
      empty={
        <EmptyState
          message={hasRangesToChoose ? t('emptyPeriod') : t('empty')}
        />
      }
      isEmpty={({ series }) => series.length === 0}
    >
      {({ series, baseCurrency }) => {
        const period = t(`periods.${selectedRange}`);
        const caption =
          symbol === undefined
            ? t('portfolioCaption', { period })
            : t('assetCaption', { symbol, period });

        return (
          <div
            aria-busy={isPlaceholderData}
            className={cn(
              'space-y-4 transition-opacity',
              isPlaceholderData && 'opacity-60'
            )}
          >
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
              <summary className="cursor-pointer rounded-sm text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2">
                {t('showTable')}
              </summary>

              {isTableOpen && (
                <Table label={t('table')} regionClassName="mt-3 max-h-72">
                  <TableCaption className="sr-only">{caption}</TableCaption>

                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('columns.day')}</TableHead>

                      <TableHead className="text-right">
                        {t('columns.value')}
                      </TableHead>

                      <TableHead className="text-right">
                        {t('columns.invested')}
                      </TableHead>

                      <TableHead className="text-right">
                        {t('columns.netContribution')}
                      </TableHead>

                      <TableHead className="text-right">
                        {t('columns.return')}
                      </TableHead>
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
