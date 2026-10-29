'use client';

import { useId, useState, type FC, type ReactNode } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  RecurringExpense,
  RecurringExpenseStatus
} from '@/app/api/v1/finances';
import {
  RECURRING_EXPENSE_DETAIL_PARAM,
  RECURRING_EXPENSE_STATUSES
} from '@/common/constants';
import { updateUrlQuery } from '@/common/utils';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoResultsState,
  StaleState
} from '@/components/data-state';
import { Money } from '@/components/financial';
import { PageHeader } from '@/components/page-header';
import { PageNavigation } from '@/components/page-navigation';
import { SectionHeader } from '@/components/section-header';
import {
  Button,
  Card,
  CardContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton
} from '@/components/ui';
import {
  useCreateRecurringExpense,
  useRecurringExpenses,
  useReferenceDay
} from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { FIRST_PAGE, pageNumberFrom } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import {
  CalendarDayText,
  dueDistanceOf,
  SeriesStatusBadge
} from './finance-display';
import { RecurringExpenseDialogs } from './recurring-expense-dialogs';
import { CreateSeriesDialog } from './recurring-expense-forms';

const PAGE_SIZE = 20;
const ALL_OPTION = 'all';

const LISTING_PARAMS = { Page: 'page', Status: 'status' } as const;

const SKELETON_ROWS = Array.from({ length: 5 }, (_, row) => row);

const NextBillText: FC<
  Record<'series', RecurringExpense> & Record<'today', string>
> = ({ series: { status, nextDueDate, endDate }, today }) => {
  const t = useTranslations('recurring.row');
  const tFinances = useTranslations('finances');

  if (status === 'CANCELLED') return t('noMoreBills');

  if (status === 'ENDED' && endDate !== null)
    return t.rich('ended', { day: () => <CalendarDayText day={endDate} /> });

  if (nextDueDate === null) return t('noBillAhead');

  const distance = dueDistanceOf(nextDueDate, today, tFinances);
  const day = () => <CalendarDayText day={nextDueDate} />;

  return distance === null
    ? t.rich('next', { day })
    : t.rich('nextWithDistance', { day, distance });
};

const mutedText = (chunks: ReactNode) => (
  <span className="font-normal text-muted-foreground">{chunks}</span>
);

const SeriesRow: FC<
  Record<'series', RecurringExpense> &
    Record<'href', string> &
    Record<'today', string>
> = ({ series, href, today }) => {
  const t = useTranslations('recurring.row');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
  const {
    description,
    category,
    frequency,
    status,
    amount,
    isVariable,
    monthlyEquivalent,
    currency
  } = series;

  return (
    <li className="relative grid gap-x-6 gap-y-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <Link
          href={href}
          scroll={false}
          className="line-clamp-2 rounded-sm font-semibold ring-offset-background wrap-anywhere after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {description}
        </Link>

        <span className="text-xs text-muted-foreground">
          {t('meta', {
            category: tFinances(`categories.${category}`),
            frequency: tFinances(`frequencies.${frequency}`)
          })}
        </span>

        <span className="text-xs text-muted-foreground">
          <NextBillText series={series} today={today} />
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
        <div className="flex flex-col whitespace-nowrap sm:items-end">
          <span className="font-medium tabular-nums">
            {t.rich(isVariable ? 'estimatedAmount' : 'amount', {
              period: tFinances(`perPeriod.${frequency}`),
              money: () => <Money value={amount} currency={currency} />,
              muted: mutedText
            })}
          </span>

          {frequency !== 'MONTHLY' && (
            <span className="text-xs text-muted-foreground">
              {t('monthlyEquivalent', {
                amount: formatMoney(monthlyEquivalent, currency)
              })}
            </span>
          )}
        </div>

        <SeriesStatusBadge status={status} />
      </div>
    </li>
  );
};

export const RecurringView: FC = () => {
  const t = useTranslations('recurring');
  const tFinances = useTranslations('finances');
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const headingId = useId();
  const statusId = useId();
  const [isAdding, setIsAdding] = useState(false);

  const page = pageNumberFrom(searchParams.get(LISTING_PARAMS.Page));
  const status = RECURRING_EXPENSE_STATUSES.find(
    (candidate) => candidate === searchParams.get(LISTING_PARAMS.Status)
  );
  const openSeriesId = searchParams.get(RECURRING_EXPENSE_DETAIL_PARAM);

  const { mutateAsync: createSeries } = useCreateRecurringExpense();
  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useRecurringExpenses({ page, pageSize: PAGE_SIZE, status });

  const isLoading = data === undefined && !isError;

  const updateListing = (
    refinement: Partial<Record<'page', number>> &
      Partial<Record<'status', RecurringExpenseStatus | undefined>>
  ) => {
    const params = new URLSearchParams(searchParams);
    const nextPage = refinement.page ?? FIRST_PAGE;
    const nextStatus = 'status' in refinement ? refinement.status : status;

    if (nextPage === FIRST_PAGE) params.delete(LISTING_PARAMS.Page);
    else params.set(LISTING_PARAMS.Page, String(nextPage));

    if (nextStatus === undefined) params.delete(LISTING_PARAMS.Status);
    else params.set(LISTING_PARAMS.Status, nextStatus);

    updateUrlQuery(params);
  };

  const seriesHref = (seriesId: string) => {
    const params = new URLSearchParams(searchParams);

    params.set(RECURRING_EXPENSE_DETAIL_PARAM, seriesId);

    return `?${params}`;
  };

  const closeSeries = () => {
    const params = new URLSearchParams(searchParams);

    params.delete(RECURRING_EXPENSE_DETAIL_PARAM);
    updateUrlQuery(params);
  };

  const statusFilter = (
    <div className="flex items-center gap-2 max-sm:w-full">
      <Label htmlFor={statusId} className="sr-only">
        {t('status')}
      </Label>

      <Select
        value={status ?? ALL_OPTION}
        onValueChange={(value) =>
          updateListing({
            status: RECURRING_EXPENSE_STATUSES.find(
              (candidate) => candidate === value
            )
          })
        }
      >
        <SelectTrigger
          id={statusId}
          className={cn(
            'h-9 w-auto gap-1.5 max-sm:flex-1',
            status !== undefined &&
              'border-primary/50 bg-primary/5 text-foreground'
          )}
        >
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL_OPTION}>{t('allStatuses')}</SelectItem>

          {RECURRING_EXPENSE_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {tFinances(`seriesStatuses.${option}`)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        description={t('description')}
        action={
          <Button
            size="sm"
            className="gap-1.5 max-sm:w-full"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={16} aria-hidden="true" />

            {t('add')}
          </Button>
        }
      />

      <section aria-labelledby={headingId} className="min-w-0">
        <Card>
          <SectionHeader
            id={headingId}
            title={t('list')}
            action={statusFilter}
          />

          <CardContent
            aria-busy={isLoading || isPlaceholderData}
            className="space-y-4"
          >
            {isLoading && (
              <LoadingState label={t('loading')}>
                <div aria-hidden="true" className="divide-y">
                  {SKELETON_ROWS.map((row) => (
                    <div
                      key={row}
                      className="grid gap-x-6 gap-y-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-44" />

                        <Skeleton className="h-3 w-56" />
                      </div>

                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
              </LoadingState>
            )}

            {data === undefined && isError && (
              <ErrorState message={t('loadFailed')} onRetry={refetch} />
            )}

            {isRefetchError && (
              <StaleState isRetrying={isFetching} onRetry={refetch} />
            )}

            {data?.total === 0 && status === undefined && (
              <EmptyState
                message={t('empty')}
                action={{
                  label: t('add'),
                  onSelect: () => setIsAdding(true)
                }}
              />
            )}

            {data?.total === 0 && status !== undefined && (
              <NoResultsState
                message={t('noResults', { status })}
                onClear={() => updateListing({ status: undefined })}
              />
            )}

            {data !== undefined &&
              data.total > 0 &&
              data.items.length === 0 && (
                <EmptyState
                  message={t('emptyPage', { page: data.page })}
                  action={{
                    label: t('goToPage', { page: data.totalPages }),
                    onSelect: () => updateListing({ page: data.totalPages })
                  }}
                />
              )}

            {data !== undefined && data.items.length > 0 && (
              <ul
                aria-label={t('list')}
                className={cn(
                  'divide-y transition-opacity',
                  isPlaceholderData && 'opacity-60'
                )}
              >
                {data.items.map((series) => (
                  <SeriesRow
                    key={series.id}
                    series={series}
                    href={seriesHref(series.id)}
                    today={today}
                  />
                ))}
              </ul>
            )}

            {data !== undefined && data.total > 0 && (
              <div className="flex justify-end">
                <PageNavigation
                  label={t('pages')}
                  page={data.page}
                  totalPages={data.totalPages}
                  detail={t('count', { count: data.total })}
                  onPageChange={(nextPage) => updateListing({ page: nextPage })}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <RecurringExpenseDialogs seriesId={openSeriesId} onClose={closeSeries} />

      {isAdding && (
        <CreateSeriesDialog
          onCancel={() => setIsAdding(false)}
          onSubmit={async (series) => {
            await createSeries(series);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
};
