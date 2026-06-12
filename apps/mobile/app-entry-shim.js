// Monorepo shim: expo/AppEntry.js imports "../../App" which resolves to the
// workspace root when expo is hoisted. This file (in apps/mobile) is substituted
// instead by the metro.config.js resolveRequest override.
//
// expo/AppEntry.js expects a default-exported React component and calls
// registerRootComponent(App) with it. We give it the expo-router App.
import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
export default App;
