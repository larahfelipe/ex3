import { useId, useMemo, useState, type FC } from 'react';

import { useSearchParams } from 'next/navigation';

import { useTranslations } from 'use-intl';

import type {
  PerformanceBenchmark,
  PerformancePoint,
  PerformanceRange,
  PerformanceSummary,
  PortfolioPerformance
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { updateUrlQuery } from '@/common/utils';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Money, ProfitLoss, Trend } from '@/components/financial';
import { InfoNote } from '@/components/info-note';
import { InfoTip } from '@/components/info-tip';
import { QuerySection } from '@/components/query-section';
import { MAX_PLOTTED_POINTS, SeriesChart } from '@/components/series-chart';
import {
  Label,
  SegmentedControl,
  SegmentedControlItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
import { isNotFoundError } from '@/lib/axios';
import { APPEAR_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { DecimalString, Maybe } from '@/types';

type PerformanceChartProps = Record<'portfolio', Portfolio> &
  Partial<Record<'symbol', string>>;

type PerformanceMetric = 'value' | 'return';

type PerformanceSeriesProps = Pick<
  PortfolioPerformance,
  'series' | 'baseCurrency' | 'summary' | 'benchmark'
> &
  Record<'metric', PerformanceMetric> &
  Record<'period' | 'seriesLabel', string>;

type LegendLineProps = Record<'label', string> &
  Partial<Record<'dashed', boolean>>;

const RANGE_PARAM = 'range';
const METRIC_PARAM = 'metric';
const BENCHMARK_PARAM = 'benchmark';

const DEFAULT_RANGE: PerformanceRange = '1Y';
const HISTORY_RANGE: PerformanceRange = 'MAX';
const DEFAULT_METRIC: PerformanceMetric = 'value';
const NO_BENCHMARK = 'none';

const PERFORMANCE_RANGES: PerformanceRange[] = [
  '1W',
  '1M',
  '3M',
  '6M',
  '1Y',
  'YTD',
  'MAX'
];

const PERFORMANCE_METRICS: PerformanceMetric[] = ['value', 'return'];

/** ETFs that follow the two indexes a Brazilian investor most often measures against. */
const BENCHMARK_SYMBOLS = ['BOVA11', 'VOO'] as const;

const benchmarkSymbolOf = (symbol: Maybe<string>) =>
  BENCHMARK_SYMBOLS.find((benchmark) => benchmark === symbol);

const ZERO_RETURN: DecimalString = '0';

/** One decimal is enough to place a line against its axis; the exact return is in the tooltip and the table. */
const RETURN_TICK_FORMAT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 1
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

/** The benchmark has no point on a day without a close near it, so it is read by date, not by position. */
const benchmarkReturnsOn = (
  points: ReadonlyArray<PerformancePoint>,
  benchmark: Maybe<PerformanceBenchmark>
): ReadonlyArray<Maybe<DecimalString>> => {
  if (!benchmark) return [];

  const returnsByDate = new Map(
    benchmark.series.map(({ date, twr }) => [date, twr])
  );

  return points.map(({ date }) => returnsByDate.get(date));
};

const LegendLine: FC<LegendLineProps> = ({ label, dashed }) => (
  <li className="flex items-center gap-1.5">
    <svg aria-hidden="true" viewBox="0 0 16 2" className="h-0.5 w-4 shrink-0">
      <line
        x1={0}
        y1={1}
        x2={16}
        y2={1}
        strokeWidth={2}
        strokeDasharray={dashed ? '4 2' : undefined}
        className={dashed ? 'stroke-chart-2' : 'stroke-primary'}
      />
    </svg>

    {label}
  </li>
);

const PeriodSummary: FC<
  Record<'summary', PerformanceSummary> &
    Record<'baseCurrency' | 'period', string>
> = ({ summary, baseCurrency, period }) => {
  const t = useTranslations('investments.performance');
  const { formatMoney } = useFormat();

  return (
    <div className="space-y-0.5 text-sm">
      <p className="flex flex-wrap items-center gap-x-2">
        <span className="font-medium">
          <ProfitLoss
            value={summary.valueChange}
            percent={summary.valueChangePercent}
            currency={baseCurrency}
          />
        </span>

        <span className="text-muted-foreground">{period}</span>

        <InfoTip label={t('valueChangeTip')}>
          <p>{t('valueChangeExplanation')}</p>

          <p className="mt-2">{t('gapsExplanation')}</p>
        </InfoTip>
      </p>

      {summary.netContribution !== ZERO_RETURN && (
        <p className="text-muted-foreground">
          {t('netContributionNote', {
            amount: formatMoney(summary.netContribution, baseCurrency, {
              signDisplay: 'exceptZero'
            })
          })}
        </p>
      )}
    </div>
  );
};

/**
 * Holds the hovered point so that moving the pointer redraws the headline and
 * the chart alone, leaving the controls and the table untouched. The value
 * view reads the money, contributions included; the return view reads the
 * time-weighted return, which leaves them out, against the benchmark's.
 */
export const PerformanceSeries: FC<PerformanceSeriesProps> = ({
  series,
  baseCurrency,
  summary,
  benchmark,
  metric,
  period,
  seriesLabel
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const t = useTranslations('investments.performance');
  const { formatCompactMoney, formatMoney, formatPercent, formatSeriesDay } =
    useFormat();

  const plotted = useMemo(() => plottedSeriesOf(series), [series]);
  const values = useMemo(
    () => plotted.map(({ value, twr }) => (metric === 'value' ? value : twr)),
    [plotted, metric]
  );
  const benchmarkReturns = useMemo(
    () => benchmarkReturnsOn(plotted, benchmark),
    [plotted, benchmark]
  );
  const comparedSymbol = benchmarkSymbolOf(benchmark?.symbol);
  const benchmarkLabel =
    benchmark === undefined
      ? undefined
      : comparedSymbol === undefined
        ? benchmark.name
        : t(`benchmarks.${comparedSymbol}`);
  const isComparing = metric === 'return' && benchmarkLabel !== undefined;
  const hasBenchmarkLine =
    isComparing && benchmark !== undefined && benchmark.series.length > 0;

  const readIndex = activeIndex ?? plotted.length - 1;
  const readPoint = plotted[readIndex] ?? plotted[0];
  const readBenchmarkReturn = benchmarkReturns[readIndex];
  const first = plotted[0];
  const last = plotted[plotted.length - 1];

  const formatSignedPercent = (fraction: Maybe<DecimalString>) =>
    fraction === null || fraction === undefined
      ? t('noBenchmarkReturn')
      : formatPercent(fraction, { signDisplay: 'exceptZero' });

  const describePoint = (index: number) => {
    const point = plotted[index];
    const day = formatSeriesDay(point.date);

    if (metric === 'value')
      return t('pointValue', {
        day,
        value: formatMoney(point.value, baseCurrency),
        invested: formatMoney(point.investedValue, baseCurrency)
      });

    return hasBenchmarkLine && benchmarkLabel !== undefined
      ? t('pointReturnAgainst', {
          day,
          return: formatSignedPercent(point.twr),
          benchmark: benchmarkLabel,
          benchmarkReturn: formatSignedPercent(benchmarkReturns[index])
        })
      : t('pointReturn', { day, return: formatSignedPercent(point.twr) });
  };

  return (
    <figure className="space-y-3">
      <div className="space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="flex items-center gap-1 text-2xl font-semibold">
            {metric === 'value' ? (
              <Money value={readPoint.value} currency={baseCurrency} />
            ) : (
              <>
                <Trend value={readPoint.twr} />

                <InfoTip label={t('returnTip')}>
                  <p>{t('returnExplanation')}</p>

                  <p className="mt-2">{t('gapsExplanation')}</p>
                </InfoTip>
              </>
            )}
          </p>

          <p className="text-sm text-muted-foreground">
            {activeIndex === null ? period : formatSeriesDay(readPoint.date)}
          </p>
        </div>

        {metric === 'value' && summary !== undefined && (
          <PeriodSummary
            summary={summary}
            baseCurrency={baseCurrency}
            period={period}
          />
        )}

        {hasBenchmarkLine && benchmarkLabel !== undefined && (
          <p className="flex flex-wrap gap-x-2 text-sm">
            <span className="text-muted-foreground">{benchmarkLabel}</span>

            <span className="font-medium">
              {readBenchmarkReturn === null ||
              readBenchmarkReturn === undefined ? (
                <span className="text-muted-foreground">
                  {t('noBenchmarkReturn')}
                </span>
              ) : (
                <Trend value={readBenchmarkReturn} />
              )}
            </span>
          </p>
        )}
      </div>

      {hasBenchmarkLine && benchmarkLabel !== undefined && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <LegendLine label={seriesLabel} />

          <LegendLine dashed label={benchmarkLabel} />
        </ul>
      )}

      <div className="space-y-1">
        <SeriesChart
          key={hasBenchmarkLine ? `${metric}-compared` : metric}
          values={values}
          comparison={hasBenchmarkLine ? benchmarkReturns : undefined}
          activeIndex={activeIndex}
          onActiveIndexChange={setActiveIndex}
          baseline={metric === 'return' ? ZERO_RETURN : undefined}
          formatTick={(amount) =>
            metric === 'value'
              ? formatCompactMoney(amount, baseCurrency)
              : formatPercent(amount, RETURN_TICK_FORMAT)
          }
          label={metric === 'value' ? t('valueChart') : t('returnChart')}
          describePoint={describePoint}
          className={cn('h-48', APPEAR_CLASS)}
          tooltip={
            <>
              <p className="font-medium">{formatSeriesDay(readPoint.date)}</p>

              {metric === 'value' ? (
                <>
                  <p>
                    <Money value={readPoint.value} currency={baseCurrency} />
                  </p>

                  <p className="text-muted-foreground">
                    {t('investedOn', {
                      amount: formatMoney(readPoint.investedValue, baseCurrency)
                    })}
                  </p>
                </>
              ) : (
                <>
                  <p className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{seriesLabel}</span>

                    <Trend value={readPoint.twr} />
                  </p>

                  {hasBenchmarkLine && benchmarkLabel !== undefined && (
                    <p className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {benchmarkLabel}
                      </span>

                      {readBenchmarkReturn === null ||
                      readBenchmarkReturn === undefined ? (
                        <span className="text-muted-foreground">
                          {t('noBenchmarkReturn')}
                        </span>
                      ) : (
                        <Trend value={readBenchmarkReturn} />
                      )}
                    </p>
                  )}
                </>
              )}
            </>
          }
        />

        <figcaption className="flex justify-between gap-4 pl-16 text-xs text-muted-foreground">
          <time dateTime={first.date}>{formatSeriesDay(first.date)}</time>

          {plotted.length > 1 && (
            <time dateTime={last.date}>{formatSeriesDay(last.date)}</time>
          )}
        </figcaption>
      </div>

      {isComparing && (
        <InfoNote className="text-xs">
          {!hasBenchmarkLine
            ? t('benchmarkWithoutCloses', { benchmark: benchmarkLabel })
            : t('benchmarkCaveat', {
                benchmark: benchmarkLabel,
                currency: baseCurrency
              })}
        </InfoNote>
      )}
    </figure>
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
  const selectedMetric =
    PERFORMANCE_METRICS.find(
      (metric) => metric === searchParams.get(METRIC_PARAM)
    ) ?? DEFAULT_METRIC;
  const selectedBenchmark = benchmarkSymbolOf(
    searchParams.get(BENCHMARK_PARAM)
  );
  const [isTableOpen, setIsTableOpen] = useState(false);
  const t = useTranslations('investments.performance');

  /**
   * The benchmark is asked for in both views, so switching between them reads
   * the same response. A catalog without it answers 404, and the series is then
   * asked for alone, with a note saying the comparison is missing.
   */
  const comparedQuery = usePerformance(portfolio, {
    range: selectedRange,
    ...(symbol !== undefined && { symbol }),
    ...(selectedBenchmark !== undefined && { benchmark: selectedBenchmark })
  });
  const isBenchmarkMissing =
    selectedBenchmark !== undefined &&
    comparedQuery.error !== null &&
    isNotFoundError(comparedQuery.error);
  const uncomparedQuery = usePerformance(
    isBenchmarkMissing ? portfolio : null,
    { range: selectedRange, ...(symbol !== undefined && { symbol }) }
  );
  const performanceQuery = isBenchmarkMissing ? uncomparedQuery : comparedQuery;
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
    { range: HISTORY_RANGE, ...(symbol !== undefined && { symbol }) }
  );

  /** A failed period keeps the selector, so another one can still be chosen. */
  const hasRangesToChoose =
    isError ||
    (performance !== undefined && performance.series.length > 0) ||
    (historyQuery.data !== undefined && historyQuery.data.series.length > 0);

  const rangeInputName = useId();
  const metricInputName = useId();
  const benchmarkSelectId = useId();

  const updateParam = (name: string, value: string, defaultValue?: string) => {
    const params = new URLSearchParams(searchParams);

    if (value === defaultValue) params.delete(name);
    else params.set(name, value);

    updateUrlQuery(params);
  };

  const seriesLabel = symbol ?? t('portfolioSeries');

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
                  onChange={() =>
                    updateParam(RANGE_PARAM, range, DEFAULT_RANGE)
                  }
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
      {({ series, baseCurrency, summary, benchmark }) => {
        const period = t(`periods.${selectedRange}`);
        const caption =
          symbol === undefined
            ? t('portfolioCaption', { period })
            : t('assetCaption', { symbol, period });
        const comparedBenchmark =
          selectedMetric === 'return' ? benchmark : undefined;
        const benchmarkReturnsByDate = new Map(
          comparedBenchmark?.series.map(({ date, twr }) => [date, twr])
        );

        return (
          <div
            aria-busy={isPlaceholderData}
            className={cn(
              'space-y-4 transition-opacity',
              isPlaceholderData && 'opacity-60'
            )}
          >
            <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
              <fieldset>
                <legend className="sr-only">{t('metric')}</legend>

                <SegmentedControl>
                  {PERFORMANCE_METRICS.map((metric) => (
                    <SegmentedControlItem
                      key={metric}
                      name={metricInputName}
                      value={metric}
                      checked={metric === selectedMetric}
                      onChange={() =>
                        updateParam(METRIC_PARAM, metric, DEFAULT_METRIC)
                      }
                    >
                      {t(`metrics.${metric}`)}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </fieldset>

              {selectedMetric === 'return' && (
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={benchmarkSelectId}
                    className="text-sm font-normal text-muted-foreground"
                  >
                    {t('compareWith')}
                  </Label>

                  <Select
                    value={selectedBenchmark ?? NO_BENCHMARK}
                    onValueChange={(value) =>
                      updateParam(BENCHMARK_PARAM, value, NO_BENCHMARK)
                    }
                  >
                    <SelectTrigger
                      id={benchmarkSelectId}
                      className="h-9 w-auto gap-2"
                    >
                      <SelectValue />
                    </SelectTrigger>

                    <SelectContent>
                      <SelectItem value={NO_BENCHMARK}>
                        {t('benchmarks.none')}
                      </SelectItem>

                      {BENCHMARK_SYMBOLS.map((benchmarkSymbol) => (
                        <SelectItem
                          key={benchmarkSymbol}
                          value={benchmarkSymbol}
                        >
                          {t(`benchmarks.${benchmarkSymbol}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {selectedMetric === 'return' &&
              isBenchmarkMissing &&
              selectedBenchmark !== undefined && (
                <InfoNote>
                  {t('benchmarkNotFound', {
                    benchmark: t(`benchmarks.${selectedBenchmark}`)
                  })}
                </InfoNote>
              )}

            <PerformanceSeries
              key={selectedRange}
              series={series}
              baseCurrency={baseCurrency}
              summary={summary}
              benchmark={benchmark}
              metric={selectedMetric}
              period={period}
              seriesLabel={seriesLabel}
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

                      {comparedBenchmark !== undefined && (
                        <TableHead className="text-right">
                          {t('columns.benchmark', {
                            symbol: comparedBenchmark.symbol
                          })}
                        </TableHead>
                      )}
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

                          {comparedBenchmark !== undefined && (
                            <TableCell className="text-right">
                              <Trend value={benchmarkReturnsByDate.get(date)} />
                            </TableCell>
                          )}
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
