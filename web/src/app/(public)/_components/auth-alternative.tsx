import type { FC } from 'react';

import Link from 'next/link';

type AuthAlternativeProps = {
  question: string;
  href: string;
  label: string;
};

export const AuthAlternative: FC<AuthAlternativeProps> = ({
  question,
  href,
  label
}) => (
  <p className="mt-8 text-center text-sm text-muted-foreground">
    {`${question} `}

    <Link
      href={href}
      className="rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 ring-offset-background transition-colors hover:decoration-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
    >
      {label}
    </Link>
  </p>
);
