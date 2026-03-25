import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

export default function WebViewScreen({ navigation, route }) {
  const { url, title } = route.params;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleGoBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const handleRetry = () => {
    setHasError(false);
    setIsLoading(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={handleGoBack}
          hitSlop={10}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.headerRight} />
      </View>

      {/* WebView Container */}
      <View style={styles.webViewContainer}>
        {hasError ? (
          <View style={styles.errorContainer}>
            <Ionicons name="cloud-offline-outline" size={64} color="#9CA3AF" />
            <Text style={styles.errorTitle}>Unable to load page</Text>
            <Text style={styles.errorText}>
              Please check your internet connection and try again.
            </Text>
            <Pressable style={styles.retryButton} onPress={handleRetry}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            source={{ uri: url }}
            style={styles.webView}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            onHttpError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            startInLoadingState={true}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            scalesPageToFit={true}
            showsVerticalScrollIndicator={true}
            showsHorizontalScrollIndicator={false}
          />
        )}

        {/* Loading Overlay */}
        {isLoading && !hasError && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#06C168" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    backgroundColor: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginHorizontal: 12,
  },
  headerRight: {
    width: 40,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#06C168",
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
