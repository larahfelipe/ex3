import { useId, useState, type FC } from 'react';

import Link from 'next/link';

import { useTranslations } from 'use-intl';

import type {
  InstrumentType,
  PortfolioAllocation
} from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { assetDetailRoute } from '@/common/constants';
import { EmptyState, LoadingState } from '@/components/data-state';
import { Money, Percentage } from '@/components/financial';
import { InfoNote } from '@/components/info-note';
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
import { useFormat } from '@/i18n/format';
import { DECIMAL_COLUMN, decimalOfUnits, unitsOf } from '@/lib/decimal';
import type { SlideDirection } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { DecimalString } from '@/types';

type AllocationChartProps = Record<'portfolio', Portfolio>;

type AllocationView = 'asset' | 'type' | 'sector' | 'currency';

type AllocationViewSelection = Record<'view', AllocationView> &
  Record<'direction', SlideDirection>;

type AllocationColor = Record<'arc' | 'swatch', string>;

type AllocationGroup = Omit<PortfolioAllocation['byType'][number], 'type'> &
  Record<'key' | 'label', string> &
  Partial<Record<'description' | 'href', string>> &
  Record<'color', AllocationColor>;

type GroupLabels = Record<'typeOf', (type: InstrumentType) => string> &
  Record<'currencyNameOf', (currency: string) => string> &
  Record<'noSector' | 'noCurrency', string>;

type Concentration = Record<'label', string> &
  Record<'share', DecimalString> &
  Partial<Record<'topShare', DecimalString>>;

type RingArc = Record<'key' | 'className', string> &
  Record<'start' | 'length', number>;

const ALLOCATION_VIEWS: AllocationView[] = [
  'asset',
  'type',
  'sector',
  'currency'
];

/** A group key no sector or currency code can take. */
const UNKNOWN_GROUP_KEY = '-';

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

/** How many of the largest positions the concentration adds up. */
export const TOP_POSITIONS_COUNT = 3;

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

/**
 * A sector is reported for companies alone, so the view is offered once one
 * position has it; a single currency splits nothing, so its view is offered
 * once there are two.
 */
const availableViewsOf = ({
  bySector,
  byCurrency
}: PortfolioAllocation): AllocationView[] =>
  ALLOCATION_VIEWS.filter(
    (view) =>
      (view !== 'sector' || bySector.some(({ sector }) => sector !== null)) &&
      (view !== 'currency' || byCurrency.length > 1)
  );

const groupsOf = (
  { byType, byAsset, bySector, byCurrency }: PortfolioAllocation,
  view: AllocationView,
  labels: GroupLabels
): Array<Omit<AllocationGroup, 'color'>> => {
  switch (view) {
    case 'type':
      return byType.map(({ type, ...share }) => ({
        key: type,
        label: labels.typeOf(type),
        ...share
      }));
    case 'sector':
      return bySector.map(({ sector, ...share }) => ({
        key: sector ?? UNKNOWN_GROUP_KEY,
        label: sector ?? labels.noSector,
        ...share
      }));
    case 'currency':
      return byCurrency.map(({ currency, ...share }) => ({
        key: currency ?? UNKNOWN_GROUP_KEY,
        label: currency ?? labels.noCurrency,
        ...(currency !== null &&
          currency !== undefined && {
            description: labels.currencyNameOf(currency)
          }),
        ...share
      }));
    case 'asset':
      return byAsset.map(({ symbol, name, ...share }) => ({
        key: symbol,
        label: symbol,
        description: name,
        href: assetDetailRoute(symbol),
        ...share
      }));
  }
};

const selectAllocationGroups = (
  portfolioAllocation: PortfolioAllocation,
  view: AllocationView,
  labels: GroupLabels
): AllocationGroup[] => {
  const groups = groupsOf(portfolioAllocation, view, labels);

  return groups.toSorted(compareShareDescending).map((group, index) => ({
    ...group,
    color: ALLOCATION_COLORS.at(index) ?? ALLOCATION_TAIL_COLOR
  }));
};

/**
 * The largest of the groups, sorted largest first, and, when there are more
 * than `TOP_POSITIONS_COUNT`, the share the largest few hold together, added
 * exactly from the API's shares. A single group concentrates nothing, and a
 * missing share leaves nothing to say.
 */
export const concentrationOf = (
  groups: AllocationGroup[]
): Concentration | null => {
  const shares = groups.flatMap(({ allocation }) => allocation ?? []);
  const [largest] = groups;
  const [share] = shares;

  if (
    largest === undefined ||
    share === undefined ||
    groups.length < 2 ||
    shares.length < groups.length
  )
    return null;

  if (groups.length <= TOP_POSITIONS_COUNT)
    return { label: largest.label, share };

  const topUnits = shares
    .slice(0, TOP_POSITIONS_COUNT)
    .reduce((sum, top) => sum + unitsOf(top, DECIMAL_COLUMN.SCALE), 0n);

  return {
    label: largest.label,
    share,
    topShare: decimalOfUnits(topUnits, DECIMAL_COLUMN.SCALE)
  };
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
  const { currencyNameOf, formatPercent } = useFormat();
  const [viewSelection, setViewSelection] = useState<AllocationViewSelection>({
    view: 'asset',
    direction: 1
  });
  const viewInputName = useId();
  const hasGroups =
    allocationQuery.data !== undefined &&
    allocationQuery.data.byType.length > 0;
  const availableViews =
    allocationQuery.data === undefined
      ? ALLOCATION_VIEWS
      : availableViewsOf(allocationQuery.data);
  const selectedView = availableViews.includes(viewSelection.view)
    ? viewSelection.view
    : 'asset';

  return (
    <QuerySection
      title={t('allocation.title')}
      query={allocationQuery}
      errorMessage={t('allocation.loadFailed')}
      action={
        hasGroups && (
          <fieldset>
            <legend className="sr-only">{t('allocation.groupBy')}</legend>

            <SegmentedControl className="flex-wrap">
              {availableViews.map((view) => (
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
          {
            typeOf: (type) => t(`instrumentTypes.${type}`),
            currencyNameOf,
            noSector: t('allocation.noSector'),
            noCurrency: t('allocation.noCurrency')
          }
        );
        const caption = t(`allocation.captions.${selectedView}`);
        const isUnpriced = portfolioAllocation.totalValue === undefined;
        const hasUnknownSector =
          selectedView === 'sector' &&
          portfolioAllocation.bySector.some(({ sector }) => sector === null);
        const concentration =
          selectedView === 'asset' ? concentrationOf(groups) : null;

        return (
          <SlideTransition
            panelKey={selectedView}
            direction={viewSelection.direction}
          >
            <div className="space-y-4 @container">
              <div className={CHART_LAYOUT_CLASS_NAME}>
                <AllocationRing groups={groups} />

                <Table label={caption} regionClassName="lg:max-h-96">
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
                        href,
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
                                {href === undefined ? (
                                  <span className="font-medium">{label}</span>
                                ) : (
                                  <Link
                                    href={href}
                                    className="w-fit rounded-sm font-medium underline-offset-4 ring-offset-background hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
                                  >
                                    {label}
                                  </Link>
                                )}

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

              {concentration && (
                <p className="text-sm text-muted-foreground">
                  {concentration.topShare === undefined
                    ? t('allocation.concentration.largest', {
                        symbol: concentration.label,
                        share: formatPercent(concentration.share)
                      })
                    : t('allocation.concentration.largestAndTop', {
                        symbol: concentration.label,
                        share: formatPercent(concentration.share),
                        count: TOP_POSITIONS_COUNT,
                        topShare: formatPercent(concentration.topShare)
                      })}
                </p>
              )}

              {isUnpriced && <InfoNote>{t('allocation.unpriced')}</InfoNote>}

              {hasUnknownSector && (
                <InfoNote>{t('allocation.unknownSector')}</InfoNote>
              )}
            </div>
          </SlideTransition>
        );
      }}
    </QuerySection>
  );
};
