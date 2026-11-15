import type { RequestHandler } from 'express';

import { BotChallenge, UserMessages } from '@/config/Constants';
import { AuthorizationError, UnavailableError } from '@/errors';
import { ChallengeVerdicts, TurnstileVerifier } from '@/infra/bot-challenge';

import { clientAddressOf } from './RateLimitMiddleware';

type BotChallengeAction = Exclude<
  (typeof BotChallenge)[keyof typeof BotChallenge],
  typeof BotChallenge.HEADER
>;

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
