import type { ReactNode } from 'react';

import type { UseMutateAsyncFunction } from '@tanstack/react-query';
import type { AxiosResponse } from 'axios';

export type WithId = Record<'id', string>;

export type WithMessage = Record<'message', string>;

export type Children = Record<'children', ReactNode>;

export type Maybe<T> = T | null | undefined;

export type MutationAsync<
  TPayload,
  TSuccess,
  TError = string
> = UseMutateAsyncFunction<AxiosResponse<TSuccess>, TError, TPayload>;

type SizeType = 'px' | 'rem' | 'em' | '%';

export type Size = `${number}${SizeType}`;

export type TailwindColorsIntensity =
  | 50
  | 100
  | 200
  | 300
  | 400
  | 500
  | 600
  | 700
  | 800
  | 900
  | 950;

export type TailwindColorsName =
  | 'slate'
  | 'gray'
  | 'zinc'
  | 'neutral'
  | 'stone'
  | 'red'
  | 'amber'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'emerald'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'violet'
  | 'purple'
  | 'fuchsia'
  | 'pink'
  | 'rose';

export type TailwindColors = `${TailwindColorsName}-${TailwindColorsIntensity}`;
