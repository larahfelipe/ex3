import type ptBR from './pt-BR';

/** The default locale's catalog is the reference: its keys and its ICU arguments type every `t` call. */
export type Messages = typeof ptBR;

/** A catalog with every key of the reference, worded in any language. */
export type LocaleMessages<Catalog = Messages> = {
  readonly [Key in keyof Catalog]: Catalog[Key] extends string
    ? string
    : LocaleMessages<Catalog[Key]>;
};

/**
 * Another locale's catalog has the reference's keys, which its `satisfies`
 * checks, and its own wording; it types as the reference so that the same `t`
 * calls read it.
 */
export const asReferenceCatalog = (catalog: LocaleMessages) =>
  catalog as Messages;
