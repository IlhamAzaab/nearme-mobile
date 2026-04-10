import { registerRootComponent } from "expo";
import { LogBox } from "react-native";
import { enableScreens } from "react-native-screens";

LogBox.ignoreLogs([
  "[expo-av]: Expo AV has been deprecated",
  "Expo AV has been deprecated and will be removed in SDK 54",
  "Expo AV has been deprecated",
  "setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture.",
  "VirtualizedList: You have a large list that is slow to update",
]);

const App = require("./src/app/App").default;

enableScreens(true);

registerRootComponent(App);
