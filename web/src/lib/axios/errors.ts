import { AxiosError } from 'axios';

export type ApiServerErrorData = {
  code: string;
  message: string;
  details: Array<{ path: string; message: string }>;
};

export type WithStatusHeader = {
  status: number;
  statusText: string;
};

export type ApiProxyErrorData = {
  _error: ApiServerErrorData | null;
  message: string;
};

export interface IApiProxyError extends WithStatusHeader, ApiProxyErrorData {}

const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

export const isNotFoundError = ({
  _error
}: Pick<ApiProxyErrorData, '_error'>) => _error?.code === NOT_FOUND_ERROR_CODE;

export class ApiProxyError extends AxiosError implements IApiProxyError {
  _error: ApiServerErrorData | null = null;
  statusText: string = 'Internal Server Error';
  override status: number = 500;
  override message: string;

  constructor(message: string, init?: Partial<IApiProxyError>) {
    super(message);
    this.name = 'ApiProxyError';
    this.message = init?.message ?? message;
    this.statusText = init?.statusText ?? this.statusText;
    this.status = init?.status ?? this.status;
    this._error = init?._error ?? null;
  }
}
