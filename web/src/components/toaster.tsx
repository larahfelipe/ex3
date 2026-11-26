'use client';

import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type CSSProperties
} from 'react';

import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { Toaster as Sonner } from 'sonner';
import { useTranslations } from 'use-intl';

import { APP_THEME } from '@/common/constants';
import { TOAST_LIFETIME_MS, toastLifetimeOf } from '@/lib/toast-lifetime';

const FOCUS_RING_CLASSES =
  'focus-visible:outline-hidden! focus-visible:ring-2! focus-visible:ring-focus!';

const ACTION_BUTTON_CLASSES =
  'col-start-2! m-0! h-8! justify-self-start! rounded-md! bg-secondary! px-2.5! text-sm! font-medium! text-secondary-foreground! hover:bg-secondary/80!';

const CLOSE_BUTTON_CLASSES = 'size-6!';

const PHONE_LAYOUT_QUERY = '(width < 40rem)';

const TOP_OFFSET = {
  top: 'calc(env(safe-area-inset-top) + var(--navigation-header) + 0.5rem)'
};

const subscribeToPhoneLayout = (onChange: VoidFunction) => {
  const query = window.matchMedia(PHONE_LAYOUT_QUERY);

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
};

const isPhoneLayout = () => window.matchMedia(PHONE_LAYOUT_QUERY).matches;

const isPhoneLayoutOnServer = () => false;

export function Toaster() {
  const toasterRef = useRef<HTMLElement>(null);
  const t = useTranslations('common.toasts');
  const isPhone = useSyncExternalStore(
    subscribeToPhoneLayout,
    isPhoneLayout,
    isPhoneLayoutOnServer
  );

  useEffect(() => {
    const toaster = toasterRef.current;

    if (!toaster) return;

    const followDocumentVisibility = () => {
      toaster.toggleAttribute('data-document-hidden', document.hidden);
      toaster.getAnimations({ subtree: true });
    };

    followDocumentVisibility();
    document.addEventListener('visibilitychange', followDocumentVisibility);

    return () =>
      document.removeEventListener(
        'visibilitychange',
        followDocumentVisibility
      );
  }, []);

  return (
    <Sonner
      ref={toasterRef}
      position={isPhone ? 'top-center' : 'bottom-right'}
      offset={TOP_OFFSET}
      mobileOffset={TOP_OFFSET}
      theme={APP_THEME}
      closeButton
      containerAriaLabel={t('region')}
      icons={{
        error: (
          <CircleAlert aria-hidden="true" size={22} className="text-negative" />
        ),
        success: (
          <CircleCheck aria-hidden="true" size={22} className="text-positive" />
        ),
        warning: (
          <TriangleAlert
            aria-hidden="true"
            size={22}
            className="text-warning"
          />
        ),
        info: <Info aria-hidden="true" size={22} className="text-info" />
      }}
      style={
        {
          '--normal-bg': 'hsl(var(--surface-elevated))',
          '--normal-bg-hover': 'hsl(var(--accent))',
          '--normal-text': 'hsl(var(--surface-elevated-foreground))',
          '--normal-border': 'hsl(var(--border))',
          '--normal-border-hover': 'hsl(var(--border))',
          '--toast-close-button-start': 'unset',
          '--toast-close-button-end': '0',
          '--toast-close-button-transform': 'translate(35%, -35%)'
        } as CSSProperties
      }
      toastOptions={{
        ...toastLifetimeOf(TOAST_LIFETIME_MS),
        closeButtonAriaLabel: t('close'),
        classNames: {
          toast:
            'grid! grid-cols-[auto_minmax(0,1fr)]! items-start! gap-3! rounded-xl! shadow-elevated!',
          icon: 'size-[22px]!',
          title: 'text-sm font-medium',
          description: 'text-sm text-surface-elevated-foreground/80!',
          actionButton: `${ACTION_BUTTON_CLASSES} ${FOCUS_RING_CLASSES}`,
          closeButton: `${CLOSE_BUTTON_CLASSES} ${FOCUS_RING_CLASSES}`
        }
      }}
    />
  );
}
