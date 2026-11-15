import type { FC } from 'react';

import { APP_TITLE } from '@/common/constants';
import { cn } from '@/lib/utils';

type WordmarkProps = Partial<Record<'className', string>>;

export const Wordmark: FC<WordmarkProps> = ({ className }) => (
  <span className={cn('font-display font-bold', className)}>{APP_TITLE}</span>
);
