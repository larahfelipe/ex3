import { z } from 'zod';

import type { Translator } from '@/i18n/translator';

/**
 * Mirror of the API's new-password policy, so a form flags violations before
 * submitting; the API stays authoritative and alone refuses commonly used
 * passwords. Passwords are never trimmed.
 */
export const PASSWORD_MIN_CODE_POINTS = 8;
const PASSWORD_MAX_BYTES = 72;

/** Mirror of the API's: below it the part of an email before the `@` is too generic to compare. */
const EMAIL_LOCAL_PART_MIN_LENGTH = 4;

const NAME_MAX_LENGTH = 255;

const utf8Encoder = new TextEncoder();

export const hasPasswordMinLength = (password: string) =>
  [...password].length >= PASSWORD_MIN_CODE_POINTS;

export const isDerivedFromEmail = (password: string, email: string) => {
  const address = email.trim();
  const localPart = address
    .slice(0, Math.max(address.lastIndexOf('@'), 0))
    .toLowerCase();

  return (
    localPart.length >= EMAIL_LOCAL_PART_MIN_LENGTH &&
    password.toLowerCase().includes(localPart)
  );
};

export const emailSchemaFor = (t: Translator<'validation'>) =>
  z
    .string()
    .trim()
    .min(1, t('email.required'))
    .pipe(z.email(t('email.invalid')));

export const accountNameSchemaFor = (t: Translator<'validation'>) =>
  z
    .string()
    .trim()
    .min(1, t('name.required'))
    .max(NAME_MAX_LENGTH, t('name.tooLong', { max: NAME_MAX_LENGTH }));

export const newPasswordSchemaFor = (t: Translator<'validation'>) =>
  z
    .string()
    .min(1, t('password.required'))
    .refine(
      hasPasswordMinLength,
      t('password.tooShort', { min: PASSWORD_MIN_CODE_POINTS })
    )
    .refine(
      (value) => utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_BYTES,
      t('password.tooLong', { max: PASSWORD_MAX_BYTES })
    )
    .refine((value) => value.trim().length > 0, t('password.blank'))
    .refine((value) => new Set(value).size > 1, t('password.repeated'));
