/**
 * Below this length the part of an email before the `@` is a common word more
 * than a name, and refusing every password containing it would turn down
 * unrelated ones. Assumed, not measured.
 */
const EMAIL_LOCAL_PART_MIN_LENGTH = 4;

/**
 * NIST SP 800-63B §3.1.1.2 has new passwords checked against words specific to
 * the account: the email names it, so it is the first guess against it.
 */
export const isDerivedFromEmail = (password: string, email: string) => {
  const localPart = email
    .slice(0, Math.max(email.lastIndexOf('@'), 0))
    .toLowerCase();

  return (
    localPart.length >= EMAIL_LOCAL_PART_MIN_LENGTH &&
    password.toLowerCase().includes(localPart)
  );
};
