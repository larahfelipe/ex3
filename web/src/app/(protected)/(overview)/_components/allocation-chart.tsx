import { useId, useState, type FC } from 'react';

import { useTranslations } from 'use-intl';

import type {
  InstrumentType,
  PortfolioAllocation
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Money, Percentage } from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import { SlideTransition } from '@/components/slide-transition';
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
import { useAllocation } from '@/hooks/use-portfolio';
import type { SlideDirection } from '@/lib/motion';
import { cn } from '@/lib/utils';

type AllocationChartProps = Record<'portfolio', Portfolio>;

type AllocationView = 'type' | 'asset';

type AllocationViewSelection = Record<'view', AllocationView> &
  Record<'direction', SlideDirection>;

type AllocationColor = Record<'arc' | 'swatch', string>;

type AllocationGroup = Omit<PortfolioAllocation['byType'][number], 'type'> &
  Record<'key' | 'label', string> &
  Partial<Record<'description', string>> &
  Record<'color', AllocationColor>;

type RingArc = Record<'key' | 'className', string> &
  Record<'start' | 'length', number>;

const ALLOCATION_VIEWS: AllocationView[] = ['asset', 'type'];

const ALLOCATION_COLORS: AllocationColor[] = [
  { arc: 'stroke-chart-1', swatch: 'bg-chart-1' },
  { arc: 'stroke-chart-2', swatch: 'bg-chart-2' },
  { arc: 'stroke-chart-3', swatch: 'bg-chart-3' },
  { arc: 'stroke-chart-4', swatch: 'bg-chart-4' },
  { arc: 'stroke-chart-5', swatch: 'bg-chart-5' },
  { arc: 'stroke-chart-6', swatch: 'bg-chart-6' },
  { arc: 'stroke-chart-7', swatch: 'bg-chart-7' },
  { arc: 'stroke-chart-8', swatch: 'bg-chart-8' },
  { arc: 'stroke-chart-9', swatch: 'bg-chart-9' },
  { arc: 'stroke-chart-10', swatch: 'bg-chart-10' }
];

/** Past the palette, the smallest groups share one neutral tone: cycling the palette would put two arcs of one color on the ring, read as one group. */
const ALLOCATION_TAIL_COLOR: AllocationColor = {
  arc: 'stroke-muted-foreground',
  swatch: 'bg-muted-foreground'
};

const RING_CIRCUMFERENCE = 100;
const RING_RADIUS = RING_CIRCUMFERENCE / (2 * Math.PI);
const RING_THICKNESS = 5;
const RING_CENTER = RING_RADIUS + RING_THICKNESS / 2;
const RING_VIEW_BOX = `0 0 ${2 * RING_CENTER} ${2 * RING_CENTER}`;

const CHART_LAYOUT_CLASS_NAME =
  'flex flex-col items-center gap-6 @md:flex-row @md:items-start';

/** Largest share first; a group without a share, unpriced, goes last in the API's order. */
const compareShareDescending = (
  { allocation: left }: Pick<AllocationGroup, 'allocation'>,
  { allocation: right }: Pick<AllocationGroup, 'allocation'>
) => {
  if (left === undefined) return right === undefined ? 0 : 1;
  if (right === undefined) return -1;

  return Number(right) - Number(left);
};

const selectAllocationGroups = (
  { byType, byAsset }: PortfolioAllocation,
  view: AllocationView,
  typeLabelOf: (type: InstrumentType) => string
): AllocationGroup[] => {
  const groups: Array<Omit<AllocationGroup, 'color'>> =
    view === 'type'
      ? byType.map(({ type, ...share }) => ({
          key: type,
          label: typeLabelOf(type),
          ...share
        }))
      : byAsset.map(({ symbol, name, ...share }) => ({
          key: symbol,
          label: symbol,
          description: name,
          ...share
        }));

  return groups.toSorted(compareShareDescending).map((group, index) => ({
    ...group,
    color: ALLOCATION_COLORS.at(index) ?? ALLOCATION_TAIL_COLOR
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
  const t = useTranslations('investments');
  const [viewSelection, setViewSelection] = useState<AllocationViewSelection>({
    view: 'asset',
    direction: 1
  });
  const { view: selectedView } = viewSelection;
  const viewInputName = useId();
  const hasGroups =
    allocationQuery.data !== undefined &&
    allocationQuery.data.byType.length > 0;

  return (
    <QuerySection
      title={t('allocation.title')}
      query={allocationQuery}
      errorMessage={t('allocation.loadFailed')}
      action={
        hasGroups && (
          <fieldset>
            <legend className="sr-only">{t('allocation.groupBy')}</legend>

            <SegmentedControl>
              {ALLOCATION_VIEWS.map((view) => (
                <SegmentedControlItem
                  key={view}
                  name={viewInputName}
                  value={view}
                  checked={view === selectedView}
                  onChange={() =>
                    setViewSelection({
                      view,
                      direction:
                        ALLOCATION_VIEWS.indexOf(view) >
                        ALLOCATION_VIEWS.indexOf(selectedView)
                          ? 1
                          : -1
                    })
                  }
                >
                  {t(`allocation.views.${view}`)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </fieldset>
        )
      }
      loading={
        <LoadingState label={t('allocation.loading')}>
          <div className="@container">
            <div className={CHART_LAYOUT_CLASS_NAME}>
              <Skeleton
                aria-hidden="true"
                className="size-40 shrink-0 rounded-full"
              />

              <Skeleton aria-hidden="true" className="h-40 w-full" />
            </div>
          </div>
        </LoadingState>
      }
      empty={<EmptyState message={t('allocation.empty')} />}
      isEmpty={({ byType }) => byType.length === 0}
    >
      {(portfolioAllocation) => {
        const groups = selectAllocationGroups(
          portfolioAllocation,
          selectedView,
          (type) => t(`instrumentTypes.${type}`)
        );
        const caption = t(`allocation.captions.${selectedView}`);

        return (
          <SlideTransition
            panelKey={viewSelection.view}
            direction={viewSelection.direction}
          >
            <div className="@container">
              <div className={CHART_LAYOUT_CLASS_NAME}>
                <AllocationRing groups={groups} />

                <Table label={caption}>
                  <TableCaption className="sr-only">{caption}</TableCaption>

                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        {t(`allocation.views.${selectedView}`)}
                      </TableHead>

                      <TableHead className="text-right">
                        {t('metrics.share')}
                      </TableHead>

                      <TableHead className="text-right">
                        {t('metrics.value')}
                      </TableHead>
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
                          <TableRowHeader>
                            <div className="flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className={cn(
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
                          </TableRowHeader>

                          <TableCell className="text-right font-medium">
                            <Percentage value={allocation} />
                          </TableCell>

                          <TableCell className="text-right">
                            <Money
                              value={marketValue}
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
          </SlideTransition>
        );
      }}
    </QuerySection>
  );
};
