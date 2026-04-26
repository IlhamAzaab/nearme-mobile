const BRAND_ASSETS = {
  appIcon: "./assets/branding/app-icon.png",
  iosIcon: "./assets/branding/ios-icon.png",
  androidAdaptiveForeground:
    "./assets/branding/android-adaptive-foreground.png",
  androidAdaptiveMonochrome:
    "./assets/branding/android-adaptive-monochrome.png",
  splashLogo: "./assets/branding/splash-logo.png",
  favicon: "./assets/branding/favicon.png",
};

export default {
  expo: {
    name: "Meezo",
    slug: "nearme-mobile",
    version: "1.0.1",
    orientation: "portrait",
    icon: BRAND_ASSETS.appIcon,
    scheme: "nearmemobile",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.nearme.mobile",
      icon: BRAND_ASSETS.iosIcon,
      infoPlist: {
        UIBackgroundModes: ["remote-notification", "location"],
        NSLocationWhenInUseUsageDescription:
          "Meezo uses your location to show nearby deliveries and navigation updates.",
        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Meezo needs background location to keep customer tracking accurate during active deliveries.",
      },
    },
    android: {
      package: "com.nearme.mobile",
      // In EAS Build, the file-type env var contains the path to the temp file.
      // Locally, fall back to ./google-services.json for development.
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: BRAND_ASSETS.androidAdaptiveForeground,
        monochromeImage: BRAND_ASSETS.androidAdaptiveMonochrome,
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "android.permission.USE_FULL_SCREEN_INTENT",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
      ],
    },
    web: {
      output: "single",
      favicon: BRAND_ASSETS.favicon,
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: BRAND_ASSETS.splashLogo,
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#06C168",
          dark: {
            backgroundColor: "#06C168",
          },
        },
      ],
      [
        "expo-notifications",
        {
          color: "#22c55e",
          defaultChannel: "default",
          // Custom alarm sound compiled into res/raw/alarm at build time.
          // Used by the urgent_orders notification channel so background/killed
          // FCM notifications ring with the custom sound (requires a new build).
          sounds: ["./assets/sounds/alarm.mp3"],
        },
      ],
      [
        "expo-location",
        {
          isAndroidBackgroundLocationEnabled: true,
          isIosBackgroundLocationEnabled: true,
        },
      ],
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic:
              String(process.env.ALLOW_CLEARTEXT_TRAFFIC || "false") === "true",
          },
        },
      ],
      "expo-secure-store",
      "@react-native-community/datetimepicker",
      "expo-document-picker",
    ],
    experiments: {
      reactCompiler: false,
    },
    owner: "mohamedilham",
    extra: {
      API_URL:
        process.env.API_URL ||
        process.env.EXPO_PUBLIC_API_URL ||
        "https://api.meezo.lk",
      SUPABASE_URL:
        process.env.SUPABASE_URL ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        process.env.VITE_SUPABASE_URL ||
        "",
      SUPABASE_ANON_KEY:
        process.env.SUPABASE_ANON_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.VITE_SUPABASE_ANON_KEY ||
        "",
      ENABLE_LOGGING: String(process.env.ENABLE_LOGGING || "true") === "true",
      eas: {
        projectId: "ae8e5d23-1d5a-4b87-81bf-feb46fe5dedb",
      },
    },
  },
};
