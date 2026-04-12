import { Image as ExpoImage } from "expo-image";

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
    await ExpoImage.prefetch(uniqueUrls, "memory-disk");
  } catch {
    // Prefetch should never block UI flow.
  }
}
