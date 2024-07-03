import type { Metadata } from 'next';

import type { Children } from '@/types';

export const metadata: Metadata = {
  title: 'EX3 | Assets'
};

export default function Layout({ children }: Readonly<Children>) {
  return children;
}
