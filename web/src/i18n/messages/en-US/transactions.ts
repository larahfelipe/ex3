import type { LocaleMessages, Messages } from '../catalog';

export default {
  types: {
    BUY: 'Buy',
    SELL: 'Sell',
    DIVIDEND: 'Dividend',
    JCP: 'JCP',
    INTEREST: 'Interest',
    BONUS: 'Bonus'
  },
  unitPrice: {
    BUY: 'Unit price',
    SELL: 'Unit price',
    DIVIDEND: 'Amount per unit',
    JCP: 'Amount per unit',
    INTEREST: 'Amount per unit',
    BONUS: 'Attributed cost per unit'
  },
  fields: {
    type: 'Type',
    date: 'Date',
    asset: 'Asset',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    fees: 'Fees',
    taxes: 'Taxes',
    broker: 'Broker',
    notes: 'Notes'
  },
  table: {
    label: 'Transactions table',
    caption: 'Transactions, newest first',
    details: 'Details',
    detailsOf: 'Details<hidden>: {type} of {symbol} on {date}</hidden>'
  },
  details: {
    title: '<tone>{type}</tone> {symbol}',
    executedOn: 'Executed on <executed>{date}</executed>'
  },
  deletion: {
    title: 'Delete this transaction?',
    description:
      "{type} of {quantity} {symbol} on {date}. The position is recalculated without it, and this can't be undone.",
    confirm: 'Delete transaction',
    failed: "Couldn't delete the transaction"
  },
  form: {
    newTitle: 'Add {symbol} transaction',
    editTitle: 'Edit {symbol} transaction',
    description:
      'Amounts in {currency}. Fees and taxes left out are recorded as zero.',
    loading: 'Loading {symbol}',
    typeHints: {
      BUY: 'Adds units to the position. The price, fees and taxes go into the average cost.',
      SELL: 'Removes units from the position and realizes the profit against the average cost.',
      DIVIDEND:
        'Income on the units held: enter them and the gross amount per unit. The position does not change.',
      JCP: 'Interest on equity for the units held: enter them, the gross amount per unit and the tax withheld. The position does not change.',
      INTEREST:
        'Interest on the units held: enter them and the gross amount per unit. The position does not change.',
      BONUS:
        'Bonus units received, at the cost per unit the company attributed, which can be zero.'
    },
    marketPrice: 'Market price',
    marketPriceAsOf: 'Market price as of {time}',
    useHeld: 'Use {quantity} held',
    effect: {
      BUY: 'Total cost',
      SELL: 'Net proceeds',
      DIVIDEND: 'Net income',
      JCP: 'Net income',
      INTEREST: 'Net income',
      BONUS: 'Cost added'
    },
    effectOf: {
      units: '{quantity} × {unitPrice}',
      unitsPlusCharges:
        '{quantity} × {unitPrice} + {charges} in fees and taxes',
      unitsLessCharges: '{quantity} × {unitPrice} − {charges} in fees and taxes'
    },
    decrease: 'Decrease the quantity by {step, number}',
    increase: 'Increase the quantity by {step, number}',
    optionalDetails: 'Optional details',
    addDetail: {
      fees: '<hidden>Add </hidden>Fees',
      taxes: '<hidden>Add </hidden>Taxes',
      broker: '<hidden>Add </hidden>Broker',
      notes: '<hidden>Add </hidden>Notes'
    },
    removeDetail: {
      fees: 'Remove<hidden> fees</hidden>',
      taxes: 'Remove<hidden> taxes</hidden>',
      broker: 'Remove<hidden> broker</hidden>',
      notes: 'Remove<hidden> notes</hidden>'
    },
    submit: {
      BUY: 'Add buy',
      SELL: 'Add sell',
      DIVIDEND: 'Add dividend',
      JCP: 'Add JCP',
      INTEREST: 'Add interest',
      BONUS: 'Add bonus'
    },
    failed: "Couldn't save the transaction"
  },
  notifications: {
    recorded:
      '{type, select, BUY {Buy recorded} SELL {Sell recorded} DIVIDEND {Dividend recorded} JCP {JCP recorded} INTEREST {Interest recorded} other {Bonus recorded}}',
    recordedDetail: '{quantity} {symbol} at {price} on {date}',
    updated: 'Transaction updated',
    deleted: 'Transaction deleted'
  }
} as const satisfies LocaleMessages<Messages['transactions']>;
