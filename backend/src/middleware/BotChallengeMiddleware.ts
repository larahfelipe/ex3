import type { RequestHandler } from 'express';

import { BotChallenge, UserMessages } from '@/config/Constants';
import { AuthorizationError, UnavailableError } from '@/errors';
import { ChallengeVerdicts, TurnstileVerifier } from '@/infra/bot-challenge';

import { clientAddressOf } from './RateLimitMiddleware';

type BotChallengeAction = Exclude<
  (typeof BotChallenge)[keyof typeof BotChallenge],
  typeof BotChallenge.HEADER
>;

/**
 * Lets the request through only once Cloudflare confirms the token the web
 * forwarded was solved for `action`. A token Cloudflare refuses is answered
 * 403; a verdict it cannot give is answered 503, never skipped. It runs after
 * the per-address budgets, which count its refusals, and before the
 * per-account ones, so a caller without a solved challenge cannot spend the
 * sign-in budget of someone else's account.
 */
export const botChallengeMiddleware =
  (action: BotChallengeAction): RequestHandler =>
  async (req, _res, next) => {
    const verifier = TurnstileVerifier.getInstance();

    if (!verifier.isEnforced) {
      next();
      return;
    }

    const verdict = await verifier.verify({
      token: req.get(BotChallenge.HEADER) ?? '',
      action,
      remoteAddress: clientAddressOf(req)
    });

    if (verdict === ChallengeVerdicts.PASSED) {
      next();
      return;
    }

    next(
      verdict === ChallengeVerdicts.REFUSED
        ? new AuthorizationError(UserMessages.CHALLENGE_FAILED)
        : new UnavailableError(UserMessages.CHALLENGE_UNAVAILABLE)
    );
  };
