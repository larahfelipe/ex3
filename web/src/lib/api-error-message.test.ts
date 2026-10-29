import { AxiosError } from 'axios';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { translatorOf } from '@/i18n/translator';

import { apiErrorMessageOf, apiIssueMessageOf } from './api-error-message';
import { ApiProxyError, type ApiServerErrorData } from './axios';
import { presentSubmitError } from './submit-error';

const t = translatorOf('pt-BR', 'errors');

const serverError = (
  code: string,
  message: string,
  details: ApiServerErrorData['details'] = []
): ApiServerErrorData => ({ code, message, details });

const apiError = (
  status: number,
  error: ApiServerErrorData | null = null,
  retryAfterSeconds: number | null = null
) =>
  new ApiProxyError(error?.message ?? 'Unexpected error', {
    status,
    _error: error,
    retryAfterSeconds
  });

const transportError = (code: string) => {
  const error = new ApiProxyError('Axios: Request timeout reached');
  error.code = code;

  return error;
};

describe('API errors', () => {
  it('words a message the API sends in Portuguese', () => {
    assert.equal(
      apiErrorMessageOf(
        apiError(
          422,
          serverError(
            'DOMAIN',
            'The payment settles more than the expense still owes'
          )
        ),
        t
      ),
      'O pagamento quita mais do que a conta ainda deve.'
    );
    assert.equal(
      apiErrorMessageOf(
        apiError(
          401,
          serverError('AUTHENTICATION', 'Invalid email or password')
        ),
        t
      ),
      'E-mail ou senha incorretos.'
    );
  });

  it('falls back to the category of a message it does not know', () => {
    const message = 'A rule the web has not been told about';

    const shown = apiErrorMessageOf(
      apiError(422, serverError('DOMAIN', message)),
      t
    );

    assert.equal(shown, 'Esta operação não é permitida.');
    assert.notEqual(shown, message);
  });

  it('falls back to the status when the answer has no category', () => {
    assert.equal(
      apiErrorMessageOf(apiError(503), t),
      'O serviço está indisponível no momento. Tente novamente mais tarde.'
    );
    assert.equal(
      apiErrorMessageOf(apiError(418), t),
      'Algo deu errado. Tente novamente mais tarde.'
    );
  });

  it('words a failure that is not the API’s as unexpected, never as its stack', () => {
    const error = new TypeError(
      "Cannot read properties of undefined (reading 'x')"
    );

    assert.equal(
      apiErrorMessageOf(error, t),
      'Algo deu errado. Tente novamente mais tarde.'
    );
    assert.equal(
      apiErrorMessageOf(error, t, 'Não foi possível salvar a conta.'),
      'Não foi possível salvar a conta.'
    );
  });

  it('words the transport’s failures', () => {
    assert.equal(
      apiErrorMessageOf(transportError(AxiosError.ECONNABORTED), t),
      'O servidor demorou demais para responder. Tente novamente.'
    );
    assert.equal(
      apiErrorMessageOf(transportError(AxiosError.ERR_NETWORK), t),
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
    );
  });

  it('says when to try again after too many requests', () => {
    const throttled = serverError(
      'INFRASTRUCTURE',
      'Too many requests, please try again later'
    );

    assert.equal(
      apiErrorMessageOf(apiError(429, throttled, 90), t),
      'Muitas tentativas. Tente novamente em 2 minutos.'
    );
    assert.equal(
      apiErrorMessageOf(apiError(429, throttled, 60), t),
      'Muitas tentativas. Tente novamente em 1 minuto.'
    );
    assert.equal(
      apiErrorMessageOf(apiError(429, throttled), t),
      'Muitas tentativas. Tente novamente mais tarde.'
    );
  });

  it('writes the day a dated message names as a Brazilian date', () => {
    const message =
      'The next due date cannot be before the due date of the last installment with payments (2026-10-28)';

    assert.equal(
      apiErrorMessageOf(apiError(422, serverError('DOMAIN', message)), t),
      'O próximo vencimento não pode ser anterior a 28/10/2026, vencimento da última parcela com pagamentos.'
    );
  });

  it('words a limit the API names in months', () => {
    assert.equal(
      apiErrorMessageOf(
        apiError(
          400,
          serverError('VALIDATION', 'A report covers at most 24 months')
        ),
        t
      ),
      'Um relatório abrange no máximo 24 meses.'
    );
  });

  it('words a refused field by its own message or a generic one', () => {
    assert.equal(
      apiIssueMessageOf('Payment date cannot be in the future', t),
      'A data do pagamento não pode estar no futuro.'
    );
    assert.equal(apiIssueMessageOf('Expected number', t), 'Valor inválido');
  });
});

describe('submit errors', () => {
  type Values = Record<'amount' | 'paidOn', string>;

  const presented = (error: unknown) => {
    const calls: Array<[string, string | undefined]> = [];

    presentSubmitError<Values>(error, {
      setError: (name, { message }) => calls.push([name, message]),
      fieldOf: (path) =>
        path === 'amount' || path === 'paidOn' ? path : undefined,
      t
    });

    return calls;
  };

  it('puts each refused field’s message under that field', () => {
    const error = apiError(
      400,
      serverError('VALIDATION', 'Invalid or corrupted request', [
        { path: 'paidOn', message: 'Payment date cannot be in the future' },
        { path: 'amount', message: 'Expected number' }
      ])
    );

    assert.deepEqual(presented(error), [
      ['paidOn', 'A data do pagamento não pode estar no futuro.'],
      ['amount', 'Valor inválido']
    ]);
  });

  it('puts what no field shows in the form’s alert', () => {
    assert.deepEqual(presented(apiError(503)), [
      [
        'root.server',
        'O serviço está indisponível no momento. Tente novamente mais tarde.'
      ]
    ]);
  });
});
