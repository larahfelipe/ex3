import type { ErrorCategory } from '@/config/Constants';

export class ApplicationError extends Error {
  readonly status: number;
  readonly code: ErrorCategory;
  readonly details: ReadonlyArray<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    code: ErrorCategory,
    details: ApplicationError['details'] = []
  ) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
