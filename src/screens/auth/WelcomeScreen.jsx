import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  StatusBar,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      
      {/* Hero Image Section - Top 60% */}
      <View style={styles.heroSection}>
        <Image
          source={require("../../assets/images/md.jpg")}
          style={styles.heroImage}
          contentFit="cover"
        />
        {/* Soft Blur Gradient Overlay */}
        <LinearGradient
          colors={["transparent", "transparent", "rgba(255,255,255,0.5)", "#ffffff"]}
          style={styles.gradientOverlay}
        />
      </View>

      {/* Bottom Content Section - Minimal */}
      <SafeAreaView style={styles.bottomContainer}>
        {/* Get Started Button */}
        <Pressable
          onPress={() => navigation.navigate("Login")}
          style={({ pressed }) => [
            styles.getStartedBtn,
            pressed && styles.btnPressed,
          ]}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </Pressable>

        {/* Sign Up Link */}
        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>Don't have an account?{" "}</Text>
          <Pressable onPress={() => navigation.navigate("Signup")}>
            <Text style={styles.signupLink}>Sign Up</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  heroSection: {
    height: height * 0.72,
    width: "100%",
    position: "relative",
    overflow: "hidden",
  },

  heroImage: {
    width: "100%",
    height: "100%",
  },

  gradientOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
  },

  bottomContainer: {
    flex: 0.28,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 20,
  },

  /* Get Started Button */
  getStartedBtn: {
    backgroundColor: "#06C168",
    borderRadius: 28,
    height: 55,
    width: 180,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },

  getStartedText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },

  btnPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },

  /* Sign Up Text */
  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },

  signupText: {
    fontSize: 13,
    color: "#666666",
    fontWeight: "400",
  },

  signupLink: {
    fontSize: 13,
    color: "#06C168",
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
