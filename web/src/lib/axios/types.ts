export type ServerErrorData = {
  name: string;
  message: string;
};

export type WithStatusHeader = {
  status: number;
  statusText: string;
};

export type ApiErrorData = {
  _error: ServerErrorData | null;
  message: string;
};

export interface ApiError extends WithStatusHeader, ApiErrorData {}
