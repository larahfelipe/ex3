import type { ReactNode } from 'react';

import type { UseMutateAsyncFunction } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

export type WithId = Record<'id', string>;

export type Children = Record<'children', ReactNode>;

export type Maybe<T> = T | null | undefined;

export type MutationAsync<
  TPayload,
  TSuccess,
  TError = string
> = UseMutateAsyncFunction<AxiosResponse<TSuccess>, TError, TPayload>;
