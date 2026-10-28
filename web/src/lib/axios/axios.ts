import axios, {
  type AxiosError,
  type CreateAxiosDefaults,
  isAxiosError
} from 'axios';

import { type ExpireSessionResponseData } from '@/app/api/v1/session';
import { signInRouteFor } from '@/common/constants';

import type { ApiProxyErrorFields, ApiServerErrorData } from './errors';
import { ApiProxyError, UNEXPECTED_ERROR_MESSAGE } from './errors';

const baseAxiosConfig: CreateAxiosDefaults = {
  headers: { 'Content-Type': 'application/json' },
  timeoutErrorMessage: 'Axios: Request timeout reached',
  timeout: 20_000
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

/** Exempt from the 401 handling too, so expiring a session cannot recurse. */
const EXPIRE_SESSION_ENDPOINT = '/v1/session/expire';

/**
 * Concurrent requests that fail with 401 share one expiry, so the rejected
 * token is dropped once and the user is redirected once. The expiry notice is
 * shown only when the user did not end the session themselves: a request still
 * in flight after a sign-out, here or in another tab, fails with 401 too.
 */
let pendingSessionExpiry: Promise<void> | null = null;

proxyApi.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<ApiProxyErrorFields>) => {
    const endpoint = err.config?.url ?? '';
    const isSessionRejection =
      err.response?.status === 401 &&
      !CREDENTIAL_ENDPOINTS.has(endpoint) &&
      endpoint !== EXPIRE_SESSION_ENDPOINT;

    if (isSessionRejection) {
      pendingSessionExpiry ??= proxyApi
        .post<ExpireSessionResponseData>(EXPIRE_SESSION_ENDPOINT)
        .then(({ data }) => {
          window.location.href = signInRouteFor({
            returnPath: `${window.location.pathname}${window.location.search}`,
            hasSessionExpired: data.hasSessionExpired
          });
        })
        .finally(() => {
          pendingSessionExpiry = null;
        });

      await pendingSessionExpiry;
    }
    const data = err.response?.data ?? { message: UNEXPECTED_ERROR_MESSAGE };

    return Promise.reject(
      new ApiProxyError(data.message, {
        ...data,
        status: err.response?.status,
        statusText: err.response?.statusText
      })
    );
  }
);

/**
 * The AxiosError holds the request config, and with it the caller's bearer
 * token, so the log is built field by field instead of from the error itself.
 */
const logUpstreamFailure = (err: unknown, error: ApiProxyError) => {
  const request = isAxiosError(err) ? err.config : undefined;

  console.error(
    JSON.stringify({
      event: 'api.upstream_request_failed',
      method: request?.method?.toUpperCase(),
      url: request?.url,
      status: error.status,
      code: error._error?.code,
      message: error.message
    })
  );
};

const THROTTLED_STATUS = 429;
const SECONDS_PER_MINUTE = 60;

/** The API's message says only "later"; its `Retry-After`, in seconds, says when. */
const throttledMessageFor = (retryAfter: unknown) => {
  if (typeof retryAfter !== 'string') return null;

  const seconds = Number(retryAfter);

  if (!Number.isFinite(seconds) || seconds <= 0) return null;

  const minutes = Math.ceil(seconds / SECONDS_PER_MINUTE);

  return `Too many requests. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
};

serverApi.interceptors.response.use(
  (res) => res,
  (err) => {
    const error = new ApiProxyError(UNEXPECTED_ERROR_MESSAGE);
    if (isAxiosError<ApiServerErrorData>(err)) {
      const { data, statusText, status, headers } = err.response ?? {};
      if (data) error._error = data;
      if (data?.message) error.message = data.message;
      if (statusText) error.statusText = statusText;
      if (status) error.status = status;
      if (status === THROTTLED_STATUS)
        error.message =
          throttledMessageFor(headers?.['retry-after']) ?? error.message;
    }
    logUpstreamFailure(err, error);
    return Promise.reject(error);
  }
);

const api = {
  getInstance: () => (typeof window !== 'undefined' ? proxyApi : serverApi)
};

export default api;
