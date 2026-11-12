'use client';

import { useId, useState, type FC } from 'react';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { CreditCard, Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  InstallmentPlan,
  InstallmentPlanStatus
} from '@/app/api/v1/finances';
import {
  INSTALLMENT_PLAN_DETAIL_PARAM,
  INSTALLMENT_PLAN_STATUSES
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
  useCreateInstallmentPlan,
  useInstallmentPlans,
  useReferenceDay
} from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { isNonzeroDecimal } from '@/lib/decimal';
import { FIRST_PAGE, pageNumberFrom } from '@/lib/pagination';
import { cn } from '@/lib/utils';

import {
  CalendarDayText,
  dueDistanceOf,
  InstallmentProgress,
  PlanStatusBadge
} from './finance-display';
import { InstallmentPlanDialogs } from './installment-plan-dialogs';
import { CreatePlanDialog } from './installment-plan-forms';

const PAGE_SIZE = 20;
const ALL_OPTION = 'all';

const LISTING_PARAMS = { Page: 'page', Status: 'status' } as const;

const SKELETON_ROWS = Array.from({ length: 5 }, (_, row) => row);

const PlanProgressText: FC<
  Record<'plan', InstallmentPlan> & Record<'today', string>
> = ({ plan, today }) => {
  const t = useTranslations('installments.progress');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
  const {
    status,
    installmentCount,
    nextDueDate,
    nextInstallmentNumber,
    outstandingAmount,
    currency
  } = plan;

  if (status === 'COMPLETED') return t('allPaid', { count: installmentCount });

  if (status === 'CANCELLED')
    return isNonzeroDecimal(outstandingAmount)
      ? t('cancelledOwing', {
          amount: formatMoney(outstandingAmount, currency)
        })
      : t('cancelled');

  if (nextDueDate === null || nextInstallmentNumber === null)
    return t('installments', { count: installmentCount });

  const distance = dueDistanceOf(nextDueDate, today, tFinances);

  return (
    <>
      {t.rich('next', {
        number: nextInstallmentNumber,
        count: installmentCount,
        day: () => <CalendarDayText day={nextDueDate} />
      })}

      {distance !== null && (
        <span
          className={cn(nextDueDate < today && 'font-medium text-negative')}
        >
          {' · '}

          {distance}
        </span>
      )}
    </>
  );
};

const PlanRow: FC<
  Record<'plan', InstallmentPlan> &
    Record<'href', string> &
    Record<'today', string>
> = ({ plan, href, today }) => {
  const t = useTranslations('installments');
  const tFinances = useTranslations('finances');
  const { formatMoney } = useFormat();
  const {
    description,
    category,
    status,
    totalAmount,
    outstandingAmount,
    currency,
    paidInstallments,
    installmentCount
  } = plan;

  return (
    <li className="relative grid gap-x-6 gap-y-3 py-3 sm:col-span-3 sm:grid-cols-subgrid sm:items-center">
      <div className="flex min-w-0 flex-col items-start gap-0.5">
        <Link
          href={href}
          scroll={false}
          className="line-clamp-2 rounded-sm font-semibold ring-offset-background wrap-anywhere after:absolute after:inset-0 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {description}
        </Link>

        <span className="text-xs text-muted-foreground">
          {tFinances(`categories.${category}`)}
        </span>

        <span className="text-xs text-muted-foreground">
          <PlanProgressText plan={plan} today={today} />
        </span>
      </div>

      <InstallmentProgress paid={paidInstallments} count={installmentCount} />

      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:gap-1">
        <div className="flex flex-col whitespace-nowrap sm:items-end">
          <span className="font-medium tabular-nums">
            <Money value={outstandingAmount} currency={currency} />
          </span>

          <span className="text-xs text-muted-foreground">
            {t('outstandingOf', {
              total: formatMoney(totalAmount, currency)
            })}
          </span>
        </div>

        <PlanStatusBadge status={status} />
      </div>
    </li>
  );
};

export const InstallmentsView: FC = () => {
  const t = useTranslations('installments');
  const tFinances = useTranslations('finances');
  const searchParams = useSearchParams();
  const today = useReferenceDay();
  const headingId = useId();
  const statusId = useId();
  const [isAdding, setIsAdding] = useState(false);

  const page = pageNumberFrom(searchParams.get(LISTING_PARAMS.Page));
  const status = INSTALLMENT_PLAN_STATUSES.find(
    (candidate) => candidate === searchParams.get(LISTING_PARAMS.Status)
  );
  const openPlanId = searchParams.get(INSTALLMENT_PLAN_DETAIL_PARAM);

  const { mutateAsync: createPlan } = useCreateInstallmentPlan();
  const {
    data,
    isError,
    isRefetchError,
    isFetching,
    isPlaceholderData,
    refetch
  } = useInstallmentPlans({ page, pageSize: PAGE_SIZE, status });

  const isLoading = data === undefined && !isError;

  const updateListing = (
    refinement: Partial<Record<'page', number>> &
      Partial<Record<'status', InstallmentPlanStatus | undefined>>
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

  const planHref = (planId: string) => {
    const params = new URLSearchParams(searchParams);

    params.set(INSTALLMENT_PLAN_DETAIL_PARAM, planId);

    return `?${params}`;
  };

  const closePlan = () => {
    const params = new URLSearchParams(searchParams);

    params.delete(INSTALLMENT_PLAN_DETAIL_PARAM);
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
            status: INSTALLMENT_PLAN_STATUSES.find(
              (candidate) => candidate === value
            )
          })
        }
      >
        <SelectTrigger
          id={statusId}
          className={cn(
            'h-(--control-height) w-auto gap-1.5 max-sm:flex-1',
            status !== undefined &&
              'border-primary/50 bg-primary/5 text-foreground'
          )}
        >
          <SelectValue />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value={ALL_OPTION}>{t('allStatuses')}</SelectItem>

          {INSTALLMENT_PLAN_STATUSES.map((option) => (
            <SelectItem key={option} value={option}>
              {tFinances(`planStatuses.${option}`)}
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
            title={t('plans')}
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
                      className="grid gap-x-6 gap-y-3 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:items-center"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-44" />

                        <Skeleton className="h-3 w-56" />
                      </div>

                      <Skeleton className="h-1.5 w-full" />

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
                icon={CreditCard}
                title={t('emptyTitle')}
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
                  'divide-y transition-opacity sm:grid sm:grid-cols-[minmax(0,1fr)_10rem_auto] sm:gap-x-6',
                  isPlaceholderData && 'opacity-60'
                )}
              >
                {data.items.map((plan) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    href={planHref(plan.id)}
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

      <InstallmentPlanDialogs planId={openPlanId} onClose={closePlan} />

      {isAdding && (
        <CreatePlanDialog
          onCancel={() => setIsAdding(false)}
          onSubmit={async (plan) => {
            await createPlan(plan);
            setIsAdding(false);
          }}
        />
      )}
    </div>
  );
};
