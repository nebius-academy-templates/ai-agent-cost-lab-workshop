const { createCjsPreset } = require('jest-preset-angular/presets');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

// Self-contained gate: run only the spec for the feature THIS ticket targets. The other features
// are separate, intentionally-unsolved tickets — their specs are RED by design, so a whole-suite
// run would never pass even after a correct scoped fix. We read the ticket from the in-app TASK.md
// (written by `npm run variant`) and map it to its feature directory.
const TICKET_TO_FEATURE = {
  'JIRA-0321': 'catalog',
  'JIRA-0410': 'orders',
  'JIRA-0455': 'edit-card',
};

function testMatch() {
  try {
    const ticket = (readFileSync(join(__dirname, 'TASK.md'), 'utf8').match(/JIRA-\d+/) || [])[0];
    const feature = ticket && TICKET_TO_FEATURE[ticket];
    if (feature) return [`<rootDir>/src/app/${feature}/**/*.spec.ts`];
  } catch {
    /* no TASK.md — fall back to the full suite */
  }
  return ['<rootDir>/src/**/*.spec.ts'];
}

module.exports = {
  ...createCjsPreset({ tsconfig: '<rootDir>/tsconfig.spec.json' }),
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testMatch: testMatch(),
};
