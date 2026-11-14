import { RecordableTransactionTypes as Types } from '@/config/Constants';

import { RowCheck } from './ImportMapping';
import type {
  FieldCells,
  ImportableType,
  ImportFormat,
  ImportIgnoreReason,
  MappedRow,
  MappingContext
} from './ImportRecord';
import { normalizeLabel, textOf, type ImportCell } from './ImportValues';

const B3_CURRENCY = 'BRL';
const B3_KEY_NAMESPACE = 'b3';

const isTotalsRow = (cell: ImportCell | null) =>
  normalizeLabel(textOf(cell) ?? '').startsWith('total');

const hasNoValue = (cells: Record<string, ImportCell | null>) =>
  Object.values(cells).every((cell) => textOf(cell) === null);

const labelOf = (cell: ImportCell | null) => normalizeLabel(textOf(cell) ?? '');

const rejectedOf = (check: RowCheck): MappedRow => ({
  outcome: 'rejected',
  problems: check.problems
});

const ignored = (reason: ImportIgnoreReason): MappedRow => ({
  outcome: 'ignored',
  reason
});

const CASH_MARKETS = new Set(['mercado a vista', 'mercado fracionario']);

const TRADE_SIDES: Readonly<Record<string, ImportableType>> = {
  compra: Types.BUY,
  venda: Types.SELL
};

const INCOME_EVENTS: Readonly<Record<string, ImportableType>> = {
  dividendo: Types.DIVIDEND,
  rendimento: Types.DIVIDEND,
  'juros sobre capital proprio': Types.JCP,
  juros: Types.INTEREST
};

const TRANSFERRED_SUFFIX = ' - transferido';

const IGNORED_MOVEMENTS: Readonly<Record<string, ImportIgnoreReason>> = {
  compra: 'settlement',
  venda: 'settlement',
  'compra / venda': 'settlement',
  transferencia: 'custody-transfer'
};

const SETTLEMENT_MOVEMENT = 'transferencia - liquidacao';
const SETTLEMENT_SIDES: Readonly<Record<string, ImportableType>> = {
  credito: Types.BUY,
  entrada: Types.BUY,
  debito: Types.SELL,
  saida: Types.SELL
};
const LENDING_PREFIX = 'emprestimo';
const BONUS_MOVEMENT = 'bonificacao em ativos';
const SPLIT_MOVEMENT = 'desdobro';
const CREDIT = 'credito';
const DEBIT = 'debito';

type TradeField =
  | 'date'
  | 'side'
  | 'market'
  | 'broker'
  | 'symbol'
  | 'quantity'
  | 'unitPrice'
  | 'total';

export const B3TradingStatement: ImportFormat<TradeField> = {
  id: 'b3-trades',
  keyNamespace: B3_KEY_NAMESPACE,
  decimalSeparator: ',',
  columns: {
    date: ['data do negocio'],
    side: ['tipo de movimentacao'],
    market: ['mercado'],
    broker: ['instituicao'],
    symbol: ['codigo de negociacao'],
    quantity: ['quantidade'],
    unitPrice: ['preco'],
    total: ['valor']
  },
  required: ['date', 'side', 'market', 'symbol', 'quantity', 'unitPrice'],
  mapRow: (cells, context) => {
    if (hasNoValue(cells) || isTotalsRow(cells.date)) return null;

    const check = new RowCheck(context);
    const tradeDate = check.date(cells.date);
    const type = TRADE_SIDES[labelOf(cells.side)] ?? null;

    if (type === null) check.reject('unsupported-type', 'type');
    if (textOf(cells.market) === null) check.reject('missing-value', 'market');
    else if (!CASH_MARKETS.has(labelOf(cells.market)))
      check.reject('unsupported-market', 'market');

    const symbol = check.b3Ticker(cells.symbol);
    const quantity = check.decimal(cells.quantity, 'quantity', {
      isPositive: true
    });
    const unitPrice = check.decimal(cells.unitPrice, 'unitPrice', {
      isPositive: true
    });
    const total = check.optionalDecimal(cells.total, 'value');
    const broker = check.broker(cells.broker);

    if (
      !check.isValid ||
      tradeDate === null ||
      type === null ||
      symbol === null ||
      quantity === null ||
      unitPrice === null
    )
      return rejectedOf(check);

    check.checkTotal(quantity, unitPrice, total);

    return {
      outcome: 'entry',
      entry: {
        symbol,
        type,
        tradeDate,
        quantity,
        unitPrice,
        fees: '0',
        taxes: '0',
        currency: B3_CURRENCY,
        broker,
        notes: null
      },
      warnings: check.warnings,
      review: null
    };
  }
};

type IncomeField =
  'symbol' | 'date' | 'event' | 'broker' | 'quantity' | 'unitPrice' | 'net';

export const B3IncomeStatement: ImportFormat<IncomeField> = {
  id: 'b3-income',
  keyNamespace: B3_KEY_NAMESPACE,
  decimalSeparator: ',',
  columns: {
    symbol: ['produto'],
    date: ['pagamento', 'data de pagamento'],
    event: ['tipo de evento'],
    broker: ['instituicao'],
    quantity: ['quantidade'],
    unitPrice: ['preco unitario'],
    net: ['valor liquido']
  },
  required: ['symbol', 'date', 'event', 'quantity'],
  mapRow: (cells, context) => {
    if (hasNoValue(cells) || isTotalsRow(cells.symbol)) return null;

    const check = new RowCheck(context);
    const tradeDate = check.date(cells.date);
    const type = INCOME_EVENTS[labelOf(cells.event)] ?? null;

    if (type === null) check.reject('unsupported-event', 'type');

    const symbol = check.b3Product(cells.symbol);
    const quantity = check.decimal(cells.quantity, 'quantity', {
      isPositive: true
    });
    const unitPrice = check.optionalDecimal(cells.unitPrice, 'unitPrice');
    const net = check.optionalDecimal(cells.net, 'value');
    const broker = check.broker(cells.broker);
    const amounts =
      quantity === null ? null : check.incomeAmounts(quantity, unitPrice, net);

    if (
      !check.isValid ||
      tradeDate === null ||
      type === null ||
      symbol === null ||
      quantity === null ||
      amounts === null
    )
      return rejectedOf(check);

    return {
      outcome: 'entry',
      entry: {
        symbol,
        type,
        tradeDate,
        quantity,
        ...amounts,
        fees: '0',
        currency: B3_CURRENCY,
        broker,
        notes: null
      },
      warnings: check.warnings,
      review: null
    };
  }
};

type MovementField =
  | 'direction'
  | 'date'
  | 'event'
  | 'symbol'
  | 'broker'
  | 'quantity'
  | 'unitPrice'
  | 'total';

const settlementTradeOf = (
  cells: FieldCells<MovementField>,
  context: MappingContext
): MappedRow => {
  const check = new RowCheck(context);
  const tradeDate = check.date(cells.date);
  const type = SETTLEMENT_SIDES[labelOf(cells.direction)] ?? null;

  if (type === null) check.reject('unsupported-type', 'type');

  const symbol = check.b3Product(cells.symbol);
  const quantity = check.decimal(cells.quantity, 'quantity', {
    isPositive: true
  });
  const unitPrice = check.decimal(cells.unitPrice, 'unitPrice', {
    isPositive: true
  });
  const total = check.optionalDecimal(cells.total, 'value');
  const broker = check.broker(cells.broker);

  if (
    !check.isValid ||
    tradeDate === null ||
    type === null ||
    symbol === null ||
    quantity === null ||
    unitPrice === null
  )
    return rejectedOf(check);

  check.checkTotal(quantity, unitPrice, total);

  return {
    outcome: 'entry',
    entry: {
      symbol,
      type,
      tradeDate,
      quantity,
      unitPrice,
      fees: '0',
      taxes: '0',
      currency: B3_CURRENCY,
      broker,
      notes: null
    },
    warnings: check.warnings,
    review: null
  };
};

export const B3MovementStatement: ImportFormat<MovementField> = {
  id: 'b3-movements',
  keyNamespace: B3_KEY_NAMESPACE,
  decimalSeparator: ',',
  columns: {
    direction: ['entrada/saida', 'entrada / saida'],
    date: ['data'],
    event: ['movimentacao'],
    symbol: ['produto'],
    broker: ['instituicao'],
    quantity: ['quantidade'],
    unitPrice: ['preco unitario'],
    total: ['valor da operacao']
  },
  required: ['direction', 'date', 'event', 'symbol', 'quantity'],
  mapRow: (cells, context) => {
    if (hasNoValue(cells) || isTotalsRow(cells.direction)) return null;

    const event = labelOf(cells.event);
    const ignoredReason =
      IGNORED_MOVEMENTS[event] ??
      (event.startsWith(LENDING_PREFIX) ? 'lending' : null);

    if (ignoredReason !== null) return ignored(ignoredReason);
    if (event === SETTLEMENT_MOVEMENT) return settlementTradeOf(cells, context);

    const check = new RowCheck(context);
    const direction = labelOf(cells.direction);
    const isTransferred = event.endsWith(TRANSFERRED_SUFFIX);
    const incomeType =
      INCOME_EVENTS[
        isTransferred ? event.slice(0, -TRANSFERRED_SUFFIX.length) : event
      ] ?? null;
    const isBonus = event === BONUS_MOVEMENT;
    const isSplit = event === SPLIT_MOVEMENT;

    if (incomeType === null && !isBonus && !isSplit)
      check.reject('unsupported-event', 'type');
    else if (direction === DEBIT)
      check.reject(
        incomeType === null ? 'unsupported-event' : 'income-debit',
        'type'
      );
    else if (direction !== CREDIT) check.reject('unsupported-type', 'type');

    const tradeDate = check.date(cells.date);
    const symbol = check.b3Product(cells.symbol);
    const quantity = check.decimal(cells.quantity, 'quantity', {
      isPositive: true
    });
    const unitPrice = check.optionalDecimal(cells.unitPrice, 'unitPrice');
    const total = check.optionalDecimal(cells.total, 'value');
    const broker = check.broker(cells.broker);
    const amounts =
      incomeType === null || quantity === null
        ? null
        : check.incomeAmounts(quantity, unitPrice, total);

    if (
      !check.isValid ||
      tradeDate === null ||
      symbol === null ||
      quantity === null ||
      (incomeType !== null && amounts === null)
    )
      return rejectedOf(check);

    if (incomeType !== null && amounts !== null) {
      if (isTransferred) check.warn('transferred-income');

      return {
        outcome: 'entry',
        entry: {
          symbol,
          type: incomeType,
          tradeDate,
          quantity,
          ...amounts,
          fees: '0',
          currency: B3_CURRENCY,
          broker,
          notes: null
        },
        warnings: check.warnings,
        review: isTransferred ? 'transferred-income' : null
      };
    }

    const attributedCost =
      isBonus &&
      unitPrice !== undefined &&
      unitPrice !== null &&
      unitPrice !== '0'
        ? unitPrice
        : '0';

    if (isSplit) check.warn('split-as-bonus');
    else if (attributedCost === '0') check.warn('bonus-cost-unknown');

    return {
      outcome: 'entry',
      entry: {
        symbol,
        type: Types.BONUS,
        tradeDate,
        quantity,
        unitPrice: attributedCost,
        fees: '0',
        taxes: '0',
        currency: B3_CURRENCY,
        broker,
        notes: null
      },
      warnings: check.warnings,
      review: isSplit ? 'split' : null
    };
  }
};

const TEMPLATE_TYPES: Readonly<Record<string, ImportableType>> = {
  buy: Types.BUY,
  compra: Types.BUY,
  c: Types.BUY,
  sell: Types.SELL,
  venda: Types.SELL,
  v: Types.SELL,
  dividend: Types.DIVIDEND,
  dividendo: Types.DIVIDEND,
  dividendos: Types.DIVIDEND,
  rendimento: Types.DIVIDEND,
  rendimentos: Types.DIVIDEND,
  jcp: Types.JCP,
  'juros sobre capital proprio': Types.JCP,
  interest: Types.INTEREST,
  juros: Types.INTEREST,
  bonus: Types.BONUS,
  bonificacao: Types.BONUS
};

type TemplateField =
  | 'date'
  | 'type'
  | 'symbol'
  | 'quantity'
  | 'unitPrice'
  | 'fees'
  | 'taxes'
  | 'currency'
  | 'broker'
  | 'notes';

const TEMPLATE_PORTUGUESE_DATE_HEADERS = [
  'data',
  'data da operacao',
  'data do negocio'
];

export const Ex3Template: ImportFormat<TemplateField> = {
  id: 'ex3-template',
  keyNamespace: 'ex3-template',
  decimalSeparator: 'file',
  dayFirstDateHeaders: TEMPLATE_PORTUGUESE_DATE_HEADERS,
  columns: {
    date: [...TEMPLATE_PORTUGUESE_DATE_HEADERS, 'date'],
    type: ['tipo', 'type', 'operacao', 'operation', 'tipo de operacao'],
    symbol: ['ativo', 'ticker', 'codigo', 'symbol', 'asset'],
    quantity: ['quantidade', 'quantity', 'qtd', 'qtde'],
    unitPrice: ['preco', 'preco unitario', 'price', 'unit price'],
    fees: ['taxas', 'custos', 'corretagem', 'fees', 'costs'],
    taxes: ['impostos', 'tributos', 'ir', 'taxes'],
    currency: ['moeda', 'currency'],
    broker: ['corretora', 'instituicao', 'broker'],
    notes: ['observacoes', 'observacao', 'notas', 'notes']
  },
  required: ['date', 'type', 'symbol', 'quantity', 'unitPrice'],
  mapRow: (cells: FieldCells<TemplateField>, context) => {
    if (hasNoValue(cells)) return null;

    const check = new RowCheck(context);
    const tradeDate = check.date(cells.date);
    const type = TEMPLATE_TYPES[labelOf(cells.type)] ?? null;

    if (type === null) check.reject('unsupported-type', 'type');

    const symbol = check.symbol(cells.symbol);
    const quantity = check.decimal(cells.quantity, 'quantity', {
      isPositive: true
    });
    const isBonus = type === Types.BONUS;
    const unitPrice = isBonus
      ? (check.optionalDecimal(cells.unitPrice, 'unitPrice') ?? '0')
      : check.decimal(cells.unitPrice, 'unitPrice', { isPositive: true });
    const fees = check.optionalDecimal(cells.fees, 'fees') ?? '0';
    const taxes = check.optionalDecimal(cells.taxes, 'taxes') ?? '0';
    const currency = check.currency(cells.currency);
    const broker = check.broker(cells.broker);
    const notes = check.notes(cells.notes);

    if (
      !check.isValid ||
      tradeDate === null ||
      type === null ||
      symbol === null ||
      quantity === null ||
      unitPrice === null
    )
      return rejectedOf(check);

    return {
      outcome: 'entry',
      entry: {
        symbol,
        type,
        tradeDate,
        quantity,
        unitPrice,
        fees,
        taxes,
        currency,
        broker,
        notes
      },
      warnings: check.warnings,
      review: null
    };
  }
};

/** The template last: its aliases are the broadest, so a header a B3 format recognizes is read by that format. */
export const IMPORT_FORMATS: ReadonlyArray<ImportFormat> = [
  B3TradingStatement,
  B3IncomeStatement,
  B3MovementStatement,
  Ex3Template
] as ReadonlyArray<ImportFormat>;
