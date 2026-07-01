// Flat ESLint config. The quality gate (scenario:verify) lints the Angular demo's
// working copy. Rules are intentionally light: lint guards real defects (unused
// vars, unsafe constructs), not the behavioral bug the scenario is about.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/.angular/**', 'traces/**', 'artifacts/**'] },
  {
    files: ['apps/angular-demo/src/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // template $any() bridge in components
    },
  },
);
