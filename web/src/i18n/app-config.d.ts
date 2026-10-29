import type { Locale } from './config';
import type { Messages } from './messages';

declare module 'use-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: Messages;
  }
}
