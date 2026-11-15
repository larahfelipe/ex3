import { Prisma } from '@prisma/client';

import {
  DecimalColumn,
  INSTRUMENT_SYMBOL_PATTERN,
  InstrumentLimits
} from '@/config/Constants';
import type { CalendarDay } from '@/domain/models';

import type {
  ImportField,
  ImportProblem,
  ImportProblemCode,
  ImportWarning,
  MappingContext
} from './ImportRecord';
import {
  parseDecimal,
  parseTradeDate,
  textOf,
  type ImportCell
} from './ImportValues';

/** Wide enough that no product or difference of two column values rounds. */
const ImportDecimal = Prisma.Decimal.clone({
  precision: 2 * DecimalColumn.PRECISION + 1
});

const CENT = new ImportDecimal('0.01');

const BROKER_MAX_LENGTH = 60;
const NOTES_MAX_LENGTH = 500;

const B3_TICKER = /^[A-Z][A-Z0-9]{3}\d{1,2}$/;
const ODD_LOT_SUFFIX = /^([A-Z][A-Z0-9]{3}\d{1,2})F$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;

export class RowCheck {
  readonly problems: Array<ImportProblem> = [];
  readonly warnings: Array<ImportWarning> = [];

  constructor(private readonly context: MappingContext) {}

  reject(code: ImportProblemCode, field: ImportField | null = null) {
    this.problems.push({ code, field });

    return null;
  }

  warn(warning: ImportWarning) {
    if (!this.warnings.includes(warning)) this.warnings.push(warning);
  }

  get isValid() {
    return this.problems.length === 0;
  }

  date(cell: ImportCell | null): CalendarDay | null {
    const date = parseTradeDate(cell, this.context);

    if (date.outcome === 'missing') return this.reject('missing-value', 'date');
    if (date.outcome === 'invalid') return this.reject('invalid-date', 'date');
    if (date.outcome === 'ambiguous')
      return this.reject('ambiguous-date', 'date');
    if (date.value > this.context.today)
      return this.reject('future-date', 'date');

    return date.value;
  }

  decimal(
    cell: ImportCell | null,
    field: ImportField,
    { isPositive }: Record<'isPositive', boolean>
  ): string | null {
    const value = this.optionalDecimal(cell, field);

    if (value === undefined) return this.reject('missing-value', field);
    if (value === null) return null;
    if (isPositive && new ImportDecimal(value).isZero())
      return this.reject('not-positive', field);

    return value;
  }

  optionalDecimal(
    cell: ImportCell | null,
    field: ImportField
  ): string | null | undefined {
    const value = parseDecimal(cell, this.context.decimalSeparator);

    if (value.outcome === 'missing') return undefined;
    if (value.outcome === 'invalid')
      return this.reject('invalid-number', field);

    return value.value;
  }

  b3Ticker(cell: ImportCell | null): string | null {
    const text = textOf(cell)?.toUpperCase();

    if (text === undefined) return this.reject('missing-value', 'symbol');

    const ticker = ODD_LOT_SUFFIX.exec(text)?.[1] ?? text;

    return B3_TICKER.test(ticker)
      ? ticker
      : this.reject('invalid-symbol', 'symbol');
  }

  b3Product(cell: ImportCell | null): string | null {
    const text = textOf(cell);

    if (text === null) return this.reject('missing-value', 'symbol');

    const written = text.split(' - ')[0].trim().toUpperCase();
    const code = ODD_LOT_SUFFIX.exec(written)?.[1] ?? written;

    return B3_TICKER.test(code)
      ? code
      : this.reject('unsupported-product', 'symbol');
  }

  symbol(cell: ImportCell | null): string | null {
    const text = textOf(cell)?.toUpperCase();

    if (text === undefined) return this.reject('missing-value', 'symbol');

    const symbol = ODD_LOT_SUFFIX.exec(text)?.[1] ?? text;

    return INSTRUMENT_SYMBOL_PATTERN.test(symbol) &&
      symbol.length <= InstrumentLimits.SYMBOL_MAX_LENGTH
      ? symbol
      : this.reject('invalid-symbol', 'symbol');
  }

  currency(cell: ImportCell | null): string | null {
    const text = textOf(cell)?.toUpperCase();

    if (text === undefined) return null;

    return CURRENCY_CODE.test(text)
      ? text
      : this.reject('invalid-currency', 'currency');
  }

  broker(cell: ImportCell | null) {
    return this.boundedText(cell, BROKER_MAX_LENGTH, 'broker-truncated');
  }

  notes(cell: ImportCell | null) {
    return this.boundedText(cell, NOTES_MAX_LENGTH, 'notes-truncated');
  }

  private boundedText(
    cell: ImportCell | null,
    maxLength: number,
    warning: ImportWarning
  ) {
    const text = textOf(cell)?.replace(/\s+/g, ' ');

    if (text === undefined) return null;
    if (text.length <= maxLength) return text;

    this.warn(warning);

    return text.slice(0, maxLength).trim();
  }

  checkTotal(
    quantity: string,
    unitPrice: string,
    total: string | null | undefined
  ) {
    if (total === null || total === undefined) return;

    if (new ImportDecimal(quantity).mul(unitPrice).sub(total).abs().gte(CENT))
      this.warn('value-mismatch');
  }

  incomeAmounts(
    quantity: string,
    grossUnitPrice: string | null | undefined,
    netTotal: string | null | undefined
  ): Record<'unitPrice' | 'taxes', string> | null {
    if (grossUnitPrice === null || netTotal === null) return null;

    if (netTotal === undefined && grossUnitPrice === undefined)
      return this.reject('missing-value', 'value');

    const units = new ImportDecimal(quantity);

    if (netTotal !== undefined) {
      const net = new ImportDecimal(netTotal);
      const gross =
        grossUnitPrice === undefined ? null : units.mul(grossUnitPrice);

      if (gross !== null && !gross.isZero() && gross.gte(net)) {
        const taxes = gross
          .sub(net)
          .toDecimalPlaces(DecimalColumn.SCALE, ImportDecimal.ROUND_HALF_UP);

        if (taxes.gte(CENT)) this.warn('withholding-derived');

        return { unitPrice: grossUnitPrice ?? '0', taxes: taxes.toFixed() };
      }

      const unitPrice = net
        .div(units)
        .toDecimalPlaces(DecimalColumn.SCALE, ImportDecimal.ROUND_HALF_UP);

      if (unitPrice.isZero()) return this.reject('not-positive', 'value');

      this.warn('unit-price-derived');

      return { unitPrice: unitPrice.toFixed(), taxes: '0' };
    }

    if (
      grossUnitPrice === undefined ||
      new ImportDecimal(grossUnitPrice).isZero()
    )
      return this.reject('not-positive', 'unitPrice');

    return { unitPrice: grossUnitPrice, taxes: '0' };
  }
}
