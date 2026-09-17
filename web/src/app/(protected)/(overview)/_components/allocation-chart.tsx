import { useId, useState, type FC } from 'react';

import { twMerge } from 'tailwind-merge';

import type { PortfolioAllocation } from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { INSTRUMENT_TYPE_LABELS } from '@/common/constants';
import { formatPercent } from '@/common/utils';
import { Amount, UnavailableValue } from '@/components/amounts';
import { QuerySection } from '@/components/query-section';
import {
  Skeleton,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import { useAllocation } from '@/hooks/use-portfolio';

type AllocationChartProps = Record<'portfolio', Portfolio>;

type AllocationView = 'type' | 'asset';

type AllocationColor = Record<'arc' | 'swatch', string>;

type AllocationGroup = Omit<PortfolioAllocation['byType'][number], 'type'> &
  Record<'key' | 'label', string> &
  Partial<Record<'description', string>> &
  Record<'color', AllocationColor>;

type RingArc = Record<'key' | 'className', string> &
  Record<'start' | 'length', number>;

const ALLOCATION_VIEWS: AllocationView[] = ['type', 'asset'];

const ALLOCATION_VIEW_LABELS: Record<
  AllocationView,
  Record<'name' | 'caption', string>
> = {
  type: { name: 'Class', caption: 'Allocation by class' },
  asset: { name: 'Asset', caption: 'Allocation by asset' }
};

const ALLOCATION_COLORS: AllocationColor[] = [
  { arc: 'stroke-primary', swatch: 'bg-primary' },
  { arc: 'stroke-sky-400', swatch: 'bg-sky-400' },
  { arc: 'stroke-emerald-400', swatch: 'bg-emerald-400' },
  { arc: 'stroke-violet-400', swatch: 'bg-violet-400' },
  { arc: 'stroke-amber-300', swatch: 'bg-amber-300' },
  { arc: 'stroke-rose-400', swatch: 'bg-rose-400' },
  { arc: 'stroke-teal-300', swatch: 'bg-teal-300' },
  { arc: 'stroke-indigo-400', swatch: 'bg-indigo-400' },
  { arc: 'stroke-lime-300', swatch: 'bg-lime-300' },
  { arc: 'stroke-fuchsia-400', swatch: 'bg-fuchsia-400' }
];

const RING_CIRCUMFERENCE = 100;
const RING_RADIUS = RING_CIRCUMFERENCE / (2 * Math.PI);
const RING_THICKNESS = 5;
const RING_CENTER = RING_RADIUS + RING_THICKNESS / 2;
const RING_VIEW_BOX = `0 0 ${2 * RING_CENTER} ${2 * RING_CENTER}`;

const CHART_LAYOUT_CLASS_NAME =
  'flex flex-col items-center gap-6 @md:flex-row @md:items-start';

const selectAllocationGroups = (
  { byType, byAsset }: PortfolioAllocation,
  view: AllocationView
): AllocationGroup[] => {
  const groups: Array<Omit<AllocationGroup, 'color'>> =
    view === 'type'
      ? byType.map(({ type, ...share }) => ({
          key: type,
          label: INSTRUMENT_TYPE_LABELS[type],
          ...share
        }))
      : byAsset.map(({ symbol, name, ...share }) => ({
          key: symbol,
          label: symbol,
          description: name,
          ...share
        }));

  return groups.map((group, index) => ({
    ...group,
    color: ALLOCATION_COLORS[index % ALLOCATION_COLORS.length]
  }));
};

const AllocationRing: FC<Record<'groups', AllocationGroup[]>> = ({
  groups
}) => {
  const arcs = groups.reduce<RingArc[]>(
    (ringArcs, { key, allocation, color }) => {
      if (allocation === undefined) return ringArcs;

      const previousArc = ringArcs.at(-1);

      return [
        ...ringArcs,
        {
          key,
          className: color.arc,
          start:
            previousArc === undefined
              ? 0
              : previousArc.start + previousArc.length,
          length: Number(allocation) * RING_CIRCUMFERENCE
        }
      ];
    },
    []
  );

  return (
    <svg
      aria-hidden="true"
      viewBox={RING_VIEW_BOX}
      className="size-40 shrink-0 -rotate-90"
    >
      <circle
        cx={RING_CENTER}
        cy={RING_CENTER}
        r={RING_RADIUS}
        fill="none"
        strokeWidth={RING_THICKNESS}
        className="stroke-muted"
      />

      {arcs.map(({ key, className, start, length }) => (
        <circle
          key={key}
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          fill="none"
          strokeWidth={RING_THICKNESS}
          strokeDasharray={`${length} ${RING_CIRCUMFERENCE - length}`}
          strokeDashoffset={-start}
          className={className}
        />
      ))}
    </svg>
  );
};

export const AllocationChart: FC<AllocationChartProps> = ({ portfolio }) => {
  const allocationQuery = useAllocation(portfolio);
  const [selectedView, setSelectedView] = useState<AllocationView>('type');
  const viewInputName = useId();
  const hasGroups =
    allocationQuery.data !== undefined &&
    allocationQuery.data.byType.length > 0;

  return (
    <QuerySection
      title="Allocation"
      query={allocationQuery}
      errorMessage="The allocation could not be loaded"
      action={
        hasGroups && (
          <fieldset className="flex rounded-md border p-0.5">
            <legend className="sr-only">Group allocation by</legend>

            {ALLOCATION_VIEWS.map((view) => (
              <label key={view} className="cursor-pointer">
                <input
                  type="radio"
                  name={viewInputName}
                  value={view}
                  checked={view === selectedView}
                  onChange={() => setSelectedView(view)}
                  className="peer sr-only"
                />

                <span className="block rounded-sm px-3 py-1 text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                  {ALLOCATION_VIEW_LABELS[view].name}
                </span>
              </label>
            ))}
          </fieldset>
        )
      }
      loading={
        <div className="@container">
          <div className={CHART_LAYOUT_CLASS_NAME}>
            <Skeleton className="size-40 shrink-0 rounded-full" />

            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      }
      empty={
        <p className="text-sm text-muted-foreground">
          No allocation to display
        </p>
      }
      isEmpty={({ byType }) => byType.length === 0}
    >
      {(portfolioAllocation) => {
        const groups = selectAllocationGroups(
          portfolioAllocation,
          selectedView
        );
        const { name, caption } = ALLOCATION_VIEW_LABELS[selectedView];

        return (
          <div className="@container">
            <div className={CHART_LAYOUT_CLASS_NAME}>
              <AllocationRing groups={groups} />

              <Table>
                <TableCaption className="sr-only">{caption}</TableCaption>

                <TableHeader>
                  <TableRow>
                    <TableHead>{name}</TableHead>

                    <TableHead className="text-right">Share</TableHead>

                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {groups.map(
                    ({
                      key,
                      label,
                      description,
                      marketValue,
                      allocation,
                      color
                    }) => (
                      <TableRow key={key}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className={twMerge(
                                'size-2.5 shrink-0 rounded-full',
                                allocation !== undefined && color.swatch
                              )}
                            />

                            <div className="flex min-w-0 flex-col">
                              <span className="font-medium">{label}</span>

                              {description !== undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {description}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-medium">
                          {allocation === undefined ? (
                            <UnavailableValue />
                          ) : (
                            formatPercent(allocation)
                          )}
                        </TableCell>

                        <TableCell className="text-right">
                          <Amount
                            amount={marketValue}
                            currency={portfolioAllocation.baseCurrency}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      }}
    </QuerySection>
  );
};
