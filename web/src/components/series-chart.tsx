import {
  useMemo,
  type FC,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode
} from 'react';

import { cn } from '@/lib/utils';
import type { DecimalString, Maybe } from '@/types';

export type SeriesTone = 'primary' | 'positive' | 'negative';

type SeriesChartProps = Record<'values', ReadonlyArray<DecimalString>> &
  Record<'activeIndex', number | null> &
  Record<'onActiveIndexChange', (index: number | null) => void> &
  Record<'tooltip', ReactNode> &
  Record<'label', string> &
  Record<'describePoint', (index: number) => string> &
  Partial<Record<'comparison', ReadonlyArray<Maybe<DecimalString>>>> &
  Partial<Record<'formatTick', (amount: number) => string>> &
  Partial<Record<'tone', SeriesTone>> &
  Partial<Record<'baseline', DecimalString>> &
  Partial<Record<'className', string>>;

type ChartPoint = Record<'x' | 'y', number>;

const CHART_WIDTH = 600;
const CHART_HEIGHT = 200;
const CHART_VIEW_BOX = `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`;
const CHART_PADDING = 6;

/** Four units drawn, four skipped: dashed enough to read as a reference, not as data. */
const BASELINE_DASH = '4 4';

/** Longer dashes than the baseline's, so a compared series reads as data, apart from it. */
const COMPARISON_DASH = '8 5';

/** Two points closer than one unit of the drawing box land on the same pixel. */
export const MAX_PLOTTED_POINTS = CHART_WIDTH;

/** Page Up and Page Down move a tenth of the series, so a long one is crossed in ten steps. */
const PAGE_FRACTION = 0.1;

/** A baseline tick closer than this to the top or bottom one would overlap it. */
const MIN_TICK_GAP = 0.15;

const TONE_CLASSES: Record<
  SeriesTone,
  Record<'line' | 'area' | 'marker', string>
> = {
  primary: {
    line: 'stroke-primary',
    area: 'fill-primary/10',
    marker: 'border-primary'
  },
  positive: {
    line: 'stroke-positive',
    area: 'fill-positive/10',
    marker: 'border-positive'
  },
  negative: {
    line: 'stroke-negative',
    area: 'fill-negative/10',
    marker: 'border-negative'
  }
};

/**
 * Amounts become numbers here only to be scaled into the drawing box: every
 * value the reader sees is formatted from the decimal string the API sent.
 */
const verticalScaleOf = (amounts: ReadonlyArray<number>) => {
  const lowest = Math.min(...amounts);
  const highest = Math.max(...amounts);
  const span = highest - lowest;
  const plotHeight = CHART_HEIGHT - 2 * CHART_PADDING;

  return {
    lowest,
    highest,
    heightOf: (amount: number) =>
      span === 0
        ? CHART_HEIGHT / 2
        : CHART_PADDING + plotHeight * (1 - (amount - lowest) / span)
  };
};

const chartPointsOf = (
  amounts: ReadonlyArray<number>,
  heightOf: (amount: number) => number
): ChartPoint[] => {
  const step = amounts.length > 1 ? CHART_WIDTH / (amounts.length - 1) : 0;

  return amounts.map((amount, index) => ({
    x: amounts.length > 1 ? index * step : CHART_WIDTH / 2,
    y: heightOf(amount)
  }));
};

const linePathOf = (points: ReadonlyArray<ChartPoint>) =>
  points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`)
    .join(' ');

/** A missing value breaks the line, so a gap reads as a gap and not as a straight move. */
const brokenLinePathOf = (points: ReadonlyArray<Maybe<ChartPoint>>) =>
  points
    .map((point, index) => {
      if (point === null || point === undefined) return '';

      const previous = points[index - 1];

      return `${previous ? 'L' : 'M'}${point.x} ${point.y}`;
    })
    .join(' ')
    .trim();

const areaPathOf = (points: ReadonlyArray<ChartPoint>) => {
  const first = points.at(0);
  const last = points.at(-1);

  if (first === undefined || last === undefined) return '';

  return `${linePathOf(points)} L${last.x} ${CHART_HEIGHT} L${first.x} ${CHART_HEIGHT} Z`;
};

/**
 * The caller holds the point under the pointer or the keyboard, so it can read
 * that point outside the drawing too. The chart is a slider over the points:
 * the arrows, Home, End, Page Up and Page Down move along them, Escape lets go,
 * and `describePoint` is what a screen reader announces. `comparison` is drawn
 * dashed on the same scale, index for index with `values`. The paths are
 * rebuilt only when `values`, `comparison` or `baseline` change, so they must
 * keep their identity across renders.
 */
export const SeriesChart: FC<SeriesChartProps> = ({
  values,
  activeIndex,
  onActiveIndexChange,
  tooltip,
  label,
  describePoint,
  comparison,
  formatTick,
  tone = 'primary',
  baseline,
  className
}) => {
  const drawing = useMemo(() => {
    const amounts = values.map(Number);
    const comparedAmounts = (comparison ?? []).map((value) =>
      value === null || value === undefined ? null : Number(value)
    );
    const baselineAmount =
      baseline === undefined ? undefined : Number(baseline);
    const { lowest, highest, heightOf } = verticalScaleOf([
      ...amounts,
      ...comparedAmounts.filter((amount) => amount !== null),
      ...(baselineAmount === undefined ? [] : [baselineAmount])
    ]);
    const points = chartPointsOf(amounts, heightOf);

    return {
      points,
      lowest,
      highest,
      linePath: linePathOf(points),
      areaPath: areaPathOf(points),
      comparisonPath: brokenLinePathOf(
        comparedAmounts.map((amount, index) => {
          const point = points[index];

          return amount === null || point === undefined
            ? null
            : { x: point.x, y: heightOf(amount) };
        })
      ),
      baselineHeight:
        baselineAmount === undefined ? undefined : heightOf(baselineAmount)
    };
  }, [values, comparison, baseline]);

  const { points } = drawing;
  const lastIndex = points.length - 1;
  const readIndex = activeIndex ?? lastIndex;
  const activePoint = activeIndex === null ? undefined : points.at(activeIndex);
  const toneClasses = TONE_CLASSES[tone];

  const trackPointer = ({
    clientX,
    currentTarget
  }: PointerEvent<HTMLDivElement>) => {
    const { left, width } = currentTarget.getBoundingClientRect();

    if (width === 0 || points.length === 0) return;

    const position = Math.round(((clientX - left) / width) * lastIndex);

    onActiveIndexChange(Math.min(lastIndex, Math.max(0, position)));
  };

  const moveWithKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      onActiveIndexChange(null);
      return;
    }

    const page = Math.max(1, Math.round(points.length * PAGE_FRACTION));
    const targets: Partial<Record<string, number>> = {
      ArrowLeft: readIndex - 1,
      ArrowDown: readIndex - 1,
      ArrowRight: readIndex + 1,
      ArrowUp: readIndex + 1,
      PageDown: readIndex - page,
      PageUp: readIndex + page,
      Home: 0,
      End: lastIndex
    };
    const target = targets[event.key];

    if (target === undefined || points.length === 0) return;

    event.preventDefault();
    onActiveIndexChange(Math.min(lastIndex, Math.max(0, target)));
  };

  const tickTopOf = (height: number) => `${(height / CHART_HEIGHT) * 100}%`;
  const hasBaselineTick =
    formatTick !== undefined &&
    drawing.baselineHeight !== undefined &&
    baseline !== undefined &&
    Math.abs(drawing.baselineHeight - CHART_PADDING) / CHART_HEIGHT >
      MIN_TICK_GAP &&
    Math.abs(CHART_HEIGHT - CHART_PADDING - drawing.baselineHeight) /
      CHART_HEIGHT >
      MIN_TICK_GAP;

  const plot = (
    <div
      role="slider"
      tabIndex={points.length === 0 ? -1 : 0}
      aria-label={label}
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={Math.max(lastIndex, 0)}
      aria-valuenow={Math.max(readIndex, 0)}
      aria-valuetext={
        points.length === 0 ? undefined : describePoint(readIndex)
      }
      className={cn(
        'relative min-w-0 flex-1 touch-pan-y rounded-sm ring-offset-background outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        formatTick === undefined && className
      )}
      onPointerDown={trackPointer}
      onPointerMove={trackPointer}
      onPointerLeave={() => onActiveIndexChange(null)}
      onKeyDown={moveWithKeys}
      onBlur={() => onActiveIndexChange(null)}
    >
      <svg
        aria-hidden="true"
        viewBox={CHART_VIEW_BOX}
        preserveAspectRatio="none"
        className="block size-full"
      >
        <path d={drawing.areaPath} className={toneClasses.area} />

        {drawing.baselineHeight !== undefined && (
          <line
            x1={0}
            y1={drawing.baselineHeight}
            x2={CHART_WIDTH}
            y2={drawing.baselineHeight}
            strokeWidth={1}
            strokeDasharray={BASELINE_DASH}
            vectorEffect="non-scaling-stroke"
            className="stroke-muted-foreground/50"
          />
        )}

        {drawing.comparisonPath !== '' && (
          <path
            d={drawing.comparisonPath}
            fill="none"
            strokeWidth={2}
            strokeDasharray={COMPARISON_DASH}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className="stroke-chart-2"
          />
        )}

        <path
          d={drawing.linePath}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={toneClasses.line}
        />

        {activePoint !== undefined && (
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

      {activePoint !== undefined && (
        <>
          <span
            aria-hidden="true"
            style={{
              left: `${(activePoint.x / CHART_WIDTH) * 100}%`,
              top: `${(activePoint.y / CHART_HEIGHT) * 100}%`
            }}
            className={cn(
              'pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-background',
              toneClasses.marker
            )}
          />

          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute top-0 space-y-0.5 rounded-md border bg-surface-elevated px-3 py-2 text-xs text-surface-elevated-foreground shadow-elevated',
              activePoint.x > CHART_WIDTH / 2 ? 'left-0' : 'right-0'
            )}
          >
            {tooltip}
          </div>
        </>
      )}
    </div>
  );

  if (formatTick === undefined) return plot;

  return (
    <div className={cn('flex gap-2', className)}>
      <div
        aria-hidden="true"
        className="relative w-14 shrink-0 text-right text-[0.6875rem] text-muted-foreground tabular-nums"
      >
        <span
          className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
          style={{ top: tickTopOf(CHART_PADDING) }}
        >
          {formatTick(drawing.highest)}
        </span>

        {hasBaselineTick && drawing.baselineHeight !== undefined && (
          <span
            className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
            style={{ top: tickTopOf(drawing.baselineHeight) }}
          >
            {formatTick(Number(baseline))}
          </span>
        )}

        <span
          className="absolute right-0 -translate-y-1/2 whitespace-nowrap"
          style={{ top: tickTopOf(CHART_HEIGHT - CHART_PADDING) }}
        >
          {formatTick(drawing.lowest)}
        </span>
      </div>

      {plot}
    </div>
  );
};
