'use client';

import { useEffect, useState, type CSSProperties, type FC } from 'react';

import { useFormatter, useTranslations } from 'use-intl';

import { srOnly } from '@/i18n/rich-text';
import {
  hasPasswordMinLength,
  isDerivedFromEmail,
  PASSWORD_MIN_CODE_POINTS
} from '@/lib/account-schema';
import { METER_FADE_SPRING_CSS, METER_FILL_SPRING_CSS } from '@/lib/motion';
import { cn } from '@/lib/utils';

type PasswordStrengthProps = {
  password: string;
  email?: string;
};

const STRENGTH_LEVELS = ['empty', 'weak', 'fair', 'good', 'strong'] as const;

type StrengthLevel = (typeof STRENGTH_LEVELS)[number];

const MAX_SCORE = STRENGTH_LEVELS.length - 1;

const METER_CELLS = Array.from({ length: MAX_SCORE }, (_, cell) => cell);

const LONG_PASSWORD_CODE_POINTS = 12;
const VERY_LONG_PASSWORD_CODE_POINTS = 16;
const VARIED_CHARACTER_CLASSES = 3;

const COMMON_START =
  /^(?:password|passw0rd|p@ssw0rd|qwerty|letmein|welcome|admin|iloveyou|monkey|dragon|abc123|123123|senha|minhasenha|mudar|123mudar|brasil|flamengo|corinthians|palmeiras)/i;
const REPEATED_RUN = /(.)\1{3,}/u;
const SEQUENCE =
  /(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210|abcd|bcde|cdef|defg|qwer|wert|erty|asdf|1q2w|1qaz)/i;
const CHARACTER_CLASSES = [
  /\p{Ll}/u,
  /\p{Lu}/u,
  /\p{Nd}/u,
  /[^\p{Ll}\p{Lu}\p{Nd}]/u
];

const STRENGTH_TONES: Record<StrengthLevel, Record<'bar' | 'text', string>> = {
  empty: { bar: 'bg-muted-foreground', text: 'text-muted-foreground' },
  weak: { bar: 'bg-negative', text: 'text-negative' },
  fair: { bar: 'bg-warning', text: 'text-warning' },
  good: { bar: 'bg-positive', text: 'text-positive' },
  strong: { bar: 'bg-positive', text: 'text-positive' }
};

const CELL_STAGGER_MS = 30;

const ANNOUNCE_DELAY_MS = 700;

const springTransitionOf = (
  { duration, easing }: Record<'duration' | 'easing', string>,
  properties: string
): CSSProperties => ({
  transitionProperty: properties,
  transitionDuration: duration,
  transitionTimingFunction: easing
});

const CELL_TRANSITION = springTransitionOf(
  METER_FILL_SPRING_CSS,
  'scale, background-color'
);
const LEVEL_TRANSITION = springTransitionOf(
  METER_FADE_SPRING_CSS,
  'opacity, color'
);
const FADE_TRANSITION = springTransitionOf(METER_FADE_SPRING_CSS, 'opacity');
const CHECK_TRANSITION = springTransitionOf(
  METER_FILL_SPRING_CSS,
  'opacity, scale'
);

export const passwordStrengthOf = (password: string, email = '') => {
  const requirements = [
    { key: 'minLength', isMet: hasPasswordMinLength(password) },
    {
      key: 'notEmail',
      isMet: password.length > 0 && !isDerivedFromEmail(password, email)
    }
  ] as const;
  const isGuessable =
    password.length > 0 &&
    [COMMON_START, REPEATED_RUN, SEQUENCE].some((pattern) =>
      pattern.test(password)
    );

  const levelOf = (): StrengthLevel => {
    if (password.length === 0) return 'empty';
    if (isGuessable || requirements.some(({ isMet }) => !isMet)) return 'weak';

    const length = [...password].length;
    const classCount = CHARACTER_CLASSES.filter((pattern) =>
      pattern.test(password)
    ).length;
    const steps = [
      length >= LONG_PASSWORD_CODE_POINTS,
      length >= VERY_LONG_PASSWORD_CODE_POINTS,
      classCount >= VARIED_CHARACTER_CLASSES
    ].filter(Boolean).length;

    if (steps >= 2) return 'strong';

    return steps === 1 ? 'good' : 'fair';
  };

  const level = levelOf();

  return {
    level,
    score: STRENGTH_LEVELS.indexOf(level),
    requirements,
    isGuessable
  };
};

type PasswordStrengthEstimate = ReturnType<typeof passwordStrengthOf>;

const useRequirementLabels = () => {
  const t = useTranslations('auth.passwordStrength');

  return {
    minLength: t('minLength', { min: PASSWORD_MIN_CODE_POINTS }),
    notEmail: t('notEmail')
  };
};

export const usePasswordStrengthAnnouncement = ({
  level,
  requirements,
  isGuessable
}: PasswordStrengthEstimate) => {
  const t = useTranslations('auth.passwordStrength');
  const format = useFormatter();
  const requirementLabels = useRequirementLabels();

  if (level === 'empty') return '';

  const unmetLabels = requirements
    .filter(({ isMet }) => !isMet)
    .map(({ key }) => requirementLabels[key]);

  return [
    t('announcement.level', { level: t(`levels.${level}`) }),
    ...(isGuessable ? [t('announcement.guessable')] : []),
    unmetLabels.length === 0
      ? t('announcement.allMet')
      : t('announcement.missing', { requirements: format.list(unmetLabels) })
  ].join(' ');
};

export const PasswordStrength: FC<PasswordStrengthProps> = ({
  password,
  email
}) => {
  const t = useTranslations('auth.passwordStrength');
  const requirementLabels = useRequirementLabels();
  const estimate = passwordStrengthOf(password, email);
  const { level, score, requirements, isGuessable } = estimate;
  const tone = STRENGTH_TONES[level];
  const announcement = usePasswordStrengthAnnouncement(estimate);

  const [announced, setAnnounced] = useState('');

  useEffect(() => {
    if (announcement === announced) return;

    const timeout = setTimeout(
      () => setAnnounced(announcement),
      ANNOUNCE_DELAY_MS
    );

    return () => clearTimeout(timeout);
  }, [announcement, announced]);

  return (
    <>
      <div
        role="meter"
        aria-label={t('label')}
        aria-valuemin={0}
        aria-valuemax={MAX_SCORE}
        aria-valuenow={score}
        aria-valuetext={t(`levels.${level}`)}
        className="flex gap-1.5 pt-1"
      >
        {METER_CELLS.map((cell) => {
          const isFilled = cell < score;

          return (
            <span
              key={cell}
              className="relative h-1.5 flex-1 overflow-hidden rounded-[2px] bg-muted"
            >
              <span
                className={cn(
                  'absolute inset-0 origin-left motion-safe:delay-(--fill-delay)',
                  isFilled ? 'scale-x-100' : 'scale-x-0',
                  tone.bar
                )}
                style={
                  {
                    ...CELL_TRANSITION,
                    '--fill-delay': `${isFilled ? cell * CELL_STAGGER_MS : 0}ms`
                  } as CSSProperties
                }
              />
            </span>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        className="mt-2 flex items-center justify-between gap-3 text-xs font-medium"
      >
        <span className="inline-grid">
          {STRENGTH_LEVELS.map((candidate) => (
            <span
              key={candidate}
              className={cn(
                'col-start-1 row-start-1 whitespace-nowrap',
                candidate === level ? 'opacity-100' : 'opacity-0',
                tone.text
              )}
              style={LEVEL_TRANSITION}
            >
              {t(`levels.${candidate}`)}
            </span>
          ))}
        </span>

        <span
          className={cn(
            'whitespace-nowrap text-warning',
            isGuessable ? 'opacity-100' : 'opacity-0'
          )}
          style={FADE_TRANSITION}
        >
          {t('guessable')}
        </span>
      </div>

      <ul className="mt-3 space-y-1.5">
        {requirements.map(({ key, isMet }) => (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="relative grid size-3.5 shrink-0 place-items-center rounded-[4px] border border-input text-positive-foreground"
            >
              <span
                className={cn(
                  'absolute -inset-px rounded-[4px] bg-positive',
                  isMet ? 'opacity-100' : 'opacity-0'
                )}
                style={FADE_TRANSITION}
              />

              <svg
                viewBox="0 0 12 12"
                fill="none"
                className={cn(
                  'relative size-2.25',
                  isMet ? 'scale-100 opacity-100' : 'scale-60 opacity-0'
                )}
                style={CHECK_TRANSITION}
              >
                <path
                  d="M2 6.2 4.7 8.9 10 3.3"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>

            <span
              className={cn(
                'transition-colors duration-200',
                isMet && 'text-foreground'
              )}
            >
              {t.rich('item', {
                status: isMet ? 'met' : 'notMet',
                requirement: requirementLabels[key],
                hidden: srOnly
              })}
            </span>
          </li>
        ))}
      </ul>

      <p aria-live="polite" className="sr-only">
        {announced}
      </p>
    </>
  );
};
