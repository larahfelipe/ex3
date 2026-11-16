import { useState, type FC } from 'react';
import {
  useController,
  useFormContext,
  useFormState,
  useWatch
} from 'react-hook-form';

import { Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  CreditCard,
  CreditCardCycle,
  CreditCardSummary
} from '@/app/api/v1/finances';
import { FormField } from '@/components/form-field';
import {
  Button,
  DialogPresence,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { useCreditCards } from '@/hooks/use-finances';
import { useFormat } from '@/i18n/format';
import { cardStatementOf } from '@/lib/card-statement';

import { AddCreditCardDialog } from './credit-card-dialogs';
import { CardLabel } from './credit-card-display';
import { triggerPropsOf, type DescriptionFormInput } from './finance-form';

export type CardChoiceInput = Pick<DescriptionFormInput, 'paymentMethod'> &
  Record<'creditCardId', string>;

type CardSchedule = 'bill' | 'series' | 'plan';

type CardChoiceProps = Partial<Record<'dayName', string>> &
  Partial<Record<'schedule', CardSchedule>> &
  Partial<Record<'currentCard', CreditCardSummary | null>>;

type CardPreviewProps = Record<'card', CreditCardCycle> &
  Partial<Record<'day', string>> &
  Record<'schedule', CardSchedule>;

/** A Radix select item cannot carry an empty value, so "no card" has its own. */
export const NO_CARD = 'NONE';

export const chargedCardIdOf = ({
  paymentMethod,
  creditCardId
}: Record<'paymentMethod', string | null> & Record<'creditCardId', string>) =>
  paymentMethod === 'CREDIT_CARD' && creditCardId !== NO_CARD
    ? creditCardId
    : null;

export const cardChoiceOf = (creditCardId: string | null) =>
  creditCardId ?? NO_CARD;

/** The record's own card stays a choice once deleted, when the list leaves it out. */
const useChosenCard = (currentCard: CreditCardSummary | null = null) => {
  const { control } = useFormContext<CardChoiceInput>();
  const [paymentMethod, creditCardId] = useWatch({
    control,
    name: ['paymentMethod', 'creditCardId']
  });
  const { data: cards = [] } = useCreditCards();
  const cardId = chargedCardIdOf({ paymentMethod, creditCardId });
  const choices: Array<CreditCard | CreditCardSummary> =
    currentCard === null || cards.some(({ id }) => id === currentCard.id)
      ? cards
      : [...cards, currentCard];

  return {
    choices,
    chosen:
      cardId === null ? null : (choices.find(({ id }) => id === cardId) ?? null)
  };
};

const CardPreview: FC<CardPreviewProps> = ({ card, day, schedule }) => {
  const t = useTranslations('finances.cardPreview');
  const { formatCalendarDay, formatWeekdayCalendarDay } = useFormat();
  const statement = day === undefined ? null : cardStatementOf(card, day);
  const isSeries = schedule !== 'bill';
  const cycle = t(schedule === 'plan' ? 'eachInstallment' : 'each', {
    closingDay: card.closingDay,
    dueDay: card.dueDay
  });

  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm sm:col-span-2"
    >
      {statement === null || day === undefined ? (
        <p className="text-muted-foreground">{cycle}</p>
      ) : (
        <>
          <p className="font-medium">
            {t(isSeries ? 'firstDue' : 'due', {
              day:
                formatWeekdayCalendarDay(statement.dueDate) ?? statement.dueDate
            })}
          </p>

          <p className="text-muted-foreground">
            {isSeries
              ? cycle
              : t('statement', {
                  closing:
                    formatCalendarDay(statement.closingDate) ??
                    statement.closingDate,
                  bill: formatCalendarDay(day) ?? day
                })}
          </p>
        </>
      )}
    </div>
  );
};

const BillCardPreview: FC<
  Record<'card', CreditCardCycle> &
    Record<'dayName', string> &
    Record<'schedule', CardSchedule>
> = ({ card, dayName, schedule }) => {
  const { control } = useFormContext<Record<string, string>>();
  const day = useWatch({ control, name: dayName });

  return <CardPreview card={card} day={day} schedule={schedule} />;
};

export const CardChoice: FC<CardChoiceProps> = ({
  dayName,
  schedule = 'bill',
  currentCard = null
}) => {
  const t = useTranslations('finances.form');
  const { control, setValue } = useFormContext<CardChoiceInput>();
  const { errors } = useFormState({ control, name: 'creditCardId' });
  const { field } = useController({ name: 'creditCardId', control });
  const paymentMethod = useWatch({ control, name: 'paymentMethod' });
  const { choices, chosen } = useChosenCard(currentCard);
  const [isAdding, setIsAdding] = useState(false);

  if (paymentMethod !== 'CREDIT_CARD') return null;

  return (
    <>
      <FormField
        isOptional
        label={t('card')}
        hint={
          chosen === null
            ? t(schedule === 'plan' ? 'cardHintInstallments' : 'cardHint')
            : undefined
        }
        error={errors.creditCardId?.message}
        className="sm:col-span-2"
        action={
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto gap-1 p-0"
            onClick={() => setIsAdding(true)}
          >
            <Plus size={14} aria-hidden="true" />

            {t('newCard')}
          </Button>
        }
      >
        {(fieldControl) => (
          <Select
            name={field.name}
            value={field.value}
            onValueChange={field.onChange}
          >
            <SelectTrigger
              {...triggerPropsOf(fieldControl)}
              ref={field.ref}
              onBlur={field.onBlur}
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value={NO_CARD}>{t('noCard')}</SelectItem>

              {choices.map((card) => (
                <SelectItem key={card.id} value={card.id}>
                  <CardLabel card={card} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      {chosen !== null &&
        (dayName === undefined ? (
          <CardPreview card={chosen} schedule={schedule} />
        ) : (
          <BillCardPreview
            card={chosen}
            dayName={dayName}
            schedule={schedule}
          />
        ))}

      <DialogPresence>
        {isAdding && (
          <AddCreditCardDialog
            key="add"
            onClose={() => setIsAdding(false)}
            onAdded={(cardId) =>
              setValue('creditCardId', cardId, { shouldDirty: true })
            }
          />
        )}
      </DialogPresence>
    </>
  );
};

export const PlanCardNote: FC<Record<'card', CreditCardSummary>> = ({
  card
}) => {
  const t = useTranslations('finances.form');

  return (
    <div className="space-y-1.5 sm:col-span-2">
      <p className="text-sm leading-none font-medium">{t('card')}</p>

      <p className="flex h-(--field-height) items-center rounded-md border border-input bg-muted/40 px-3 text-sm">
        <CardLabel card={card} />
      </p>

      <p className="text-sm text-muted-foreground">{t('cardSetByPlan')}</p>
    </div>
  );
};
