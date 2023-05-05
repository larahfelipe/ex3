import { z } from 'zod';

export const UpdateUserSchema = z.object({
  name: z.string().optional(),
  oldPassword: z
    .string()
    .max(255, 'Password must have at most 255 characters')
    .transform((value) => value.trim())
    .optional(),
  newPassword: z
    .string()
    .max(255, 'Password must have at most 255 characters')
    .transform((value) => value.trim())
    .optional()
});
