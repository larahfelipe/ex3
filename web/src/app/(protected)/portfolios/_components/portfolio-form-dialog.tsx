import { useId, useMemo, useState, type FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { DEFAULT_CURRENCY, OFFERED_CURRENCIES } from '@/common/constants';
import { ChoiceField, FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import type { Translator } from '@/i18n/translator';
import { ApiProxyError, isConflictError } from '@/lib/axios';
import {
  PORTFOLIO_NAME_MAX_LENGTH,
  portfolioNameKey,
  portfolioNameSchemaFor
} from '@/lib/portfolio-schema';
import { presentSubmitError } from '@/lib/submit-error';

export type PortfolioFormTarget =
  { kind: 'create' } | { kind: 'edit'; portfolio: Portfolio };

export type PortfolioDraft = z.output<
  ReturnType<typeof portfolioFormSchemaFor>
>;

type PortfolioFormDialogProps = {
  target: PortfolioFormTarget;
  takenNames: ReadonlyArray<string>;
  onCancel: VoidFunction;
  onSubmit: (draft: PortfolioDraft) => Promise<unknown>;
};

type PortfolioFormInput = z.input<ReturnType<typeof portfolioFormSchemaFor>>;

type PortfolioFormField = keyof PortfolioFormInput;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const portfolioFormSchemaFor = (t: Translator<'validation'>) =>
  z.object({
    name: portfolioNameSchemaFor(t),
    baseCurrency: z
      .string()
      .regex(CURRENCY_CODE_PATTERN, t('currency.required'))
  });

const PORTFOLIO_FORM_FIELDS = [
  'name',
  'baseCurrency'
] as const satisfies ReadonlyArray<PortfolioFormField>;

const isPortfolioFormField = (path: string): path is PortfolioFormField =>
  PORTFOLIO_FORM_FIELDS.some((field) => field === path);

export const PortfolioFormDialog: FC<PortfolioFormDialogProps> = ({
  target,
  takenNames,
  onCancel,
  onSubmit
}) => {
  const formId = useId();
  const t = useTranslations('portfolios.form');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const portfolioFormSchema = useMemo(
    () => portfolioFormSchemaFor(tValidation),
    [tValidation]
  );
  const [rejectedNameKeys, setRejectedNameKeys] = useState<ReadonlySet<string>>(
    new Set()
  );

  const takenNameKeys = new Set([
    ...takenNames.map(portfolioNameKey),
    ...rejectedNameKeys
  ]);

  const isEditing = target.kind === 'edit';

  const defaultValues: PortfolioFormInput = isEditing
    ? {
        name: target.portfolio.name,
        baseCurrency: target.portfolio.baseCurrency
      }
    : { name: '', baseCurrency: DEFAULT_CURRENCY };

  const currencyOptions = [
    ...new Set([...OFFERED_CURRENCIES, defaultValues.baseCurrency])
  ];

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { errors, isDirty, isSubmitting }
  } = useForm<PortfolioFormInput, unknown, PortfolioDraft>({
    mode: 'onChange',
    /** `useForm` takes its options anew on every render, so validation always sees the latest taken names. */
    resolver: zodResolver(
      portfolioFormSchema.refine(
        ({ name }) => !takenNameKeys.has(portfolioNameKey(name)),
        { message: tValidation('portfolio.nameTaken'), path: ['name'] }
      )
    ),
    defaultValues
  });

  useRevalidateOnLocaleChange(errors, trigger);

  const submitDraft = async (draft: PortfolioDraft) => {
    try {
      await onSubmit(draft);
    } catch (error) {
      if (error instanceof ApiProxyError && isConflictError(error))
        setRejectedNameKeys(
          (keys) => new Set([...keys, portfolioNameKey(draft.name)])
        );

      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isPortfolioFormField(path) ? path : undefined),
        t: tErrors
      });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <DialogContent hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {isEditing
              ? t('editTitle', { name: target.portfolio.name })
              : t('newTitle')}
          </DialogTitle>

          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form id={formId} noValidate onSubmit={handleSubmit(submitDraft)}>
            <div className="grid gap-4">
              <FormField label={t('name')} error={errors.name?.message}>
                {(control) => (
                  <Input
                    {...control}
                    type="text"
                    autoComplete="off"
                    maxLength={PORTFOLIO_NAME_MAX_LENGTH}
                    {...register('name')}
                  />
                )}
              </FormField>

              <ChoiceField
                legend={t('baseCurrency')}
                hint={isEditing ? t('baseCurrencyLockedHint') : undefined}
                error={errors.baseCurrency?.message}
              >
                <SegmentedControl className="grid min-h-(--field-height) grid-cols-3 sm:flex sm:w-fit">
                  {currencyOptions.map((currency) => (
                    <SegmentedControlItem
                      key={currency}
                      value={currency}
                      {...register('baseCurrency')}
                    >
                      {currency}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </ChoiceField>

              {errors.root?.server?.message !== undefined && (
                <p role="alert" className="text-sm text-negative">
                  {errors.root.server.message}
                </p>
              )}
            </div>
          </form>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton
            form={formId}
            isPending={isSubmitting}
            disabled={isEditing && !isDirty}
          >
            {isEditing ? tActions('saveChanges') : t('create')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
