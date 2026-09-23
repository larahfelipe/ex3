import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isDerivedFromEmail } from './PasswordPolicy';

describe('isDerivedFromEmail', () => {
  it('flags a password containing the part before the @, in any case', () => {
    assert.equal(
      isDerivedFromEmail('Maria.Silva-1990', 'maria.silva@ex3.app'),
      true
    );
    assert.equal(
      isDerivedFromEmail('xMARIA.SILVAx', 'maria.silva@ex3.app'),
      true
    );
  });

  it('accepts a password that does not contain it', () => {
    assert.equal(
      isDerivedFromEmail('violet-harbor', 'maria.silva@ex3.app'),
      false
    );
  });

  it('ignores a part before the @ too short to tell a derived password', () => {
    assert.equal(isDerivedFromEmail('bob-the-builder', 'bob@ex3.app'), false);
  });

  it('splits at the last @, as a quoted part before it may contain one', () => {
    assert.equal(
      isDerivedFromEmail('"ann@home"-2026', '"ann@home"@ex3.app'),
      true
    );
  });

  it('finds nothing to compare in a value without an @', () => {
    assert.equal(isDerivedFromEmail('not-an-email', 'not-an-email'), false);
  });
});
