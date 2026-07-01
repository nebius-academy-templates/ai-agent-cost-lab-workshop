const { createCjsPreset } = require('jest-preset-angular/presets');
const { resolve } = require('node:path');

const APP = resolve(__dirname, '../../../apps/angular-demo');

/** Mandatory reference suite for catalog-pagination — the quality gate. Hidden from the agent. */
module.exports = {
  ...createCjsPreset({ tsconfig: resolve(__dirname, 'tsconfig.reference.json') }),
  rootDir: __dirname,
  roots: [__dirname, resolve(APP, 'src')],
  setupFilesAfterEnv: [resolve(APP, 'setup-jest.ts')],
  testMatch: [resolve(__dirname, '*.reference.spec.ts')],
};
