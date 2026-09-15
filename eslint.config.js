// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // build output and test artefacts are generated, not source
    ignores: ["dist/*", "dist-e2e/*", "test-results/*", "playwright-report/*"],
  }
]);
