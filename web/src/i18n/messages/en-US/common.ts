import type { LocaleMessages, Messages } from '../catalog';

export default {
  actions: {
    back: 'Back',
    cancel: 'Cancel',
    clearAll: 'Clear all',
    clearRefinements: 'Clear search and filters',
    close: 'Close',
    delete: 'Delete',
    edit: 'Edit',
    next: 'Next',
    previous: 'Previous',
    refresh: 'Refresh',
    retry: 'Try again',
    save: 'Save',
    saveChanges: 'Save changes'
  },
  states: {
    loading: 'Loading',
    notAvailable: 'Unavailable',
    stale: "This data couldn't be refreshed and may be out of date"
  },
  pagination: {
    position: 'Page {page, number} of {totalPages, number}',
    positionWithDetail: 'Page {page, number} of {totalPages, number} · {detail}'
  },
  form: {
    optionalLabel: '<label></label><muted> (optional)</muted>',
    optionalSectionTitle: '<title></title><muted> · Optional</muted>',
    datePlaceholder: 'Pick a date',
    currency: 'Currency',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    labelInCurrency: '{label}<hidden> in {currency}</hidden>'
  },
  searchableSelect: {
    search: 'Search',
    noResults: 'Nothing matches “{query}”',
    results:
      '{count, plural, =0 {No options found} one {# option found} other {# options found}}'
  },
  confirmDeletion: {
    typeToConfirm: 'Type <strong>{phrase}</strong> to confirm',
    mismatch: "The text doesn't match the name above"
  },
  metric: {
    about: 'About: {label}'
  },
  calendar: {
    month: 'Month',
    year: 'Year',
    today: 'Today'
  },
  toasts: {
    region: 'Notifications',
    close: 'Close notification'
  },
  fallback: {
    title: 'Something went wrong',
    retry: 'Try again'
  },
  language: {
    label: 'Language',
    failed: "Couldn't change the language. Try again."
  }
} as const satisfies LocaleMessages<Messages['common']>;
