import { createRequire } from 'node:module';

import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import { defineConfig, globalIgnores } from 'eslint/config';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import perfectionist from 'eslint-plugin-perfectionist';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const { version: reactVersion } = createRequire(import.meta.url)(
  'react/package.json'
);

export default defineConfig(
  globalIgnores([
    '.next/**',
    'build/**',
    'out/**',
    'next-env.d.ts',
    'public/sw.js',
    'public/workbox-*.js'
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  { settings: { react: { version: reactVersion } } },
  jsxA11y.flatConfigs.recommended,
  prettierRecommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true }, projectService: true }
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
      perfectionist
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs['recommended-latest'].rules,
      'no-console': ['error', { allow: ['error', 'warn'] }],
      'no-duplicate-imports': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      // Event handlers may return the promise of an awaited mutation; React
      // ignores the value, so only the non-attribute checks are kept.
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } }
      ],
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          allowForKnownSafeCalls: [
            {
              from: 'package',
              package: 'node:test',
              name: ['describe', 'it', 'suite', 'test']
            }
          ]
        }
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true }
      ],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' }
      ],
      // A scrollable region only reaches the keyboard when it is focusable.
      'jsx-a11y/no-noninteractive-tabindex': [
        'error',
        {
          tags: ['section'],
          roles: ['tabpanel', 'region'],
          allowExpressionValues: true
        }
      ],
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/no-unused-prop-types': 'error',
      'react/self-closing-comp': 'warn',
      'react/jsx-curly-brace-presence': [
        'error',
        { props: 'never', children: 'never', propElementValues: 'always' }
      ],
      'react/hook-use-state': 'warn',
      'react/jsx-boolean-value': 'warn',
      'react/jsx-fragments': 'warn',
      'react/jsx-newline': 'warn',
      'react/jsx-no-target-blank': 'warn',
      'react/jsx-no-useless-fragment': 'warn',
      // Every word the interface shows comes from the message catalogs in
      // src/i18n, so text written straight into JSX is a missed translation.
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: [
            '·',
            '–',
            '—',
            '/',
            ':',
            '%',
            '(',
            ')',
            '+',
            '-',
            '×'
          ]
        }
      ],
      'perfectionist/sort-imports': [
        'warn',
        {
          type: 'alphabetical',
          ignoreCase: true,
          newlinesBetween: 1,
          internalPattern: ['^@/'],
          customGroups: [
            { groupName: 'react', elementNamePattern: '^react' },
            { groupName: 'next', elementNamePattern: '^next' }
          ],
          groups: [
            'react',
            'next',
            ['builtin', 'external'],
            'internal',
            ['parent', 'sibling', 'index'],
            'unknown'
          ]
        }
      ],
      'perfectionist/sort-named-imports': [
        'warn',
        {
          type: 'alphabetical',
          ignoreCase: true,
          groups: ['value-import', 'type-import']
        }
      ],
      'perfectionist/sort-named-exports': [
        'warn',
        {
          type: 'alphabetical',
          ignoreCase: true,
          groups: ['value-export', 'type-export']
        }
      ],
      'perfectionist/sort-exports': [
        'warn',
        { type: 'alphabetical', ignoreCase: true }
      ]
    }
  },
  {
    files: ['*.js', '*.mjs', '*.ts'],
    languageOptions: {
      globals: globals.node
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off'
    }
  },
  {
    // Primitives forward `children` through props, so the content these rules
    // look for is only visible at the call site.
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'jsx-a11y/anchor-has-content': 'off',
      'jsx-a11y/heading-has-content': 'off'
    }
  }
);
