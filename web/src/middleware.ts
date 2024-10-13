import { cookies } from 'next/headers';
import {
  NextResponse,
  type MiddlewareConfig,
  type NextRequest
} from 'next/server';

import { APP_ROUTES, APP_STORAGE_KEYS } from './common/constants';

export const middleware = async ({ url, nextUrl }: NextRequest) => {
  const { pathname } = nextUrl;

  const authToken = cookies().get(APP_STORAGE_KEYS.Token)?.value;
  const isAuth = !!authToken;

  const isPubRoute =
    pathname.startsWith(APP_ROUTES.Public.SignIn) ||
    pathname.startsWith(APP_ROUTES.Public.SignUp);

  if (!isPubRoute && !isAuth)
    return NextResponse.redirect(new URL(APP_ROUTES.Public.SignIn, url));

  if (isPubRoute && isAuth)
    return NextResponse.redirect(new URL(APP_ROUTES.Protected.Assets, url));

  return NextResponse.next();
};

export const config: MiddlewareConfig = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.ico$|.*\\.gif$|sitemap.xml|robots.txt).*)'
  ]
};
