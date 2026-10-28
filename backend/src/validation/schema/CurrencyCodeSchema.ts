import { z } from 'zod';

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

export const isSupportedCurrency = (code: string) =>
  SUPPORTED_CURRENCIES.has(code);

export const currencyCodeSchema = (field: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .refine(isSupportedCurrency, `${field} must be an ISO 4217 code`);
