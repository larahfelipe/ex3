import type { ReactNode } from 'react';

export const srOnly = (chunks: ReactNode) => (
  <span className="sr-only">{chunks}</span>
);
