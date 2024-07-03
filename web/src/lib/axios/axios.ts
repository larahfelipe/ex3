import axios, {
  type AxiosError,
  type AxiosResponse,
  type CreateAxiosDefaults,
  isAxiosError
} from 'axios';

import type { ApiError, ServerErrorData } from './types';

const axiosConfig: CreateAxiosDefaults = {
  headers: { 'Content-Type': 'application/json' },
  timeoutErrorMessage: 'Axios: Request timeout reached',
  timeout: 20_000, // 20s,
  baseURL: typeof window === 'undefined' ? process.env.API_URL : '/api'
};

export const client = axios.create(axiosConfig);

export const server = axios.create(axiosConfig);

client.interceptors.response.use(
  (res) => res,
  (err: AxiosError<Error>) => Promise.reject<Error>(err.response!.data)
);

server.interceptors.response.use(
  (res) => res,
  (err) => {
    const error: ApiError = {
      _error: null,
      status: 500,
      statusText: 'Internal Server Error',
      message: 'Something went wrong. Please try again later'
    };

    if (isAxiosError(err)) {
      const { data, statusText, status } =
        (err.response as AxiosResponse<ServerErrorData>) ?? {};
      error._error = data;
      error.message = data.message;
      error.statusText = statusText;
      error.status = status;
    }

    return Promise.reject<Error>(new Error(JSON.stringify(error)));
  }
);
