import { useMemo, useState } from "react";
import { Image as ReactNativeImage } from "react-native";

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

  return (
    <ReactNativeImage
      source={{ uri: resolvedUri }}
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
