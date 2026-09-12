import jwt from 'jsonwebtoken';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { UnauthorizedError } from '@/errors';

import { Jwt } from './Jwt';

const SECRET = 'a'.repeat(32);
const EXPIRATION_SECONDS = 60 * 60;

const CLAIMS = {
  sub: '0f2f5a3c-2c1c-4f2a-9a1a-7c6f5d4e3b2a',
  sessionVersion: 3
};

const sut = Jwt.getInstance(SECRET, EXPIRATION_SECONDS);

const assertRejectedWith = (token: string, message: RegExp) =>
  assert.rejects(sut.decrypt(token), (e: unknown) => {
    assert.ok(e instanceof UnauthorizedError);
    assert.match(e.message, message);
    return true;
  });

describe('Jwt', () => {
  it('round-trips the subject and the session version', async () => {
    const token = await sut.encrypt(CLAIMS);

    assert.deepEqual(await sut.decrypt(token), CLAIMS);
  });

  it('signs with HS256 and the configured lifetime', async () => {
    const token = await sut.encrypt(CLAIMS);

    const decoded = jwt.decode(token, { complete: true });
    const { iat, exp } = decoded?.payload as jwt.JwtPayload;

    assert.equal(decoded?.header.alg, 'HS256');
    assert.ok(iat !== undefined && exp !== undefined);
    assert.equal(exp - iat, EXPIRATION_SECONDS);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(CLAIMS, SECRET, { expiresIn: '-1s' });

    await assertRejectedWith(expired, /expired/i);
  });

  it('rejects a token signed with another secret', async () => {
    const foreign = jwt.sign(CLAIMS, 'b'.repeat(32));

    await assertRejectedWith(foreign, /invalid/i);
  });

  it('rejects a token signed with the right secret under another algorithm', async () => {
    const otherAlgorithm = jwt.sign(CLAIMS, SECRET, { algorithm: 'HS512' });

    await assertRejectedWith(otherAlgorithm, /invalid/i);
  });

  it('rejects a genuine token whose claims have another shape', async () => {
    const legacy = jwt.sign({ id: CLAIMS.sub }, SECRET);
    const coercible = jwt.sign({ ...CLAIMS, sessionVersion: '3' }, SECRET);

    await assertRejectedWith(legacy, /invalid/i);
    await assertRejectedWith(coercible, /invalid/i);
  });

  it('rejects a malformed token', async () => {
    await assertRejectedWith('not-a-jwt', /invalid/i);
  });
});
