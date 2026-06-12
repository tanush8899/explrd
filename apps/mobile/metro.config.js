const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch workspace root so Metro can resolve @explrd/shared
config.watchFolders = [workspaceRoot];

// Let Metro resolve packages from both the mobile app and workspace root
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// When expo is hoisted to the monorepo root by npm workspaces, expo/AppEntry.js
// (at <root>/node_modules/expo/AppEntry.js) resolves its hardcoded "../../App"
// import to the workspace root — not apps/mobile. Redirect it to our local shim
// that provides the expo-router App component as a default export, which
// expo/AppEntry.js can then pass to registerRootComponent.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    context.originModulePath.endsWith("/node_modules/expo/AppEntry.js") &&
    moduleName === "../../App"
  ) {
    return {
      filePath: path.resolve(projectRoot, "app-entry-shim.js"),
      type: "sourceFile",
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
