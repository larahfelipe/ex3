import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importHelpers from 'eslint-plugin-import-helpers';
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
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: globals.node,
      parserOptions: { projectService: true }
    },
    plugins: {
      'import-helpers': importHelpers
    },
    rules: {
      'no-duplicate-imports': 'error',
      'no-console': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/consistent-type-imports': [
        'warn',
        { fixStyle: 'inline-type-imports' }
      ],
      'import-helpers/order-imports': [
        'warn',
        {
          newlinesBetween: 'always',
          groups: [['module'], ['/^@//'], ['parent', 'sibling', 'index']],
          alphabetize: { order: 'asc', ignoreCase: true }
        }
      ]
    }
  },
  {
    files: ['src/test/**/*.ts'],
    rules: {
      'no-console': 'off'
    }
  }
);
