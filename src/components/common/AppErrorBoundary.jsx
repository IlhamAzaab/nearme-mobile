import React from "react";
import { Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    const scope = this.props.scope || "App";
    console.error(`[${scope}] Uncaught render error:`, error);
    if (errorInfo?.componentStack) {
      console.error(`[${scope}] Component stack:\n${errorInfo.componentStack}`);
    }
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ error: null, errorInfo: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.error) {
      const scope = this.props.scope || "App";
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Screen failed to render</Text>
            <Text style={styles.message}>
              {scope} hit a runtime error. The details were logged to the
              terminal so the root cause can be traced.
            </Text>
            <Text style={styles.errorText} numberOfLines={6}>
              {String(
                this.state.error?.message ||
                  this.state.error ||
                  "Unknown error",
              )}
            </Text>
            <Pressable style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 20,
    backgroundColor: "#111827",
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 10,
  },
  message: {
    color: "#CBD5E1",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  errorText: {
    color: "#FCA5A5",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 18,
  },
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "#06C168",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
