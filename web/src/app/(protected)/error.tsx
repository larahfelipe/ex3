'use client';

import { useEffect, useRef } from 'react';

import { RefreshCw, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui';

type ErrorProps = Record<'retry', VoidFunction>;

/**
 * A page that fails to render is replaced here, inside the layout, so the
 * navigation stays and the user can leave for a page that works. Its content
 * is gone, and focus with it, so the heading takes focus and is announced.
 */
export default function PageError({ retry }: ErrorProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const t = useTranslations('common.fallback');

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <section className="flex min-h-[60dvh] items-center justify-center">
      <div className="w-full max-w-md space-y-6 text-center">
        <TriangleAlert
          aria-hidden="true"
          className="mx-auto size-8 text-muted-foreground"
        />

        <div className="space-y-2">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-bold focus:outline-hidden"
          >
            {t('title')}
          </h1>

          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>

        <Button variant="secondary" className="gap-2" onClick={() => retry()}>
          <RefreshCw aria-hidden="true" className="size-4" />

          <span>{t('retry')}</span>
        </Button>
      </div>
    </section>
  );
}
