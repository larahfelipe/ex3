export const SUPPORTED_LOCALES = ['pt-BR', 'en-US'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
