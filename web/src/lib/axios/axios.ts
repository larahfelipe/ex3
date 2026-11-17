import axios, {
  isAxiosError,
  type AxiosError,
  type CreateAxiosDefaults
} from 'axios';

import { type ExpireSessionResponseData } from '@/app/api/v1/session';
import { CSRF_HEADER, signInRouteFor } from '@/common/constants';

import {
  ApiProxyError,
  UNEXPECTED_ERROR_MESSAGE,
  type ApiProxyErrorFields,
  type ApiServerErrorData
} from './errors';

const baseAxiosConfig: CreateAxiosDefaults = {
  headers: { 'Content-Type': 'application/json' },
  timeoutErrorMessage: 'Axios: Request timeout reached',
  timeout: 20_000
};

const THROTTLED_STATUS = 429;

const retryAfterSecondsOf = (retryAfter: unknown) => {
  if (typeof retryAfter !== 'string') return null;

  const seconds = Number(retryAfter);

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
};

const proxyApi = axios.create({
  ...baseAxiosConfig,
  headers: {
    ...baseAxiosConfig.headers,
    [CSRF_HEADER.Name]: CSRF_HEADER.Value
  },
  baseURL: '/api'
});

const serverApi = axios.create({
  ...baseAxiosConfig,
  baseURL: process.env.API_URL
});

const CREDENTIAL_ENDPOINTS: ReadonlySet<string> = new Set([
  '/v1/sign-in',
  '/v1/sign-up'
]);

/** Exempt from the 401 handling too, so expiring a session cannot recurse. */
const EXPIRE_SESSION_ENDPOINT = '/v1/session/expire';

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
    const error = new ApiProxyError(data.message, {
      ...data,
      status: err.response?.status,
      statusText: err.response?.statusText
    });

    if (err.response === undefined) error.code = err.code;

    return Promise.reject(error);
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
        error.retryAfterSeconds = retryAfterSecondsOf(headers?.['retry-after']);
    }
    logUpstreamFailure(err, error);
    return Promise.reject(error);
  }
);

const api = {
  getInstance: () => (typeof window !== 'undefined' ? proxyApi : serverApi)
};

export default api;
