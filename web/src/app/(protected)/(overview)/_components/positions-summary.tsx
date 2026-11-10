import type { FC } from 'react';

import Link from 'next/link';

import { useTranslations } from 'use-intl';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { APP_ROUTES, assetDetailRoute } from '@/common/constants';
import { EmptyState, LoadingState } from '@/components/data-state';
import {
  Money,
  Percentage,
  ProfitLoss,
  Quantity
} from '@/components/financial';
import { PageNavigation } from '@/components/page-navigation';
import { QuerySection } from '@/components/query-section';
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
import { usePageParam } from '@/hooks/use-page-param';
import { usePositions } from '@/hooks/use-portfolio';
import { FIRST_PAGE } from '@/lib/pagination';

type PositionsSummaryProps = Record<'portfolio', Portfolio> &
  Record<'onAddAsset', VoidFunction> &
  Partial<Record<'className', string>>;

const POSITIONS_PAGE_SIZE = 10;
export const POSITIONS_PAGE_PARAM = 'positionsPage';

export const PositionsSummary: FC<PositionsSummaryProps> = ({
  portfolio,
  onAddAsset,
  className
}) => {
  const [requestedPage, goToPage] = usePageParam(POSITIONS_PAGE_PARAM);
  const positionsQuery = usePositions(portfolio, {
    page: requestedPage,
    pageSize: POSITIONS_PAGE_SIZE
  });
  const t = useTranslations('investments');

  return (
    <QuerySection
      title={t('overview.positions.title')}
      className={className}
      query={positionsQuery}
      errorMessage={t('overview.positions.loadFailed')}
      loading={
        <LoadingState
          label={t('overview.positions.loading')}
          className="h-48"
        />
      }
      isEmpty={({ total }) => total === 0}
      empty={
        <EmptyState
          message={t('overview.positions.empty')}
          action={{ label: t('overview.addAsset'), onSelect: onAddAsset }}
        />
      }
      action={
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={APP_ROUTES.Protected.Assets}>
            {t('overview.positions.manage')}
          </Link>
        </Button>
      }
    >
      {({ items, page, totalPages }) =>
        items.length === 0 ? (
          <EmptyState
            message={t('positions.emptyPage', { page })}
            action={{
              label: t('positions.goToPage', { page: totalPages }),
              onSelect: () => goToPage(totalPages)
            }}
          />
        ) : (
          <div className="space-y-4">
            <Table label={t('overview.positions.table')}>
              <TableCaption className="sr-only">
                {t('overview.positions.caption', {
                  currency: portfolio.baseCurrency
                })}
              </TableCaption>

              <TableHeader>
                <TableRow>
                  <TableHead>{t('metrics.asset')}</TableHead>

                  <TableHead className="text-right max-sm:hidden">
                    {t('metrics.quantity')}
                  </TableHead>

                  <TableHead className="text-right">
                    {t('metrics.marketValue')}
                  </TableHead>

                  <TableHead className="text-right max-sm:hidden">
                    {t('metrics.allocation')}
                  </TableHead>

                  <TableHead className="text-right">
                    {t('metrics.profitLoss')}
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {items.map((position) => (
                  <TableRow key={position.symbol}>
                    <TableRowHeader>
                      <div className="flex min-w-0 flex-col items-start gap-0.5">
                        <Button
                          asChild
                          variant="link"
                          className="h-auto p-0 font-medium"
                        >
                          <Link href={assetDetailRoute(position.symbol)}>
                            {position.symbol}
                          </Link>
                        </Button>

                        <span className="line-clamp-1 text-xs text-muted-foreground">
                          {position.name}
                        </span>

                        <span className="text-xs text-muted-foreground tabular-nums sm:hidden">
                          {t.rich('positions.held', {
                            quantity: () => (
                              <Quantity value={position.quantity} />
                            )
                          })}
                        </span>
                      </div>
                    </TableRowHeader>

                    <TableCell className="text-right whitespace-nowrap tabular-nums max-sm:hidden">
                      <Quantity value={position.quantity} />
                    </TableCell>

                    <TableCell className="text-right tabular-nums">
                      <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
                        <Money
                          value={position.marketValue}
                          currency={position.baseCurrency}
                        />

                        <span className="text-xs text-muted-foreground sm:hidden">
                          {t.rich('overview.positions.shareOfPortfolio', {
                            share: () => (
                              <Percentage value={position.allocation} />
                            )
                          })}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right tabular-nums max-sm:hidden">
                      <Percentage value={position.allocation} />
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      <ProfitLoss
                        value={position.profitLoss}
                        percent={position.profitLossPercent}
                        currency={position.baseCurrency}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > FIRST_PAGE && (
              <PageNavigation
                label={t('overview.positions.pages')}
                page={page}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            )}
          </div>
        )
      }
    </QuerySection>
  );
};
