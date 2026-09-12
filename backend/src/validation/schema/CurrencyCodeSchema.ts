import { z } from 'zod';

const SUPPORTED_CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

export const currencyCodeSchema = (field: string) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .refine(
      (code) => SUPPORTED_CURRENCIES.has(code),
      `${field} must be an ISO 4217 code`
    );
