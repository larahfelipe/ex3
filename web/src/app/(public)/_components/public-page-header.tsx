import type { FC } from 'react';

type PublicPageHeaderProps = {
  title: string;
  description?: string;
};

export const PublicPageHeader: FC<PublicPageHeaderProps> = ({
  title,
  description
}) => (
  <header className="space-y-4 text-center">
    <p className="font-display text-4xl font-bold tracking-tight">EX3</p>

    <div className="h-px bg-linear-to-r from-transparent via-primary/50 to-transparent" />

    <div className="space-y-1.5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>

      {description !== undefined && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  </header>
);
