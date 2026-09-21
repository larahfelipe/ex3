import { useId, type FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { CURRENCIES } from '@/common/constants';
import { FormField } from '@/components/form-field';
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
import { ApiProxyError, UNEXPECTED_ERROR_MESSAGE } from '@/lib/axios';

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
  const currencyHintId = useId();
  const currencyErrorId = useId();

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
    mode: 'onTouched',
    resolver: zodResolver(PortfolioFormSchema),
    defaultValues
  });

  const currencyError = errors.baseCurrency?.message;
  const currencyDescriptionIds = [
    ...(isEditing ? [currencyHintId] : []),
    ...(currencyError !== undefined ? [currencyErrorId] : [])
  ];

  const presentSubmitError = (error: unknown) => {
    const issues =
      error instanceof ApiProxyError ? (error._error?.details ?? []) : [];
    const unplacedMessages: Array<string> = [];
    let hasFieldIssue = false;

    for (const { path, message } of issues) {
      if (!isPortfolioFormField(path)) {
        unplacedMessages.push(message);
        continue;
      }

      setError(
        path,
        { type: 'server', message },
        { shouldFocus: !hasFieldIssue }
      );
      hasFieldIssue = true;
    }

    if (unplacedMessages.length > 0)
      setError('root.server', {
        type: 'server',
        message: unplacedMessages.join(', ')
      });
    else if (!hasFieldIssue)
      setError('root.server', {
        type: 'server',
        message:
          error instanceof Error ? error.message : UNEXPECTED_ERROR_MESSAGE
      });
  };

  const submitDraft = async (draft: PortfolioDraft) => {
    try {
      await onSubmit(draft);
    } catch (error) {
      presentSubmitError(error);
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
          <fieldset disabled={isSubmitting} className="grid gap-4">
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

            <fieldset
              aria-describedby={
                currencyDescriptionIds.length > 0
                  ? currencyDescriptionIds.join(' ')
                  : undefined
              }
            >
              <legend className="mb-1.5 text-sm font-medium leading-none">
                Base currency
              </legend>

              <div className="grid grid-cols-3 rounded-md border p-0.5 sm:flex sm:w-fit">
                {currencyOptions.map((currency) => (
                  <label key={currency} className="cursor-pointer">
                    <input
                      type="radio"
                      value={currency}
                      className="peer sr-only"
                      {...register('baseCurrency')}
                    />

                    <span className="block rounded-sm px-3 py-1 text-center text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2">
                      {currency}
                    </span>
                  </label>
                ))}
              </div>

              {isEditing && (
                <p
                  id={currencyHintId}
                  className="mt-1.5 text-sm text-muted-foreground"
                >
                  The base currency can change only while the portfolio has no
                  transactions.
                </p>
              )}

              {currencyError !== undefined && (
                <p
                  id={currencyErrorId}
                  className="mt-1.5 text-sm text-negative"
                >
                  {currencyError}
                </p>
              )}
            </fieldset>

            {errors.root?.server?.message !== undefined && (
              <p role="alert" className="text-sm text-negative">
                {errors.root.server.message}
              </p>
            )}
          </fieldset>
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <Button
            type="submit"
            form={formId}
            className="gap-2"
            disabled={isSubmitting || (isEditing && !isDirty)}
          >
            {isSubmitting && (
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
            )}

            <span>{isEditing ? 'Save changes' : 'Create portfolio'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
