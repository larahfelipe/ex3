export class ApplicationError {
  readonly message: string;
  readonly status: number;
  readonly name: string;

  constructor(message: string, status = 500, name = 'ApplicationError') {
    this.message = message;
    this.status = status;
    this.name = name;
  }
}
