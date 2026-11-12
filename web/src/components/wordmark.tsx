import type { FC } from 'react';

import { APP_TITLE } from '@/common/constants';
import { cn } from '@/lib/utils';

type WordmarkProps = Partial<Record<'className', string>>;

/** The brand in the display face. Its size, leading, tracking and colour come from where it is set. */
export const Wordmark: FC<WordmarkProps> = ({ className }) => (
  <span className={cn('font-display font-bold', className)}>{APP_TITLE}</span>
);
