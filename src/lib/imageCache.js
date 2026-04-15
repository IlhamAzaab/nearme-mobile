import { Image as ExpoImage } from "expo-image";

let FastImage = null;
try {
  FastImage = require("react-native-fast-image");
} catch {
  FastImage = null;
}

function normalizeUrl(url) {
  const uri = String(url || "").trim();
  if (!uri) return "";
  if (!/^https?:\/\//i.test(uri)) return "";
  return uri;
}

export async function prefetchImageUrls(urls = []) {
  const uniqueUrls = [
    ...new Set((urls || []).map((url) => normalizeUrl(url))),
  ].filter(Boolean);

  if (uniqueUrls.length === 0) return;

  try {
    if (
      FastImage &&
      typeof FastImage.preload === "function" &&
      FastImage.priority
    ) {
      await FastImage.preload(
        uniqueUrls.map((uri) => ({
          uri,
          priority: FastImage.priority.normal,
        })),
      );
      return;
    }

    await ExpoImage.prefetch(uniqueUrls, "memory-disk");
  } catch {
    // Prefetch should never block UI flow.
  }
}
