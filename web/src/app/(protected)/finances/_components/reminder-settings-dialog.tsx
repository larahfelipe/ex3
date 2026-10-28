import { useId, useState, type FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { presentSubmitError } from '@/lib/submit-error';

import { fieldOfPath, FormRootError } from './finance-form';

type ReminderSettingsDialogProps = Record<'settings', FinanceSettings> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (settings: FinanceSettings) => Promise<unknown>>;

type ReminderSettingsInput = z.input<typeof ReminderSettingsFields>;

type ReminderSwitch = Exclude<keyof FinanceSettings, 'reminderLeadDays'>;

const ReminderSettingsFields = z.object({
  reminderLeadDays: z.coerce
    .number<string>('Enter a number of days')
    .int('Enter a whole number of days')
    .min(0, 'Days cannot be negative')
    .max(
      FINANCE_LIMITS.ReminderMaxLeadDays,
      `At most ${FINANCE_LIMITS.ReminderMaxLeadDays} days`
    ),
  remindOverdue: z.boolean(),
  remindUpcomingBills: z.boolean(),
  remindUpcomingInstallments: z.boolean()
});

const REMINDER_SWITCHES: ReadonlyArray<
  Record<'key', ReminderSwitch> & Record<'label', string>
> = [
  { key: 'remindOverdue', label: 'Overdue bills' },
  { key: 'remindUpcomingBills', label: 'Bills due soon' },
  { key: 'remindUpcomingInstallments', label: 'Installments due soon' }
];

const settingsFieldOf = fieldOfPath(ReminderSettingsFields.keyof().options);

export const ReminderSettingsDialog: FC<ReminderSettingsDialogProps> = ({
  settings,
  onCancel,
  onSubmit
}) => {
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);

  const methods = useForm<ReminderSettingsInput, unknown, FinanceSettings>({
    mode: 'onChange',
    resolver: zodResolver(ReminderSettingsFields),
    defaultValues: {
      ...settings,
      reminderLeadDays: String(settings.reminderLeadDays)
    }
  });

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
        fallbackMessage: 'The reminders could not be saved'
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
          <DialogTitle>Reminders</DialogTitle>

          <DialogDescription>
            Choose what is flagged on the overview and in the navigation, and
            how many days ahead. Reminders are shown in the app only.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submitSettings)}
          >
            <ChoiceField legend="Remind me of">
              <ul className="divide-y rounded-md border">
                {REMINDER_SWITCHES.map(({ key, label }) => (
                  <li key={key}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50">
                      <input
                        type="checkbox"
                        className="size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        {...register(key)}
                      />

                      {label}
                    </label>
                  </li>
                ))}
              </ul>
            </ChoiceField>

            <FormField
              label="Days before the due date"
              hint={`For bills and installments due soon. 0 flags them on their due day; at most ${FINANCE_LIMITS.ReminderMaxLeadDays}`}
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
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            Save reminders
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
