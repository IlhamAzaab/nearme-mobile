import { useMemo, useState } from "react";
import { Image as ReactNativeImage } from "react-native";

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
  transition,
  fallback = null,
  onError,
  ...rest
}) {
  const [loadFailed, setLoadFailed] = useState(false);

  const resolvedUri = useMemo(() => {
    if (source?.uri) return normalizeUri(source.uri);
    return normalizeUri(uri);
  }, [source?.uri, uri]);

  if (!resolvedUri || loadFailed) {
    return fallback;
  }

  const normalizedSource = {
    ...(source || {}),
    uri: resolvedUri,
  };

  if (FastImage) {
    return (
      <FastImage
        source={{
          ...normalizedSource,
          priority: FastImage?.priority?.normal,
        }}
        style={style}
        resizeMode={mapFastImageResizeMode(contentFit)}
        onError={(event) => {
          setLoadFailed(true);
          onError?.(event);
        }}
        {...rest}
      />
    );
  }

  return (
    <ReactNativeImage
      source={normalizedSource}
      style={style}
      resizeMode={mapResizeMode(contentFit)}
      onError={(event) => {
        setLoadFailed(true);
        onError?.(event);
      }}
      {...rest}
    />
  );
}
