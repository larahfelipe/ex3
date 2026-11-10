import type { ReactNode } from 'react';

/**
 * The `<hidden>` tag of a message: words a screen reader says that the layout
 * leaves out, such as the row an action applies to.
 */
export const srOnly = (chunks: ReactNode) => (
  <span className="sr-only">{chunks}</span>
);
