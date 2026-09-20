import { envs } from '@/config/Envs';

export const LogSeverities = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
} as const;

export type LogSeverity = (typeof LogSeverities)[keyof typeof LogSeverities];

/**
 * Every line the service writes is one of these events. The discriminator is
 * what a log query groups by, so a new kind of line is a new member here, never
 * a free-form message.
 */
export type LogEvent =
  | { event: 'server_started'; port: number }
  | { event: 'database_connected' }
  | { event: 'database_unreachable'; reason: string }
  | { event: 'quote_provider_key_missing' }
  | { event: 'quote_provider_unavailable'; reason: string; retryInMs: number }
  | { event: 'dependency_unavailable'; dependency: 'database'; reason: string }
  | {
      event: 'http_request';
      requestId: string;
      method: string;
      route: string;
      status: number;
      durationMs: number;
      userId?: string;
      errorCode?: string;
    }
  | {
      event: 'request_failed';
      requestId?: string;
      errorName: string;
      errorMessage: string;
      stack?: string;
    };

export type LogEntry = LogEvent & { severity: LogSeverity };

export type LogSink = (entry: LogEntry) => void;

const CLIENT_ERROR_FLOOR = 400;
const SERVER_ERROR_FLOOR = 500;

export const severityOfStatus = (status: number): LogSeverity => {
  if (status >= SERVER_ERROR_FLOOR) return LogSeverities.ERROR;

  return status >= CLIENT_ERROR_FLOOR
    ? LogSeverities.WARNING
    : LogSeverities.INFO;
};

/**
 * One JSON object per line: `JSON.stringify` escapes the newlines and control
 * characters that request data can carry, so no input can forge a second entry.
 */
export const formatLogEntry = (entry: LogEntry, occurredAt: Date) =>
  JSON.stringify({ timestamp: occurredAt.toISOString(), ...entry });

/** The suite's output is the test runner's; a server line in it reports nothing. */
const isSilenced = envs.nodeEnv === 'test';

export const log: LogSink = (entry) => {
  if (isSilenced) return;

  const line = `${formatLogEntry(entry, new Date())}\n`;

  if (entry.severity === LogSeverities.ERROR) process.stderr.write(line);
  else process.stdout.write(line);
};
