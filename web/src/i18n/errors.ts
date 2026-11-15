import { IntlErrorCode, type IntlError } from 'use-intl/core';

type MessageFallbackInfo = Record<'error', IntlError> &
  Record<'key', string> &
  Partial<Record<'namespace', string>>;

const isProduction = process.env.NODE_ENV === 'production';

export const reportIntlError = (error: IntlError) => {
  if (isProduction) return;

  console.error(
    error.code === IntlErrorCode.MISSING_MESSAGE
      ? `[i18n] Missing message: ${error.originalMessage ?? error.message}`
      : `[i18n] ${error.message}`
  );
};

export const messageFallbackOf = ({ key, namespace }: MessageFallbackInfo) =>
  namespace === undefined ? key : `${namespace}.${key}`;
