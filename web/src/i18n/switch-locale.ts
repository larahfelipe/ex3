import type { Locale } from './config';
import type { Messages } from './messages/catalog';

export type LocaleSwitchEffects = Record<
  'loadMessages',
  (locale: Locale) => Promise<Messages>
> &
  Record<'showCatalog', (locale: Locale, messages: Messages) => void> &
  Record<'savePreference', (locale: Locale) => void> &
  Record<'setPendingLocale', (locale: Locale | null) => void>;

type LocaleSwitchState = Record<'activeLocale', Locale> &
  Record<'requestedLocale', { current: Locale }>;

/**
 * Switches the language in the order a person picks them: `requestedLocale`
 * holds the last choice across switches, so a catalog that arrives after a
 * later one is dropped, and so is its failure. The choice is saved only once
 * its catalog shows, so a failed switch leaves the saved language as it was.
 */
export const runLocaleSwitch = async (
  next: Locale,
  { activeLocale, requestedLocale }: LocaleSwitchState,
  effects: LocaleSwitchEffects
) => {
  requestedLocale.current = next;

  if (next === activeLocale) return effects.setPendingLocale(null);

  effects.setPendingLocale(next);

  try {
    const messages = await effects.loadMessages(next);

    if (requestedLocale.current !== next) return;

    effects.showCatalog(next, messages);
    effects.savePreference(next);
  } catch (error) {
    if (requestedLocale.current === next) throw error;
  } finally {
    if (requestedLocale.current === next) effects.setPendingLocale(null);
  }
};
