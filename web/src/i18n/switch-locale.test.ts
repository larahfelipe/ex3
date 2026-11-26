import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { Locale } from './config';
import { MESSAGES } from './messages';
import type { Messages } from './messages/catalog';
import { runLocaleSwitch } from './switch-locale';

type Step =
  | ['pending', Locale | null]
  | ['load', Locale]
  | ['account', Locale]
  | ['show', Locale]
  | ['save', Locale];

const deferredCatalog = () => {
  let resolve: (messages: Messages) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<Messages>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
};

const switchRecording = (
  load: (locale: Locale) => Promise<Messages> = (locale) =>
    Promise.resolve(MESSAGES[locale])
) => {
  const steps: Array<Step> = [];
  const shown: Array<Messages> = [];
  const requestedLocale = { current: 'pt-BR' as Locale };
  const switchFrom = (
    activeLocale: Locale,
    next: Locale,
    saveToAccount?: (locale: Locale) => Promise<unknown>
  ) =>
    runLocaleSwitch(
      next,
      { activeLocale, requestedLocale },
      {
        loadMessages: (locale) => {
          steps.push(['load', locale]);

          return load(locale);
        },
        showCatalog: (locale, messages) => {
          steps.push(['show', locale]);
          shown.push(messages);
        },
        savePreference: (locale) => steps.push(['save', locale]),
        setPendingLocale: (locale) => steps.push(['pending', locale]),
        ...(saveToAccount && {
          saveToAccount: (locale: Locale) => {
            steps.push(['account', locale]);

            return saveToAccount(locale);
          }
        })
      }
    );

  return { steps, shown, switchFrom };
};

const deferredSave = () => {
  let resolve: VoidFunction = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  let markStarted: VoidFunction = () => undefined;
  const started = new Promise<void>((resolveStarted) => {
    markStarted = resolveStarted;
  });
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  const save = () => {
    markStarted();

    return promise;
  };

  return { save, started, resolve, reject };
};

describe('switching the language', () => {
  it('loads the catalog, shows it, then saves the choice', async () => {
    const { steps, shown, switchFrom } = switchRecording();

    await switchFrom('pt-BR', 'en-US');

    assert.deepEqual(steps, [
      ['pending', 'en-US'],
      ['load', 'en-US'],
      ['show', 'en-US'],
      ['save', 'en-US'],
      ['pending', null]
    ]);
    assert.deepEqual(shown, [MESSAGES['en-US']]);
  });

  it('does nothing for the language already shown', async () => {
    const { steps, switchFrom } = switchRecording();

    await switchFrom('pt-BR', 'pt-BR');

    assert.deepEqual(steps, [['pending', null]]);
  });

  it('keeps the last choice when an earlier catalog arrives after it', async () => {
    const english = deferredCatalog();
    const { steps, switchFrom } = switchRecording((locale) =>
      locale === 'en-US' ? english.promise : Promise.resolve(MESSAGES[locale])
    );

    const toEnglish = switchFrom('pt-BR', 'en-US');
    await switchFrom('pt-BR', 'pt-BR');
    english.resolve(MESSAGES['en-US']);
    await toEnglish;

    assert.deepEqual(steps, [
      ['pending', 'en-US'],
      ['load', 'en-US'],
      ['pending', null]
    ]);
  });

  it('rejects a failed switch and saves nothing', async () => {
    const { steps, switchFrom } = switchRecording(() =>
      Promise.reject(new Error('offline'))
    );

    await assert.rejects(switchFrom('pt-BR', 'en-US'), /offline/);

    assert.deepEqual(steps, [
      ['pending', 'en-US'],
      ['load', 'en-US'],
      ['pending', null]
    ]);
  });

  it('drops the failure of a switch a later choice replaced', async () => {
    const english = deferredCatalog();
    const { steps, switchFrom } = switchRecording((locale) =>
      locale === 'en-US' ? english.promise : Promise.resolve(MESSAGES[locale])
    );

    const toEnglish = switchFrom('pt-BR', 'en-US');
    await switchFrom('pt-BR', 'pt-BR');
    english.reject(new Error('offline'));

    await toEnglish;

    assert.equal(
      steps.some(([step]) => step === 'show' || step === 'save'),
      false
    );
  });
});

describe('saving the language to the account', () => {
  it('saves the choice once its catalog is loaded, before showing it', async () => {
    const { steps, switchFrom } = switchRecording();

    await switchFrom('pt-BR', 'en-US', () => Promise.resolve());

    assert.deepEqual(steps, [
      ['pending', 'en-US'],
      ['load', 'en-US'],
      ['account', 'en-US'],
      ['show', 'en-US'],
      ['save', 'en-US'],
      ['pending', null]
    ]);
  });

  it('keeps the language and the cookie when the account refuses the choice', async () => {
    const { steps, switchFrom } = switchRecording();

    await assert.rejects(
      switchFrom('pt-BR', 'en-US', () => Promise.reject(new Error('offline'))),
      /offline/
    );

    assert.deepEqual(steps, [
      ['pending', 'en-US'],
      ['load', 'en-US'],
      ['account', 'en-US'],
      ['pending', null]
    ]);
  });

  it('saves nothing when its catalog fails to load', async () => {
    const { steps, switchFrom } = switchRecording(() =>
      Promise.reject(new Error('offline'))
    );

    await assert.rejects(
      switchFrom('pt-BR', 'en-US', () => Promise.resolve()),
      /offline/
    );

    assert.equal(
      steps.some(([step]) => step === 'account'),
      false
    );
  });

  it('shows nothing a later choice replaced while it was being saved, and saves the later one too', async () => {
    const englishSave = deferredSave();
    const { steps, switchFrom } = switchRecording();

    const toEnglish = switchFrom('pt-BR', 'en-US', englishSave.save);
    await englishSave.started;
    const backToPortuguese = switchFrom('pt-BR', 'pt-BR', () =>
      Promise.resolve()
    );
    englishSave.resolve();
    await Promise.all([toEnglish, backToPortuguese]);

    assert.deepEqual(steps, [
      ['pending', 'en-US'],
      ['load', 'en-US'],
      ['account', 'en-US'],
      ['pending', null],
      ['account', 'pt-BR']
    ]);
  });

  it('drops the refusal of a save a later choice replaced', async () => {
    const englishSave = deferredSave();
    const { switchFrom } = switchRecording();

    const toEnglish = switchFrom('pt-BR', 'en-US', englishSave.save);
    await englishSave.started;
    await switchFrom('pt-BR', 'pt-BR');
    englishSave.reject(new Error('offline'));

    await toEnglish;
  });
});
