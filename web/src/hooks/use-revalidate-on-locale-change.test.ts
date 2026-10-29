import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clientErrorPathsOf } from './use-revalidate-on-locale-change';

const issue = (type: string) => ({ type, message: 'mensagem', ref: {} });

describe('errors checked again after a language switch', () => {
  it('names the fields the form’s own validation flagged', () => {
    assert.deepEqual(
      clientErrorPathsOf({
        amount: issue('custom'),
        description: issue('too_small')
      }),
      ['amount', 'description']
    );
  });

  it('leaves out what the server said, which checking again would clear', () => {
    assert.deepEqual(
      clientErrorPathsOf({
        name: issue('server'),
        email: issue('invalid_format'),
        root: { server: issue('server') }
      }),
      ['email']
    );
  });

  it('reaches nested fields and stands a field array’s root for the array', () => {
    assert.deepEqual(
      clientErrorPathsOf({
        installments: Object.assign([undefined, { amount: issue('custom') }], {
          root: issue('custom')
        }),
        payment: { paidAt: issue('custom'), account: issue('server') }
      }),
      ['installments.1.amount', 'installments', 'payment.paidAt']
    );
  });

  it('reads a field named `type` as a field, not as an error', () => {
    assert.deepEqual(clientErrorPathsOf({ type: issue('invalid_value') }), [
      'type'
    ]);
  });

  it('finds nothing in a form without errors', () => {
    assert.deepEqual(clientErrorPathsOf({}), []);
  });
});
