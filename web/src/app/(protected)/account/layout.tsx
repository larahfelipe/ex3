import type { Metadata } from 'next';

import type { Children } from '@/types';

export const metadata: Metadata = {
  title: 'EX3 | Account'
};

export default function Layout({ children }: Readonly<Children>) {
  return children;
}
