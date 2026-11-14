import type { Metadata } from 'next';
import Link from 'next/link';

import { APP_ROUTES } from '@/common/constants';
import { Button } from '@/components/ui';
import { getServerTranslator } from '@/i18n/server';

const NOT_FOUND_STATUS = 404;

export const generateMetadata = async (): Promise<Metadata> => ({
  title: (await getServerTranslator('navigation.pages'))('notFound')
});

export default async function NotFound() {
  const t = await getServerTranslator('common.notFound');

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <p className="font-display text-sm font-semibold tracking-widest text-primary">
          {NOT_FOUND_STATUS}
        </p>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t('title')}</h1>

          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>

        <Button asChild>
          <Link href={APP_ROUTES.Protected.Overview}>{t('action')}</Link>
        </Button>
      </div>
    </main>
  );
}
