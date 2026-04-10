import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";

export default function EditProfileScreen({ navigation }) {
  const { user } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [profilePic, setProfilePic] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pic = await AsyncStorage.getItem("@profile_pic");
        const nm = await AsyncStorage.getItem("userName");
        if (pic) setProfilePic(pic);
        if (nm) setName(nm);
      } catch {}
    })();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photos to change your profile picture.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setProfilePic(result.assets[0].uri);
      }
    } catch (e) {
      console.error("Image picker error:", e);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      Alert.alert("Name required", "Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem("userName", name.trim());
      if (profilePic) await AsyncStorage.setItem("@profile_pic", profilePic);

      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [name, profilePic, navigation]);

  const initial = (name || "U").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={st.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDFBF2" />

      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>
        <Text style={st.headerTitle}>Edit Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={st.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Avatar ── */}
          <View style={st.avatarSection}>
            <Pressable onPress={pickImage} style={st.avatarPress}>
              {profilePic ? (
                <Image source={{ uri: profilePic }} style={st.avatarImg} />
              ) : (
                <View style={st.avatarFallback}>
                  <Text style={st.avatarInitial}>{initial}</Text>
                </View>
              )}
              <View style={st.cameraIcon}>
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            </Pressable>
            <Text style={st.changePicTxt}>Tap to change photo</Text>
          </View>

          {/* ── Fields ── */}
          <View style={st.fieldCard}>
            <FieldRow
              icon="person-outline"
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
            />
          </View>

          {/* ── Save ── */}
          <Pressable
            style={[st.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={st.saveBtnTxt}>Save Changes</Text>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ─── Field Row ─── */
function FieldRow({ icon, label, value, onChangeText, placeholder, keyboardType, autoCapitalize }) {
  return (
    <View style={st.fieldRow}>
      <View style={st.fieldIconWrap}>
        <Ionicons name={icon} size={18} color="#06C168" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={st.fieldLabel}>{label}</Text>
        <TextInput
          style={st.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
        />
      </View>
    </View>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EDFBF2" },

  /* header */
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#EDFBF2",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111827" },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  /* avatar */
  avatarSection: { alignItems: "center", paddingVertical: 24 },
  avatarPress: { position: "relative" },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 40, fontWeight: "800", color: "#fff" },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#EDFBF2",
  },
  changePicTxt: { fontSize: 12, color: "#6B7280", marginTop: 8 },

  /* field card */
  fieldCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 6,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#9CA3AF",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginHorizontal: 16,
  },

  /* save btn */
  saveBtn: {
    backgroundColor: "#06C168",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveBtnTxt: { fontSize: 16, fontWeight: "700", color: "#fff" },
});
