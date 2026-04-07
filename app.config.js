export default {
  expo: {
    name: "nearme-mobile",
    slug: "nearme-mobile",
    version: "1.0.1",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "nearmemobile",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.nearme.mobile",
      infoPlist: {
        UIBackgroundModes: ["remote-notification"],
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
        foregroundImage: "./assets/images/android-icon-foreground.png",
        backgroundImage: "./assets/images/android-icon-background.png",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "android.permission.USE_FULL_SCREEN_INTENT",
      ],
    },
    web: {
      output: "single",
      favicon: "./assets/images/favicon.png",
    },
    plugins: [
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
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
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true,
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
        "https://meezo-backend-d3gw.onrender.com",
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