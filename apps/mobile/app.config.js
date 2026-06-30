const IS_DEV = process.env.APP_VARIANT === "development";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: IS_DEV ? "explrd (Dev)" : "explrd",
  slug: "explrd",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  scheme: IS_DEV ? "explrd-dev" : "explrd",
  userInterfaceStyle: "light",
  ios: {
    supportsTablet: false,
    bundleIdentifier: IS_DEV ? "com.explrd.app.dev" : "com.explrd.app",
    infoPlist: {
      NSPhotoLibraryAddUsageDescription: "explrd saves your passport card to Photos.",
      NSPhotoLibraryUsageDescription:
        "explrd reads the location saved in your photos to map the cities you've visited, and saves your passport card to Photos. Your photos never leave your device.",
      NSLocationWhenInUseUsageDescription: "explrd shows your saved places on the map.",
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#fafbfc",
    },
    package: IS_DEV ? "com.explrd.app.dev" : "com.explrd.app",
    permissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_AUDIO",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        // Solid dark fill that matches the center of the JS SplashScreen
        // gradient (#1a2238 → #0d1120) so the native → JS handoff is seamless.
        // No image: the old placeholder splash-icon.png rendered as a white
        // box on the dark background and flashed for ~0.5s before the JS
        // splash (globe + wordmark) faded in.
        backgroundColor: "#13192c",
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission:
          "explrd reads the location saved in your photos to map the cities you've visited. Your photos never leave your device.",
      },
    ],
    "expo-image",
    "expo-sharing",
    "expo-status-bar",
    "expo-web-browser",
    "expo-apple-authentication",
    [
      "expo-notifications",
      {
        // Tints the notification on Android; uses the default icon for now.
        color: "#007aff",
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: "fe1f682b-7466-46b3-9157-31a07f36749e",
    },
  },
};

module.exports = { expo: config };
