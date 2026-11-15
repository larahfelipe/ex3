import { AxiosError } from 'axios';

import { FINANCE_LIMITS } from '@/common/constants';
import type { Messages } from '@/i18n/messages';
import type { Translator } from '@/i18n/translator';

import { ApiProxyError } from './axios';
import { BotChallengeError } from './bot-challenge';
import { utcDateOfCalendarDay } from './dates';

type ErrorMessages = Messages['errors'];

type PlainErrorKey =
  | `api.${keyof ErrorMessages['api']}`
  | `categories.${keyof ErrorMessages['categories']}`
  | 'throttledLater'
  | 'unexpected';

/**
 * The API answers in English and names no reason beyond the category in
 * `code`, so its messages are the contract: each one it sends is worded here by
 * the catalog key that says the same to the user. A message missing from this
 * table falls back to its category, never to the English text. Mirrors the
 * messages in the API's `config/Constants.ts`.
 */
const API_MESSAGE_KEYS: Readonly<Record<string, PlainErrorKey>> = {
  'Invalid or corrupted request': 'categories.VALIDATION',
  'Authentication required': 'categories.AUTHENTICATION',
  'Resource access denied': 'categories.AUTHORIZATION',
  'Resource not found': 'categories.NOT_FOUND',
  'Resource already exists': 'categories.CONFLICT',
  'Request payload exceeds the maximum allowed size': 'api.payloadTooLarge',
  'Request breaks a rule of the domain': 'categories.DOMAIN',
  'Too many requests, please try again later': 'throttledLater',
  'Service dependencies are unavailable': 'categories.INFRASTRUCTURE',
  'An unexpected error occurred': 'unexpected',
  'Asset not found in portfolio': 'api.assetNotFound',
  'Asset already exists in portfolio': 'api.assetAlreadyExists',
  'No assets found for this portfolio': 'api.portfolioEmpty',
  'Instrument not found in catalog': 'api.instrumentNotFound',
  'Instrument not listed by the market data provider':
    'api.instrumentNotListed',
  'Instrument already exists in catalog': 'api.instrumentAlreadyExists',
  'Instrument already exists among your private instruments':
    'api.privateInstrumentAlreadyExists',
  'Invalid instrument: the currency must be the one its market quotes in':
    'api.instrumentCurrencyMismatch',
  'Market data is unavailable, please try again later':
    'api.marketDataUnavailable',
  'Portfolio not found for this user': 'api.portfolioNotFound',
  'You already have a portfolio with this name': 'api.portfolioNameTaken',
  'The last portfolio of an account cannot be deleted': 'api.lastPortfolio',
  'The base currency cannot change once the portfolio has transactions':
    'api.baseCurrencyLocked',
  'Transaction not found for this asset': 'api.transactionNotFound',
  'Invalid transaction: a sale would exceed the units held on its date':
    'api.saleExceedsHolding',
  'Invalid transaction: every transaction of a position must share one currency':
    'api.transactionCurrencyMismatch',
  'Invalid transaction: resulting position exceeds the supported range':
    'api.positionOutOfRange',
  'Transaction unit price must be greater than zero':
    'api.unitPriceNotPositive',
  'User already exists': 'api.userAlreadyExists',
  'Invalid password': 'api.invalidPassword',
  'Invalid email or password': 'api.invalidCredentials',
  'Email must be a valid email': 'api.invalidEmail',
  'Password must not contain the part of the email before the @':
    'api.passwordDerivedFromEmail',
  'Human verification failed, please try again': 'api.challengeFailed',
  'Human verification is unavailable, please try again later':
    'api.challengeUnavailable',
  'Expense not found': 'api.expenseNotFound',
  'Payment not found for this expense': 'api.paymentNotFound',
  'Installment plan not found': 'api.installmentPlanNotFound',
  'Recurring expense not found': 'api.recurringExpenseNotFound',
  'Amount has more decimal places than the currency has minor units':
    'api.amountPrecision',
  'The amount cannot be less than what the payments already settled':
    'api.amountBelowSettled',
  'The payment settles more than the expense still owes':
    'api.paymentExceedsOutstanding',
  'The expense is already paid in full': 'api.alreadySettled',
  'The expense is cancelled': 'api.expenseCancelled',
  'An expense with payments cannot be cancelled or deleted; void its payments first':
    'api.expenseHasPayments',
  'Installments and recurring occurrences are deleted through their plan or series; cancel this one instead':
    'api.expenseManagedByOrigin',
  'The plan or series this expense belongs to is cancelled':
    'api.expenseOriginCancelled',
  'A plan with payments cannot be deleted; cancel it to keep its history':
    'api.planHasPayments',
  'The installment plan is cancelled': 'api.planCancelled',
  'A payment must settle an amount or a discount above zero':
    'api.paymentEmpty',
  'Payment date cannot be in the future': 'api.paymentInFuture',
  'End date must not be before the start date': 'api.endBeforeStart',
  'The amount is too small to split into that many installments':
    'api.installmentSplitTooSmall',
  'A recurring expense with payments cannot be deleted; cancel it to keep its history':
    'api.seriesHasPayments',
  'The recurring expense is cancelled': 'api.seriesCancelled',
  'The end date would remove an occurrence that already has payments':
    'api.endBeforePaidOccurrence',
  'The reference day must be within one day of the current date':
    'api.referenceDayOutOfRange',
  'To must not be before from': 'api.rangeReversed',
  'Unsupported file: import an XLSX or CSV file': 'api.importFileUnsupported',
  'Unsupported file: save the spreadsheet as XLSX and import it again':
    'api.importFileLegacy',
  'The file could not be read: it is damaged or malformed':
    'api.importFileMalformed',
  'The file is too large to import': 'api.importFileTooLarge',
  'No B3 statement or EX3 template was recognized in the file':
    'api.importFormatUnrecognized',
  'The file has no rows to import': 'api.importNoRows',
  'The file has more rows than one import takes': 'api.importTooManyRows',
  'The portfolio changed since the preview: review the import again':
    'api.importChanged',
  'Import not found for this user': 'api.importNotFound',
  'The import was already undone': 'api.importAlreadyUndone',
  'Undoing the import would leave a sale exceeding the units held: change the transactions recorded after it first':
    'api.importUndoOversold',
  'Select at least one row to import': 'api.importSelectionEmpty',
  'File content must be encoded in base64': 'api.importContentInvalid',
  'File name must not contain control characters': 'api.importFileNameInvalid'
};

const LIMIT_MESSAGES = [
  {
    message: `Start date must be within the last ${FINANCE_LIMITS.OccurrenceHorizonMonths} months`,
    key: 'limits.startOutsideHorizon',
    months: FINANCE_LIMITS.OccurrenceHorizonMonths
  },
  {
    message: `A report covers at most ${FINANCE_LIMITS.ReportMaxMonths} months`,
    key: 'limits.reportTooLong',
    months: FINANCE_LIMITS.ReportMaxMonths
  }
] as const;

const DATED_MESSAGES = [
  {
    prefix: `Effective from cannot be later than the day after the ${FINANCE_LIMITS.OccurrenceHorizonMonths} months bills are created ahead`,
    key: 'dated.effectiveFromAfterHorizon'
  },
  {
    prefix:
      'The next due date cannot be before the due date of the last installment with payments',
    key: 'dated.rescheduleBeforeKept'
  }
] as const;

const DATED_SUFFIX = /^ \((\d{4}-\d{2}-\d{2})\)$/;

const THROTTLED_STATUS = 429;
const SECONDS_PER_MINUTE = 60;

const CATEGORY_CODES = new Set<string>([
  'VALIDATION',
  'AUTHENTICATION',
  'AUTHORIZATION',
  'NOT_FOUND',
  'CONFLICT',
  'DOMAIN',
  'INFRASTRUCTURE',
  'INTERNAL'
] satisfies Array<keyof ErrorMessages['categories']>);

const isCategoryCode = (
  code: string | undefined
): code is keyof ErrorMessages['categories'] =>
  code !== undefined && CATEGORY_CODES.has(code);

const CATEGORY_BY_STATUS: Readonly<
  Record<number, keyof ErrorMessages['categories']>
> = {
  400: 'VALIDATION',
  401: 'AUTHENTICATION',
  403: 'AUTHORIZATION',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'DOMAIN',
  503: 'INFRASTRUCTURE'
};

export const knownApiMessageOf = (
  message: string,
  t: Translator<'errors'>
): string | null => {
  const key = API_MESSAGE_KEYS[message];

  if (key !== undefined) return t(key);

  const limit = LIMIT_MESSAGES.find((entry) => entry.message === message);

  if (limit !== undefined) return t(limit.key, { months: limit.months });

  for (const { prefix, key: datedKey } of DATED_MESSAGES) {
    if (!message.startsWith(prefix)) continue;

    const day = DATED_SUFFIX.exec(message.slice(prefix.length))?.[1];
    const date = day === undefined ? null : utcDateOfCalendarDay(day);

    return date === null ? null : t(datedKey, { date });
  }

  return null;
};

export const apiIssueMessageOf = (message: string, t: Translator<'errors'>) =>
  knownApiMessageOf(message, t) ?? t('invalidValue');

export const apiErrorMessageOf = (
  error: unknown,
  t: Translator<'errors'>,
  unexpected = t('unexpected')
): string => {
  if (error instanceof BotChallengeError)
    return t(
      error.reason === 'failed'
        ? 'api.challengeFailed'
        : 'api.challengeUnavailable'
    );

  if (!(error instanceof ApiProxyError)) return unexpected;

  if (
    error.code === AxiosError.ECONNABORTED ||
    error.code === AxiosError.ETIMEDOUT
  )
    return t('timeout');
  if (error.code === AxiosError.ERR_NETWORK) return t('network');

  if (error.status === THROTTLED_STATUS)
    return error.retryAfterSeconds
      ? t('throttled', {
          minutes: Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE)
        })
      : t('throttledLater');

  const serverError = error._error;
  const known =
    serverError === null ? null : knownApiMessageOf(serverError.message, t);

  if (known !== null) return known;

  if (isCategoryCode(serverError?.code))
    return t(`categories.${serverError.code}`);

  const category = CATEGORY_BY_STATUS[error.status];

  return category === undefined ? unexpected : t(`categories.${category}`);
};
