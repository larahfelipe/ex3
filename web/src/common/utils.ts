export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions
) => new Intl.NumberFormat('en-US', options).format(value);

export const replaceUrl = (href: string) =>
  window.history.pushState({}, '', href);

export const truncateText = (
  text: string,
  maxLength: number,
  suffix = '...'
) => {
  if (text.length <= maxLength) return text;
  const charsToShow = maxLength - suffix.length;
  const frontChars = Math.ceil(charsToShow / 2);
  const backChars = Math.floor(charsToShow / 2);
  return (
    text.substring(0, frontChars) +
    suffix +
    text.substring(text.length - backChars)
  );
};

export const sanitizeInputValue = (
  value: string,
  inputType: 'text' | 'number' | 'alphanumeric',
  options?: {
    allowSpaces?: boolean;
    allowHyphens?: boolean;
    allowSpecialChars?: boolean;
  }
) => {
  if (!value?.length) return value;
  const sanitizeWithRegex = (regex: RegExp) => value.replace(regex, '');
  switch (inputType) {
    case 'text':
      return sanitizeWithRegex(
        new RegExp(
          `[^a-zA-ZÀ-ž${options?.allowSpaces ? '\\s' : ''}${options?.allowHyphens ? '-' : ''}${options?.allowSpecialChars ? '!@#\\$%&\\*\\(\\)_\\+\\.,' : ''}]`,
          'g'
        )
      );
    case 'number':
      return sanitizeWithRegex(/\D/g);
    case 'alphanumeric':
      return sanitizeWithRegex(
        new RegExp(
          `[^a-zA-ZÀ-ž0-9${options?.allowSpaces ? '\\s' : ''}${options?.allowHyphens ? '-' : ''}${options?.allowSpecialChars ? '!@#\\$%&\\*\\(\\)_\\+\\.,' : ''}]`,
          'g'
        )
      );
    default:
      console.warn(`Unknown inputType: ${inputType}`);
      return value;
  }
};
