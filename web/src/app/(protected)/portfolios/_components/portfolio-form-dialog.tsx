import { useId, type FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { CURRENCIES } from '@/common/constants';
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
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { presentSubmitError } from '@/lib/submit-error';

export type PortfolioFormTarget =
  { kind: 'create' } | { kind: 'edit'; portfolio: Portfolio };

export type PortfolioDraft = z.output<typeof PortfolioFormSchema>;

type PortfolioFormDialogProps = {
  target: PortfolioFormTarget;
  onCancel: VoidFunction;
  onSubmit: (draft: PortfolioDraft) => Promise<unknown>;
};

type PortfolioFormInput = z.input<typeof PortfolioFormSchema>;

type PortfolioFormField = keyof PortfolioFormInput;

/** Mirrors `CreatePortfolioSchema` in the API. */
const NAME_MAX_LENGTH = 60;

const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const OFFERED_CURRENCIES = Object.values(CURRENCIES).map(({ id }) => id);

const DEFAULT_CURRENCY = CURRENCIES.BRL.id;

const PortfolioFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(
      NAME_MAX_LENGTH,
      `Name must have at most ${NAME_MAX_LENGTH} characters`
    ),
  baseCurrency: z
    .string()
    .regex(CURRENCY_CODE_PATTERN, 'Choose the base currency')
});

const PORTFOLIO_FORM_FIELDS = PortfolioFormSchema.keyof().options;

const isPortfolioFormField = (path: string): path is PortfolioFormField =>
  PORTFOLIO_FORM_FIELDS.some((field) => field === path);

export const PortfolioFormDialog: FC<PortfolioFormDialogProps> = ({
  target,
  onCancel,
  onSubmit
}) => {
  const formId = useId();

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
    formState: { errors, isDirty, isSubmitting }
  } = useForm<PortfolioFormInput, unknown, PortfolioDraft>({
    mode: 'onChange',
    resolver: zodResolver(PortfolioFormSchema),
    defaultValues
  });

  const submitDraft = async (draft: PortfolioDraft) => {
    try {
      await onSubmit(draft);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isPortfolioFormField(path) ? path : undefined)
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {isEditing ? `Edit ${target.portfolio.name}` : 'New portfolio'}
          </DialogTitle>

          <DialogDescription>
            Positions and transactions of a portfolio are valued in its base
            currency.
          </DialogDescription>
        </DialogHeader>

        <form id={formId} noValidate onSubmit={handleSubmit(submitDraft)}>
          <div className="grid gap-4">
            <FormField label="Name" error={errors.name?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  autoComplete="off"
                  maxLength={NAME_MAX_LENGTH}
                  {...register('name')}
                />
              )}
            </FormField>

            <ChoiceField
              legend="Base currency"
              hint={
                isEditing
                  ? 'The base currency can change only while the portfolio has no transactions.'
                  : undefined
              }
              error={errors.baseCurrency?.message}
            >
              <SegmentedControl className="grid grid-cols-3 sm:flex sm:w-fit">
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

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton
            form={formId}
            isPending={isSubmitting}
            disabled={isEditing && !isDirty}
          >
            {isEditing ? 'Save changes' : 'Create portfolio'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
