import type { FC } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslations } from 'use-intl';
import type { z } from 'zod';

import type { RecurrenceFrequency } from '@/app/api/v1/finances';
import { FINANCE_LIMITS, RECURRENCE_FREQUENCIES } from '@/common/constants';
import { ChoiceField } from '@/components/form-field';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui';
import { useReferenceDay } from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import { shiftCalendarDay, shiftCalendarDayByMonths } from '@/lib/dates';

import { DayField, type ValidationTranslator } from './finance-form';

export type AmountKind = (typeof AMOUNT_KINDS)[number];

type EndMode = (typeof END_MODES)[number];

export type SeriesTerms = Record<'amountKind', AmountKind> &
  Record<'endMode', EndMode> &
  Record<'endDate', string>;

type StartField = 'startDate' | 'dueDate';

type RecurrenceInput = SeriesTerms &
  Record<'frequency', RecurrenceFrequency> &
  Record<StartField, string>;

type StartFieldProps = Record<'startName', StartField>;

type EndBounds = Record<'startDate' | 'today', string> &
  Partial<Record<'currentEnd', string | null>>;

export const AMOUNT_KINDS = ['fixed', 'variable'] as const;

export const END_MODES = ['never', 'date'] as const;

const PREVIEWED_OCCURRENCES = 3;

export const earliestEndOf = (today: string, startDate: string) =>
  startDate > today ? startDate : today;

export const earliestStartOf = (today: string) =>
  shiftCalendarDayByMonths(today, -FINANCE_LIMITS.OccurrenceHorizonMonths) ??
  undefined;

export const requireEndOf = (
  { endMode, endDate }: SeriesTerms,
  { startDate, today, currentEnd = null }: EndBounds,
  ctx: z.RefinementCtx,
  t: ValidationTranslator
) => {
  if (endMode !== 'date') return;

  if (endDate === '')
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: t('day.required')
    });
  else if (startDate !== '' && endDate < startDate)
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: t('recurring.endBeforeStart')
    });
  else if (endDate < today && endDate !== currentEnd)
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: t('recurring.endBeforeToday')
    });
};

export const requireRecentStartOf = (
  today: string,
  t: ValidationTranslator
) => {
  const earliestStart = earliestStartOf(today);

  return (startDate: string, path: StartField, ctx: z.RefinementCtx) => {
    if (
      earliestStart !== undefined &&
      startDate !== '' &&
      startDate < earliestStart
    )
      ctx.addIssue({
        code: 'custom',
        path: [path],
        message: t('recurring.startTooEarly', {
          months: FINANCE_LIMITS.OccurrenceHorizonMonths
        })
      });
  };
};

export const endDateOf = ({
  endMode,
  endDate
}: Pick<SeriesTerms, 'endMode' | 'endDate'>) =>
  endMode === 'date' ? endDate : null;

export const occurrenceDayAt = (
  frequency: RecurrenceFrequency,
  startDate: string,
  index: number
) =>
  frequency === 'WEEKLY'
    ? shiftCalendarDay(startDate, index * 7)
    : shiftCalendarDayByMonths(
        startDate,
        frequency === 'MONTHLY' ? index : index * 12
      );

const SeriesPreview: FC<StartFieldProps> = ({ startName }) => {
  const t = useTranslations('recurring.preview');
  const { formatCalendarDay } = useFormat();
  const { control } = useFormContext<RecurrenceInput>();
  const [frequency, startDate, endMode, endDate] = useWatch({
    control,
    name: ['frequency', startName, 'endMode', 'endDate']
  });

  const end = endMode === 'date' && endDate !== '' ? endDate : null;
  const isWithinEnd = (day: string | null): day is string =>
    day !== null && (end === null || day <= end);
  const days = Array.from({ length: PREVIEWED_OCCURRENCES }, (_, index) =>
    occurrenceDayAt(frequency, startDate, index)
  ).filter(isWithinEnd);
  const continues =
    days.length === PREVIEWED_OCCURRENCES &&
    isWithinEnd(occurrenceDayAt(frequency, startDate, PREVIEWED_OCCURRENCES));
  const dayText = (day: string) => formatCalendarDay(day) ?? day;

  return (
    <div
      aria-live="polite"
      className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm"
    >
      {days.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <p className="font-medium">
            {end === null
              ? t('rule', { frequency, start: dayText(startDate) })
              : t('ruleUntil', {
                  frequency,
                  start: dayText(startDate),
                  end: dayText(end)
                })}
          </p>

          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">
              {t('firstBills', { count: days.length })}
            </p>

            <ol className="flex flex-wrap items-center gap-1.5">
              {days.map((day) => (
                <li
                  key={day}
                  className="rounded-md border bg-surface-elevated px-2 py-1 text-xs font-medium tabular-nums"
                >
                  <time dateTime={day}>{dayText(day)}</time>
                </li>
              ))}

              {continues && (
                <li className="px-1 text-muted-foreground">
                  {t.rich('more', {
                    shown: (chunks) => <span aria-hidden="true">{chunks}</span>,
                    hidden: srOnly
                  })}
                </li>
              )}
            </ol>
          </div>
        </>
      )}
    </div>
  );
};

export const AmountKindChoice: FC = () => {
  const t = useTranslations('recurring.form');
  const { control, register } = useFormContext<SeriesTerms>();
  const amountKind = useWatch({ control, name: 'amountKind' });

  return (
    <ChoiceField
      legend={t('amountKind')}
      hint={t(`amountKindHints.${amountKind}`)}
    >
      <SegmentedControl className="grid min-h-(--field-height) grid-cols-2">
        {AMOUNT_KINDS.map((kind) => (
          <SegmentedControlItem
            key={kind}
            value={kind}
            {...register('amountKind')}
          >
            {t(`amountKinds.${kind}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </ChoiceField>
  );
};

export const EndChoice: FC<Record<'earliestEnd', string>> = ({
  earliestEnd
}) => {
  const t = useTranslations('recurring.form');
  const { control, register } = useFormContext<SeriesTerms>();
  const endMode = useWatch({ control, name: 'endMode' });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceField legend={t('ends')}>
        <SegmentedControl className="grid min-h-(--field-height) grid-cols-2">
          {END_MODES.map((mode) => (
            <SegmentedControlItem
              key={mode}
              value={mode}
              {...register('endMode')}
            >
              {t(`endModes.${mode}`)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </ChoiceField>

      {endMode === 'date' && (
        <DayField
          name="endDate"
          label={t('endDate')}
          hint={t('endDateHint')}
          min={earliestEnd}
        />
      )}
    </div>
  );
};

const FrequencyChoice: FC = () => {
  const t = useTranslations('recurring.form');
  const tFinances = useTranslations('finances');
  const { register } = useFormContext<RecurrenceInput>();

  return (
    <ChoiceField legend={t('frequency')} hint={t('frequencyHint')}>
      <SegmentedControl className="grid min-h-(--field-height) grid-cols-3">
        {RECURRENCE_FREQUENCIES.map((frequency) => (
          <SegmentedControlItem
            key={frequency}
            value={frequency}
            {...register('frequency')}
          >
            {tFinances(`frequencies.${frequency}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </ChoiceField>
  );
};

const StartedEndChoice: FC<StartFieldProps> = ({ startName }) => {
  const { control } = useFormContext<RecurrenceInput>();
  const startDate = useWatch({ control, name: startName });
  const today = useReferenceDay();

  return <EndChoice earliestEnd={earliestEndOf(today, startDate)} />;
};

export const RecurrenceFields: FC<StartFieldProps> = ({ startName }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <FrequencyChoice />

      <AmountKindChoice />
    </div>

    <StartedEndChoice startName={startName} />

    <SeriesPreview startName={startName} />
  </>
);
