'use client';

import type { ComponentProps, FC, ReactElement } from 'react';

import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'use-intl';

import type { FieldControlProps } from '@/components/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  UnstyledSelectTrigger
} from '@/components/ui';
import {
  isSupportedLocale,
  LOCALE_NAMES,
  LOCALES,
  type Locale
} from '@/i18n/config';
import { useLocaleSwitch } from '@/providers/locale-provider';

export type LanguageTriggerState = Record<'locale', Locale> &
  Record<'isPending', boolean>;

type LanguageSelectProps = Partial<
  Pick<FieldControlProps, 'id' | 'aria-describedby'>
> &
  Partial<Record<'className', string>> &
  Partial<Pick<ComponentProps<typeof SelectContent>, 'side' | 'align'>> &
  Partial<
    Record<'renderTrigger', (language: LanguageTriggerState) => ReactElement>
  >;

export const LanguageSelect: FC<LanguageSelectProps> = ({
  renderTrigger,
  className,
  side,
  align,
  ...control
}) => {
  const { locale, pendingLocale, switchLocale } = useLocaleSwitch();
  const t = useTranslations('common.language');

  const shownLocale = pendingLocale ?? locale;
  const isPending = pendingLocale !== null;

  const changeLanguage = (value: string) => {
    if (!isSupportedLocale(value)) return;

    switchLocale(value).catch(() => toast.error(t('failed')));
  };

  return (
    <Select value={shownLocale} onValueChange={changeLanguage}>
      {renderTrigger === undefined ? (
        <SelectTrigger {...control} aria-busy={isPending} className={className}>
          <SelectValue>
            {isPending && (
              <Loader2
                aria-hidden="true"
                className="mr-2 inline size-4 animate-spin align-[-0.1875em]"
              />
            )}

            <span lang={shownLocale}>{LOCALE_NAMES[shownLocale]}</span>
          </SelectValue>
        </SelectTrigger>
      ) : (
        <UnstyledSelectTrigger asChild aria-busy={isPending}>
          {renderTrigger({ locale: shownLocale, isPending })}
        </UnstyledSelectTrigger>
      )}

      <SelectContent side={side} align={align}>
        {LOCALES.map((option) => (
          <SelectItem key={option} value={option} lang={option}>
            {LOCALE_NAMES[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
