/**
 * The name an account is shown by: its first and last names, whichever it
 * holds, one space apart.
 */
export const fullName = (firstName: string | null, lastName: string | null) =>
  [firstName, lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' ');

/**
 * The names as stored: the full name is always written with its parts, and an
 * account that holds neither has no full name, rather than an empty one.
 */
export const personNames = (
  firstName: string | null,
  lastName: string | null
) => {
  const name = fullName(firstName, lastName);

  return { firstName, lastName, name: name === '' ? null : name };
};
