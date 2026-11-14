export const fullName = (firstName: string | null, lastName: string | null) =>
  [firstName, lastName]
    .map((part) => part?.trim() ?? '')
    .filter((part) => part !== '')
    .join(' ');

export const personNames = (
  firstName: string | null,
  lastName: string | null
) => {
  const name = fullName(firstName, lastName);

  return { firstName, lastName, name: name === '' ? null : name };
};
