import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { envs } from '@/config/Envs';
import { log, LogSeverities, type LogSink } from '@/infra/observability';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Cloudflare's bound on a token; anything longer was not issued by it. */
export const TURNSTILE_TOKEN_MAX_LENGTH = 2048;

/**
 * Assumed, not measured: siteverify answers in well under a second, and a
 * person waiting on the sign-in button should not wait on it for long.
 */
const VERIFY_TIMEOUT_MS = 5000;

/**
 * The codes that describe the token the caller sent. Every other code means
 * the request, the secret or Cloudflare failed, which the caller cannot fix.
 */
const CALLER_ERROR_CODES: ReadonlySet<string> = new Set([
  'missing-input-response',
  'invalid-input-response',
  'timeout-or-duplicate'
]);

const SiteverifyResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).default([]),
  hostname: z.string().optional(),
  action: z.string().optional()
});

export const ChallengeVerdicts = {
  PASSED: 'PASSED',
  REFUSED: 'REFUSED',
  UNAVAILABLE: 'UNAVAILABLE'
} as const;

export type ChallengeVerdict =
  (typeof ChallengeVerdicts)[keyof typeof ChallengeVerdicts];

const reasonOf = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

/**
 * Asks Cloudflare whether a Turnstile token was solved, for this site and for
 * this action, and not spent before: Cloudflare answers each token once. The
 * secret goes only in the body of requests to its fixed origin, and a redirect
 * is refused so it is never sent elsewhere. A verdict Cloudflare cannot give
 * is `UNAVAILABLE`, never `PASSED`.
 */
export class TurnstileVerifier {
  private static INSTANCE: TurnstileVerifier;
  private readonly secretKey: string | undefined;
  private readonly checksSolvedContext: boolean;
  private readonly expectedHostnames: ReadonlySet<string>;
  private readonly fetchResponse: typeof fetch;
  private readonly logEntry: LogSink;

  constructor({
    secretKey,
    checksSolvedContext,
    expectedHostnames,
    fetchResponse = (input, init) => fetch(input, init),
    logEntry = log
  }: TurnstileVerifier.Options) {
    this.secretKey = secretKey;
    this.checksSolvedContext = checksSolvedContext;
    this.expectedHostnames = new Set(expectedHostnames);
    this.fetchResponse = fetchResponse;
    this.logEntry = logEntry;
  }

  /**
   * Cloudflare's test secrets answer a fixed action and hostname, so those are
   * checked only against a real secret, the one production accepts. The widget
   * runs on the web, whose origins are the ones the API allows.
   */
  static getInstance() {
    if (!TurnstileVerifier.INSTANCE)
      TurnstileVerifier.INSTANCE = new TurnstileVerifier({
        secretKey: envs.turnstileSecretKey,
        checksSolvedContext: !envs.isTurnstileTestSecretKey,
        expectedHostnames: envs.corsAllowedOrigins.map(
          (origin) => new URL(origin).hostname
        )
      });

    return TurnstileVerifier.INSTANCE;
  }

  /** Without a secret, which production refuses to start without, nothing is verified. */
  get isEnforced() {
    return this.secretKey !== undefined;
  }

  async verify({
    token,
    action,
    remoteAddress
  }: TurnstileVerifier.Challenge): Promise<ChallengeVerdict> {
    if (this.secretKey === undefined)
      return this.unavailable('no secret key is configured');

    if (token.length === 0 || token.length > TURNSTILE_TOKEN_MAX_LENGTH)
      return ChallengeVerdicts.REFUSED;

    let response: Response;

    try {
      response = await this.fetchResponse(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: this.secretKey,
          response: token,
          remoteip: remoteAddress,
          idempotency_key: randomUUID()
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS)
      });
    } catch (error) {
      return this.unavailable(reasonOf(error));
    }

    if (!response.ok)
      return this.unavailable(`siteverify answered ${response.status}`);

    const parsed = SiteverifyResponseSchema.safeParse(
      await response.json().catch(() => undefined)
    );

    if (!parsed.success)
      return this.unavailable('siteverify answered an unexpected body');

    const { success, hostname, 'error-codes': errorCodes } = parsed.data;

    if (!success)
      return errorCodes.every((code) => CALLER_ERROR_CODES.has(code))
        ? ChallengeVerdicts.REFUSED
        : this.unavailable(`siteverify refused: ${errorCodes.join(', ')}`);

    const isSolvedHere =
      !this.checksSolvedContext ||
      (parsed.data.action === action &&
        (this.expectedHostnames.size === 0 ||
          (hostname !== undefined && this.expectedHostnames.has(hostname))));

    return isSolvedHere ? ChallengeVerdicts.PASSED : ChallengeVerdicts.REFUSED;
  }

  private unavailable(reason: string) {
    this.logEntry({
      severity: LogSeverities.ERROR,
      event: 'bot_challenge_unavailable',
      reason
    });

    return ChallengeVerdicts.UNAVAILABLE;
  }
}

export namespace TurnstileVerifier {
  export type Options = {
    secretKey: string | undefined;
    checksSolvedContext: boolean;
    /** Empty outside production, where no web origin is required: then any. */
    expectedHostnames: ReadonlyArray<string>;
    fetchResponse?: typeof fetch;
    logEntry?: LogSink;
  };

  export type Challenge = {
    token: string;
    action: string;
    remoteAddress: string;
  };
}
