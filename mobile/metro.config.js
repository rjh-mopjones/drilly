// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the workspace root so changes to packages/parser hot-reload
config.watchFolders = [workspaceRoot];

// Allow Metro to resolve packages from both project and workspace node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Treat markdown files as static assets so `require("./assets/content/foo.md")` returns
// an asset module ID consumable by expo-asset.
config.resolver.assetExts.push("md");

// Don't try to transform .md as source code
config.resolver.sourceExts = config.resolver.sourceExts.filter((ext) => ext !== "md");

// @xyflow/react (interactive architecture diagrams) depends on zustand, whose
// ESM build uses `import.meta.env` to emit deprecation warnings. Metro bundles
// web as a classic script, so `import.meta` is a hard syntax error and the
// entire bundle fails to parse at runtime, rendering a blank page. zustand also
// ships a clean CJS build, so disable package-exports resolution for that one
// package to fall back to its `main` entry.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  if (moduleName === "zustand" || moduleName.startsWith("zustand/")) {
    return context.resolveRequest(
      { ...context, unstable_enablePackageExports: false },
      moduleName,
      platform,
    );
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
