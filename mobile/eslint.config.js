// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*'] },
  // Nothing is logged in a release build: no console calls in app code (tests and scripts may)
  { files: ['src/**/*.{ts,tsx}'], ignores: ['src/**/__tests__/**'], rules: { 'no-console': 'error' } },
]);
