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

proxyApi.interceptors.response.use(
  (res) => res,
  async (err: AxiosError<IApiProxyError>) => {
    if (err.response?.status === 401) {
      const { data } = await proxyApi.post<SignOutResponseData>('/sign-out');
      if (data?.success) {
        toast.error('Session expired. Please, log in again');
        window.location.href = APP_ROUTES.Public.SignIn;
      }
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
