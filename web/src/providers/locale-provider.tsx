'use client';

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC
} from 'react';

import { useRouter } from 'next/navigation';

import { IntlProvider } from 'use-intl';

import { APP_TIME_ZONE, type Locale } from '@/i18n/config';
import { messageFallbackOf, reportIntlError } from '@/i18n/errors';
import { localeCookieOf } from '@/i18n/locale-cookie';
import type { Messages } from '@/i18n/messages/catalog';
import { loadMessages } from '@/i18n/messages/load';
import { runLocaleSwitch } from '@/i18n/switch-locale';
import type { Children } from '@/types';

type LocaleProviderProps = Children &
  Record<'locale', Locale> &
  Record<'messages', Messages>;

export type LocaleSwitch = Record<'locale', Locale> &
  Record<'pendingLocale', Locale | null> &
  Record<'switchLocale', (locale: Locale) => Promise<void>>;

type ActiveCatalog = Record<'locale', Locale> & Record<'messages', Messages>;

export const LocaleSwitchContext = createContext<LocaleSwitch | null>(null);

export const useLocaleSwitch = () => {
  const localeSwitch = use(LocaleSwitchContext);

  if (localeSwitch === null)
    throw new Error('useLocaleSwitch is used outside LocaleProvider.');

  return localeSwitch;
};

export const LocaleProvider: FC<LocaleProviderProps> = ({
  locale,
  messages,
  children
}) => {
  const router = useRouter();

  const [catalog, setCatalog] = useState<ActiveCatalog>({ locale, messages });
  const [pendingLocale, setPendingLocale] = useState<Locale | null>(null);

  useEffect(() => {
    document.documentElement.lang = catalog.locale;
  }, [catalog.locale]);

  // The last choice, which wins over a catalog that arrives after it.
  const requestedLocale = useRef(locale);

  const switchLocale = useCallback(
    (next: Locale) =>
      runLocaleSwitch(
        next,
        { activeLocale: catalog.locale, requestedLocale },
        {
          loadMessages,
          showCatalog: (shown, shownMessages) =>
            setCatalog({ locale: shown, messages: shownMessages }),
          savePreference: (saved) => {
            document.cookie = localeCookieOf(saved);
            router.refresh();
          },
          setPendingLocale
        }
      ),
    [catalog.locale, router]
  );

  const localeSwitch = useMemo(
    () => ({ locale: catalog.locale, pendingLocale, switchLocale }),
    [catalog.locale, pendingLocale, switchLocale]
  );

  return (
    <LocaleSwitchContext value={localeSwitch}>
      <IntlProvider
        locale={catalog.locale}
        timeZone={APP_TIME_ZONE}
        messages={catalog.messages}
        onError={reportIntlError}
        getMessageFallback={messageFallbackOf}
      >
        {children}
      </IntlProvider>
    </LocaleSwitchContext>
  );
};
