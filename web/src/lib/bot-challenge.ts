import { BOT_CHALLENGE } from '@/common/constants';

export class BotChallengeError extends Error {
  readonly reason: 'failed' | 'unavailable';

  constructor(reason: BotChallengeError['reason']) {
    super(`Bot challenge ${reason}`);
    this.reason = reason;
  }
}

export type ChallengedRequest<Payload> = {
  payload: Payload;
  challengeToken: string | null;
};

export const botChallengeHeaders = (
  challengeToken: string | null
): Record<string, string> =>
  challengeToken === null ? {} : { [BOT_CHALLENGE.Header]: challengeToken };

export const botChallengeSiteKey = () => {
  const siteKey = process.env.TURNSTILE_SITE_KEY?.trim();

  if (siteKey) return siteKey;

  if (process.env.NODE_ENV === 'production')
    console.error(JSON.stringify({ event: 'bot_challenge.site_key_missing' }));

  return undefined;
};
