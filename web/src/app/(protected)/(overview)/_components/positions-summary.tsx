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
const POSITIONS_PAGE_PARAM = 'positionsPage';

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
      {({ items, page, totalPages }) => (
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
                    <div className="flex flex-col items-start">
                      <Button
                        asChild
                        variant="link"
                        className="h-auto p-0 font-medium"
                      >
                        <Link href={assetDetailRoute(position.symbol)}>
                          {position.symbol}
                        </Link>
                      </Button>

                      <span className="text-xs text-muted-foreground">
                        {position.name}
                      </span>
                    </div>
                  </TableRowHeader>

                  <TableCell className="text-right max-sm:hidden">
                    <Quantity value={position.quantity} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Money
                      value={position.marketValue}
                      currency={position.baseCurrency}
                    />
                  </TableCell>

                  <TableCell className="text-right max-sm:hidden">
                    <Percentage value={position.allocation} />
                  </TableCell>

                  <TableCell className="text-right">
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
      )}
    </QuerySection>
  );
};
