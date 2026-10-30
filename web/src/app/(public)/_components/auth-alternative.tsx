import Link from 'next/link';

import { getServerTranslator } from '@/i18n/server';

type AuthAlternativeProps = {
  question: string;
  href: string;
  label: string;
};

export const AuthAlternative = async ({
  question,
  href,
  label
}: AuthAlternativeProps) => (
  <p className="mt-8 text-sm text-muted-foreground">
    {(await getServerTranslator('auth')).rich('alternative', {
      question,
      label,
      link: (chunks) => (
        <Link
          href={href}
          className="rounded-sm font-medium text-foreground underline decoration-muted-foreground underline-offset-4 ring-offset-background transition-colors hover:decoration-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          {chunks}
        </Link>
      )
    })}
  </p>
);
