import type { FC } from 'react';

import { APP_TITLE } from '@/common/constants';

type PublicPageHeaderProps = {
  title: string;
};

export const PublicPageHeader: FC<PublicPageHeaderProps> = ({ title }) => (
  <header className="space-y-4 text-center">
    <p className="font-display text-4xl font-bold tracking-tight">
      {APP_TITLE}
    </p>

    <div className="h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />

    <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
  </header>
);
