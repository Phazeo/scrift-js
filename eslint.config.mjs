import path from 'node:path';
import { fileURLToPath } from 'node:url';

import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

/**
 * ESLint flat config (ESLint 9+). TypeScript is linted with syntax-based
 * rules only — tests live outside `tsconfig.json` "include", so we do not
 * use `projectService` (that would require a second tsconfig or widening
 * the main graph). `npm run typecheck` remains the authority for types.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      '**/*.d.ts',
      '**/*.d.cts',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },
  },
  {
    files: ['tests/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
);
