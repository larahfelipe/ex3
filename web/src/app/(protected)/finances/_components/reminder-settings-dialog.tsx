import { useId, useMemo, useState, type FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type { FinanceSettings } from '@/app/api/v1/finances';
import { FINANCE_LIMITS } from '@/common/constants';
import { ChoiceField, FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input
} from '@/components/ui';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { presentSubmitError } from '@/lib/submit-error';

import {
  fieldOfPath,
  FormRootError,
  type ValidationTranslator
} from './finance-form';

type ReminderSettingsDialogProps = Record<'settings', FinanceSettings> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (settings: FinanceSettings) => Promise<unknown>>;

type ReminderSettingsInput = z.input<
  ReturnType<typeof reminderSettingsSchemaFor>
>;

const reminderSettingsSchemaFor = (t: ValidationTranslator) =>
  z.object({
    reminderLeadDays: z.coerce
      .number<string>(t('reminders.daysRequired'))
      .int(t('reminders.daysWhole'))
      .min(0, t('reminders.daysMin'))
      .max(
        FINANCE_LIMITS.ReminderMaxLeadDays,
        t('reminders.daysMax', { max: FINANCE_LIMITS.ReminderMaxLeadDays })
      ),
    remindOverdue: z.boolean(),
    remindUpcomingBills: z.boolean(),
    remindUpcomingInstallments: z.boolean()
  });

const REMINDER_SWITCHES = [
  'remindOverdue',
  'remindUpcomingBills',
  'remindUpcomingInstallments'
] as const satisfies ReadonlyArray<
  Exclude<keyof FinanceSettings, 'reminderLeadDays'>
>;

const settingsFieldOf = fieldOfPath([
  'reminderLeadDays',
  ...REMINDER_SWITCHES
] as const satisfies ReadonlyArray<keyof ReminderSettingsInput>);

export const ReminderSettingsDialog: FC<ReminderSettingsDialogProps> = ({
  settings,
  onCancel,
  onSubmit
}) => {
  const t = useTranslations('financeOverview.reminders');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);
  const schema = useMemo(
    () => reminderSettingsSchemaFor(tValidation),
    [tValidation]
  );

  const methods = useForm<ReminderSettingsInput, unknown, FinanceSettings>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      ...settings,
      reminderLeadDays: String(settings.reminderLeadDays)
    }
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = methods;

  const submitSettings = async (next: FinanceSettings) => {
    setIsSaving(true);

    try {
      await onSubmit(next);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: settingsFieldOf,
        t: tErrors,
        fallbackMessage: t('settings.failed')
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>

          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submitSettings)}
          >
            <ChoiceField legend={t('settings.remindOf')}>
              <ul className="divide-y rounded-md border">
                {REMINDER_SWITCHES.map((key) => (
                  <li key={key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        {...register(key)}
                      />

                      {t(`settings.switches.${key}`)}
                    </label>
                  </li>
                ))}
              </ul>
            </ChoiceField>

            <FormField
              label={t('settings.leadDays')}
              hint={t('settings.leadDaysHint', {
                max: FINANCE_LIMITS.ReminderMaxLeadDays
              })}
              error={errors.reminderLeadDays?.message}
            >
              {(fieldControl) => (
                <Input
                  {...fieldControl}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={FINANCE_LIMITS.ReminderMaxLeadDays}
                  step={1}
                  className="w-32"
                  {...register('reminderLeadDays')}
                />
              )}
            </FormField>

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {t('settings.submit')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
