'use client';

import { useState, type FC, type ReactNode } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import {
  ChartCandlestick,
  ChevronLeft,
  CircleUserRound,
  Languages,
  LayoutDashboard,
  Loader2,
  LogOut,
  ReceiptText,
  Wallet
} from 'lucide-react';
import { useTranslations } from 'use-intl';

import {
  APP_ROUTES,
  APP_STORAGE_KEYS,
  APP_TITLE,
  NAVIGATION_STATES,
  PREFERENCE_MAX_AGE_SECONDS
} from '@/common/constants';
import { LanguageSelect } from '@/components/language-select';
import { useFinanceAlerts } from '@/hooks/use-finances';
import { useCurrentUser, useSignOut } from '@/hooks/use-user';
import { LOCALE_SHORT_NAMES } from '@/i18n/config';
import { cn } from '@/lib/utils';

type NavigationState =
  (typeof NAVIGATION_STATES)[keyof typeof NAVIGATION_STATES];

type NavigationSection = Record<'path', string> &
  Record<'name', SectionName> &
  Record<'icon', ReactNode>;

type SectionName =
  'overview' | 'assets' | 'portfolios' | 'finances' | 'account';

type NavigationLinkProps = NavigationSection &
  Record<'isActive', boolean> &
  Partial<Record<'detail', string>> &
  Partial<Record<'alertCount', number>>;

type SidebarProps = Record<'initialState', NavigationState>;

const PORTFOLIO_SECTIONS: Array<NavigationSection> = [
  {
    name: 'overview',
    path: APP_ROUTES.Protected.Overview,
    icon: <LayoutDashboard size={18} />
  },
  {
    name: 'assets',
    path: APP_ROUTES.Protected.Assets,
    icon: <ChartCandlestick size={18} />
  },
  {
    name: 'portfolios',
    path: APP_ROUTES.Protected.Portfolios,
    icon: <Wallet size={18} />
  }
];

/** Cash flow, kept apart from the investment sections it never mixes with. */
const FINANCE_SECTION: NavigationSection = {
  name: 'finances',
  path: APP_ROUTES.Protected.Finances,
  icon: <ReceiptText size={18} />
};

/** Past this, the badge reads "99+": the exact count is on the finance overview. */
const ALERT_BADGE_MAX = 99;

const ACCOUNT_SECTION: NavigationSection = {
  name: 'account',
  path: APP_ROUTES.Protected.Account,
  icon: <CircleUserRound size={18} />
};

/** WCAG 2.5.5 asks for a 44px target, above the default button height. */
const NAVIGATION_ITEM_CLASS =
  'group/item relative flex min-h-11 w-full min-w-11 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-[0.6875rem] font-medium text-muted-foreground outline-hidden ring-offset-background transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 aria-disabled:pointer-events-none aria-disabled:opacity-50 motion-safe:active:scale-95 aria-[current=page]:text-foreground sm:py-2 navigation-expanded:flex-row navigation-expanded:justify-start navigation-expanded:gap-3 navigation-expanded:px-3 navigation-expanded:text-sm navigation-expanded:hover:bg-accent navigation-expanded:aria-[current=page]:bg-accent';

const NAVIGATION_ICON_CLASS =
  'flex h-7 w-12 shrink-0 items-center justify-center rounded-full transition-colors group-hover/item:bg-accent group-aria-[current=page]/item:bg-primary/15 group-aria-[current=page]/item:text-primary navigation-expanded:h-auto navigation-expanded:w-auto navigation-expanded:bg-transparent navigation-expanded:group-hover/item:bg-transparent navigation-expanded:group-aria-[current=page]/item:bg-transparent';

/**
 * The toggle sits on the rail's border, centred on the brand's line: 24 px
 * drawn, with a 44 px target (WCAG 2.5.5) from the pseudo-element around it.
 */
const NAVIGATION_TOGGLE_CLASS =
  'absolute top-3.5 right-0 z-10 hidden size-6 translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-surface ring-offset-background transition-colors before:absolute before:-inset-2.5 hover:border-input hover:bg-accent hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-safe:active:scale-90 lg:flex';

const isCurrentPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

const NavigationLink: FC<NavigationLinkProps> = ({
  name,
  path,
  icon,
  detail,
  alertCount,
  isActive
}) => {
  const t = useTranslations('navigation');

  return (
    <Link
      href={path}
      aria-current={isActive ? 'page' : undefined}
      className={NAVIGATION_ITEM_CLASS}
    >
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-y-2 left-0 hidden w-1 rounded-full bg-primary navigation-expanded:block"
        />
      )}

      <span
        aria-hidden="true"
        className={cn(NAVIGATION_ICON_CLASS, 'relative')}
      >
        {icon}

        {alertCount !== undefined && alertCount > 0 && (
          <span className="absolute -top-1 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-negative px-1 text-[0.625rem] leading-none font-semibold text-negative-foreground navigation-expanded:-top-2 navigation-expanded:-right-2.5">
            {alertCount > ALERT_BADGE_MAX ? `${ALERT_BADGE_MAX}+` : alertCount}
          </span>
        )}
      </span>

      <span className="flex max-w-full min-w-0 flex-col items-center navigation-expanded:items-start">
        <span className="max-w-full truncate">
          {t(name)}

          {alertCount !== undefined && alertCount > 0 && (
            <span className="sr-only">
              {t('overdueCount', { count: alertCount })}
            </span>
          )}
        </span>

        {detail !== undefined && (
          <span className="hidden max-w-full truncate text-xs font-normal text-muted-foreground navigation-expanded:block">
            {detail}
          </span>
        )}
      </span>
    </Link>
  );
};

export const Sidebar: FC<SidebarProps> = ({ initialState }) => {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const tLanguage = useTranslations('common.language');

  const [navigationState, setNavigationState] = useState(initialState);

  const { mutate: signOut, isPending: isSigningOut } = useSignOut();
  const { data: user } = useCurrentUser();
  // A badge that fails to load is left out: the finance pages show the same count with their own error state.
  const { data: financeAlerts } = useFinanceAlerts();

  const isExpanded = navigationState === NAVIGATION_STATES.Expanded;
  const toggleLabel = isExpanded ? t('collapse') : t('expand');

  const toggleNavigation = () => {
    const nextState = isExpanded
      ? NAVIGATION_STATES.Collapsed
      : NAVIGATION_STATES.Expanded;

    setNavigationState(nextState);
    document.cookie = `${APP_STORAGE_KEYS.Navigation}=${nextState}; path=/; max-age=${PREFERENCE_MAX_AGE_SECONDS}; samesite=lax`;
  };

  return (
    <nav
      aria-label={t('main')}
      data-navigation-state={navigationState}
      className="fixed inset-x-0 bottom-0 z-40 flex h-(--navigation-bar) border-t bg-background px-1 sm:sticky sm:inset-auto sm:top-0 sm:h-dvh sm:w-(--navigation-rail) sm:shrink-0 sm:self-start sm:border-t-0 sm:border-r sm:px-0 sm:transition-[width,border-color] lg:has-[>button:hover]:border-input navigation-expanded:w-(--navigation-sidebar)"
    >
      <button
        type="button"
        className={NAVIGATION_TOGGLE_CLASS}
        aria-label={toggleLabel}
        title={toggleLabel}
        onClick={toggleNavigation}
      >
        <ChevronLeft
          size={14}
          aria-hidden="true"
          className={cn(
            'motion-safe:transition-transform',
            !isExpanded && 'rotate-180'
          )}
        />
      </button>

      <div className="contents sm:flex sm:min-h-0 sm:flex-1 sm:flex-col sm:overflow-y-auto sm:px-2 sm:py-3 navigation-expanded:px-3">
        <div className="hidden sm:flex sm:justify-center navigation-expanded:justify-start navigation-expanded:pl-3">
          <p className="font-display text-lg font-bold">{APP_TITLE}</p>
        </div>

        <ul className="flex flex-3 sm:mt-6 sm:flex-none sm:flex-col sm:gap-1">
          {PORTFOLIO_SECTIONS.map((section) => (
            <li key={section.path} className="flex flex-1">
              <NavigationLink
                {...section}
                isActive={isCurrentPath(pathname, section.path)}
              />
            </li>
          ))}
        </ul>

        <ul className="flex flex-1 sm:mt-3 sm:flex-none sm:flex-col sm:gap-1 sm:border-t sm:pt-3">
          <li className="flex flex-1">
            <NavigationLink
              {...FINANCE_SECTION}
              alertCount={financeAlerts?.overdue.count}
              isActive={isCurrentPath(pathname, FINANCE_SECTION.path)}
            />
          </li>
        </ul>

        <ul className="flex flex-1 sm:mt-auto sm:flex-none sm:flex-col sm:gap-1 sm:border-t sm:pt-3">
          <li className="flex flex-1">
            <NavigationLink
              {...ACCOUNT_SECTION}
              detail={user?.name ?? undefined}
              isActive={isCurrentPath(pathname, ACCOUNT_SECTION.path)}
            />
          </li>

          <li className="flex flex-1 max-sm:hidden">
            <LanguageSelect
              side="right"
              align="end"
              renderTrigger={({ locale, isPending }) => (
                <button
                  type="button"
                  aria-label={tLanguage('label')}
                  className={cn(
                    NAVIGATION_ITEM_CLASS,
                    'data-[state=open]:text-foreground navigation-expanded:data-[state=open]:bg-accent'
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      NAVIGATION_ICON_CLASS,
                      'group-data-[state=open]/item:bg-accent navigation-expanded:group-data-[state=open]/item:bg-transparent'
                    )}
                  >
                    {isPending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Languages size={18} />
                    )}
                  </span>

                  <span className="flex max-w-full min-w-0 flex-col items-center navigation-expanded:items-start">
                    <span aria-hidden="true" className="max-w-full truncate">
                      {tLanguage('label')}
                    </span>

                    {/* The control's value: read out on the rail, shown once expanded. */}
                    <span
                      lang={locale}
                      className="sr-only max-w-full text-xs font-normal text-muted-foreground navigation-expanded:not-sr-only"
                    >
                      <span className="block truncate">
                        {LOCALE_SHORT_NAMES[locale]}
                      </span>
                    </span>
                  </span>
                </button>
              )}
            />
          </li>

          <li className="flex flex-1 max-sm:hidden">
            <button
              type="button"
              aria-disabled={isSigningOut}
              className={cn(
                NAVIGATION_ITEM_CLASS,
                'hover:text-negative navigation-expanded:hover:bg-negative/10'
              )}
              onClick={() => {
                if (!isSigningOut) signOut();
              }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  NAVIGATION_ICON_CLASS,
                  'group-hover/item:bg-negative/10'
                )}
              >
                {isSigningOut ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <LogOut size={18} />
                )}
              </span>

              <span className="max-w-full truncate">{t('signOut')}</span>
            </button>
          </li>
        </ul>
      </div>
    </nav>
  );
};
