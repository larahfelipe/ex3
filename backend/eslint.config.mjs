import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import perfectionist from 'eslint-plugin-perfectionist';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores(['dist/**']),
  js.configs.recommended,
  tseslint.configs.recommended,
  prettierRecommended,
  {
    files: ['src/**/*.ts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
      parserOptions: { projectService: true }
    },
    plugins: { perfectionist },
    rules: {
      'no-duplicate-imports': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-namespace': 'off',
      // An async method that satisfies a promise-returning contract turns a
      // throw into a rejection, which its callers rely on.
      '@typescript-eslint/require-await': 'off',
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
      'perfectionist/sort-imports': [
        'warn',
        {
          type: 'alphabetical',
          ignoreCase: true,
          newlinesBetween: 1,
          internalPattern: ['^@/'],
          groups: [
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
    // supertest hands a response body over as `any`; the assertions are what
    // check its shape.
    files: ['src/**/*.test.ts', 'src/**/*.integration.ts', 'src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off'
    }
  },
  {
    files: ['src/test/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  }
);
