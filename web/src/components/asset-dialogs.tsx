import type { FC } from 'react';

import type { Portfolio } from '@/app/api/v1/portfolios';
import { AddAssetDialog } from '@/components/add-asset-dialog';
import { ConfirmDeletionDialog } from '@/components/confirm-deletion-dialog';
import { TransactionFormDialog } from '@/components/transaction-form-dialog';
import { useCreateAsset, useDeleteAsset } from '@/hooks/use-assets';
import { useCreateTransaction } from '@/hooks/use-transactions';
import type { Maybe } from '@/types';

export type AssetDialog =
  | Record<'kind', 'add-asset'>
  | (Record<'kind', 'add-transaction' | 'delete-asset'> &
      Record<'symbol', string>);

type AssetDialogsProps = Record<'portfolio', Portfolio> &
  Record<'dialog', Maybe<AssetDialog>> &
  Record<'onDialogChange', (dialog: Maybe<AssetDialog>) => void> &
  Partial<Record<'onAssetDeleted', VoidFunction>>;

/**
 * Only page state holds the open dialog: the router's search params trail a
 * `replaceState` by a render, so a dialog also mirrored in the URL reopens as
 * the user closes it.
 */
export const AssetDialogs: FC<AssetDialogsProps> = ({
  portfolio,
  dialog,
  onDialogChange,
  onAssetDeleted
}) => {
  const closeDialog = () => onDialogChange(null);

  const { mutateAsync: createAsset } = useCreateAsset(portfolio, (symbol) =>
    onDialogChange({ kind: 'add-transaction', symbol })
  );
  const { mutateAsync: createTransaction } = useCreateTransaction(portfolio);
  const { mutateAsync: deleteAsset } = useDeleteAsset(portfolio);

  switch (dialog?.kind) {
    case 'add-asset':
      return (
        <AddAssetDialog
          onCancel={closeDialog}
          onConfirm={async (addition) => {
            await createAsset(addition);
            closeDialog();
          }}
        />
      );

    case 'add-transaction':
      return (
        <TransactionFormDialog
          portfolio={portfolio}
          target={{
            kind: 'create',
            symbol: dialog.symbol,
            currency: portfolio.baseCurrency
          }}
          onCancel={closeDialog}
          onSubmit={async (draft) => {
            await createTransaction({ ...draft, assetSymbol: dialog.symbol });
            closeDialog();
          }}
        />
      );

    case 'delete-asset':
      return (
        <ConfirmDeletionDialog
          title={`Delete ${dialog.symbol}?`}
          description={`Every transaction of ${dialog.symbol} in ${portfolio.name} is deleted with it, and this cannot be undone.`}
          confirmLabel="Delete asset"
          failureMessage="The asset could not be deleted"
          onCancel={closeDialog}
          onConfirm={async () => {
            await deleteAsset({ symbol: dialog.symbol });
            onAssetDeleted?.();
            closeDialog();
          }}
        />
      );

    default:
      return null;
  }
};
