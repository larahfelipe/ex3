const WHITESPACE_RUN = /\s+/g;

/**
 * The name as stored and shown: a run of whitespace reads as one space, and the
 * NFC form keeps an accented letter typed composed or decomposed the same name.
 */
export const normalizePortfolioName = (name: string) =>
  name.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim();

/**
 * What makes two names of one owner the same name: they differ at most in
 * letter case or in the whitespace `normalizePortfolioName` folds. The unique
 * index on the owner and this key is what refuses a duplicate.
 */
export const portfolioNameKey = (name: string) =>
  normalizePortfolioName(name).toLowerCase();
