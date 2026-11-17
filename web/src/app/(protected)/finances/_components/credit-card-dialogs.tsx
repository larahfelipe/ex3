import { useId, useMemo, useState, type FC } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreditCard as CreditCardIcon,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type { CreditCard, CreditCardFields } from '@/app/api/v1/finances';
import { CARD_BRANDS, FINANCE_LIMITS } from '@/common/constants';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { ChoiceField, FormField } from '@/components/form-field';
import { InfoNote } from '@/components/info-note';
import { NumberInput } from '@/components/number-input';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPresence,
  DialogTitle,
  IconButton,
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import {
  useCreateCreditCard,
  useCreditCards,
  useDeleteCreditCard,
  useUpdateCreditCard
} from '@/hooks/use-finances';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { presentSubmitError } from '@/lib/submit-error';

import { CardBrandLogo, CardLabel } from './credit-card-display';
import {
  fieldOfPath,
  FormRootError,
  requiredTextFieldFor,
  type ValidationTranslator
} from './finance-form';

export type CreditCardFormTarget =
  | Record<'kind', 'create'>
  | (Record<'kind', 'edit'> & Record<'card', CreditCard>);

type CreditCardFormInput = z.input<ReturnType<typeof creditCardFormSchemaFor>>;

type CreditCardFormDialogProps = Record<'target', CreditCardFormTarget> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (card: CreditCardFields) => Promise<unknown>>;

type AddCreditCardDialogProps = Record<'onClose', VoidFunction> &
  Partial<Record<'onAdded', (cardId: string) => void>>;

type CardAction =
  | Record<'kind', 'list' | 'add'>
  | (Record<'kind', 'edit' | 'delete'> & Record<'card', CreditCard>);

const CARD_NUMBER_PATTERN = /(?:\d[ -]?){12,}/;

const DAY_MAX_LENGTH = 2;

const cardDayFieldFor = (t: ValidationTranslator) =>
  z
    .string()
    .min(1, t('card.dayRequired'))
    .pipe(
      z.coerce
        .number<string>()
        .int(t('card.dayRange'))
        .min(1, t('card.dayRange'))
        .max(31, t('card.dayRange'))
    );

export const creditCardFormSchemaFor = (t: ValidationTranslator) =>
  z
    .object({
      name: requiredTextFieldFor(t, FINANCE_LIMITS.CardNameMaxLength).refine(
        (name) => !CARD_NUMBER_PATTERN.test(name),
        t('card.nameHasNumber')
      ),
      lastFourDigits: z
        .string()
        .trim()
        .regex(/^\d{4}$/, t('card.lastFourDigits')),
      brand: z.enum(CARD_BRANDS),
      closingDay: cardDayFieldFor(t),
      dueDay: cardDayFieldFor(t)
    })
    .refine(({ closingDay, dueDay }) => closingDay !== dueDay, {
      path: ['dueDay'],
      message: t('card.sameDays')
    });

const CARD_FORM_FIELDS = [
  'name',
  'lastFourDigits',
  'brand',
  'closingDay',
  'dueDay'
] as const satisfies ReadonlyArray<keyof CreditCardFormInput>;

const cardFieldOf = fieldOfPath(CARD_FORM_FIELDS);

const defaultValuesOf = (target: CreditCardFormTarget): CreditCardFormInput =>
  target.kind === 'create'
    ? {
        name: '',
        lastFourDigits: '',
        brand: CARD_BRANDS[0],
        closingDay: '',
        dueDay: ''
      }
    : {
        name: target.card.name,
        lastFourDigits: target.card.lastFourDigits,
        brand: target.card.brand,
        closingDay: String(target.card.closingDay),
        dueDay: String(target.card.dueDay)
      };

export const CreditCardFormDialog: FC<CreditCardFormDialogProps> = ({
  target,
  onCancel,
  onSubmit
}) => {
  const t = useTranslations('finances.cards.form');
  const tFinances = useTranslations('finances');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const [isSaving, setIsSaving] = useState(false);
  const schema = useMemo(
    () => creditCardFormSchemaFor(tValidation),
    [tValidation]
  );

  const methods = useForm<CreditCardFormInput, unknown, CreditCardFields>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: defaultValuesOf(target)
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting }
  } = methods;

  const [closingDay, dueDay] = useWatch({
    control,
    name: ['closingDay', 'dueDay']
  });
  const movedBillCount =
    target.kind === 'edit' &&
    (Number(closingDay) !== target.card.closingDay ||
      Number(dueDay) !== target.card.dueDay)
      ? target.card.unpaidBillCount
      : 0;

  const submitCard = async (card: CreditCardFields) => {
    setIsSaving(true);

    try {
      await onSubmit(card);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: cardFieldOf,
        t: tErrors,
        fallbackMessage: t('failed')
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
      <DialogContent className="sm:max-w-lg" hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'create' ? t('addTitle') : t('editTitle')}
          </DialogTitle>

          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...methods}>
            {/* This dialog can open over a bill's form, and React carries a
                submit up through the portal to that form as well. */}
            <form
              id={formId}
              noValidate
              className="grid gap-6"
              onSubmit={(event) => {
                event.stopPropagation();
                void handleSubmit(submitCard)(event);
              }}
            >
              <InfoNote>{t('privacy')}</InfoNote>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t('name')} error={errors.name?.message}>
                  {(fieldControl) => (
                    <Input
                      {...fieldControl}
                      type="text"
                      autoComplete="off"
                      placeholder={t('namePlaceholder')}
                      maxLength={FINANCE_LIMITS.CardNameMaxLength}
                      {...register('name')}
                    />
                  )}
                </FormField>

                <FormField
                  label={t('lastFourDigits')}
                  error={errors.lastFourDigits?.message}
                >
                  {(fieldControl) => (
                    <NumberInput
                      {...fieldControl}
                      maxLength={4}
                      className="tabular-nums"
                      {...register('lastFourDigits')}
                    />
                  )}
                </FormField>

                <ChoiceField
                  legend={t('brand')}
                  error={errors.brand?.message}
                  className="sm:col-span-2"
                >
                  <SegmentedControl className="grid min-h-(--field-height) grid-cols-2">
                    {CARD_BRANDS.map((brand) => (
                      <SegmentedControlItem
                        key={brand}
                        value={brand}
                        {...register('brand')}
                      >
                        <span className="flex items-center gap-2">
                          <CardBrandLogo brand={brand} />

                          {tFinances(`cardBrands.${brand}`)}
                        </span>
                      </SegmentedControlItem>
                    ))}
                  </SegmentedControl>
                </ChoiceField>

                <FormField
                  label={t('closingDay')}
                  hint={t('closingDayHint')}
                  error={errors.closingDay?.message}
                >
                  {(fieldControl) => (
                    <NumberInput
                      {...fieldControl}
                      maxLength={DAY_MAX_LENGTH}
                      className="tabular-nums"
                      {...register('closingDay', { deps: ['dueDay'] })}
                    />
                  )}
                </FormField>

                <FormField
                  label={t('dueDay')}
                  hint={t('dueDayHint')}
                  error={errors.dueDay?.message}
                >
                  {(fieldControl) => (
                    <NumberInput
                      {...fieldControl}
                      maxLength={DAY_MAX_LENGTH}
                      className="tabular-nums"
                      {...register('dueDay')}
                    />
                  )}
                </FormField>
              </div>

              {movedBillCount > 0 && (
                <InfoNote aria-live="polite">
                  {t('followsNewDays', { count: movedBillCount })}
                </InfoNote>
              )}

              <FormRootError />
            </form>
          </FormProvider>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {target.kind === 'create'
              ? t('submitAdd')
              : tActions('saveChanges')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const AddCreditCardDialog: FC<AddCreditCardDialogProps> = ({
  onClose,
  onAdded
}) => {
  const { mutateAsync: createCard } = useCreateCreditCard();

  return (
    <CreditCardFormDialog
      target={{ kind: 'create' }}
      onCancel={onClose}
      onSubmit={async (card) => {
        const { data } = await createCard(card);

        onAdded?.(data.id);
        onClose();
      }}
    />
  );
};

const CardRow: FC<
  Record<'card', CreditCard> & Record<'onAction', (action: CardAction) => void>
> = ({ card, onAction }) => {
  const t = useTranslations('finances.cards');
  const tActions = useTranslations('common.actions');

  return (
    <li className="flex items-center gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        <CardLabel card={card} className="max-w-full text-sm font-medium" />

        <p className="text-sm text-muted-foreground">
          {t('cycle', { closingDay: card.closingDay, dueDay: card.dueDay })}

          {' · '}

          {t('openBills', { count: card.unpaidBillCount })}
        </p>
      </div>

      <div className="-mr-2 flex shrink-0 sm:-mr-1.5">
        <IconButton
          icon={Pencil}
          label={tActions('edit')}
          aria-label={t('manage.editNamed', { name: card.name })}
          onClick={() => onAction({ kind: 'edit', card })}
        />

        <IconButton
          icon={Trash2}
          variant="ghost-destructive"
          label={tActions('delete')}
          aria-label={t('manage.deleteNamed', { name: card.name })}
          onClick={() => onAction({ kind: 'delete', card })}
        />
      </div>
    </li>
  );
};

export const CreditCardsDialog: FC<Record<'onClose', VoidFunction>> = ({
  onClose
}) => {
  const t = useTranslations('finances.cards');
  const tActions = useTranslations('common.actions');
  const [action, setAction] = useState<CardAction>({ kind: 'list' });
  const cardsQuery = useCreditCards();

  const { mutateAsync: updateCard } = useUpdateCreditCard();
  const { mutateAsync: deleteCard } = useDeleteCreditCard();

  const cards = cardsQuery.data;
  const backToList = () => setAction({ kind: 'list' });

  return (
    <>
      <Dialog open={action.kind === 'list'} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('manage.title')}</DialogTitle>

            <DialogDescription>{t('manage.description')}</DialogDescription>
          </DialogHeader>

          <DialogBody>
            {cards === undefined && cardsQuery.isError && (
              <ErrorState
                message={t('manage.loadFailed')}
                onRetry={() => void cardsQuery.refetch()}
              />
            )}

            {cards === undefined && !cardsQuery.isError && (
              <LoadingState label={t('manage.loading')} className="h-40" />
            )}

            {cards?.length === 0 && (
              <EmptyState icon={CreditCardIcon} message={t('manage.empty')} />
            )}

            {cards !== undefined && cards.length > 0 && (
              <ul className="divide-y">
                {cards.map((card) => (
                  <CardRow key={card.id} card={card} onAction={setAction} />
                ))}
              </ul>
            )}
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              {tActions('close')}
            </Button>

            <Button
              className="gap-1.5"
              onClick={() => setAction({ kind: 'add' })}
            >
              <Plus size={16} aria-hidden="true" />

              {t('manage.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogPresence>
        {action.kind === 'add' && (
          <AddCreditCardDialog key="add" onClose={backToList} />
        )}

        {action.kind === 'edit' && (
          <CreditCardFormDialog
            key="edit"
            target={{ kind: 'edit', card: action.card }}
            onCancel={backToList}
            onSubmit={async (card) => {
              await updateCard({ ...card, id: action.card.id });
              backToList();
            }}
          />
        )}

        {action.kind === 'delete' && (
          <ConfirmDeletionDialog
            key="delete"
            title={t('delete.title', { name: action.card.name })}
            description={t('delete.description')}
            confirmLabel={t('delete.confirm')}
            failureMessage={t('delete.failed')}
            onCancel={backToList}
            onConfirm={async () => {
              await deleteCard({ id: action.card.id });
              backToList();
            }}
          />
        )}
      </DialogPresence>
    </>
  );
};
