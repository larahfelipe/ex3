import { z } from 'zod';

/**
 * NIST SP 800-63B-4 §3.1.1.2 asks 15 characters of a password that is the only
 * factor, as here, and 8 only beside a second one. The product settled on 8,
 * the floor of the 800-63B-3 profile, which leaves resistance to guessing to
 * the checks below and to the sign-in throttle.
 */
const NEW_PASSWORD_MIN_CODE_POINTS = 8;

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

/**
 * The passwords that published leak rankings put first, trimmed to those the
 * length floor lets through, compared case-insensitively. Curated, not a breach
 * corpus: one leaked elsewhere but absent here is accepted (TD-005).
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  '0123456789',
  '0987654321',
  '11223344',
  '12121212',
  '123123123',
  '12341234',
  '12345678',
  '123456789',
  '1234567890',
  '123456789a',
  '123mudar',
  '147258369',
  '1q2w3e4r',
  '1q2w3e4r5t',
  '1qaz2wsx',
  '87654321',
  '987654321',
  'abc12345',
  'abcd1234',
  'admin123',
  'administrator',
  'asdf1234',
  'asdfghjk',
  'asdfghjkl',
  'baseball',
  'brasil123',
  'changeme',
  'computer',
  'corinthians',
  'flamengo',
  'football',
  'iloveyou',
  'internet',
  'letmein1',
  'minhasenha',
  'mudar123',
  'p@ssw0rd',
  'palmeiras',
  'passw0rd',
  'password',
  'password1',
  'password12',
  'password123',
  'princess',
  'q1w2e3r4',
  'qwerty12',
  'qwerty123',
  'qwertyui',
  'qwertyuiop',
  'senha123',
  'senha1234',
  'starwars',
  'sunshine',
  'superman',
  'trustno1',
  'welcome1',
  'whatever',
  'zaq12wsx'
]);

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
  .refine((value) => value.trim().length > 0, 'Password must not be blank')
  .refine(
    (value) => new Set(value).size > 1,
    'Password must not repeat a single character'
  )
  .refine(
    (value) => !COMMON_PASSWORDS.has(value.toLowerCase()),
    'Password must not be a commonly used password'
  );

export const SubmittedPasswordSchema = z
  .string()
  .min(1, 'Password is required')
  .max(
    SUBMITTED_PASSWORD_MAX_LENGTH,
    `Password must have at most ${SUBMITTED_PASSWORD_MAX_LENGTH} characters`
  );
