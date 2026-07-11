import { Image as ExpoImage } from "expo-image";
import { applyCloudinaryTransformations } from "./cloudinaryImage";

let FastImage = null;
const preloadedUrlSet = new Set();
try {
  FastImage = require("react-native-fast-image");
} catch {
  FastImage = null;
}

const DEFAULT_PREFETCH_OPTIONS = { width: 720 };

function normalizeUrl(url) {
  const uri = String(url || "").trim();
  if (!uri) return "";
  if (!/^https?:\/\//i.test(uri)) return "";
  return uri;
}

function optimizeUrl(url, options) {
  const normalized = normalizeUrl(url);
  if (!normalized) return "";
  return applyCloudinaryTransformations(normalized, options || DEFAULT_PREFETCH_OPTIONS);
}

export function isImagePrefetched(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  // Check both raw and optimized versions
  if (preloadedUrlSet.has(normalized)) return true;
  const optimized = applyCloudinaryTransformations(normalized, DEFAULT_PREFETCH_OPTIONS);
  return preloadedUrlSet.has(optimized);
}

export async function prefetchImageUrls(urls = [], transformOptions) {
  const opts = transformOptions || DEFAULT_PREFETCH_OPTIONS;
  const uniqueUrls = [
    ...new Set(
      (urls || [])
        .map((url) => optimizeUrl(url, opts))
        .filter(Boolean),
    ),
  ];

  if (uniqueUrls.length === 0) return;

  try {
    if (
      FastImage &&
      typeof FastImage.preload === "function" &&
      FastImage.priority
    ) {
      FastImage.preload(
        uniqueUrls.map((uri) => ({
          uri,
          priority: FastImage.priority.normal,
        })),
      );
      uniqueUrls.forEach((uri) => preloadedUrlSet.add(uri));
      return;
    }

    await ExpoImage.prefetch(uniqueUrls, "memory-disk");
    uniqueUrls.forEach((uri) => preloadedUrlSet.add(uri));
  } catch {
    // Prefetch should never block UI flow.
  }
}

