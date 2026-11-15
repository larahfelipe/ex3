const EMAIL_LOCAL_PART_MIN_LENGTH = 4;

export const isDerivedFromEmail = (password: string, email: string) => {
  const localPart = email
    .slice(0, Math.max(email.lastIndexOf('@'), 0))
    .toLowerCase();

  return (
    localPart.length >= EMAIL_LOCAL_PART_MIN_LENGTH &&
    password.toLowerCase().includes(localPart)
  );
};
