export const fullName = (firstName: string, lastName: string) =>
  [firstName, lastName]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join(' ');
