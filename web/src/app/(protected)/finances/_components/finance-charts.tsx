import { useId, useState, type FC } from 'react';

import Link from 'next/link';

import { useTranslations } from 'use-intl';

import type { CalendarMonth } from '@/app/api/v1/finances';
import { Money } from '@/components/financial';
import {
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableRowHeader
} from '@/components/ui';
import { useFormat } from '@/i18n/format';
import { isNonzeroDecimal } from '@/lib/decimal';
import { cn } from '@/lib/utils';
import type { DecimalString } from '@/types';

export type ChartSeries<Key extends string> = Record<'key', Key> &
  Record<'label', string> &
  Record<'color', SeriesColor>;

export type SeriesColor = Record<'bar' | 'swatch', string>;

export type MonthColumn<Key extends string> = Record<'month', CalendarMonth> &
  Record<'values', Record<Key, DecimalString>> &
  Partial<Record<'href', string>>;

type MonthColumnChartProps<Key extends string> = {
  title: string;
  currency: string;
  series: ReadonlyArray<ChartSeries<Key>>;
  columns: ReadonlyArray<MonthColumn<Key>>;
  layout: 'grouped' | 'stacked';
  linkLabel?: string;
};

export type CategoryBar = Record<'key' | 'label', string> &
  Record<'value', DecimalString> &
  Record<'share', DecimalString | null> &
  Partial<Record<'href' | 'detail', string>>;

/**
 * The order the finance charts take their hues in. The app's own palette,
 * validated for these slots: blue and green never touch, so the one pair
 * readers with color blindness see as close is split by the orange.
 */
export const FINANCE_SERIES_COLORS: ReadonlyArray<SeriesColor> = [
  { bar: 'bg-chart-2', swatch: 'bg-chart-2' },
  { bar: 'bg-chart-1', swatch: 'bg-chart-1' },
  { bar: 'bg-chart-3', swatch: 'bg-chart-3' }
];

const PLOT_HEIGHT_CLASS = 'h-44';

const DENSE_COLUMN_COUNT = 12;

const COLUMN_GAP_CLASS = 'gap-1 @md:gap-2';
const DENSE_COLUMN_GAP_CLASS = 'gap-0.5 @md:gap-1 @xl:gap-2';

const MONTH_LABEL_CLASSES = {
  short: '@max-[1.75rem]:hidden',
  narrow: '@min-[1.75rem]:hidden'
};
const DENSE_MONTH_LABEL_CLASSES = {
  short: '@max-[0.875rem]:hidden',
  narrow: '@min-[0.875rem]:hidden'
};

/**
 * The tooltip's left edge sits at the column's centre, as a share of the plot,
 * and moves back by the same share of its own width. No wider than the plot,
 * it then stays over its column and never leaves the plot, at either end.
 */
const columnCentreOf = (index: number, count: number) =>
  `${((index + 0.5) / count) * 100}%`;

/** Amounts become numbers only to be scaled: every value read is formatted from the API's decimal. */
const scaleOf = (amounts: ReadonlyArray<number>) => {
  const highest = Math.max(0, ...amounts);

  return {
    highest,
    percentOf: (amount: number) =>
      highest === 0 ? 0 : Math.max(0, (amount / highest) * 100)
  };
};

const sumOfValues = (values: ReadonlyArray<DecimalString>) =>
  values.reduce((total, value) => total + Number(value), 0);

const SeriesLegend: FC<
  Record<
    'series',
    ReadonlyArray<Pick<ChartSeries<string>, 'key' | 'label' | 'color'>>
  >
> = ({ series }) => (
  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
    {series.map(({ key, label, color }) => (
      <li key={key} className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className={cn('size-2.5 shrink-0 rounded-[2px]', color.swatch)}
        />

        {label}
      </li>
    ))}
  </ul>
);

const ColumnTooltip = <Key extends string>({
  column,
  series,
  currency,
  centre,
  linkLabel
}: Record<'column', MonthColumn<Key>> &
  Record<'series', ReadonlyArray<ChartSeries<Key>>> &
  Record<'currency' | 'centre', string> &
  Partial<Record<'linkLabel', string>>) => {
  const { formatCalendarMonth, formatMoney } = useFormat();

  return (
    <div
      aria-hidden="true"
      style={{ left: centre, translate: `-${centre} 0` }}
      className="pointer-events-none invisible absolute bottom-full z-10 mb-2 w-max min-w-[min(10rem,100%)] max-w-full space-y-1 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground opacity-0 shadow-elevated transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
    >
      <p className="font-semibold">
        {formatCalendarMonth(column.month) ?? column.month}
      </p>

      {series.map(({ key, label, color }) => (
        <p
          key={key}
          className="flex flex-wrap items-center justify-between gap-x-4"
        >
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn('size-2 rounded-[2px]', color.swatch)}
            />

            {label}
          </span>

          <span className="font-medium tabular-nums">
            {formatMoney(column.values[key], currency)}
          </span>
        </p>
      ))}

      {column.href !== undefined && linkLabel !== undefined && (
        <p className="pt-1 text-muted-foreground">{linkLabel}</p>
      )}
    </div>
  );
};

const ColumnMarks = <Key extends string>({
  column,
  series,
  layout,
  percentOf
}: Record<'column', MonthColumn<Key>> &
  Record<'series', ReadonlyArray<ChartSeries<Key>>> &
  Record<'layout', MonthColumnChartProps<Key>['layout']> &
  Record<'percentOf', (amount: number) => number>) => {
  if (layout === 'grouped')
    return (
      <div className="flex h-full w-full items-end justify-center gap-0.5">
        {series.map(({ key, color }) => {
          const value = column.values[key];

          return (
            <span
              key={key}
              style={{ height: `${percentOf(Number(value))}%` }}
              className={cn(
                'w-full max-w-6 rounded-t-[4px]',
                isNonzeroDecimal(value) && 'min-h-0.5',
                color.bar
              )}
            />
          );
        })}
      </div>
    );

  const shown = series.filter(({ key }) =>
    isNonzeroDecimal(column.values[key])
  );
  const total = sumOfValues(shown.map(({ key }) => column.values[key]));

  return (
    <div className="flex h-full w-full items-end justify-center">
      <div
        style={{ height: `${percentOf(total)}%` }}
        className="flex w-full max-w-6 flex-col-reverse gap-0.5"
      >
        {shown.map(({ key, color }, index) => (
          <span
            key={key}
            style={{ flexGrow: Number(column.values[key]) }}
            className={cn(
              'min-h-0.5 basis-0',
              index === shown.length - 1 && 'rounded-t-[4px]',
              color.bar
            )}
          />
        ))}
      </div>
    </div>
  );
};

const ChartTable = <Key extends string>({
  title,
  currency,
  series,
  columns
}: Pick<
  MonthColumnChartProps<Key>,
  'title' | 'currency' | 'series' | 'columns'
>) => {
  const t = useTranslations('finances.charts');
  const { formatCalendarMonth } = useFormat();

  return (
    <Table label={t('table', { title })}>
      <TableCaption className="sr-only">
        {t('caption', { title, currency })}
      </TableCaption>

      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>{t('month')}</TableHead>

          {series.map(({ key, label }) => (
            <TableHead key={key} className="text-right">
              {label}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {columns.map((column) => (
          <TableRow key={column.month}>
            <TableRowHeader className="whitespace-nowrap">
              {column.href === undefined ? (
                (formatCalendarMonth(column.month) ?? column.month)
              ) : (
                <Link
                  href={column.href}
                  className="rounded-sm hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
                >
                  {formatCalendarMonth(column.month) ?? column.month}
                </Link>
              )}
            </TableRowHeader>

            {series.map(({ key }) => (
              <TableCell key={key} className="text-right tabular-nums">
                <Money value={column.values[key]} currency={currency} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
};

export const MonthColumnChart = <Key extends string>({
  title,
  currency,
  series,
  columns,
  layout,
  linkLabel
}: MonthColumnChartProps<Key>) => {
  const t = useTranslations('finances.charts');
  const {
    formatCalendarMonth,
    formatCompactMoney,
    formatMoney,
    formatNarrowCalendarMonth,
    formatShortCalendarMonth
  } = useFormat();
  const tableId = useId();
  const [isTableShown, setIsTableShown] = useState(false);

  const { highest, percentOf } = scaleOf(
    columns.flatMap(({ values }) => {
      const amounts = series.map(({ key }) => values[key]);

      return layout === 'stacked'
        ? [sumOfValues(amounts)]
        : amounts.map(Number);
    })
  );

  const isDense = columns.length > DENSE_COLUMN_COUNT;
  const gapClass = isDense ? DENSE_COLUMN_GAP_CLASS : COLUMN_GAP_CLASS;
  const labelClasses = isDense
    ? DENSE_MONTH_LABEL_CLASSES
    : MONTH_LABEL_CLASSES;

  const describe = (column: MonthColumn<Key>) =>
    t('column', {
      month: formatCalendarMonth(column.month) ?? column.month,
      values: series
        .map(({ key, label }) =>
          t('columnValue', {
            label,
            amount: formatMoney(column.values[key], currency)
          })
        )
        .join(', ')
    });

  return (
    <figure className="@container space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SeriesLegend series={series} />

        <Button
          variant="ghost"
          size="xs"
          aria-expanded={isTableShown}
          aria-controls={tableId}
          onClick={() => setIsTableShown((isShown) => !isShown)}
        >
          {isTableShown ? t('hideTable') : t('showTable')}
        </Button>
      </div>

      <div className="flex gap-2">
        <div
          aria-hidden="true"
          className={cn(
            'flex shrink-0 flex-col justify-between text-right text-[0.6875rem] text-muted-foreground tabular-nums @max-md:hidden',
            PLOT_HEIGHT_CLASS
          )}
        >
          <span className="-translate-y-1/2">
            {formatCompactMoney(highest, currency)}
          </span>

          <span className="translate-y-1/2">
            {formatCompactMoney(0, currency)}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p
            aria-hidden="true"
            className="mb-1 text-[0.6875rem] text-muted-foreground tabular-nums @md:hidden"
          >
            {formatCompactMoney(highest, currency)}
          </p>

          <div className={cn('relative', PLOT_HEIGHT_CLASS)}>
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-0 border-t border-border/60"
            />

            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 border-t border-border/60"
            />

            <ul
              className={cn(
                'relative flex h-full items-end border-b border-border',
                gapClass
              )}
            >
              {columns.map((column, index) => {
                const marks = (
                  <>
                    <ColumnMarks
                      column={column}
                      series={series}
                      layout={layout}
                      percentOf={percentOf}
                    />

                    <ColumnTooltip
                      column={column}
                      series={series}
                      currency={currency}
                      centre={columnCentreOf(index, columns.length)}
                      linkLabel={linkLabel}
                    />
                  </>
                );
                const markClass =
                  'group flex h-full min-w-0 flex-1 rounded-t-sm outline-hidden hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-focus';

                return (
                  <li key={column.month} className="flex h-full min-w-0 flex-1">
                    {column.href === undefined ? (
                      <span
                        role="img"
                        aria-label={describe(column)}
                        className={markClass}
                      >
                        {marks}
                      </span>
                    ) : (
                      <Link
                        href={column.href}
                        aria-label={
                          linkLabel === undefined
                            ? describe(column)
                            : t('columnWithLink', {
                                description: describe(column),
                                link: linkLabel
                              })
                        }
                        className={markClass}
                      >
                        {marks}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div
            aria-hidden="true"
            className={cn(
              'mt-1.5 flex text-[0.6875rem] text-muted-foreground',
              gapClass
            )}
          >
            {columns.map(({ month }, index) => (
              <span
                key={month}
                className="@container flex min-w-0 flex-1 justify-center whitespace-nowrap"
              >
                {(!isDense || index % 2 === 0) && (
                  <>
                    <span className={labelClasses.short}>
                      {formatShortCalendarMonth(month)}
                    </span>

                    <span className={labelClasses.narrow}>
                      {formatNarrowCalendarMonth(month)}
                    </span>
                  </>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div id={tableId} hidden={!isTableShown}>
        {isTableShown && (
          <ChartTable
            title={title}
            currency={currency}
            series={series}
            columns={columns}
          />
        )}
      </div>
    </figure>
  );
};

export const CategoryBars: FC<
  Record<'bars', ReadonlyArray<CategoryBar>> &
    Record<'currency', string> &
    Partial<Record<'color', SeriesColor>>
> = ({ bars, currency, color = FINANCE_SERIES_COLORS[0] }) => {
  const { formatPercent } = useFormat();
  const { percentOf } = scaleOf(bars.map(({ value }) => Number(value)));

  return (
    <ul className="space-y-3">
      {bars.map(({ key, label, value, share, href, detail }) => {
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-medium">{label}</span>

              <span className="shrink-0 tabular-nums">
                <Money value={value} currency={currency} />

                {share !== null && (
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    {formatPercent(share)}
                  </span>
                )}
              </span>
            </span>

            <span
              aria-hidden="true"
              className="block h-2 rounded-full bg-muted"
            >
              <span
                style={{ width: `${percentOf(Number(value))}%` }}
                className={cn(
                  'block h-full rounded-full',
                  isNonzeroDecimal(value) && 'min-w-1',
                  color.bar
                )}
              />
            </span>

            {detail !== undefined && (
              <span className="block text-xs text-muted-foreground">
                {detail}
              </span>
            )}
          </>
        );

        return (
          <li key={key}>
            {href === undefined ? (
              <div className="space-y-1.5">{content}</div>
            ) : (
              <Link
                href={href}
                className="block space-y-1.5 rounded-md ring-offset-background outline-hidden hover:[&>span:first-child>span:first-child]:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                {content}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
};
