const CLOUDINARY_HOST_REGEX = /(^|\.)cloudinary\.com$/i;
const UPLOAD_MARKER = "/upload/";
const SKIPPED_RESOURCE_TYPES_REGEX = /\/(?:raw|video)\/upload\//i;
const PDF_EXTENSION_REGEX = /\.pdf(?:$|[?#])/i;

function normalizeUrl(url) {
  if (typeof url !== "string") return "";
  return url.trim();
}

function splitUrl(url) {
  const normalized = normalizeUrl(url);
  if (!normalized) return { base: "", query: "", hash: "" };

  const hashIndex = normalized.indexOf("#");
  const queryIndex = normalized.indexOf("?");

  let cutIndex = -1;
  if (queryIndex >= 0 && hashIndex >= 0) cutIndex = Math.min(queryIndex, hashIndex);
  else if (queryIndex >= 0) cutIndex = queryIndex;
  else if (hashIndex >= 0) cutIndex = hashIndex;

  if (cutIndex < 0) {
    return { base: normalized, query: "", hash: "" };
  }

  const base = normalized.slice(0, cutIndex);
  const suffix = normalized.slice(cutIndex);
  const queryStart = suffix.indexOf("?");
  const hashStart = suffix.indexOf("#");

  let query = "";
  let hash = "";

  if (queryStart >= 0) {
    if (hashStart > queryStart) {
      query = suffix.slice(queryStart, hashStart);
      hash = suffix.slice(hashStart);
    } else {
      query = suffix.slice(queryStart);
    }
  } else if (hashStart >= 0) {
    hash = suffix.slice(hashStart);
  }

  return { base, query, hash };
}

function getHostname(url) {
  try {
    return new URL(url).hostname || "";
  } catch {
    return "";
  }
}

function isFinitePositiveNumber(value) {
  return Number.isFinite(value) && Number(value) > 0;
}

function sanitizeDimension(value) {
  const numberValue = Number(value);
  if (!isFinitePositiveNumber(numberValue)) return undefined;
  return Math.max(1, Math.round(numberValue));
}

function sanitizeQuality(value) {
  if (value == null || value === "") return "auto";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "auto";
    if (trimmed.toLowerCase() === "auto") return "auto";

    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return Math.min(100, Math.max(1, Math.round(numeric)));
    }
    return trimmed;
  }

  if (Number.isFinite(value)) {
    return Math.min(100, Math.max(1, Math.round(value)));
  }

  return "auto";
}

function sanitizeFormat(value) {
  if (value == null || value === "") return "auto";
  const format = String(value).trim().toLowerCase();
  return format || "auto";
}

function sanitizeCrop(value) {
  if (value == null || value === "") return undefined;
  const crop = String(value).trim().toLowerCase();
  return crop || undefined;
}

function looksLikeTransformationSegment(segment) {
  if (!segment) return false;
  if (/^v\d+$/i.test(segment)) return false;

  // Common Cloudinary transformation tokens look like "w_300", "q_auto", etc.
  return /(?:^|,)[a-z]{1,4}_[^,\/]+/i.test(segment);
}

function hasExistingTransformations(pathAfterUpload) {
  const firstSegment = String(pathAfterUpload || "").split("/")[0] || "";
  return looksLikeTransformationSegment(firstSegment);
}

export function isCloudinaryImageUrl(url) {
  const normalized = normalizeUrl(url);
  if (!/^https?:\/\//i.test(normalized)) return false;

  const hostname = getHostname(normalized);
  if (!CLOUDINARY_HOST_REGEX.test(hostname)) return false;

  const { base } = splitUrl(normalized);
  if (!base.includes(UPLOAD_MARKER)) return false;
  if (SKIPPED_RESOURCE_TYPES_REGEX.test(base)) return false;
  if (PDF_EXTENSION_REGEX.test(base)) return false;

  return true;
}

export function buildCloudinaryTransformString(options = {}) {
  const width = sanitizeDimension(options.width);
  const height = sanitizeDimension(options.height);
  const crop = sanitizeCrop(options.crop) || (width && height ? "fill" : undefined);
  const quality = sanitizeQuality(options.quality);
  const format = sanitizeFormat(options.format);

  const transforms = [`f_${format}`, `q_${quality}`];

  if (width) transforms.push(`w_${width}`);
  if (height) transforms.push(`h_${height}`);
  if (crop) transforms.push(`c_${crop}`);

  return transforms.join(",");
}

export function applyCloudinaryTransformations(url, options = {}) {
  const normalized = normalizeUrl(url);
  if (!isCloudinaryImageUrl(normalized)) return normalized;

  const { base, query, hash } = splitUrl(normalized);
  const markerIndex = base.indexOf(UPLOAD_MARKER);
  if (markerIndex < 0) return normalized;

  const beforeUpload = base.slice(0, markerIndex + UPLOAD_MARKER.length);
  const afterUpload = base.slice(markerIndex + UPLOAD_MARKER.length);

  if (!options.force && hasExistingTransformations(afterUpload)) {
    return normalized;
  }

  const transformation = buildCloudinaryTransformString(options);
  if (!transformation) return normalized;

  const normalizedAfterUpload = afterUpload.replace(/^\/+/, "");
  const transformedBase = `${beforeUpload}${transformation}/${normalizedAfterUpload}`;

  return `${transformedBase}${query}${hash}`;
}

export function getCloudinaryImage(url, widthOrOptions, height) {
  let options = {};

  if (typeof widthOrOptions === "number") {
    options.width = widthOrOptions;
    if (typeof height === "number") {
      options.height = height;
    }
  } else if (widthOrOptions && typeof widthOrOptions === "object") {
    options = widthOrOptions;
  }

  return applyCloudinaryTransformations(url, options);
}
