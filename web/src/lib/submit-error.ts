import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import type { Translator } from '@/i18n/translator';

import { apiErrorMessageOf, apiIssueMessageOf } from './api-error-message';
import { ApiProxyError } from './axios';

type SubmitErrorPlacement<Values extends FieldValues> = {
  setError: UseFormSetError<Values>;
  fieldOf: (path: string) => FieldPath<Values> | undefined;
  t: Translator<'errors'>;
  fallbackMessage?: string;
};

export const presentSubmitError = <Values extends FieldValues>(
  error: unknown,
  { setError, fieldOf, t, fallbackMessage }: SubmitErrorPlacement<Values>
) => {
  const errorMessage = apiErrorMessageOf(error, t, fallbackMessage);
  const issues =
    error instanceof ApiProxyError ? (error._error?.details ?? []) : [];
  const unplacedMessages = new Set<string>();
  let hasFieldIssue = false;

  for (const { path, message } of issues) {
    const field = fieldOf(path);
    const issueMessage = apiIssueMessageOf(message, t);

    if (field === undefined) {
      unplacedMessages.add(issueMessage);
      continue;
    }

    setError(
      field,
      { type: 'server', message: issueMessage },
      { shouldFocus: !hasFieldIssue }
    );
    hasFieldIssue = true;
  }

  if (unplacedMessages.size > 0)
    setError('root.server', {
      type: 'server',
      message:
        unplacedMessages.size === 1 ? [...unplacedMessages][0] : errorMessage
    });
  else if (!hasFieldIssue)
    setError('root.server', {
      type: 'server',
      message: errorMessage
    });
};
