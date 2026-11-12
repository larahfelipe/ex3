'use client';

import {
  useId,
  useRef,
  useState,
  type AriaAttributes,
  type KeyboardEvent,
  type Ref
} from 'react';

import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils';

import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { SELECT_ITEM_CLASS, SELECT_TRIGGER_CLASS } from './select';

/** A `description` shows under the label, and typing finds the option by it too: what a category holds, say. */
export type SearchableOption = Record<'value' | 'label', string> &
  Partial<Record<'description', string>>;

type SearchableSelectProps = Record<
  'options',
  ReadonlyArray<SearchableOption>
> &
  Record<'value', string> &
  Record<'onValueChange', (value: string) => void> &
  Partial<
    Record<'id' | 'name' | 'placeholder' | 'className', string> &
      Record<'disabled', boolean> &
      Record<'onBlur', VoidFunction> &
      Record<'ref', Ref<HTMLButtonElement>>
  > &
  Pick<AriaAttributes, 'aria-invalid' | 'aria-describedby'>;

const COMBINING_MARKS = /\p{M}/gu;

/** Case and accents aside, so "saude" finds "Saúde". */
const searchTextOf = (text: string) =>
  text.normalize('NFD').replace(COMBINING_MARKS, '').toLocaleLowerCase();

export const optionsMatching = (
  options: ReadonlyArray<SearchableOption>,
  query: string
) => {
  const searched = searchTextOf(query.trim());

  return searched === ''
    ? options
    : options.filter(({ label, description = '' }) =>
        [label, description].some((text) =>
          searchTextOf(text).includes(searched)
        )
      );
};

const isTypedCharacter = ({ key, altKey, ctrlKey, metaKey }: KeyboardEvent) =>
  key.length === 1 && key !== ' ' && !altKey && !ctrlKey && !metaKey;

/**
 * A select whose list is narrowed by typing, for lists long enough that
 * scanning them is slower than naming the option. Typing on the closed field
 * opens it with that text; the arrows move through the matches, Enter picks
 * one and Escape closes it, giving focus back to the field.
 */
export const SearchableSelect = ({
  options,
  value,
  onValueChange,
  id,
  name,
  placeholder,
  className,
  disabled,
  onBlur,
  ref,
  ...aria
}: SearchableSelectProps) => {
  const t = useTranslations('common.searchableSelect');
  const listId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const matches = optionsMatching(options, query);
  const selected = options.find((option) => option.value === value);
  const activeOption = matches.at(activeIndex);
  const optionIdOf = (index: number) => `${listId}-${index}`;

  const moveTo = (index: number) => {
    setActiveIndex(index);
    document
      .getElementById(optionIdOf(index))
      ?.scrollIntoView({ block: 'nearest' });
  };

  const open = (typed = '') => {
    const shown = optionsMatching(options, typed);

    setQuery(typed);
    setActiveIndex(
      Math.max(
        0,
        shown.findIndex((option) => option.value === value)
      )
    );
    setIsOpen(true);
  };

  const close = () => {
    setIsOpen(false);
    onBlur?.();
  };

  const choose = (option: SearchableOption) => {
    if (option.value !== value) onValueChange(option.value);
    close();
  };

  const search = (text: string) => {
    setQuery(text);
    setActiveIndex(0);
    document.getElementById(listId)?.scrollTo({ top: 0 });
  };

  const openFromKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (isOpen) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      open();
    } else if (isTypedCharacter(event)) {
      event.preventDefault();
      open(event.key);
    }
  };

  const navigate = (event: KeyboardEvent<HTMLInputElement>) => {
    const lastIndex = matches.length - 1;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveTo(Math.min(activeIndex + 1, lastIndex));
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(Math.max(activeIndex - 1, 0));
        break;
      case 'PageDown':
      case 'PageUp':
        event.preventDefault();
        moveTo(event.key === 'PageUp' ? 0 : Math.max(lastIndex, 0));
        break;
      case 'Enter':
        event.preventDefault();
        if (activeOption) choose(activeOption);
        break;
      case 'Tab':
        event.preventDefault();
        close();
        break;
    }
  };

  return (
    <Popover
      modal
      open={isOpen}
      onOpenChange={(isOpening) => (isOpening ? open() : close())}
    >
      <PopoverTrigger asChild>
        <button
          {...aria}
          ref={ref}
          id={id}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-controls={isOpen ? listId : undefined}
          disabled={disabled}
          data-placeholder={selected === undefined || undefined}
          className={cn(SELECT_TRIGGER_CLASS, 'text-left', className)}
          onKeyDown={openFromKey}
        >
          <span>{selected?.label ?? placeholder}</span>

          <ChevronsUpDown aria-hidden className="size-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>

      {name !== undefined && <input type="hidden" name={name} value={value} />}

      <PopoverContent
        align="start"
        className="w-(--radix-popover-trigger-width) min-w-56 p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          searchRef.current?.focus();
          searchRef.current?.setSelectionRange(query.length, query.length);
          moveTo(activeIndex);
        }}
      >
        <div className="flex items-center gap-2 border-b px-3">
          <Search
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground"
          />

          <input
            ref={searchRef}
            type="text"
            role="combobox"
            aria-label={t('search')}
            aria-autocomplete="list"
            aria-expanded
            aria-controls={listId}
            aria-activedescendant={
              activeOption ? optionIdOf(activeIndex) : undefined
            }
            autoComplete="off"
            spellCheck={false}
            placeholder={t('search')}
            value={query}
            className="h-10 w-full min-w-0 bg-transparent text-base outline-hidden placeholder:text-muted-foreground md:text-sm"
            onChange={({ target }) => search(target.value)}
            onKeyDown={navigate}
          />
        </div>

        <div
          id={listId}
          role="listbox"
          className="popover-list max-h-[min(16rem,calc(var(--radix-popover-content-available-height)-3rem))] overflow-y-auto p-1"
        >
          {matches.map((option, index) => (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus -- focus stays in the search box, which takes the keys and names the active option through aria-activedescendant, as the APG combobox does
            <div
              key={option.value}
              id={optionIdOf(index)}
              role="option"
              aria-selected={option.value === value}
              data-active={index === activeIndex || undefined}
              className={cn(
                SELECT_ITEM_CLASS,
                'data-active:bg-accent data-active:text-accent-foreground'
              )}
              onPointerMove={() => setActiveIndex(index)}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(option)}
            >
              {option.value === value && (
                <span className="absolute right-2 flex size-3.5 items-center justify-center">
                  <Check aria-hidden className="size-4" />
                </span>
              )}

              {option.description === undefined ? (
                option.label
              ) : (
                <span className="grid gap-0.5 py-0.5">
                  <span>{option.label}</span>

                  <span className="text-xs text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              )}
            </div>
          ))}
        </div>

        {matches.length === 0 && (
          <p className="px-3 pt-1 pb-4 text-center text-sm text-muted-foreground">
            {t('noResults', { query: query.trim() })}
          </p>
        )}

        <p aria-live="polite" className="sr-only">
          {query.trim() === '' ? '' : t('results', { count: matches.length })}
        </p>
      </PopoverContent>
    </Popover>
  );
};
