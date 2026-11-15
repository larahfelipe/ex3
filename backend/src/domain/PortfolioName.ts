const WHITESPACE_RUN = /\s+/g;

export const normalizePortfolioName = (name: string) =>
  name.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim();

export const portfolioNameKey = (name: string) =>
  normalizePortfolioName(name).toLowerCase();
