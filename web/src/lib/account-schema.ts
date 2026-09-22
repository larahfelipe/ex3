import { z } from 'zod';

/**
 * Mirror of the API's new-password policy, so a form flags violations before
 * submitting; the API stays authoritative. Passwords are never trimmed.
 */
const PASSWORD_MIN_CODE_POINTS = 15;
const PASSWORD_MAX_BYTES = 72;

const NAME_MIN_LENGTH = 6;
const NAME_MAX_LENGTH = 255;

const utf8Encoder = new TextEncoder();

export const NEW_PASSWORD_HINT = `At least ${PASSWORD_MIN_CODE_POINTS} characters`;

export const AccountNameSchema = z
  .string()
  .trim()
  .min(
    NAME_MIN_LENGTH,
    `Name must be at least ${NAME_MIN_LENGTH} characters long`
  )
  .max(
    NAME_MAX_LENGTH,
    `Name must be at most ${NAME_MAX_LENGTH} characters long`
  );

export const NewPasswordSchema = z
  .string()
  .refine(
    (value) => [...value].length >= PASSWORD_MIN_CODE_POINTS,
    `Password must be at least ${PASSWORD_MIN_CODE_POINTS} characters long`
  )
  .refine(
    (value) => utf8Encoder.encode(value).byteLength <= PASSWORD_MAX_BYTES,
    `Password must be at most ${PASSWORD_MAX_BYTES} bytes long`
  )
  .refine((value) => value.trim().length > 0, 'Password must not be blank');
