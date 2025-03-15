import { cookies } from 'next/headers';
import {
  NextResponse,
  type MiddlewareConfig,
  type NextRequest
} from 'next/server';

import { APP_ROUTES, APP_STORAGE_KEYS } from './common/constants';

const isPubRoute = (pathname: string) =>
  pathname.startsWith(APP_ROUTES.Public.SignIn) ||
  pathname.startsWith(APP_ROUTES.Public.SignUp);

export const middleware = async (req: NextRequest) => {
  const token = cookies().get(APP_STORAGE_KEYS.Token)?.value;
  const isAuthenticated = !!token;

  const { pathname } = req.nextUrl;

  if (!isPubRoute(pathname) && !isAuthenticated)
    return NextResponse.redirect(new URL(APP_ROUTES.Public.SignIn, req.url));

  if (isPubRoute(pathname) && isAuthenticated)
    return NextResponse.redirect(new URL(APP_ROUTES.Protected.Assets, req.url));

  return NextResponse.next();
};

export const config: MiddlewareConfig = {
  matcher: [
    '/((?!api|_next/static|_next/image|.*\\.png$|.*\\.svg$|.*\\.jpg$|.*\\.jpeg$|.*\\.ico$|.*\\.gif$|sitemap.xml|robots.txt).*)'
  ]
};
