import { z } from 'zod';

export const SignInSchema = z.object({
  email: z
    .string()
    .email('E-mail must be valid')
    .nonempty('E-mail is required')
    .transform((value) => value.trim()),
  password: z
    .string()
    .nonempty('Password is required')
    .min(6, 'Password must be at least 6 characters long')
    .transform((value) => value.trim())
});
