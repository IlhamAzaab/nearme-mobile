import { registerRootComponent } from "expo";
import { LogBox } from "react-native";
import { enableScreens } from "react-native-screens";
import "./src/services/driverBackgroundLocationService";

LogBox.ignoreLogs([
  "[expo-av]: Expo AV has been deprecated",
  "Expo AV has been deprecated and will be removed in SDK 54",
  "Expo AV has been deprecated",
  "setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.",
  "VirtualizedList: You have a large list that is slow to update",
]);

if (global.ErrorUtils?.setGlobalHandler) {
  const previousHandler = global.ErrorUtils.getGlobalHandler?.();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error("[GlobalError] Uncaught JS error:", error);
    console.error("[GlobalError] Fatal:", Boolean(isFatal));
    if (error?.stack) {
      console.error("[GlobalError] Stack:\n" + error.stack);
    }

    if (typeof previousHandler === "function") {
      previousHandler(error, isFatal);
    }
  });
}

const App = require("./src/app/App").default;

enableScreens(true);

registerRootComponent(App);
