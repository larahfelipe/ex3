import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AppRouterContext,
  type AppRouterInstance
} from 'next/dist/shared/lib/app-router-context.shared-runtime';

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useTranslations } from 'use-intl';

import type { Locale } from '@/i18n/config';
import { useFormat } from '@/i18n/format';
import { MESSAGES } from '@/i18n/messages';
import {
  LocaleProvider,
  LocaleSwitchContext,
  type LocaleSwitch
} from '@/providers/locale-provider';
import { nbsp, renderWithIntl, textOf } from '@/test/intl';

import { LanguageSelect } from './language-select';
import { CurrencyAmountInput } from './money-input';

const localeSwitchOf = (
  locale: Locale,
  pendingLocale: Locale | null = null
): LocaleSwitch => ({
  locale,
  pendingLocale,
  switchLocale: () => Promise.resolve()
});

const withLocaleSwitch = (localeSwitch: LocaleSwitch, node: ReactNode) =>
  renderWithIntl(
    <LocaleSwitchContext value={localeSwitch}>{node}</LocaleSwitchContext>,
    localeSwitch.locale
  );

/** The sidebar's trigger, reduced to what it reads. */
const navigationTrigger = (
  <LanguageSelect
    renderTrigger={({ locale, isPending }) => (
      <button type="button" aria-label="Idioma" data-pending={isPending}>
        <span lang={locale}>{locale}</span>
      </button>
    )}
  />
);

const shownLocalesOf = (markup: string) =>
  [
    ...markup.matchAll(
      /role="combobox"[^>]*>(?:<[^>]+>)*?<span lang="([\w-]+)"/g
    )
  ].map(([, locale]) => locale);

describe('language select', () => {
  it('names the current language in its own words, marked with its lang', () => {
    const markup = withLocaleSwitch(
      localeSwitchOf('pt-BR'),
      <LanguageSelect id="language" aria-describedby="language-hint" />
    );

    assert.match(markup, /role="combobox"/);
    assert.match(markup, /id="language"/);
    assert.match(markup, /aria-describedby="language-hint"/);
    assert.match(markup, /aria-busy="false"/);
    assert.match(markup, /<span lang="pt-BR">Português \(Brasil\)<\/span>/);
  });

  it('names English in English, whatever language is around it', () => {
    const markup = withLocaleSwitch(
      localeSwitchOf('en-US'),
      <LanguageSelect />
    );

    assert.match(
      markup,
      /<span lang="en-US">English \(United States\)<\/span>/
    );
  });

  it('shows the language picked while its catalog loads, marked busy', () => {
    const markup = withLocaleSwitch(
      localeSwitchOf('pt-BR', 'en-US'),
      <>
        <LanguageSelect />

        {navigationTrigger}
      </>
    );

    assert.deepEqual(shownLocalesOf(markup), ['en-US', 'en-US']);
    assert.equal(markup.match(/aria-busy="true"/g)?.length, 2);
    assert.match(markup, /animate-spin/);
    assert.match(markup, /data-pending="true"/);
  });

  it('opens from a trigger of its own, which it makes the combobox', () => {
    const markup = withLocaleSwitch(localeSwitchOf('pt-BR'), navigationTrigger);

    assert.match(
      markup,
      /<button type="button" aria-label="Idioma" data-pending="false" role="combobox" aria-expanded="false"/
    );
  });

  it('shows the same language in every place it is offered', () => {
    for (const locale of ['pt-BR', 'en-US'] as const)
      assert.deepEqual(
        shownLocalesOf(
          withLocaleSwitch(
            localeSwitchOf(locale),
            <>
              {navigationTrigger}

              <LanguageSelect />
            </>
          )
        ),
        [locale, locale]
      );
  });
});

const Formatted = () => {
  const t = useTranslations('common.actions');
  const { formatMoney, formatCalendarDay } = useFormat();

  return (
    <p>
      {[
        t('cancel'),
        formatMoney('1234.5', 'BRL'),
        formatCalendarDay('2026-10-28')
      ].join(' · ')}
    </p>
  );
};

const ROUTER: AppRouterInstance = {
  bfcacheId: 'test',
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined
};

/** The provider the root layout renders, seeded as the server seeds it from the cookie. */
const appIn = (locale: Locale) =>
  renderToStaticMarkup(
    <AppRouterContext value={ROUTER}>
      <LocaleProvider locale={locale} messages={MESSAGES[locale]}>
        {navigationTrigger}

        <LanguageSelect />

        <Formatted />

        <CurrencyAmountInput
          value="1234.5"
          currency="BRL"
          decimals={2}
          onValueChange={() => undefined}
          onRejectedPaste={() => undefined}
        />
      </LocaleProvider>
    </AppRouterContext>
  );

describe('locale provider', () => {
  it('renders the selectors, the text and the formats in one language', () => {
    const portuguese = appIn('pt-BR');
    const english = appIn('en-US');

    assert.deepEqual(shownLocalesOf(portuguese), ['pt-BR', 'pt-BR']);
    assert.ok(
      textOf(portuguese).includes(
        `Cancelar · ${nbsp('R$ 1.234,50')} · 28/10/2026`
      )
    );
    assert.match(portuguese, /value="1\.234,50"/);

    assert.deepEqual(shownLocalesOf(english), ['en-US', 'en-US']);
    assert.ok(textOf(english).includes('Cancel · R$1,234.50 · 10/28/2026'));
    assert.match(english, /value="1,234\.50"/);
  });
});
