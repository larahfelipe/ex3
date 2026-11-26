import { z } from 'zod';

import { LocaleSchema } from './LocaleSchema';
import { NewPasswordSchema, SubmittedPasswordSchema } from './PasswordSchema';
import { FirstNameSchema, LastNameSchema } from './PersonNameSchema';

export const UpdateUserSchema = z
  .object({
    firstName: FirstNameSchema.optional(),
    lastName: LastNameSchema.optional(),
    locale: LocaleSchema.optional(),
    oldPassword: SubmittedPasswordSchema.optional(),
    newPassword: NewPasswordSchema.optional()
  })
  .refine(
    ({ oldPassword, newPassword }) =>
      (oldPassword === undefined) === (newPassword === undefined),
    'Changing the password requires both oldPassword and newPassword'
  )
  .transform(({ firstName, lastName, locale, oldPassword, newPassword }) => ({
    firstName,
    lastName,
    locale,
    passwordChange:
      oldPassword !== undefined && newPassword !== undefined
        ? { oldPassword, newPassword }
        : undefined
  }));
