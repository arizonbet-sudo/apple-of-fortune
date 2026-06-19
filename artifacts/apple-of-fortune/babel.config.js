const {
  expoRouterBabelPlugin,
} = require("babel-preset-expo/build/expo-router-plugin");

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // In a pnpm monorepo, babel-preset-expo's internal hasModule("expo-router")
      // check resolves from the hoisted preset location and can fail to see the
      // app-local expo-router. When that happens the preset silently skips the
      // transform that inlines process.env.EXPO_ROUTER_APP_ROOT, and Metro fails
      // with "First argument of require.context should be a string" during the
      // production/EAS bundle. Registering the plugin explicitly guarantees the
      // inline always runs (Babel dedupes it when the preset also adds it).
      expoRouterBabelPlugin,
    ],
  };
};
