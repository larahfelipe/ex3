import type { ComponentProps, FC } from 'react';

import { CircleAlert, TriangleAlert } from 'lucide-react';

import { cn } from '@/lib/utils';

type AuthNoticeProps = ComponentProps<'p'> &
  Record<'tone', 'negative' | 'warning'>;

const TONE_CLASSES = {
  negative: 'border-negative/30 bg-negative/10 text-negative',
  warning: 'border-warning/30 bg-warning/10 text-warning'
} as const;

const TONE_ICONS = {
  negative: CircleAlert,
  warning: TriangleAlert
} as const;

export const AuthNotice: FC<AuthNoticeProps> = ({
  tone,
  className,
  children,
  ...props
}) => {
  const Icon = TONE_ICONS[tone];

  return (
    <p
      className={cn(
        'flex items-start gap-2 rounded-xl border p-3 text-sm',
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />

      {children}
    </p>
  );
};
