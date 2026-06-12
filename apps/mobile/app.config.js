const IS_DEV = process.env.APP_VARIANT === "development";

/** @type {import('expo/config').ExpoConfig} */
const config = {
  name: IS_DEV ? "Explr (Dev)" : "Explr",
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
      NSPhotoLibraryAddUsageDescription: "Explr saves your passport card to Photos.",
      NSPhotoLibraryUsageDescription: "Explr saves your passport card to Photos.",
      NSLocationWhenInUseUsageDescription: "Explr shows your saved places on the map.",
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
        backgroundColor: "#06080d",
        image: "./assets/splash-icon.png",
        imageWidth: 200,
      },
    ],
    [
      "expo-media-library",
      {
        photosPermission: "Explr saves your passport card to your photo library.",
      },
    ],
    "expo-image",
    "expo-sharing",
    "expo-status-bar",
    "expo-web-browser",
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
