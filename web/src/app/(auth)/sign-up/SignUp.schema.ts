import { z } from 'zod';

export const SignUpSchema = z
  .object({
    name: z
      .string()
      .min(3, 'Name must be at least 3 character long')
      .max(25, 'Name must be at most 25 character long')
      .nonempty('Name is required')
      .transform((value) => value.trim()),
    email: z
      .string()
      .email('E-mail must be valid')
      .nonempty('E-mail is required')
      .transform((value) => value.trim()),
    password: z
      .string()
      .nonempty('Password is required')
      .min(6, 'Password must be at least 6 characters long')
      .transform((value) => value.trim()),
    confirmPassword: z
      .string()
      .nonempty('Password confirmation is required')
      .transform((value) => value.trim())
  })
  .superRefine(({ password, confirmPassword }, ctx) => {
    if (confirmPassword !== password)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords must match'
      });
  });
