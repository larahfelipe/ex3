type AccessTokenClaims = {
  exp?: number;
};

const MILLISECONDS_PER_SECOND = 1000;

const base64UrlToBase64 = (segment: string) =>
  segment.replace(/-/g, '+').replace(/_/g, '/');

/**
 * Reads the claims without verifying the signature. The API is the only
 * authority on whether a token is genuine — this exists so the client can tell
 * an already-expired session apart from an active one before making a request.
 */
export const decodeAccessToken = (token: string): AccessTokenClaims | null => {
  const [, payload] = token.split('.');

  if (!payload) return null;

  try {
    return JSON.parse(atob(base64UrlToBase64(payload))) as AccessTokenClaims;
  } catch {
    return null;
  }
};

export const getAccessTokenExpiration = (token: string): Date | null => {
  const exp = decodeAccessToken(token)?.exp;

  return exp ? new Date(exp * MILLISECONDS_PER_SECOND) : null;
};

export const isAccessTokenActive = (
  token: string,
  now = new Date()
): boolean => {
  const expiresAt = getAccessTokenExpiration(token);

  return !!expiresAt && expiresAt > now;
};
