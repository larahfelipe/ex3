import type { FC } from 'react';

type PublicPageHeaderProps = Record<'title', string>;

export const PublicPageHeader: FC<PublicPageHeaderProps> = ({ title }) => (
  <header>
    <h1 className="font-display text-3xl font-bold tracking-tight text-balance">
      {title}
    </h1>
  </header>
);
