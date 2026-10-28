import { QueryClient } from '@tanstack/react-query';

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
import type { Maybe } from '@/types';

const QUERY_RETRY_LIMIT = 2;

/**
 * The provider serves a quote for a minute before asking the market again, so a
 * request repeated inside that window returns the same numbers. Anything the
 * user writes invalidates the portfolio scope and refetches regardless.
 */
const STALE_TIME_MS = 60_000;

const CLIENT_ERROR_FLOOR = 400;
const SERVER_ERROR_FLOOR = 500;

/** A rejected request fails the same way however many times it is repeated. */
const isRequestRejected = (error: Error) =>
  error instanceof ApiProxyError &&
  error.status >= CLIENT_ERROR_FLOOR &&
  error.status < SERVER_ERROR_FLOOR;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: STALE_TIME_MS,
      retry: (failureCount, error) =>
        !isRequestRejected(error) && failureCount < QUERY_RETRY_LIMIT
    }
  }
});

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
  performance: (portfolioId: PortfolioId, params: PerformanceParams) =>
    [...portfolioScope(portfolioId), 'performance', params] as const,
  transactions: (portfolioId: PortfolioId, filters: TransactionFilters) =>
    [...portfolioScope(portfolioId), 'transactions', filters] as const,
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
