'use client';

import { useReducer } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

import { createTransaction } from '@/api/create-transaction';
import type { Asset } from '@/api/get-assets';
import { TRANSACTION_TYPES } from '@/common/constants';
import { AssetsTable, type ActionType } from '@/components/assets-table';
import {
  AddAssetTransactionDialog,
  AddAssetTransactionSchema,
  type AddAssetTransactionSchemaType
} from '@/components/dialogs';
import type { Maybe } from '@/types';

type DialogContext<TRef, TData = unknown> = {
  ref: TRef;
  data?: TData;
};

type ReducerState = {
  open: boolean;
  context: Maybe<DialogContext<ActionType, Asset>>;
};

type ReducerAction = {
  type: ActionType;
  payload?: Asset;
};

const initialState: ReducerState = {
  open: false,
  context: null
};

const reducer = (state: ReducerState, action: ReducerAction): ReducerState => {
  if (!action?.payload && action.type === 'delete') return initialState;

  return {
    ...state,
    open: true,
    context: {
      ref: action.type,
      data: action.payload
    }
  };
};

export default function Dashboard() {
  const [dialog, dispatch] = useReducer(reducer, initialState);

  const addAssetTransactionFormMethods = useForm<AddAssetTransactionSchemaType>(
    {
      mode: 'onBlur',
      resolver: zodResolver(AddAssetTransactionSchema),
      defaultValues: {
        type: TRANSACTION_TYPES[0],
        amount: 0,
        price: 0
      }
    }
  );

  const { mutateAsync: createAssetTransaction } = useMutation({
    mutationFn: createTransaction,
    onSuccess: ({ data }) => toast.success(data.message),
    onError: (e: string) => toast.error(e)
  });

  const handleAction = (type: ActionType, payload?: Asset) =>
    dispatch({ type, payload });

  const handleCloseDialog = () => dispatch({ type: 'delete' });

  return (
    <>
      {dialog?.context?.ref === 'add-transaction' && (
        <FormProvider {...addAssetTransactionFormMethods}>
          <AddAssetTransactionDialog
            open={dialog.open}
            data={dialog.context.data as Asset}
            onCancel={handleCloseDialog}
            onConfirm={createAssetTransaction}
          />
        </FormProvider>
      )}

      <div className="mt-12 sm:mx-4">
        <AssetsTable onAction={handleAction} />
      </div>
    </>
  );
}
