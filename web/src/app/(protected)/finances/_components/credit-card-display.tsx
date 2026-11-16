import type { FC } from 'react';

import { useTranslations } from 'use-intl';

import type { CardBrand, CreditCardSummary } from '@/app/api/v1/finances';
import { STATUS_TONES } from '@/common/constants';
import { srOnly } from '@/i18n/rich-text';
import { cn } from '@/lib/utils';

type CardBrandLogoProps = Record<'brand', CardBrand> &
  Partial<Record<'label' | 'className', string>>;

export type CardIdentity = Pick<
  CreditCardSummary,
  'name' | 'brand' | 'lastFourDigits'
> &
  Partial<Pick<CreditCardSummary, 'deletedAt'>>;

type CardLabelProps = Record<'card', CardIdentity> &
  Partial<Record<'className', string>>;

const VisaMark: FC = () => (
  <svg x="3" y="4.5" width="18" height="7" viewBox="-0.5 -1 43 15">
    <g fill="#1434CB" transform="translate(2.4 0) skewX(-10)">
      <path d="M0 0H3.4L5.9 9L8.4 0H11.8L7.6 13H4.2Z" />

      <path d="M12.8 0H16V13H12.8Z" />

      <path
        fillRule="evenodd"
        d="M27 13L31.6 0H35.4L40 13H36.6L35.8 10.5H31.2L30.4 13ZM32.1 7.8H34.9L33.5 3.6Z"
      />

      <path
        fill="none"
        stroke="#1434CB"
        strokeWidth="2.6"
        d="M25.9 2.6C24.9 1.5 23.4 1 21.9 1.2C19.6 1.5 18.8 3.3 19.9 4.8C21 6.3 25.3 6.6 25.6 9.2C25.9 11.6 23.6 12.4 21.6 12C20.1 11.7 19 11 18.3 10.1"
      />
    </g>
  </svg>
);

const MastercardMark: FC = () => (
  <>
    <circle cx="9.5" cy="8" r="5" fill="#EB001B" />

    <circle cx="14.5" cy="8" r="5" fill="#F79E1B" />

    <path d="M12 3.67A5 5 0 0 1 12 12.33A5 5 0 0 1 12 3.67Z" fill="#FF5F00" />
  </>
);

/**
 * A drawn mark in each network's colours, on the white chip both networks ask
 * for, so it reads the same on either theme. Without a label it is decoration
 * beside text that already names the brand.
 */
export const CardBrandLogo: FC<CardBrandLogoProps> = ({
  brand,
  label,
  className
}) => (
  <svg
    viewBox="0 0 24 16"
    role={label === undefined ? undefined : 'img'}
    aria-label={label}
    aria-hidden={label === undefined ? true : undefined}
    className={cn('h-4 w-6 shrink-0', className)}
  >
    <rect
      x="0.5"
      y="0.5"
      width="23"
      height="15"
      rx="2.5"
      className="fill-white stroke-border"
    />

    {brand === 'VISA' ? <VisaMark /> : <MastercardMark />}
  </svg>
);

/** The digits read as "ending in 1234": dots read aloud would be noise. */
export const CardDigits: FC<Record<'lastFourDigits', string>> = ({
  lastFourDigits
}) => {
  const t = useTranslations('finances.cards');

  return (
    <span className="shrink-0 text-muted-foreground tabular-nums">
      {t.rich('digits', {
        lastFour: lastFourDigits,
        mask: (chunks) => <span aria-hidden="true">{chunks}</span>,
        hidden: srOnly
      })}
    </span>
  );
};

export const CardLabel: FC<CardLabelProps> = ({ card, className }) => {
  const t = useTranslations('finances');

  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <CardBrandLogo brand={card.brand} label={t(`cardBrands.${card.brand}`)} />

      <span className="min-w-0 truncate">{card.name}</span>

      <CardDigits lastFourDigits={card.lastFourDigits} />

      {(card.deletedAt ?? null) !== null && (
        <span
          className={cn(
            'shrink-0 rounded-full border px-1.5 text-xs font-medium',
            STATUS_TONES.inactive
          )}
        >
          {t('cards.removed')}
        </span>
      )}
    </span>
  );
};
