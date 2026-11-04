import { BOT_CHALLENGE } from '@/common/constants';

/**
 * A challenge the visitor did not solve, such as one left unanswered, is
 * `failed`; one the browser could not run, such as when Cloudflare cannot be
 * reached, is `unavailable`. Both match what the API answers in either case.
 */
export class BotChallengeError extends Error {
  readonly reason: 'failed' | 'unavailable';

  constructor(reason: BotChallengeError['reason']) {
    super(`Bot challenge ${reason}`);
    this.reason = reason;
  }
}

/** A form's payload and the token solved for it, null where no challenge is configured. */
export type ChallengedRequest<Payload> = {
  payload: Payload;
  challengeToken: string | null;
};

export const botChallengeHeaders = (
  challengeToken: string | null
): Record<string, string> =>
  challengeToken === null ? {} : { [BOT_CHALLENGE.Header]: challengeToken };

/**
 * Read by the sign-in and sign-up pages as they render, so the site key is set
 * where the web runs rather than built into it. Production cannot sign anyone
 * in or up without one, since the API refuses every unsolved request there, so
 * its absence is logged as the failure it is.
 */
export const botChallengeSiteKey = () => {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();

  if (siteKey) return siteKey;

  if (process.env.NODE_ENV === 'production')
    console.error(JSON.stringify({ event: 'bot_challenge.site_key_missing' }));

  return undefined;
};
