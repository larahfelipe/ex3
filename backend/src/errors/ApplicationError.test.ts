import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ErrorCategories, Errors } from '@/config/Constants';

import {
  ApplicationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DomainError,
  NotFoundError,
  ValidationError
} from './index';

const CLIENT_ERROR_FLOOR = 400;
const SERVER_ERROR_CEILING = 600;

describe('error catalog', () => {
  it('classifies every entry under a category of the taxonomy', () => {
    const categories: ReadonlyArray<string> = Object.values(ErrorCategories);

    for (const [name, { code, status, message }] of Object.entries(Errors)) {
      assert.ok(categories.includes(code), `${name} carries an unknown code`);
      assert.ok(
        status >= CLIENT_ERROR_FLOOR && status < SERVER_ERROR_CEILING,
        `${name} is answered with ${status}`
      );
      assert.ok(message.length > 0, `${name} has no message`);
    }
  });

  it('names each category after itself, so the code is the classification', () => {
    for (const [name, code] of Object.entries(ErrorCategories))
      assert.equal(code, name);
  });
});

describe('application errors', () => {
  it('answers each failure with the status and the code of its category', () => {
    const failures = [
      { error: new ValidationError(), expected: Errors.VALIDATION },
      { error: new AuthenticationError(), expected: Errors.AUTHENTICATION },
      { error: new AuthorizationError(), expected: Errors.AUTHORIZATION },
      { error: new NotFoundError(), expected: Errors.NOT_FOUND },
      { error: new ConflictError(), expected: Errors.CONFLICT },
      { error: new DomainError(), expected: Errors.DOMAIN }
    ];

    for (const { error, expected } of failures) {
      assert.ok(error instanceof ApplicationError);
      assert.equal(error.status, expected.status);
      assert.equal(error.code, expected.code);
      assert.equal(error.message, expected.message);
      assert.deepEqual(error.details, []);
    }
  });

  it('keeps a message of its own and the rejected fields of a validation', () => {
    const details = [{ path: 'email', message: 'Email must be a valid email' }];

    const error = new ValidationError('Email must be a valid email', details);

    assert.equal(error.code, ErrorCategories.VALIDATION);
    assert.equal(error.message, 'Email must be a valid email');
    assert.deepEqual(error.details, details);
  });

  it('keeps the domain and the conflict apart from a malformed request', () => {
    assert.notEqual(Errors.CONFLICT.status, Errors.VALIDATION.status);
    assert.notEqual(Errors.DOMAIN.status, Errors.VALIDATION.status);
    assert.notEqual(Errors.CONFLICT.code, Errors.DOMAIN.code);
  });
});
