import { z } from 'zod';

/**
 * NIST SP 800-63B-4 §3.1.1.2: a password that is the only authentication factor
 * must have at least 15 characters, each Unicode code point counting as one.
 */
const NEW_PASSWORD_MIN_CODE_POINTS = 15;

/**
 * bcrypt digests only the first 72 bytes and ignores the rest, so a longer
 * password is rejected instead of being stored weaker than it looks.
 */
const NEW_PASSWORD_MAX_BYTES = 72;

/**
 * Bound of the previous policy, kept so accounts created under it can still
 * authenticate. It only caps the request: bcrypt's work does not grow with it.
 */
const SUBMITTED_PASSWORD_MAX_LENGTH = 255;

const countCodePoints = (value: string) => [...value].length;

/**
 * Passwords are used exactly as received, never trimmed or normalized, so the
 * value validated is the value hashed and, later, the value verified.
 */
export const NewPasswordSchema = z
  .string()
  .refine(
    (value) => countCodePoints(value) >= NEW_PASSWORD_MIN_CODE_POINTS,
    `Password must have at least ${NEW_PASSWORD_MIN_CODE_POINTS} characters`
  )
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= NEW_PASSWORD_MAX_BYTES,
    `Password must have at most ${NEW_PASSWORD_MAX_BYTES} bytes`
  )
  .refine((value) => value.trim().length > 0, 'Password must not be blank');

export const SubmittedPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(
    SUBMITTED_PASSWORD_MAX_LENGTH,
    `Password must have at most ${SUBMITTED_PASSWORD_MAX_LENGTH} characters`
  );
