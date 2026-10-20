// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // build output and test artefacts are generated, not source (every dist-* export, the iOS tour's
    // screenshots, the knowledge graph); core.mjs imports JSON "with { type: 'json' }", which the
    // Expo parser cannot read yet, so the wish proxy is checked by `npm run proxy:test` instead
    ignores: ["dist/*", "dist-*/*", "test-results/*", "playwright-report/*", "ios-tour-out/*", "graphify-out/*", "proxy/wish/*.mjs"],
  }
]);
