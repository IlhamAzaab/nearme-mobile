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
      "@react-native-community/datetimepicker",
    ],
    experiments: {
      reactCompiler: false,
    },
    owner: "mohamedilham",
    extra: {
      eas: {
        projectId: "ae8e5d23-1d5a-4b87-81bf-feb46fe5dedb",
      },
    },
  },
};
