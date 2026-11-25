import { fixupConfigRules } from '@eslint/compat';
import js from '@eslint/js';
import reactCompiler from 'eslint-plugin-react-compiler';
import reactHooks from 'eslint-plugin-react-hooks';
import reactJsx from 'eslint-plugin-react/configs/jsx-runtime.js';
import react from 'eslint-plugin-react/configs/recommended.js';
import globals from 'globals';
import ts from 'typescript-eslint';

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', 'packages/server/data/**'] },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...fixupConfigRules([
    {
      ...react,
      settings: {
        react: { version: 'detect' },
      },
    },
    reactJsx,
  ]),
  {
    files: ['packages/app/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-compiler': reactCompiler,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-compiler/react-compiler': 'error',
      'react/prop-types': 'off',
    },
  },
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
];
