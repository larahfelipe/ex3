import { useMemo, type FC, type PointerEvent, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import type { DecimalString } from '@/types';

export type SeriesTone = 'primary' | 'positive' | 'negative';

type SeriesChartProps = Record<'values', ReadonlyArray<DecimalString>> &
  Record<'activeIndex', number | null> &
  Record<'onActiveIndexChange', (index: number | null) => void> &
  Record<'tooltip', ReactNode> &
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

/** Two points closer than one unit of the drawing box land on the same pixel. */
export const MAX_PLOTTED_POINTS = CHART_WIDTH;

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
  const span = Math.max(...amounts) - lowest;
  const plotHeight = CHART_HEIGHT - 2 * CHART_PADDING;

  return (amount: number) =>
    span === 0
      ? CHART_HEIGHT / 2
      : CHART_PADDING + plotHeight * (1 - (amount - lowest) / span);
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

const areaPathOf = (points: ReadonlyArray<ChartPoint>) => {
  const first = points.at(0);
  const last = points.at(-1);

  if (first === undefined || last === undefined) return '';

  return `${linePathOf(points)} L${last.x} ${CHART_HEIGHT} L${first.x} ${CHART_HEIGHT} Z`;
};

/**
 * The caller holds the point under the pointer, so it can read that point
 * outside the drawing too. The paths are rebuilt only when `values` or
 * `baseline` change, so `values` must keep its identity across renders.
 */
export const SeriesChart: FC<SeriesChartProps> = ({
  values,
  activeIndex,
  onActiveIndexChange,
  tooltip,
  tone = 'primary',
  baseline,
  className
}) => {
  const drawing = useMemo(() => {
    const amounts = values.map(Number);
    const baselineAmount =
      baseline === undefined ? undefined : Number(baseline);
    const heightOf = verticalScaleOf(
      baselineAmount === undefined ? amounts : [...amounts, baselineAmount]
    );
    const points = chartPointsOf(amounts, heightOf);

    return {
      points,
      linePath: linePathOf(points),
      areaPath: areaPathOf(points),
      baselineHeight:
        baselineAmount === undefined ? undefined : heightOf(baselineAmount)
    };
  }, [values, baseline]);

  const { points } = drawing;
  const activePoint = activeIndex === null ? undefined : points.at(activeIndex);
  const toneClasses = TONE_CLASSES[tone];

  const trackPointer = ({
    clientX,
    currentTarget
  }: PointerEvent<HTMLDivElement>) => {
    const { left, width } = currentTarget.getBoundingClientRect();

    if (width === 0 || points.length === 0) return;

    const position = Math.round(
      ((clientX - left) / width) * (points.length - 1)
    );

    onActiveIndexChange(Math.min(points.length - 1, Math.max(0, position)));
  };

  return (
    <div
      className={cn('relative touch-pan-y', className)}
      onPointerDown={trackPointer}
      onPointerMove={trackPointer}
      onPointerLeave={() => onActiveIndexChange(null)}
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
};
