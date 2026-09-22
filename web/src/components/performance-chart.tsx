import { useId, useMemo, useState, type FC, type PointerEvent } from 'react';

import { twMerge } from 'tailwind-merge';

import type {
  PerformancePoint,
  PerformanceRange,
  PortfolioPerformance
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { formatSeriesDay } from '@/common/utils';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Money, Trend } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
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
  TableRow
} from '@/components/ui';
import { usePerformance } from '@/hooks/use-portfolio';

type PerformanceChartProps = Record<'portfolio', Portfolio> &
  Partial<Record<'symbol', string>>;

type PerformanceSeriesProps = Pick<
  PortfolioPerformance,
  'series' | 'baseCurrency'
> &
  Record<'period', string>;

type ChartPoint = Record<'x' | 'y', number>;

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

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const CHART_VIEW_BOX = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;
const CHART_PADDING = 6;

/** Two points closer than one unit of the drawing box land on the same pixel. */
const MAX_PLOTTED_POINTS = CHART_WIDTH;

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
 * Amounts become numbers here only to be scaled into the drawing box: every
 * value the reader sees is formatted from the decimal string the API sent.
 */
const chartPointsOf = (
  series: ReadonlyArray<PerformancePoint>
): ChartPoint[] => {
  const values = series.map(({ value }) => Number(value));
  const lowest = Math.min(...values);
  const span = Math.max(...values) - lowest;
  const plotHeight = CHART_HEIGHT - 2 * CHART_PADDING;
  const step = values.length > 1 ? CHART_WIDTH / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: values.length > 1 ? index * step : CHART_WIDTH / 2,
    y:
      span === 0
        ? CHART_HEIGHT / 2
        : CHART_PADDING + plotHeight * (1 - (value - lowest) / span)
  }));
};

const linePathOf = (points: ReadonlyArray<ChartPoint>) =>
  points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ');

const areaPathOf = (points: ReadonlyArray<ChartPoint>) => {
  const first = points.at(0);
  const last = points.at(-1);

  if (first === undefined || last === undefined) return '';

  return `${linePathOf(points)} L${last.x} ${CHART_HEIGHT} L${first.x} ${CHART_HEIGHT} Z`;
};

/**
 * Holds the hovered point so that moving the pointer redraws the line and the
 * tooltip alone, leaving the period selector and the table untouched; the paths
 * are built once per series instead of once per pointer event.
 */
const PerformanceSeries: FC<PerformanceSeriesProps> = ({
  series,
  baseCurrency,
  period
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const plotted = useMemo(() => plottedSeriesOf(series), [series]);
  const points = useMemo(() => chartPointsOf(plotted), [plotted]);
  const linePath = useMemo(() => linePathOf(points), [points]);
  const areaPath = useMemo(() => areaPathOf(points), [points]);

  const activePoint = activeIndex === null ? null : points.at(activeIndex);
  const readPoint = plotted.at(activeIndex ?? -1) ?? plotted[0];

  const trackPointer = ({
    clientX,
    currentTarget
  }: PointerEvent<HTMLDivElement>) => {
    const { left, width } = currentTarget.getBoundingClientRect();

    if (width === 0 || points.length === 0) return;

    const position = Math.round(
      ((clientX - left) / width) * (points.length - 1)
    );

    setActiveIndex(Math.min(points.length - 1, Math.max(0, position)));
  };

  return (
    <>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-2xl font-semibold">
          <Money value={readPoint.value} currency={baseCurrency} />
        </p>

        <p className="text-sm font-medium">
          <Trend value={readPoint.twr} />
        </p>

        <p className="text-sm text-muted-foreground">
          {activeIndex === null ? period : formatSeriesDay(readPoint.date)}
        </p>
      </div>

      <div
        className="relative"
        onPointerMove={trackPointer}
        onPointerLeave={() => setActiveIndex(null)}
      >
        <svg
          aria-hidden="true"
          viewBox={CHART_VIEW_BOX}
          preserveAspectRatio="none"
          className="block h-48 w-full"
        >
          <path d={areaPath} className="fill-primary/10" />

          <path
            d={linePath}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-primary"
          />

          {activePoint !== undefined && activePoint !== null && (
            <line
              x1={activePoint.x}
              y1={0}
              x2={activePoint.x}
              y2={CHART_HEIGHT}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className="stroke-muted-foreground/40"
            />
          )}
        </svg>

        {activePoint !== undefined && activePoint !== null && (
          <>
            <span
              aria-hidden="true"
              style={{
                left: `${(activePoint.x / CHART_WIDTH) * 100}%`,
                top: `${(activePoint.y / CHART_HEIGHT) * 100}%`
              }}
              className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
            />

            <div
              aria-hidden="true"
              className={twMerge(
                'pointer-events-none absolute top-0 space-y-0.5 rounded-md border bg-background px-3 py-2 text-xs shadow-elevated',
                activePoint.x > CHART_WIDTH / 2 ? 'left-0' : 'right-0'
              )}
            >
              <p className="font-medium">{formatSeriesDay(readPoint.date)}</p>

              <p>
                <Money value={readPoint.value} currency={baseCurrency} />
              </p>

              <p>
                <Trend value={readPoint.twr} />
              </p>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export const PerformanceChart: FC<PerformanceChartProps> = ({
  portfolio,
  symbol
}) => {
  const [selectedRange, setSelectedRange] = useState<PerformanceRange>('1Y');
  const [isTableOpen, setIsTableOpen] = useState(false);
  const performanceQuery = usePerformance(portfolio, {
    range: selectedRange,
    symbol
  });
  const rangeInputName = useId();

  return (
    <QuerySection
      title="Performance"
      query={performanceQuery}
      errorMessage="The performance could not be loaded"
      action={
        <fieldset>
          <legend className="sr-only">Period</legend>

          <SegmentedControl className="flex-wrap">
            {PERFORMANCE_RANGES.map((range) => (
              <SegmentedControlItem
                key={range}
                name={rangeInputName}
                value={range}
                checked={range === selectedRange}
                onChange={() => setSelectedRange(range)}
              >
                {PERFORMANCE_RANGE_LABELS[range].name}
              </SegmentedControlItem>
            ))}
          </SegmentedControl>
        </fieldset>
      }
      loading={
        <LoadingState label="Loading the performance">
          <div className="space-y-4">
            <Skeleton aria-hidden="true" className="h-8 w-56" />

            <Skeleton aria-hidden="true" className="h-48 w-full" />
          </div>
        </LoadingState>
      }
      empty={<EmptyState message="No performance to display for this period" />}
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
                          <TableCell>{formatSeriesDay(date)}</TableCell>

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
