import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { z } from 'zod';

import { UnauthorizedError } from '@/errors';

/**
 * Pinned on signing and on verification (RFC 8725 §3.1): the token header must
 * never choose the algorithm its own signature is checked with.
 */
const SIGNING_ALGORITHM = 'HS256';

/**
 * A verified signature only proves the issuer; the claims are still parsed so a
 * token minted under an older payload shape is rejected instead of trusted.
 */
const AccessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  sessionVersion: z.number().int().nonnegative()
});

export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;

export class Jwt {
  private static INSTANCE: Jwt;
  private readonly secret: string;
  private readonly expirationSeconds: number;

  private constructor(secret: string, expirationSeconds: number) {
    this.secret = secret;
    this.expirationSeconds = expirationSeconds;
  }

  static getInstance(secret: string, expirationSeconds: number) {
    if (!Jwt.INSTANCE) Jwt.INSTANCE = new Jwt(secret, expirationSeconds);

    return Jwt.INSTANCE;
  }

  async encrypt({ sub, sessionVersion }: AccessTokenClaims) {
    return jwt.sign({ sessionVersion }, this.secret, {
      algorithm: SIGNING_ALGORITHM,
      subject: sub,
      expiresIn: this.expirationSeconds
    });
  }

  async decrypt(cipherText: string): Promise<AccessTokenClaims> {
    const claims = AccessTokenClaimsSchema.safeParse(this.verify(cipherText));

    if (!claims.success) throw new UnauthorizedError('Invalid access token');

    return claims.data;
  }

  private verify(cipherText: string) {
    try {
      return jwt.verify(cipherText, this.secret, {
        algorithms: [SIGNING_ALGORITHM]
      });
    } catch (e) {
      if (e instanceof TokenExpiredError)
        throw new UnauthorizedError('Access token expired');

      if (e instanceof JsonWebTokenError)
        throw new UnauthorizedError('Invalid access token');

      throw e;
    }
  }
}
