import { IntlErrorCode, type IntlError } from 'use-intl/core';

type MessageFallbackInfo = Record<'error', IntlError> &
  Record<'key', string> &
  Partial<Record<'namespace', string>>;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * A key the catalog lacks is a defect the compiler normally catches; one that
 * slips through, such as a key built at run time, is reported while developing
 * and testing, and production shows its path instead of failing the page.
 */
export const reportIntlError = (error: IntlError) => {
  if (isProduction) return;

  console.error(
    error.code === IntlErrorCode.MISSING_MESSAGE
      ? `[i18n] Missing message: ${error.originalMessage ?? error.message}`
      : `[i18n] ${error.message}`
  );
};

/** The key's full path, so a missing message is visible and searchable rather than blank. */
export const messageFallbackOf = ({ key, namespace }: MessageFallbackInfo) =>
  namespace === undefined ? key : `${namespace}.${key}`;
