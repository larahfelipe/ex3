import { environmentManager, QueryClient } from '@tanstack/react-query';

import type {
  ExpenseFilters,
  FinanceCalendarParams,
  FinanceReportParams,
  FinanceSummaryParams,
  InstallmentPlanFilters,
  PaymentFilters,
  RecurringExpenseFilters
} from '@/app/api/v1/finances';
import type {
  PerformanceParams,
  PositionListingParams
} from '@/app/api/v1/portfolio';
import type {
  GetPortfoliosRequestParams,
  Portfolio
} from '@/app/api/v1/portfolios';
import type { TransactionFilters } from '@/app/api/v1/transactions';
import { ApiProxyError } from '@/lib/axios';
import type { Maybe, PageParams } from '@/types';

const QUERY_RETRY_LIMIT = 2;

/**
 * The provider serves a quote for a minute before asking the market again, so a
 * request repeated inside that window returns the same numbers. Anything the
 * user writes invalidates the portfolio scope and refetches regardless.
 */
const STALE_TIME_MS = 60_000;

const CLIENT_ERROR_FLOOR = 400;
const SERVER_ERROR_FLOOR = 500;
const THROTTLED_STATUS = 429;

/** A rejected request fails the same way however many times it is repeated. */
export const isRequestRejected = (error: Error) =>
  error instanceof ApiProxyError &&
  error.status >= CLIENT_ERROR_FLOOR &&
  error.status < SERVER_ERROR_FLOOR;

/**
 * Whether a later reload may succeed where this request failed. A throttled
 * request is rejected only until the API's window resets, so it counts, though
 * it is not retried at once: that would spend the window again.
 */
export const isReloadable = (error: Error) =>
  !isRequestRejected(error) ||
  (error instanceof ApiProxyError && error.status === THROTTLED_STATUS);

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: STALE_TIME_MS,
        retry: (failureCount, error) =>
          !isRequestRejected(error) && failureCount < QUERY_RETRY_LIMIT
      }
    }
  });

let browserQueryClient: Maybe<QueryClient> = null;

/**
 * One client per server render, one for the browser's lifetime. On the server
 * a query is never collected, so a shared client would keep every visitor's
 * query keys for as long as the process runs, and hand one visitor's cache to
 * the next.
 */
export const getQueryClient = () => {
  if (environmentManager.isServer()) return createQueryClient();

  browserQueryClient ??= createQueryClient();

  return browserQueryClient;
};

type PortfolioId = Maybe<Portfolio['id']>;

const accountPortfolios = () => ['portfolios'] as const;

const visibleInstruments = () => ['instruments'] as const;

const portfolioScope = (portfolioId: PortfolioId) =>
  ['portfolio', portfolioId] as const;

/** Cash flow only: no investment query lives under it, and no finance write touches the portfolio scope. */
const financeScope = () => ['finances'] as const;

export const queryKeys = {
  currentUser: () => ['user'] as const,
  visibleInstruments,
  instrumentSearch: (query: string | null) =>
    [...visibleInstruments(), 'search', query] as const,
  portfolios: accountPortfolios,
  portfolioPages: () => [...accountPortfolios(), 'page'] as const,
  portfolioPage: (requestedPage: GetPortfoliosRequestParams) =>
    [...accountPortfolios(), 'page', requestedPage] as const,
  portfolioDetails: (portfolioId: PortfolioId) =>
    [...accountPortfolios(), 'details', portfolioId] as const,
  portfolio: portfolioScope,
  portfolioOverview: (portfolioId: PortfolioId) =>
    [...portfolioScope(portfolioId), 'overview'] as const,
  positions: (portfolioId: PortfolioId, listing: PositionListingParams) =>
    [...portfolioScope(portfolioId), 'positions', listing] as const,
  position: (portfolioId: PortfolioId, symbol: string) =>
    [...portfolioScope(portfolioId), 'position', symbol] as const,
  positionIndicators: (portfolioId: PortfolioId, symbol: string) =>
    [...portfolioScope(portfolioId), 'position', symbol, 'indicators'] as const,
  positionFundamentals: (portfolioId: PortfolioId, symbol: string) =>
    [
      ...portfolioScope(portfolioId),
      'position',
      symbol,
      'fundamentals'
    ] as const,
  allocation: (portfolioId: PortfolioId) =>
    [...portfolioScope(portfolioId), 'allocation'] as const,
  income: (portfolioId: PortfolioId) =>
    [...portfolioScope(portfolioId), 'income'] as const,
  performance: (portfolioId: PortfolioId, params: PerformanceParams) =>
    [...portfolioScope(portfolioId), 'performance', params] as const,
  transactions: (portfolioId: PortfolioId, filters: TransactionFilters) =>
    [...portfolioScope(portfolioId), 'transactions', filters] as const,
  transactionImports: (portfolioId: PortfolioId, requestedPage: PageParams) =>
    [
      ...portfolioScope(portfolioId),
      'transaction-imports',
      requestedPage
    ] as const,
  finances: financeScope,
  financeSummary: (params: FinanceSummaryParams) =>
    [...financeScope(), 'summary', params] as const,
  financeCalendar: (params: FinanceCalendarParams) =>
    [...financeScope(), 'calendar', params] as const,
  financeReport: (params: FinanceReportParams) =>
    [...financeScope(), 'report', params] as const,
  financeAlerts: (today: string) =>
    [...financeScope(), 'alerts', today] as const,
  financeSettings: () => [...financeScope(), 'settings'] as const,
  expenses: (filters: ExpenseFilters, today: string) =>
    [...financeScope(), 'expenses', filters, today] as const,
  expense: (expenseId: string, today: string) =>
    [...financeScope(), 'expense', expenseId, today] as const,
  payments: (filters: PaymentFilters) =>
    [...financeScope(), 'payments', filters] as const,
  installmentPlans: (filters: InstallmentPlanFilters) =>
    [...financeScope(), 'installment-plans', filters] as const,
  installmentPlan: (planId: string, today: string) =>
    [...financeScope(), 'installment-plan', planId, today] as const,
  recurringExpenses: (filters: RecurringExpenseFilters, today: string) =>
    [...financeScope(), 'recurring-expenses', filters, today] as const,
  recurringExpense: (seriesId: string, today: string) =>
    [...financeScope(), 'recurring-expense', seriesId, today] as const
};
