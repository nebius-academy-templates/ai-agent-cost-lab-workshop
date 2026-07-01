// Flat ESLint config — self-contained for this app (no dependency on the repo root).
// Rules mirror the workshop quality gate: lint guards real defects (unused vars, unsafe
// constructs), not the behavioral bug the task is about.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/**', '.angular/**', 'node_modules/**'] },
  {
    files: ['src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // template $any() bridge in components
    },
  },
);
