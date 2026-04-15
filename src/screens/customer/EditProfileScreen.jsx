import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import OptimizedImage from "../../components/common/OptimizedImage";

export default function EditProfileScreen({ navigation, route }) {
  const { user, refreshAuthState } = useAuth();
  const prefill = route?.params?.prefill || {};

  const [name, setName] = useState(prefill?.name || user?.name || "");
  const [email, setEmail] = useState(prefill?.email || user?.email || "");
  const [phone, setPhone] = useState(prefill?.phone || "");
  const [profilePic, setProfilePic] = useState(prefill?.profilePic || null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const pic = await AsyncStorage.getItem("@profile_pic");
        const ph = await AsyncStorage.getItem("@profile_phone");
        const nm = await AsyncStorage.getItem("userName");
        const em = await AsyncStorage.getItem("userEmail");
        if (pic) setProfilePic(pic);
        if (nm) setName(nm);
        if (ph) setPhone(ph);
        if (em) setEmail(em);
      } catch {}
    })();
  }, []);

  const pickImage = useCallback(async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please allow access to your photos to change your profile picture.",
        );
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
      await refreshAuthState();

      Alert.alert("Saved", "Your profile has been updated.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [name, profilePic, navigation, refreshAuthState]);

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
                <OptimizedImage uri={profilePic} style={st.avatarImg} />
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
              autoCapitalize="words"
            />
            <View style={st.divider} />
            <ReadOnlyFieldRow
              icon="mail-outline"
              label="Email"
              value={email || "Not available"}
            />
            <View style={st.divider} />
            <ReadOnlyFieldRow
              icon="call-outline"
              label="Phone Number"
              value={phone || "Not available"}
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

function ReadOnlyFieldRow({ icon, label, value }) {
  return (
    <View style={st.fieldRow}>
      <View style={st.fieldIconWrap}>
        <Ionicons name={icon} size={18} color="#06C168" />
      </View>
      <View style={{ flex: 1 }}>
        <View style={st.readOnlyLabelRow}>
          <Text style={st.fieldLabel}>{label}</Text>
          <View style={st.verifiedChip}>
            <Ionicons name="checkmark-circle" size={12} color="#06C168" />
            <Text style={st.verifiedChipText}>Verified</Text>
          </View>
        </View>
        <Text style={st.readOnlyValue}>{value}</Text>
      </View>
      <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
    </View>
  );
}

/* ─── Field Row ─── */
function FieldRow({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
}) {
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
  readOnlyLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  readOnlyValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
  },
  verifiedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#E6F9EE",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#06C168",
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
