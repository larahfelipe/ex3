import { z } from 'zod';

import { NewPasswordSchema, SubmittedPasswordSchema } from './PasswordSchema';
import { FirstNameSchema, LastNameSchema } from './PersonNameSchema';

/**
 * A new password is accepted only together with the current one: holding a
 * session is not enough to replace the credential that created it.
 */
export const UpdateUserSchema = z
  .object({
    firstName: FirstNameSchema.optional(),
    lastName: LastNameSchema.optional(),
    oldPassword: SubmittedPasswordSchema.optional(),
    newPassword: NewPasswordSchema.optional()
  })
  .refine(
    ({ oldPassword, newPassword }) =>
      (oldPassword === undefined) === (newPassword === undefined),
    'Changing the password requires both oldPassword and newPassword'
  )
  .transform(({ firstName, lastName, oldPassword, newPassword }) => ({
    firstName,
    lastName,
    passwordChange:
      oldPassword !== undefined && newPassword !== undefined
        ? { oldPassword, newPassword }
        : undefined
  }));
