import { Image as ExpoImage } from "expo-image";
import { useMemo, useState } from "react";
import { PixelRatio, StyleSheet } from "react-native";
import { applyCloudinaryTransformations } from "../../lib/cloudinaryImage";
import { isImagePrefetched } from "../../lib/imageCache";

let FastImage = null;
try {
  const fastImageModule = require("react-native-fast-image");
  FastImage = fastImageModule?.default || fastImageModule;
} catch {
  FastImage = null;
}

function mapResizeMode(contentFit) {
  switch (contentFit) {
    case "contain":
      return "contain";
    case "fill":
      return "stretch";
    case "none":
      return "center";
    case "cover":
    default:
      return "cover";
  }
}

function normalizeUri(uri) {
  if (typeof uri !== "string") return "";
  return uri.trim();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPositiveNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return value;
}

function getStyleDimensions(style) {
  const flattenedStyle = StyleSheet.flatten(style);
  if (!flattenedStyle || typeof flattenedStyle !== "object") {
    return { width: undefined, height: undefined };
  }

  return {
    width: toPositiveNumber(flattenedStyle.width),
    height: toPositiveNumber(flattenedStyle.height),
  };
}

const CLOUDINARY_PRESETS = {
  thumbnail: { width: 150, height: 150, crop: "fill" },
  card: { width: 360 },
  medium: { width: 720 },
  hero: { width: 860 },
};

function inferCloudinaryOptions(style) {
  const { width, height } = getStyleDimensions(style);
  const maxLayoutDimension = Math.max(width || 0, height || 0);

  if (!Number.isFinite(maxLayoutDimension) || maxLayoutDimension <= 0) {
    return {};
  }

  const devicePixelRatio = clamp(PixelRatio.get() || 1, 1, 3);

  if (maxLayoutDimension <= 120) {
    const thumbWidth = clamp(Math.round((width || 100) * devicePixelRatio), 80, 220);
    const thumbHeight = clamp(
      Math.round((height || width || 100) * devicePixelRatio),
      80,
      220,
    );
    return {
      width: thumbWidth,
      height: thumbHeight,
      crop: "fill",
    };
  }

  if (maxLayoutDimension <= 220) {
    const cardWidth = clamp(Math.round((width || 180) * devicePixelRatio), 180, 420);
    const cardHeight = height
      ? clamp(Math.round(height * devicePixelRatio), 120, 420)
      : undefined;

    return {
      width: cardWidth,
      height: cardHeight,
      crop: cardHeight ? "fill" : undefined,
    };
  }

  const mediumWidth = width
    ? clamp(Math.round(width * devicePixelRatio), 420, 960)
    : 780;

  return {
    width: mediumWidth,
  };
}

function resolveCloudinaryOptions({ style, preset, options }) {
  const inferredOptions = inferCloudinaryOptions(style);
  const presetOptions =
    preset && CLOUDINARY_PRESETS[preset] ? CLOUDINARY_PRESETS[preset] : {};

  return {
    ...inferredOptions,
    ...presetOptions,
    ...(options || {}),
  };
}

function mapFastImageResizeMode(contentFit) {
  if (!FastImage?.resizeMode) {
    return mapResizeMode(contentFit);
  }

  switch (contentFit) {
    case "contain":
      return FastImage.resizeMode.contain;
    case "fill":
      return FastImage.resizeMode.stretch;
    case "none":
      return FastImage.resizeMode.center;
    case "cover":
    default:
      return FastImage.resizeMode.cover;
  }
}

export default function OptimizedImage({
  uri,
  source,
  style,
  contentFit = "cover",
  transition = 140,
  cloudinaryPreset,
  cloudinaryOptions,
  disableCloudinaryTransform = false,
  fallback = null,
  onError,
  onLoad,
  onLoadEnd,
  ...rest
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  const resolvedUri = useMemo(() => {
    if (source?.uri) return normalizeUri(source.uri);
    return normalizeUri(uri);
  }, [source?.uri, uri]);

  const transformedUri = useMemo(() => {
    if (!resolvedUri || disableCloudinaryTransform) {
      return resolvedUri;
    }

    const options = resolveCloudinaryOptions({
      style,
      preset: cloudinaryPreset,
      options: cloudinaryOptions,
    });

    return applyCloudinaryTransformations(resolvedUri, options);
  }, [
    cloudinaryOptions,
    cloudinaryPreset,
    disableCloudinaryTransform,
    resolvedUri,
    style,
  ]);

  const sourceKey = useMemo(() => transformedUri, [transformedUri]);
  const effectiveTransition = isImagePrefetched(transformedUri)
    ? 0
    : Number.isFinite(transition)
      ? transition
      : 140;

  if (!transformedUri || loadFailed) {
    return fallback;
  }

  const normalizedSource = {
    ...(source || {}),
    uri: transformedUri,
  };

  if (FastImage) {
    return (
      <FastImage
        key={sourceKey}
        source={{
          ...normalizedSource,
          priority: FastImage?.priority?.normal,
        }}
        style={style}
        resizeMode={mapFastImageResizeMode(contentFit)}
        onLoad={onLoad}
        onLoadEnd={onLoadEnd}
        onError={(event) => {
          setLoadFailed(true);
          onError?.(event);
        }}
        {...rest}
      />
    );
  }

  return (
    <ExpoImage
      key={sourceKey}
      source={normalizedSource}
      style={style}
      contentFit={contentFit}
      cachePolicy="memory-disk"
      transition={effectiveTransition}
      onLoad={onLoad}
      onLoadEnd={onLoadEnd}
      onError={(event) => {
        setLoadFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
