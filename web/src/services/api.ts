import axios, { type AxiosError, type AxiosResponse } from 'axios';

import { UNKNOWN_ERROR_MESSAGE, envs } from '@/config';

export const api = axios.create({
  baseURL: envs.apiUrl
});

api.interceptors.response.use(
  (res: AxiosResponse<unknown>) => res,
  (err: AxiosError<unknown>) =>
    Promise.reject(err?.response?.data ?? UNKNOWN_ERROR_MESSAGE)
);
