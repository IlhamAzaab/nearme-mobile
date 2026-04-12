import { AppState } from "react-native";
import { preloadAllAppImages } from "./ImagePreloader";

let lastRefresh = 0;
let unsubscribe = null;

const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function startBackgroundCacheRefresher(getRestaurants, getFoodItems) {
  if (unsubscribe) return unsubscribe;

  const subscription = AppState.addEventListener("change", async (state) => {
    if (state !== "active") return;

    const now = Date.now();
    if (now - lastRefresh <= REFRESH_INTERVAL_MS) return;

    lastRefresh = now;
    preloadAllAppImages(getRestaurants(), getFoodItems()).catch(() => {});
  });

  unsubscribe = () => {
    subscription.remove();
    unsubscribe = null;
  };

  return unsubscribe;
}