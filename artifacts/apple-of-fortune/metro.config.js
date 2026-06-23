const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo support: watch the whole workspace and resolve modules from both
// the app's own node_modules and the hoisted workspace root node_modules.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Force a single instance of React / React DOM so every module shares one
// hooks dispatcher. In a pnpm monorepo Metro can otherwise register React
// more than once (the same package resolved via different symlink paths),
// which makes react-dom install the dispatcher on one React instance while
// expo-router reads hooks from another -> "Invalid hook call" /
// "Cannot read properties of null (reading 'useRef')" at runtime.
const singletonRoots = {
  react: path.dirname(require.resolve("react/package.json")),
  "react-dom": path.dirname(require.resolve("react-dom/package.json")),
};

const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const [name, root] of Object.entries(singletonRoots)) {
    if (moduleName === name || moduleName.startsWith(name + "/")) {
      const subpath = moduleName.slice(name.length);
      const target = subpath ? path.join(root, subpath) : root;
      return context.resolveRequest(context, target, platform);
    }
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
