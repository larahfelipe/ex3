import type { FC } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';

import { useTranslations } from 'use-intl';
import type { z } from 'zod';

import type { RecurrenceFrequency } from '@/app/api/v1/finances';
import { FINANCE_LIMITS, RECURRENCE_FREQUENCIES } from '@/common/constants';
import { ChoiceField } from '@/components/form-field';
import { SegmentedControl, SegmentedControlItem } from '@/components/ui';
import { useFormat } from '@/i18n/format';
import { shiftCalendarDay, shiftCalendarDayByMonths } from '@/lib/dates';

import { DayField, type ValidationTranslator } from './finance-form';

export type AmountKind = (typeof AMOUNT_KINDS)[number];

type EndMode = (typeof END_MODES)[number];

export type SeriesTerms = Record<'amountKind', AmountKind> &
  Record<'endMode', EndMode> &
  Record<'endDate', string>;

/** The day a new series starts on: its own field, or the due date of the bill it repeats. */
type StartField = 'startDate' | 'dueDate';

type RecurrenceInput = SeriesTerms &
  Record<'frequency', RecurrenceFrequency> &
  Record<StartField, string>;

type StartFieldProps = Record<'startName', StartField>;

export const AMOUNT_KINDS = ['fixed', 'variable'] as const;

export const END_MODES = ['never', 'date'] as const;

const PREVIEWED_OCCURRENCES = 3;

export const requireEndOf = (
  { endMode, endDate }: SeriesTerms,
  startDate: string,
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
};

/** The API generates a new series' bills from no further back than `OccurrenceHorizonMonths`. */
export const requireRecentStartOf = (
  today: string,
  t: ValidationTranslator
) => {
  const earliestStart = shiftCalendarDayByMonths(
    today,
    -FINANCE_LIMITS.OccurrenceHorizonMonths
  );

  return (startDate: string, path: StartField, ctx: z.RefinementCtx) => {
    if (earliestStart !== null && startDate !== '' && startDate < earliestStart)
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

/** The `index`-th day of the series, counted from its start as the API does. */
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
  const tFinances = useTranslations('finances');
  const { formatCalendarDay, formatList } = useFormat();
  const { control } = useFormContext<RecurrenceInput>();
  const [frequency, startDate, endMode, endDate] = useWatch({
    control,
    name: ['frequency', startName, 'endMode', 'endDate']
  });

  const end = endMode === 'date' && endDate !== '' ? endDate : null;
  const days = Array.from({ length: PREVIEWED_OCCURRENCES }, (_, index) =>
    occurrenceDayAt(frequency, startDate, index)
  ).filter(
    (day): day is string => day !== null && (end === null || day <= end)
  );
  const shownDays = days.map((day) => formatCalendarDay(day) ?? day);
  const period = tFinances(`perPeriod.${frequency}`);
  const shownEnd = end === null ? null : (formatCalendarDay(end) ?? end);

  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm"
    >
      {days.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <p className="font-medium">
            {t('first', { count: days.length, days: formatList(shownDays) })}
          </p>

          <p className="text-muted-foreground">
            {shownEnd === null
              ? t('then', { period })
              : t('thenUntil', { period, day: shownEnd })}
          </p>
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

export const EndChoice: FC = () => {
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
        <DayField name="endDate" label={t('endDate')} hint={t('endDateHint')} />
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

/**
 * How a new series repeats from the day in `startName`: how often, whether its
 * amount is fixed, when it ends, and the first bills that makes.
 */
export const RecurrenceFields: FC<StartFieldProps> = ({ startName }) => (
  <>
    <div className="grid gap-4 sm:grid-cols-2">
      <FrequencyChoice />

      <AmountKindChoice />
    </div>

    <EndChoice />

    <SeriesPreview startName={startName} />
  </>
);
