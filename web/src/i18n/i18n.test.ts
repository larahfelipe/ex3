import { IntlMessageFormat } from 'intl-messageformat';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  APP_TIME_ZONE,
  DEFAULT_LOCALE,
  isSupportedLocale,
  LOCALE_NAMES,
  LOCALE_SHORT_NAMES,
  LOCALES,
  resolveLocale,
  type Locale
} from './config';
import { localeCookieOf } from './locale-cookie';
import { MESSAGES } from './messages';
import { translatorOf } from './translator';

type IcuNode = { type: number; value?: string } & Partial<
  Record<'options', Record<string, Record<'value', Array<IcuNode>>>>
> &
  Partial<Record<'children', Array<IcuNode>>>;

/** The node types of `@formatjs/icu-messageformat-parser`'s AST. */
const ICU = {
  argument: 1,
  number: 2,
  date: 3,
  time: 4,
  select: 5,
  plural: 6,
  tag: 8
} as const;

type ArgumentKind = 'text' | 'number' | 'choice' | 'date' | 'tag';

/** A number for a plural wins over a choice, which wins over plain text: each one formats as the others. */
const KIND_RANK: Record<ArgumentKind, number> = {
  text: 0,
  choice: 1,
  date: 2,
  number: 3,
  tag: 4
};

const leavesOf = (node: unknown, path = ''): Array<[string, string]> =>
  typeof node === 'string'
    ? [[path, node]]
    : Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
        leavesOf(value, path === '' ? key : `${path}.${key}`)
      );

const kindOf = ({ type }: IcuNode): ArgumentKind | null => {
  if (type === ICU.argument) return 'text';
  if (type === ICU.number || type === ICU.plural) return 'number';
  if (type === ICU.select) return 'choice';
  if (type === ICU.date || type === ICU.time) return 'date';
  if (type === ICU.tag) return 'tag';

  return null;
};

const argumentsOf = (
  nodes: ReadonlyArray<IcuNode>,
  found = new Map<string, ArgumentKind>()
) => {
  for (const node of nodes) {
    const kind = kindOf(node);

    if (kind !== null && node.value !== undefined) {
      const known = found.get(node.value);

      if (known === undefined || KIND_RANK[kind] > KIND_RANK[known])
        found.set(node.value, kind);
    }

    for (const option of Object.values(node.options ?? {}))
      argumentsOf(option.value, found);

    if (node.children !== undefined) argumentsOf(node.children, found);
  }

  return found;
};

const parse = (message: string, locale: Locale = DEFAULT_LOCALE) =>
  new IntlMessageFormat(message, locale).getAst() as Array<IcuNode>;

const SAMPLE_VALUES: Record<ArgumentKind, unknown> = {
  text: 'texto',
  number: 2,
  choice: 'other',
  date: new Date(Date.UTC(2026, 9, 28)),
  tag: (chunks: Array<unknown>) => chunks.join('')
};

const CATALOG = leavesOf(MESSAGES[DEFAULT_LOCALE]);

const CATALOGS = LOCALES.map(
  (locale) => [locale, leavesOf(MESSAGES[locale])] as const
);

describe('locale', () => {
  it('renders in Brazilian Portuguese by default', () => {
    assert.equal(DEFAULT_LOCALE, 'pt-BR');
    assert.ok(LOCALES.includes(DEFAULT_LOCALE));
  });

  it('offers Brazilian Portuguese and American English, each named in its own words', () => {
    assert.deepEqual(LOCALES, ['pt-BR', 'en-US']);
    assert.deepEqual(LOCALE_NAMES, {
      'pt-BR': 'Português (Brasil)',
      'en-US': 'English (United States)'
    });
    assert.deepEqual(LOCALE_SHORT_NAMES, {
      'pt-BR': 'Português',
      'en-US': 'English'
    });
    assert.equal(
      new Set(Object.values(LOCALE_SHORT_NAMES)).size,
      LOCALES.length
    );

    // As the language names itself, in the "standard" style: "English (United States)", not "American English".
    for (const locale of LOCALES)
      assert.equal(
        new Intl.DisplayNames(locale, {
          type: 'language',
          languageDisplay: 'standard'
        })
          .of(locale)
          ?.toLowerCase(),
        LOCALE_NAMES[locale].toLowerCase(),
        locale
      );
  });

  it('formats in one fixed time zone, so server and browser agree', () => {
    assert.equal(APP_TIME_ZONE, 'UTC');
  });

  it('falls back to the default for anything that is not a supported locale', () => {
    assert.equal(resolveLocale('pt-BR'), 'pt-BR');
    assert.equal(resolveLocale('en-US'), 'en-US');

    for (const candidate of [
      'en',
      'pt',
      'pt-PT',
      'PT-br',
      'en-us',
      'es-ES',
      ' en-US',
      '',
      null,
      undefined,
      42
    ])
      assert.equal(resolveLocale(candidate), DEFAULT_LOCALE, String(candidate));

    assert.equal(isSupportedLocale('en-US'), true);
    assert.equal(isSupportedLocale('en'), false);
  });

  it('saves the choice in a cookie every page sends, for a year', () => {
    assert.equal(
      localeCookieOf('en-US'),
      'ex3:locale=en-US; path=/; max-age=31536000; samesite=lax'
    );
    assert.equal(
      resolveLocale(localeCookieOf('en-US').split(';')[0]?.split('=')[1]),
      'en-US'
    );
  });
});

describe('catalogs', () => {
  it('has a catalog for every supported locale', () => {
    for (const locale of LOCALES) assert.ok(MESSAGES[locale]);
  });

  it('gives every locale the default’s keys and, per key, its arguments', () => {
    const reference = new Map(
      CATALOG.map(([key, message]) => [key, argumentsOf(parse(message))])
    );

    for (const locale of LOCALES) {
      const messages = leavesOf(MESSAGES[locale]);

      assert.deepEqual(
        messages.map(([key]) => key).sort(),
        [...reference.keys()].sort(),
        locale
      );

      for (const [key, message] of messages)
        assert.deepEqual(
          argumentsOf(parse(message, locale)),
          reference.get(key),
          `${locale}: ${key}`
        );
    }
  });

  it('writes every message as valid ICU that formats with its arguments', () => {
    for (const [locale, messages] of CATALOGS)
      for (const [key, message] of messages) {
        const values = Object.fromEntries(
          [...argumentsOf(parse(message, locale))].map(([name, kind]) => [
            name,
            SAMPLE_VALUES[kind]
          ])
        );
        const formatted = new IntlMessageFormat(message, locale).format(values);
        const text = Array.isArray(formatted) ? formatted.join('') : formatted;

        assert.equal(typeof text, 'string', `${locale}: ${key}`);
        assert.doesNotMatch(String(text), /[{}]/, `${locale}: ${key}`);
      }
  });

  it('keeps every message trimmed and free of ICU quoting', () => {
    for (const [locale, messages] of CATALOGS)
      for (const [key, message] of messages) {
        assert.notEqual(message.trim(), '', `${locale}: ${key}`);
        assert.equal(message, message.trim(), `${locale}: ${key}`);
        // An apostrophe before syntax starts a quoted, literal span in ICU.
        assert.doesNotMatch(message, /'[{}#|<']/, `${locale}: ${key}`);
      }
  });

  it('gives every plural an `other` branch', () => {
    for (const [locale, messages] of CATALOGS)
      for (const [key, message] of messages)
        for (const match of message.matchAll(/\{\w+, plural,/g)) {
          const plural = message.slice(match.index);

          assert.match(plural, /\bother \{/, `${locale}: ${key}`);
        }
  });

  it('translates the English catalog instead of copying the Portuguese one', () => {
    const portuguese = new Map(CATALOG);
    const english = leavesOf(MESSAGES['en-US']);
    const copied = english.filter(
      ([key, message]) => portuguese.get(key) === message
    );

    // Names, symbols and markup-only messages read the same in both.
    assert.ok(
      copied.length < english.length / 20,
      copied.map(([key]) => key).join(', ')
    );
  });
});

describe('translator', () => {
  it('reads each locale’s catalog', () => {
    assert.equal(translatorOf('pt-BR', 'common.actions')('cancel'), 'Cancelar');
    assert.equal(
      translatorOf('pt-BR', 'finances')('categories.FOOD'),
      'Alimentação'
    );
    assert.equal(translatorOf('en-US', 'common.actions')('cancel'), 'Cancel');
    assert.equal(translatorOf('en-US', 'common.language')('label'), 'Language');
  });

  it('interpolates arguments as text, never as markup', () => {
    assert.equal(
      translatorOf('pt-BR', 'finances.display')('installmentOf', {
        number: 3,
        count: 12
      }),
      'Parcela 3 de 12'
    );
  });

  it('chooses a branch by context', () => {
    const t = translatorOf('pt-BR', 'finances.summary');

    assert.equal(t('same', { period: 'lastMonth' }), 'Igual ao mês passado');
    assert.equal(
      t('same', { period: 'em out. de 2025' }),
      'Mesmo valor que em out. de 2025'
    );
  });

  it('reports a missing key and shows its path instead of failing', (context) => {
    const reported = context.mock.method(console, 'error', () => undefined);
    const t = translatorOf('pt-BR', 'common.actions');

    // A key built at run time escapes the compiler's check.
    const key = ['not', 'there'].join('');

    assert.equal(t(key as never), 'common.actions.notthere');
    assert.equal(reported.mock.callCount(), 1);
    assert.match(
      String(reported.mock.calls[0]?.arguments[0]),
      /^\[i18n\] Missing message: .*common\.actions\.notthere/
    );
  });
});

describe('plurals', () => {
  const t = translatorOf('pt-BR');

  it('agrees the noun and its verb with the count', () => {
    assert.equal(t('bills.alerts.overdue', { count: 1 }), '1 conta vencida');
    assert.equal(t('bills.alerts.overdue', { count: 2 }), '2 contas vencidas');
    assert.equal(
      t('bills.alerts.dueSoon', { count: 1, days: 0 }),
      '1 conta vence hoje'
    );
    assert.equal(
      t('bills.alerts.dueSoon', { count: 3, days: 1 }),
      '3 contas vencem em até 1 dia'
    );
    assert.equal(
      t('bills.alerts.dueSoon', { count: 3, days: 7 }),
      '3 contas vencem em até 7 dias'
    );
  });

  it('says none for a count of zero, which Portuguese plural rules would make singular', () => {
    assert.equal(new Intl.PluralRules('pt-BR').select(0), 'one');

    assert.equal(t('bills.count', { total: 0 }), 'Nenhuma conta');
    assert.equal(
      t('financeOverview.metrics.bills', { count: 0 }),
      'Nenhuma conta'
    );
    assert.equal(
      t('reports.metrics.owedDetail', { count: 0 }),
      'Nenhuma conta com vencimento no período'
    );
    assert.equal(t('reports.payments.count', { count: 0 }), 'Nenhum pagamento');
    assert.equal(t('installments.count', { count: 0 }), 'Nenhum parcelamento');
    assert.equal(
      t('recurring.count', { count: 0 }),
      'Nenhuma despesa recorrente'
    );
    assert.equal(t('calendar.day.count', { count: 0 }), 'Nenhuma conta');
  });

  it('writes one, many and large counts with grouped digits', () => {
    assert.equal(t('bills.count', { total: 1 }), '1 conta');
    assert.equal(t('bills.count', { total: 2 }), '2 contas');
    assert.equal(t('bills.count', { total: 1234 }), '1.234 contas');
  });

  it('words days around a due date', () => {
    const display = translatorOf('pt-BR', 'finances.display');

    assert.equal(display('dueIn', { days: 0 }), 'Vence hoje');
    assert.equal(display('dueIn', { days: 1 }), 'Vence amanhã');
    assert.equal(display('dueIn', { days: 5 }), 'Vence em 5 dias');
    assert.equal(display('overdueBy', { days: 1 }), 'Venceu ontem');
    assert.equal(display('overdueBy', { days: 2 }), 'Venceu há 2 dias');
  });

  it('words the toasts by their counts', () => {
    const notifications = translatorOf('pt-BR', 'finances.notifications');

    assert.equal(
      notifications('planAddedDetail', { description: 'Notebook', count: 1 }),
      'Notebook em 1 parcela'
    );
    assert.equal(
      notifications('planAddedDetail', { description: 'Notebook', count: 10 }),
      'Notebook em 10 parcelas'
    );
    assert.equal(
      notifications('remindersLeadDays', { days: 1 }),
      'As contas são sinalizadas 1 dia antes do vencimento'
    );
    assert.equal(
      notifications('remindersLeadDays', { days: 3 }),
      'As contas são sinalizadas 3 dias antes do vencimento'
    );
  });
});

describe('English plurals', () => {
  const t = translatorOf('en-US');

  it('agrees the noun with the count, with grouped digits', () => {
    assert.equal(t('bills.count', { total: 0 }), 'No bills');
    assert.equal(t('bills.count', { total: 1 }), '1 bill');
    assert.equal(t('bills.count', { total: 1234 }), '1,234 bills');
    assert.equal(t('bills.alerts.overdue', { count: 1 }), '1 overdue bill');
    assert.equal(t('bills.alerts.overdue', { count: 2 }), '2 overdue bills');
  });

  it('words days around a due date', () => {
    const display = translatorOf('en-US', 'finances.display');

    assert.equal(display('dueIn', { days: 0 }), 'Due today');
    assert.equal(display('dueIn', { days: 1 }), 'Due tomorrow');
    assert.equal(display('dueIn', { days: 5 }), 'Due in 5 days');
  });
});
