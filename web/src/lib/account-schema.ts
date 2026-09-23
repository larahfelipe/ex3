import { z } from 'zod';

/**
 * Mirror of the API's new-password policy, so a form flags violations before
 * submitting; the API stays authoritative and alone refuses commonly used
 * passwords. Passwords are never trimmed.
 */
const PASSWORD_MIN_CODE_POINTS = 8;
const PASSWORD_MAX_BYTES = 72;

/** Mirror of the API's: below it the part of an email before the `@` is too generic to compare. */
const EMAIL_LOCAL_PART_MIN_LENGTH = 4;

const NAME_MAX_LENGTH = 255;

const utf8Encoder = new TextEncoder();

export const PASSWORD_MIN_LENGTH_REQUIREMENT = `At least ${PASSWORD_MIN_CODE_POINTS} characters`;

export const PASSWORD_DERIVED_FROM_EMAIL_MESSAGE =
  'Password must not contain the part of your email before the @';

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

export const EmailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .pipe(z.email('Enter a valid email address, like name@example.com'));

export const AccountNameSchema = z
  .string()
  .trim()
  .min(1, 'Name is required')
  .max(
    NAME_MAX_LENGTH,
    `Name must be at most ${NAME_MAX_LENGTH} characters long`
  );

export const NewPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .refine(
    hasPasswordMinLength,
    `Password must be at least ${PASSWORD_MIN_CODE_POINTS} characters long`
  )
  .refine(
    (value) => utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_BYTES,
    `Password must be at most ${PASSWORD_MAX_BYTES} bytes long`
  )
  .refine((value) => value.trim().length > 0, 'Password must not be blank')
  .refine(
    (value) => new Set(value).size > 1,
    'Password must not repeat a single character'
  );
