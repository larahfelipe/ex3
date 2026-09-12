import { createRequire } from 'node:module';

import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import importHelpers from 'eslint-plugin-import-helpers';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const { version: reactVersion } = createRequire(import.meta.url)(
  'react/package.json'
);

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'build/**',
      'out/**',
      'next-env.d.ts',
      'public/sw.js',
      'public/workbox-*.js'
    ]
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  react.configs.flat.recommended,
  { settings: { react: { version: reactVersion } } },
  jsxA11y.flatConfigs.recommended,
  prettierRecommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } }
    },
    plugins: {
      '@next/next': nextPlugin,
      'react-hooks': reactHooks,
      'import-helpers': importHelpers
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      'no-console': ['error', { allow: ['error', 'warn'] }],
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' }
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
      'import-helpers/order-imports': [
        'warn',
        {
          newlinesBetween: 'always',
          groups: [
            ['/^react/'],
            ['/^next/'],
            ['module'],
            ['/^@//'],
            ['/^~/'],
            ['parent', 'sibling', 'index']
          ],
          alphabetize: { order: 'asc', ignoreCase: true }
        }
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
