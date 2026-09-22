import type { FieldPath, FieldValues, UseFormSetError } from 'react-hook-form';

import { ApiProxyError, UNEXPECTED_ERROR_MESSAGE } from './axios';

type SubmitErrorPlacement<Values extends FieldValues> = {
  setError: UseFormSetError<Values>;
  fieldOf: (path: string) => FieldPath<Values> | undefined;
  fallbackMessage?: string;
};

/**
 * Shows each issue of a rejected submit under the field `fieldOf` maps its path
 * to, focusing the first, and every other message in the form's `root.server`
 * alert.
 */
export const presentSubmitError = <Values extends FieldValues>(
  error: unknown,
  {
    setError,
    fieldOf,
    fallbackMessage = UNEXPECTED_ERROR_MESSAGE
  }: SubmitErrorPlacement<Values>
) => {
  const issues =
    error instanceof ApiProxyError ? (error._error?.details ?? []) : [];
  const unplacedMessages: Array<string> = [];
  let hasFieldIssue = false;

  for (const { path, message } of issues) {
    const field = fieldOf(path);

    if (field === undefined) {
      unplacedMessages.push(message);
      continue;
    }

    setError(
      field,
      { type: 'server', message },
      { shouldFocus: !hasFieldIssue }
    );
    hasFieldIssue = true;
  }

  if (unplacedMessages.length > 0)
    setError('root.server', {
      type: 'server',
      message: unplacedMessages.join(', ')
    });
  else if (!hasFieldIssue)
    setError('root.server', {
      type: 'server',
      message: error instanceof Error ? error.message : fallbackMessage
    });
};
