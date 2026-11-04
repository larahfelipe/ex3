import type { LocaleMessages, Messages } from '../catalog';

export default {
  unexpected: 'Something went wrong. Try again later.',
  network:
    "Couldn't connect to the server. Check your connection and try again.",
  timeout: 'The server took too long to respond. Try again.',
  throttled:
    'Too many attempts. Try again in {minutes, plural, one {# minute} other {# minutes}}.',
  throttledLater: 'Too many attempts. Try again later.',
  invalidValue: 'Invalid value',
  categories: {
    VALIDATION: "Some of the data isn't valid. Review it and try again.",
    AUTHENTICATION: 'Your session is no longer valid. Sign in again.',
    AUTHORIZATION: "You don't have access to this resource.",
    NOT_FOUND: "We couldn't find what you were looking for.",
    CONFLICT:
      'This record changed or already exists. Refresh the page and try again.',
    DOMAIN: "This operation isn't allowed.",
    INFRASTRUCTURE: 'The service is unavailable right now. Try again later.',
    INTERNAL: 'Something went wrong. Try again later.'
  },
  api: {
    payloadTooLarge: 'The data sent exceeds the maximum size allowed.',
    assetNotFound: "This asset isn't in the portfolio.",
    assetAlreadyExists: 'This asset is already in the portfolio.',
    portfolioEmpty: "This portfolio doesn't have any assets yet.",
    instrumentNotFound: "This asset isn't in the catalog.",
    instrumentNotListed: "This asset isn't listed by the quote provider.",
    instrumentAlreadyExists: 'This asset is already in the catalog.',
    privateInstrumentAlreadyExists:
      'You already registered a private asset with this code.',
    instrumentCurrencyMismatch:
      "The currency must be the one the asset's market quotes it in.",
    marketDataUnavailable: 'Quotes are unavailable right now. Try again later.',
    portfolioNotFound: 'Portfolio not found.',
    portfolioNameTaken: 'You already have a portfolio with this name.',
    lastPortfolio: "The account's last portfolio can't be deleted.",
    baseCurrencyLocked:
      "The base currency can't change once the portfolio has transactions.",
    transactionNotFound: 'Transaction not found for this asset.',
    saleExceedsHolding:
      'The sale would exceed the quantity held on the transaction date.',
    transactionCurrencyMismatch:
      'Every transaction in a position must use the same currency.',
    positionOutOfRange: 'The resulting position exceeds the supported limit.',
    unitPriceNotPositive: 'The unit price must be greater than zero.',
    userAlreadyExists: 'This email is already registered.',
    invalidPassword: 'The password is incorrect.',
    invalidCredentials: 'Incorrect email or password.',
    invalidEmail: 'Enter a valid email.',
    passwordDerivedFromEmail:
      "The password can't contain the part of the email before the @.",
    challengeFailed: "We couldn't confirm you're a person. Try again.",
    challengeUnavailable:
      'Verification is unavailable right now. Try again later.',
    expenseNotFound: 'Bill not found.',
    paymentNotFound: 'Payment not found for this bill.',
    installmentPlanNotFound: 'Installment plan not found.',
    recurringExpenseNotFound: 'Recurring expense not found.',
    amountPrecision:
      'The amount has more decimal places than the currency allows.',
    amountBelowSettled: "The amount can't be less than what was already paid.",
    paymentExceedsOutstanding:
      'The payment settles more than the bill still owes.',
    alreadySettled: 'This bill is already paid in full.',
    expenseCancelled: 'This bill is cancelled.',
    expenseHasPayments:
      "A bill with payments can't be cancelled or deleted. Void its payments first.",
    expenseManagedByOrigin:
      'Installments and recurring expense occurrences are deleted through their installment plan or recurring expense. Cancel this bill instead of deleting it.',
    expenseOriginCancelled:
      "This bill's installment plan or recurring expense was cancelled.",
    planHasPayments:
      "An installment plan with payments can't be deleted. Cancel it to keep the history.",
    planCancelled: 'This installment plan is cancelled.',
    paymentEmpty:
      'The payment must settle an amount or a discount greater than zero.',
    paymentInFuture: "The payment date can't be in the future.",
    endBeforeStart: "The end date can't be before the start date.",
    installmentSplitTooSmall:
      'The amount is too small to split into that many installments.',
    seriesHasPayments:
      "A recurring expense with payments can't be deleted. Stop it to keep the history.",
    seriesCancelled: 'This recurring expense was stopped.',
    endBeforePaidOccurrence:
      'The end date would remove an occurrence that already has payments.',
    referenceDayOutOfRange:
      "This device's date differs too much from the server's. Check the device's date and time.",
    rangeReversed: "The end date can't be before the start date."
  },
  limits: {
    startOutsideHorizon:
      'The start date must be within the last {months, number} months.',
    reportTooLong: 'A report covers at most {months, number} months.'
  },
  dated: {
    effectiveFromAfterHorizon:
      'The change must take effect on {date, date, ::ddMMyyyy} at the latest.',
    rescheduleBeforeKept:
      "The next due date can't be before {date, date, ::ddMMyyyy}, the due date of the last installment with payments."
  }
} as const satisfies LocaleMessages<Messages['errors']>;
