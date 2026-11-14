import { useEffect, useRef } from 'react';
import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Path,
  UseFormTrigger
} from 'react-hook-form';

import { useLocale } from 'use-intl';

const isFieldError = (node: object): node is FieldError =>
  'type' in node && typeof node.type === 'string';

/**
 * The paths, as `trigger` takes them, of the errors the form's own validation
 * wrote. A field array's `root` stands for the array. Errors the server set
 * are left out, since validating again would clear them, and so is the form's
 * own `root`, which validation never writes.
 */
export const clientErrorPathsOf = (
  errors: object,
  prefix?: string
): Array<string> =>
  Object.entries(errors).flatMap(([key, node]: [string, unknown]) => {
    if (typeof node !== 'object' || node === null) return [];

    const isRoot = key === 'root';
    const path = isRoot
      ? prefix
      : prefix === undefined
        ? key
        : `${prefix}.${key}`;

    if (isFieldError(node))
      return node.type === 'server' || path === undefined ? [] : [path];

    return isRoot ? [] : clientErrorPathsOf(node, path);
  });

export const useRevalidateOnLocaleChange = <Values extends FieldValues>(
  errors: FieldErrors<Values>,
  trigger: UseFormTrigger<Values>
) => {
  const locale = useLocale();
  const validatedLocale = useRef(locale);

  useEffect(() => {
    if (validatedLocale.current === locale) return;

    validatedLocale.current = locale;

    const paths = clientErrorPathsOf(errors);

    if (paths.length > 0) void trigger(paths as Array<Path<Values>>);
  }, [errors, locale, trigger]);
};
