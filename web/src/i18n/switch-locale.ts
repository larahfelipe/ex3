import type { Locale } from './config';
import type { Messages } from './messages/catalog';

export type SaveToAccount = (locale: Locale) => Promise<unknown>;

export type LocaleSwitchEffects = Record<
  'loadMessages',
  (locale: Locale) => Promise<Messages>
> &
  Record<'showCatalog', (locale: Locale, messages: Messages) => void> &
  Record<'savePreference', (locale: Locale) => void> &
  Record<'setPendingLocale', (locale: Locale | null) => void> &
  Partial<Record<'saveToAccount', SaveToAccount>>;

type LocaleSwitchState = Record<'activeLocale', Locale> &
  Record<'requestedLocale', { current: Locale }>;

export const runLocaleSwitch = async (
  next: Locale,
  { activeLocale, requestedLocale }: LocaleSwitchState,
  effects: LocaleSwitchEffects
) => {
  requestedLocale.current = next;

  /**
   * Picking the language shown only happens while another one is pending,
   * whose save may already be on its way, so the account gets this one after
   * it.
   */
  if (next === activeLocale) {
    effects.setPendingLocale(null);
    await effects.saveToAccount?.(next);

    return;
  }

  effects.setPendingLocale(next);

  try {
    const messages = await effects.loadMessages(next);

    if (requestedLocale.current !== next) return;

    await effects.saveToAccount?.(next);

    if (requestedLocale.current !== next) return;

    effects.showCatalog(next, messages);
    effects.savePreference(next);
  } catch (error) {
    if (requestedLocale.current === next) throw error;
  } finally {
    if (requestedLocale.current === next) effects.setPendingLocale(null);
  }
};
