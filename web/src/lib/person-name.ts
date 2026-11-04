/** Mirror of the API's: the first and last names, whichever are given, one space apart. */
export const fullName = (firstName: string, lastName: string) =>
  [firstName, lastName]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(' ');
