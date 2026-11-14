'use client';

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type FC,
  type Ref,
  type RefObject
} from 'react';

import { useLocale, useTranslations } from 'use-intl';

import { APP_THEME, type BotChallengeAction } from '@/common/constants';
import { BotChallengeError } from '@/lib/bot-challenge';
import { cn } from '@/lib/utils';
import { useNonce } from '@/providers/nonce-provider';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const FLEXIBLE_WIDGET_MIN_WIDTH = 300;

type TurnstileOptions = {
  sitekey: string;
  action: BotChallengeAction;
  execution: 'execute';
  appearance: 'interaction-only';
  retry: 'never';
  'response-field': false;
  size: 'flexible' | 'compact';
  theme: typeof APP_THEME;
  language: string;
  callback: (token: string) => void;
  'error-callback': () => boolean;
  'timeout-callback': () => void;
  'unsupported-callback': () => void;
  'before-interactive-callback': () => void;
  'after-interactive-callback': () => void;
};

type Turnstile = {
  render: (container: HTMLElement, options: TurnstileOptions) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

let turnstileLoad: Promise<Turnstile> | null = null;

/**
 * Loaded once per page, and only by a form that asks for it. Turnstile stamps
 * what it adds to the page with its own script's nonce. A failed load is
 * forgotten, so the next attempt tries again.
 */
const loadTurnstile = (nonce: string | undefined) =>
  (turnstileLoad ??= new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      script.remove();
      turnstileLoad = null;
      reject(new BotChallengeError('unavailable'));
    };

    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    if (nonce !== undefined) script.nonce = nonce;
    script.onload = () =>
      window.turnstile === undefined ? fail() : resolve(window.turnstile);
    script.onerror = fail;
    document.head.append(script);
  }));

type PendingSolve = {
  resolve: (token: string) => void;
  reject: (error: BotChallengeError) => void;
};

const settle = (
  pendingRef: RefObject<PendingSolve | null>,
  outcome: string | BotChallengeError
) => {
  const pending = pendingRef.current;

  pendingRef.current = null;
  if (typeof outcome === 'string') pending?.resolve(outcome);
  else pending?.reject(outcome);
};

export type BotChallengeHandle = {
  solve: () => Promise<string | null>;
  reset: () => void;
};

type BotChallengeProps = {
  siteKey: string | undefined;
  action: BotChallengeAction;
  ref: Ref<BotChallengeHandle>;
};

export const BotChallenge: FC<BotChallengeProps> = ({
  siteKey,
  action,
  ref
}) => {
  const t = useTranslations('auth.challenge');
  const locale = useLocale();
  const nonce = useNonce();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const pendingRef = useRef<PendingSolve | null>(null);
  const [isInteractive, setIsInteractive] = useState(false);

  useEffect(() => {
    if (siteKey === undefined) return;

    let isCurrent = true;
    let widgetId: string | null = null;

    loadTurnstile(nonce)
      .then((turnstile) => {
        const container = containerRef.current;

        if (!isCurrent || container === null) return;

        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          action,
          execution: 'execute',
          appearance: 'interaction-only',
          retry: 'never',
          'response-field': false,
          size:
            container.clientWidth < FLEXIBLE_WIDGET_MIN_WIDTH
              ? 'compact'
              : 'flexible',
          theme: APP_THEME,
          language: locale,
          callback: (token) => settle(pendingRef, token),
          'error-callback': () => {
            settle(pendingRef, new BotChallengeError('unavailable'));

            return true;
          },
          'timeout-callback': () =>
            settle(pendingRef, new BotChallengeError('failed')),
          'unsupported-callback': () =>
            settle(pendingRef, new BotChallengeError('unavailable')),
          'before-interactive-callback': () => setIsInteractive(true),
          'after-interactive-callback': () => setIsInteractive(false)
        });
        widgetIdRef.current = widgetId;
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
      widgetIdRef.current = null;
      settle(pendingRef, new BotChallengeError('unavailable'));
      setIsInteractive(false);
    };
  }, [siteKey, action, locale, nonce]);

  useImperativeHandle(
    ref,
    () => ({
      solve: async () => {
        if (siteKey === undefined) return null;

        const turnstile = await loadTurnstile(nonce);
        const widgetId = widgetIdRef.current;

        if (widgetId === null) throw new BotChallengeError('unavailable');

        settle(pendingRef, new BotChallengeError('failed'));

        return new Promise<string>((resolve, reject) => {
          pendingRef.current = { resolve, reject };
          turnstile.execute(widgetId);
        });
      },
      reset: () => {
        if (widgetIdRef.current !== null)
          window.turnstile?.reset(widgetIdRef.current);
        setIsInteractive(false);
      }
    }),
    [siteKey, nonce]
  );

  if (siteKey === undefined) return null;

  return (
    <div className={cn(isInteractive && 'mt-6 space-y-3')}>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {isInteractive ? t('prompt') : null}
      </p>

      <div ref={containerRef} />
    </div>
  );
};
