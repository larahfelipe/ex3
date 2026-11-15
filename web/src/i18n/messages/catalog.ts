import type ptBR from './pt-BR';

export type Messages = typeof ptBR;

export type LocaleMessages<Catalog = Messages> = {
  readonly [Key in keyof Catalog]: Catalog[Key] extends string
    ? string
    : LocaleMessages<Catalog[Key]>;
};

export const asReferenceCatalog = (catalog: LocaleMessages) =>
  catalog as Messages;
