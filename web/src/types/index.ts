import type { ReactNode } from 'react';

export type WithId = Record<'id', string>;

export type WithMessage = Record<'message', string>;

export type WithTimestamps = Record<'createdAt' | 'updatedAt', string>;

export type Children = Readonly<Record<'children', ReactNode>>;

export type Maybe<T> = T | null | undefined;

export type DecimalString = `${number}`;

export type Pagination = Record<
  'page' | 'limit' | 'total' | 'totalPages',
  number
>;

export type PageParams = Partial<Record<'page' | 'pageSize', number>>;

export type Page<Item> = Record<
  'page' | 'pageSize' | 'total' | 'totalPages',
  number
> &
  Record<'items', Array<Item>>;
