import axios, {
  type AxiosError,
  type CreateAxiosDefaults,
  isAxiosError
} from 'axios';
import { toast } from 'sonner';

import { type SignOutResponseData } from '@/app/api/v1/sign-out';
import { APP_ROUTES } from '@/common/constants';

import type { ApiServerErrorData, IApiProxyError } from './errors';
import { ApiProxyError } from './errors';

const baseAxiosConfig: CreateAxiosDefaults = {
  headers: { 'Content-Type': 'application/json' },
  timeoutErrorMessage: 'Axios: Request timeout reached',
  timeout: 20_000 // 20s,
};

const proxyApi = axios.create({
  ...baseAxiosConfig,
  baseURL: '/api'
});

const serverApi = axios.create({
  ...baseAxiosConfig,
  baseURL: process.env.API_URL
});

/**
 * A 401 from these endpoints means the submitted credentials were rejected, not
 * that a session expired, so it must reach the form instead of signing out.
 */
const CREDENTIAL_ENDPOINTS: ReadonlySet<string> = new Set([
  '/v1/sign-in',
  '/v1/sign-up'
]);

/** Exempt from the 401 handling too, so ending a session cannot recurse. */
const SIGN_OUT_ENDPOINT = '/v1/sign-out';

/**
 * Concurrent requests that fail with 401 share one sign-out, so the session is
 * ended once and the user sees a single toast and redirect.
 */
let pendingSignOut: Promise<void> | null = null;

proxyApi.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<IApiProxyError>) => {
    const endpoint = err.config?.url ?? '';
    const isSessionRejection =
      err.response?.status === 401 &&
      !CREDENTIAL_ENDPOINTS.has(endpoint) &&
      endpoint !== SIGN_OUT_ENDPOINT;

    if (isSessionRejection) {
      pendingSignOut ??= proxyApi
        .post<SignOutResponseData>(SIGN_OUT_ENDPOINT)
        .then(({ data }) => {
          if (!data?.success) return;
          toast.error('Session expired. Please, log in again');
          window.location.href = APP_ROUTES.Public.SignIn;
        })
        .finally(() => {
          pendingSignOut = null;
        });

      await pendingSignOut;
    }
    const error = err.response?.data ?? {
      message: 'Something went wrong. Please try again later'
    };
    return Promise.reject(new ApiProxyError(error.message, error));
  }
);

serverApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    const error = new ApiProxyError(
      'Something went wrong. Please try again later'
    );
    if (isAxiosError<ApiServerErrorData>(err)) {
      const { data, statusText, status } = err.response ?? {};
      if (data) error._error = data;
      if (data?.message) error.message = data.message;
      if (statusText) error.statusText = statusText;
      if (status) error.status = status;
    }
    return Promise.reject(error);
  }
);

const api = {
  getInstance: () => (typeof window !== 'undefined' ? proxyApi : serverApi)
};

export default api;
