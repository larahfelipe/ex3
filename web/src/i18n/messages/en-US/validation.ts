import type { LocaleMessages, Messages } from '../catalog';

export default {
  email: {
    required: 'Enter the email',
    invalid: 'Enter a valid email, such as name@example.com'
  },
  name: {
    required: 'Enter the name',
    tooLong: 'The name must have at most {max, number} characters'
  },
  password: {
    required: 'Enter the password',
    currentRequired: 'Enter the current password',
    currentIncorrect: 'The current password is incorrect',
    tooShort: 'The password must have at least {min, number} characters',
    tooLong: 'The password must have at most {max, number} bytes',
    blank: "The password can't be only spaces",
    repeated: "The password can't repeat a single character",
    derivedFromEmail:
      "The password can't contain the part of your email before the @",
    confirmRequired: 'Confirm the password',
    confirmNewRequired: 'Confirm the new password',
    mismatch: "The passwords don't match"
  },
  portfolio: {
    nameTaken: 'You already have a portfolio with this name'
  },
  currency: {
    required: 'Select the currency',
    invalid: 'Select a valid base currency'
  },
  text: {
    required: 'Fill in this field',
    tooLong: 'Use at most {max, number} characters'
  },
  day: {
    required: 'Select a date',
    invalid: 'Select a valid calendar day'
  },
  amount: {
    required: 'Enter an amount',
    invalid:
      'Use a number with up to {integerDigits, number} whole digits and {decimals, number} decimal places',
    notPositive: 'Enter an amount greater than zero',
    ambiguous:
      'Ambiguous amount: write {asDecimal} if it has decimal places or {asWhole} if it is a whole number',
    pastedAmbiguous:
      'The pasted amount could be {asDecimal} or {asWhole}: type the digits',
    pastedInvalid:
      "The pasted amount isn't a number with up to {integerDigits, number} whole digits and {decimals, number} decimal places",
    minorUnits:
      '{places, plural, =0 {Amounts in {currency} have no decimal places} one {Amounts in {currency} have at most # decimal place} other {Amounts in {currency} have at most # decimal places}}'
  },
  installments: {
    countRequired: 'Enter the number of installments',
    countWhole: 'Enter a whole number of installments',
    countMin: 'Enter at least 1 installment',
    countMax: 'Enter at most {max, number} installments',
    tooSmallToSplit:
      'The amount is too small for each of the {count, number} installments to be at least {amount}',
    afterKept:
      'Choose {day} or a later date, when installment {number, number} is due'
  },
  recurring: {
    endBeforeStart: 'Choose a date on or after the first due date',
    startTooEarly:
      'Choose a date within the last {months, plural, one {# month} other {# months}} or later',
    effectiveFromTooLate: 'Choose {day} or an earlier date'
  },
  reminders: {
    daysRequired: 'Enter a number of days',
    daysWhole: 'Enter a whole number of days',
    daysMin: "The number of days can't be negative",
    daysMax: 'Enter at most {max, number} days'
  },
  quantity: {
    required: 'Enter the quantity',
    notPositive: 'The quantity must be greater than zero'
  }
} as const satisfies LocaleMessages<Messages['validation']>;
