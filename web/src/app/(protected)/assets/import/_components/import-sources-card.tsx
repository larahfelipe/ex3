import { useId, type FC } from 'react';

import { Download, Landmark, Table2, type LucideIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'use-intl';

import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent } from '@/components/ui';
import type { Locale } from '@/i18n/config';
import type { Children } from '@/types';

const TEMPLATE_FILES: Record<Locale, string> = {
  'pt-BR': '/templates/ex3-modelo-importacao.csv',
  'en-US': '/templates/ex3-import-template.csv'
};

const Source: FC<
  Children & Record<'title', string> & Record<'icon', LucideIcon>
> = ({ title, icon: Icon, children }) => (
  <div className="space-y-2">
    <h3 className="flex items-center gap-2 text-sm font-semibold">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />

      {title}
    </h3>

    <div className="space-y-2 text-sm text-muted-foreground text-pretty">
      {children}
    </div>
  </div>
);

export const ImportSourcesCard: FC = () => {
  const t = useTranslations('imports.sources');
  const locale = useLocale();
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <Card className="h-full">
        <SectionHeader id={headingId} title={t('title')} />

        <CardContent className="space-y-6">
          <Source title={t('b3.title')} icon={Landmark}>
            <p>{t('b3.steps')}</p>

            <p>{t('b3.costs')}</p>

            <p>{t('b3.coverage')}</p>
          </Source>

          <Source title={t('template.title')} icon={Table2}>
            <p>{t('template.columns')}</p>

            <p>{t('template.values')}</p>

            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={TEMPLATE_FILES[locale]} download>
                <Download aria-hidden="true" className="size-4" />

                {t('template.download')}
              </a>
            </Button>
          </Source>
        </CardContent>
      </Card>
    </section>
  );
};
