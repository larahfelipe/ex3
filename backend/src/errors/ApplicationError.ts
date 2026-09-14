export class ApplicationError {
  readonly message: string;
  readonly status: number;
  readonly code: string;
  readonly details: ReadonlyArray<{ path: string; message: string }>;

  constructor(
    message: string,
    status: number,
    code: string,
    details: ApplicationError['details'] = []
  ) {
    this.message = message;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
