import { useState, type FC } from 'react';

import Link from 'next/link';

import type { Portfolio } from '@/app/api/v1/portfolios';
import {
  APP_ROUTES,
  ASSET_DIALOG_ACTIONS,
  assetDetailRoute
} from '@/common/constants';
import { EmptyState, LoadingState } from '@/components/data-state';
import {
  Money,
  Percentage,
  ProfitLoss,
  Quantity
} from '@/components/financial';
import { QuerySection } from '@/components/query-section';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import { usePositions } from '@/hooks/use-portfolio';

type PositionsSummaryProps = Record<'portfolio', Portfolio> &
  Partial<Record<'className', string>>;

const FIRST_PAGE = 1;
const POSITIONS_PAGE_SIZE = 10;

const ADD_ASSET_HREF = `${APP_ROUTES.Protected.Assets}?action=${ASSET_DIALOG_ACTIONS.Add}`;

export const PositionsSummary: FC<PositionsSummaryProps> = ({
  portfolio,
  className
}) => {
  const [requestedPage, setRequestedPage] = useState(FIRST_PAGE);
  const positionsQuery = usePositions(portfolio, {
    page: requestedPage,
    pageSize: POSITIONS_PAGE_SIZE
  });

  return (
    <QuerySection
      title="Positions"
      className={className}
      query={positionsQuery}
      errorMessage="The positions could not be loaded"
      loading={<LoadingState label="Loading positions" className="h-48" />}
      isEmpty={({ total }) => total === 0}
      empty={
        <EmptyState
          message="No positions yet"
          action={{ label: 'Add asset', href: ADD_ASSET_HREF }}
        />
      }
      action={
        <Button asChild variant="link" size="sm" className="h-auto p-0">
          <Link href={APP_ROUTES.Protected.Assets}>Manage assets</Link>
        </Button>
      }
    >
      {({ items, page, totalPages }) => (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>

                <TableHead className="text-right">Quantity</TableHead>

                <TableHead className="text-right">Market value</TableHead>

                <TableHead className="text-right">Allocation</TableHead>

                <TableHead className="text-right">Profit/Loss</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {items.map((position) => (
                <TableRow key={position.symbol}>
                  <TableCell>
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
                  </TableCell>

                  <TableCell className="text-right">
                    <Quantity value={position.quantity} />
                  </TableCell>

                  <TableCell className="text-right">
                    <Money
                      value={position.marketValue}
                      currency={position.baseCurrency}
                    />
                  </TableCell>

                  <TableCell className="text-right">
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
            <nav
              aria-label="Positions pages"
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= FIRST_PAGE}
                onClick={() => setRequestedPage(page - 1)}
              >
                Previous
              </Button>

              <span
                aria-live="polite"
                className="text-sm text-muted-foreground"
              >
                {`Page ${page} of ${totalPages}`}
              </span>

              <Button
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setRequestedPage(page + 1)}
              >
                Next
              </Button>
            </nav>
          )}
        </div>
      )}
    </QuerySection>
  );
};
