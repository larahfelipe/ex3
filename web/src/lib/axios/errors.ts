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

export type ApiProxyErrorFields = WithStatusHeader & ApiProxyErrorData;

export const UNEXPECTED_ERROR_MESSAGE =
  'Something went wrong. Please try again later';

const VALIDATION_ERROR_CODE = 'VALIDATION';

const NOT_FOUND_ERROR_CODE = 'NOT_FOUND';

const CONFLICT_ERROR_CODE = 'CONFLICT';

const DOMAIN_ERROR_CODE = 'DOMAIN';

export const isValidationError = ({
  _error
}: Pick<ApiProxyErrorData, '_error'>) => _error?.code === VALIDATION_ERROR_CODE;

export const isNotFoundError = ({
  _error
}: Pick<ApiProxyErrorData, '_error'>) => _error?.code === NOT_FOUND_ERROR_CODE;

export const isConflictError = ({
  _error
}: Pick<ApiProxyErrorData, '_error'>) => _error?.code === CONFLICT_ERROR_CODE;

export const isDomainError = ({ _error }: Pick<ApiProxyErrorData, '_error'>) =>
  _error?.code === DOMAIN_ERROR_CODE;

export class ApiProxyError extends AxiosError implements ApiProxyErrorFields {
  _error: ApiServerErrorData | null = null;
  statusText: string = 'Internal Server Error';
  override status: number = 500;
  override message: string;

  constructor(message: string, init?: Partial<ApiProxyErrorFields>) {
    super(message);
    this.name = 'ApiProxyError';
    this.message = init?.message ?? message;
    this.statusText = init?.statusText ?? this.statusText;
    this.status = init?.status ?? this.status;
    this._error = init?._error ?? null;
  }
}
