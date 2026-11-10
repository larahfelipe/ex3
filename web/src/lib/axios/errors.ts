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

/**
 * `message` is technical, for logs: the interface words an error from its
 * `_error`, its status and `retryAfterSeconds` (see `apiErrorMessageOf`).
 */
export type ApiProxyErrorData = {
  _error: ApiServerErrorData | null;
  message: string;
  /** From a throttled answer's `Retry-After`; null when it named no delay. */
  retryAfterSeconds?: number | null;
};

export type ApiProxyErrorFields = WithStatusHeader & ApiProxyErrorData;

/** The technical message of an error that carries no other; it never reaches the interface. */
export const UNEXPECTED_ERROR_MESSAGE = 'Unexpected error';

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
  retryAfterSeconds: number | null = null;
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
    this.retryAfterSeconds = init?.retryAfterSeconds ?? null;
  }
}
