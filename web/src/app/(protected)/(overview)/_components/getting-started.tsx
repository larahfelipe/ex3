import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FC,
  type ReactNode,
  type RefObject
} from 'react';

import Link from 'next/link';

import { Check, Plus, X } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { GetPortfolioPositionsResponseData } from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import { APP_ROUTES, APP_STORAGE_KEYS } from '@/common/constants';
import { SectionHeader } from '@/components/section-header';
import { Button, Card, CardContent } from '@/components/ui';
import { usePositions } from '@/hooks/use-portfolio';
import { APPEAR_CLASS } from '@/lib/motion';
import { FIRST_PAGE } from '@/lib/pagination';
import { cn } from '@/lib/utils';
import type { Maybe } from '@/types';

type GettingStartedProps = Record<'portfolio', Portfolio> &
  Partial<Record<'isComplete' | 'isLeaving', boolean>> &
  Record<'onAddAsset' | 'onDismiss', VoidFunction> &
  Record<'onRecordTransaction', (symbol: string) => void>;

type GettingStartedStepsProps = Pick<
  GettingStartedProps,
  'portfolio' | 'onAddAsset' | 'onRecordTransaction'
> &
  Record<'isComplete' | 'isSettled', boolean> &
  Record<'assets', GetPortfolioPositionsResponseData | undefined>;

type StepStatus = 'done' | 'current' | 'upcoming';

type GettingStartedStepProps = Record<'number', number> &
  Record<'title' | 'description', string> &
  Record<'status', StepStatus> &
  Record<'cascade', number> &
  Partial<Record<'isLast', boolean>> &
  Partial<Record<'action', ReactNode>>;

export type GettingStartedStage =
  'hidden' | 'open' | 'complete' | 'leaving' | 'revealed';

type GettingStartedProgress = Record<'portfolioId', Maybe<string>> &
  Record<'stage', GettingStartedStage>;

const FIRST_ASSETS = { page: FIRST_PAGE, pageSize: 1 };

/** Time to see every step done before the overview takes the guide's place. */
const COMPLETION_HOLD_MS = 1600;

/** The leaving card's `duration-200`. */
const LEAVE_MS = 200;

/** Between one step settling and the next, so steps done together read in order. */
const STEP_CASCADE_MS = 150;

const LEAVE_CLASS =
  'animate-out fade-out-0 fill-mode-forwards duration-200 ease-in motion-reduce:animate-none';

const MARKER_CLASSES: Readonly<Record<StepStatus, string>> = {
  done: 'border-positive/40 bg-positive/10 text-positive',
  current: 'border-primary/50 bg-primary/10 text-primary',
  upcoming: 'text-muted-foreground'
};

const dismissalSubscribers = new Set<VoidFunction>();

/** Hides the guide for the rest of the visit when the browser blocks storage. */
let isDismissedForVisit = false;

const readIsDismissed = () => {
  if (isDismissedForVisit) return true;

  try {
    return (
      localStorage.getItem(APP_STORAGE_KEYS.GettingStartedDismissed) !== null
    );
  } catch {
    return false;
  }
};

const subscribeToDismissal = (onChange: VoidFunction) => {
  const onStorageChange = ({ key }: StorageEvent) => {
    if (key === null || key === APP_STORAGE_KEYS.GettingStartedDismissed)
      onChange();
  };

  dismissalSubscribers.add(onChange);
  window.addEventListener('storage', onStorageChange);

  return () => {
    dismissalSubscribers.delete(onChange);
    window.removeEventListener('storage', onStorageChange);
  };
};

/**
 * Whether the guide was hidden in this browser. It stays hidden for every
 * portfolio, since whoever hid it once knows the way; each section's empty
 * state still offers its next step.
 */
export const useGettingStartedDismissal = () => {
  const isDismissed = useSyncExternalStore(
    subscribeToDismissal,
    readIsDismissed,
    () => false
  );

  const dismiss = useCallback(() => {
    isDismissedForVisit = true;

    try {
      localStorage.setItem(APP_STORAGE_KEYS.GettingStartedDismissed, 'true');
    } catch {
      // Blocked storage leaves the dismissal to `isDismissedForVisit`.
    }

    dismissalSubscribers.forEach((notify) => notify());
  }, []);

  return [isDismissed, dismiss] as const;
};

/**
 * Opens while the portfolio has no transaction and completes when the first
 * one lands while it is open; a count still loading changes nothing.
 */
export const nextGettingStartedStage = (
  stage: GettingStartedStage,
  transactionCount: Maybe<number>
): GettingStartedStage => {
  if (typeof transactionCount !== 'number') return stage;

  if (transactionCount === 0) return 'open';

  return stage === 'open' ? 'complete' : stage;
};

/**
 * Where the Overview's guide stands for the active portfolio. Once the first
 * transaction lands, the guide stays a moment with every step done, fades out,
 * and the overview fades in, instead of one replacing the other at once. Focus
 * dropped by a step's action, or by the leaving guide, goes to `focusFallback`.
 */
export const useGettingStartedStage = (
  portfolioId: Maybe<string>,
  transactionCount: Maybe<number>,
  focusFallback: RefObject<HTMLElement | null>
) => {
  const [progress, setProgress] = useState<GettingStartedProgress>(() => ({
    portfolioId,
    stage: nextGettingStartedStage('hidden', transactionCount)
  }));
  const stage = nextGettingStartedStage(
    progress.portfolioId === portfolioId ? progress.stage : 'hidden',
    transactionCount
  );

  if (progress.portfolioId !== portfolioId || progress.stage !== stage)
    setProgress({ portfolioId, stage });

  useEffect(() => {
    if (stage !== 'complete' && stage !== 'leaving') return;

    const next = stage === 'complete' ? 'leaving' : 'revealed';
    const timeout = setTimeout(
      () =>
        setProgress((current) =>
          current.stage === stage ? { ...current, stage: next } : current
        ),
      stage === 'complete' ? COMPLETION_HOLD_MS : LEAVE_MS
    );

    return () => clearTimeout(timeout);
  }, [stage]);

  useEffect(() => {
    if (
      (stage === 'complete' || stage === 'revealed') &&
      document.activeElement === document.body
    )
      focusFallback.current?.focus();
  }, [stage, focusFallback]);

  return stage;
};

const StepCheck: FC<Record<'isDrawn', boolean>> = ({ isDrawn }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn(
      'col-start-1 row-start-1 size-4 transition-opacity duration-150 motion-safe:delay-(--step-delay)',
      isDrawn ? 'opacity-100' : 'opacity-0'
    )}
  >
    <path
      d="m4.5 12.5 5 5L20 7"
      pathLength={1}
      className={cn(
        '[stroke-dasharray:1] transition-[stroke-dashoffset] duration-300 ease-out motion-safe:delay-[calc(var(--step-delay)+100ms)]',
        isDrawn ? '[stroke-dashoffset:0]' : '[stroke-dashoffset:1]'
      )}
    />
  </svg>
);

/**
 * A step settles in place: its marker turns from the number to a drawn check,
 * the line to the next step fills, and the next step takes the accent. Colour,
 * opacity, scale and stroke change, never the size, so nothing around moves.
 * `cascade` staggers steps that change together.
 */
const GettingStartedStep: FC<GettingStartedStepProps> = ({
  number,
  title,
  description,
  status,
  cascade,
  isLast = false,
  action
}) => {
  const t = useTranslations('investments.overview.gettingStarted');
  const isDone = status === 'done';

  return (
    <li
      className="relative flex gap-3"
      style={
        { '--step-delay': `${cascade * STEP_CASCADE_MS}ms` } as CSSProperties
      }
    >
      {!isLast && (
        <span
          aria-hidden="true"
          className="absolute top-8 -bottom-4 left-3.5 w-px -translate-x-1/2 overflow-hidden rounded-full bg-border"
        >
          <span
            className={cn(
              'block size-full origin-top bg-positive/50 transition-[scale] duration-300 ease-out motion-safe:delay-[calc(var(--step-delay)+150ms)]',
              isDone ? 'scale-y-100' : 'scale-y-0'
            )}
          />
        </span>
      )}

      <span
        aria-hidden="true"
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold transition-colors duration-300 motion-safe:delay-(--step-delay)',
          MARKER_CLASSES[status]
        )}
      >
        <span
          className={cn(
            'col-start-1 row-start-1 transition-[opacity,scale] duration-200 motion-safe:delay-(--step-delay)',
            isDone ? 'scale-50 opacity-0' : 'scale-100 opacity-100'
          )}
        >
          {number}
        </span>

        <StepCheck isDrawn={isDone} />
      </span>

      <div className="min-w-0 space-y-1.5 pt-0.5">
        <p
          className={cn(
            'font-medium transition-colors duration-300 motion-safe:delay-(--step-delay)',
            isDone && 'text-muted-foreground'
          )}
        >
          {title}

          {isDone && <span className="sr-only"> ({t('done')})</span>}
        </p>

        <p className="text-sm text-muted-foreground">{description}</p>

        {action && <div className={APPEAR_CLASS}>{action}</div>}
      </div>
    </li>
  );
};

/**
 * Remounted once the first asset is known, so a portfolio that already holds
 * one shows its steps done instead of animating them; from then on, each step
 * the user completes animates. Focus lost with the action of the step just
 * done goes to the next step's action.
 */
const GettingStartedSteps: FC<GettingStartedStepsProps> = ({
  portfolio,
  assets,
  isComplete,
  isSettled,
  onAddAsset,
  onRecordTransaction
}) => {
  const t = useTranslations('investments.overview.gettingStarted');
  const recordButtonRef = useRef<HTMLButtonElement>(null);
  const firstAsset = assets?.items.at(0);
  const hasAsset = firstAsset !== undefined;
  const hadAsset = useRef(hasAsset);
  const doneCount = isComplete ? 3 : hasAsset ? 2 : 0;
  const cascadeStart = isComplete ? 2 : 0;

  useEffect(() => {
    if (
      hasAsset &&
      !hadAsset.current &&
      document.activeElement === document.body
    )
      recordButtonRef.current?.focus();

    hadAsset.current = hasAsset;
  }, [hasAsset]);

  const statusOf = (number: number): StepStatus => {
    if (!isSettled) return 'upcoming';

    if (number <= doneCount) return 'done';

    return number === doneCount + 1 ? 'current' : 'upcoming';
  };

  const stepProps = (number: number) => ({
    number,
    status: statusOf(number),
    cascade: Math.max(0, number - 1 - cascadeStart)
  });

  return (
    <ol aria-busy={!isSettled} className="space-y-5">
      <GettingStartedStep
        {...stepProps(1)}
        title={t('portfolio.title')}
        description={t('portfolio.description', {
          name: portfolio.name,
          currency: portfolio.baseCurrency
        })}
        action={
          isSettled &&
          !hasAsset && (
            <Button asChild variant="link" size="sm" className="px-0">
              <Link href={APP_ROUTES.Protected.Portfolios}>
                {t('portfolio.action')}
              </Link>
            </Button>
          )
        }
      />

      <GettingStartedStep
        {...stepProps(2)}
        title={t('addAsset.title')}
        description={t('addAsset.description')}
        action={
          isSettled &&
          !hasAsset && (
            <Button size="sm" className="gap-1.5" onClick={onAddAsset}>
              <Plus size={16} aria-hidden="true" />

              {t('addAsset.action')}
            </Button>
          )
        }
      />

      <GettingStartedStep
        {...stepProps(3)}
        title={t('recordTransaction.title')}
        description={t('recordTransaction.description')}
        action={
          isComplete ? (
            <p className="flex h-9 items-center gap-1.5 text-sm font-medium text-positive">
              <Check size={16} aria-hidden="true" />

              {t('recordTransaction.recorded')}
            </p>
          ) : (
            hasAsset && (
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  ref={recordButtonRef}
                  size="sm"
                  onClick={() => onRecordTransaction(firstAsset.symbol)}
                >
                  {t('recordTransaction.action', {
                    symbol: firstAsset.symbol
                  })}
                </Button>

                {assets !== undefined && assets.total > 1 && (
                  <Button asChild variant="link" size="sm" className="px-0">
                    <Link href={APP_ROUTES.Protected.Assets}>
                      {t('recordTransaction.otherAssets')}
                    </Link>
                  </Button>
                )}
              </div>
            )
          )
        }
      />

      <GettingStartedStep
        {...stepProps(4)}
        isLast
        title={t('follow.title')}
        description={t('follow.description')}
      />
    </ol>
  );
};

/**
 * Takes the place of the overview's sections while the portfolio has no
 * transaction, when every one of them would be empty: it says what fills them
 * and offers the next step. Once a transaction is recorded it shows every step
 * done and announces it, then leaves on its own; whoever needs no guide can
 * hide it.
 */
export const GettingStarted: FC<GettingStartedProps> = ({
  portfolio,
  isComplete = false,
  isLeaving = false,
  onAddAsset,
  onDismiss,
  onRecordTransaction
}) => {
  const headingId = useId();
  const t = useTranslations('investments.overview.gettingStarted');
  const { data: assets, isPending } = usePositions(portfolio, FIRST_ASSETS);

  return (
    <Card
      role="region"
      aria-labelledby={headingId}
      className={isLeaving ? LEAVE_CLASS : APPEAR_CLASS}
    >
      <SectionHeader
        id={headingId}
        title={t('title')}
        description={t('description')}
        action={
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={onDismiss}
          >
            <X size={16} aria-hidden="true" />

            {t('dismiss')}
          </Button>
        }
      />

      <CardContent>
        <p role="status" className="sr-only">
          {isComplete && t('complete')}
        </p>

        <GettingStartedSteps
          key={isPending ? 'pending' : 'settled'}
          portfolio={portfolio}
          assets={assets}
          isComplete={isComplete}
          isSettled={!isPending}
          onAddAsset={onAddAsset}
          onRecordTransaction={onRecordTransaction}
        />
      </CardContent>
    </Card>
  );
};
