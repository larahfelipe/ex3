import axios, { isAxiosError } from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    let msg = 'Something went wrong. Please try again later';

    // eslint-disable-next-line no-unsafe-optional-chaining
    if (isAxiosError(err) && 'message' in err.response?.data)
      msg = err.response?.data.message;

    return Promise.reject(msg);
  }
);
