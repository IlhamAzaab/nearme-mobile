import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import OptimizedImage from "../../components/common/OptimizedImage";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const getProfilePicCacheKey = (userId) =>
  userId ? `@profile_pic:${String(userId)}` : "@profile_pic";

/* ─────────────────────── PROFILE SCREEN ─────────────────────── */

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const profilePicCacheKey = getProfilePicCacheKey(user?.id);
  const [profilePic, setProfilePic] = useState(null);
  const [phone, setPhone] = useState(null);
  const [email, setEmail] = useState("");
  const [savedAddress, setSavedAddress] = useState({
    address: "",
    city: "",
    latitude: null,
    longitude: null,
  });
  const [profileLoading, setProfileLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const hasDeliveryPin =
    Number.isFinite(Number(savedAddress?.latitude)) &&
    Number.isFinite(Number(savedAddress?.longitude));

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const cachedProfilePic = await AsyncStorage.getItem(profilePicCacheKey);
      if (cachedProfilePic) {
        setProfilePic(cachedProfilePic);
      }

      const token = await getAccessToken();
      if (!token) {
        setPhone("");
        setEmail("");
        setProfilePic(cachedProfilePic || null);
        setSavedAddress({
          address: "",
          city: "",
          latitude: null,
          longitude: null,
        });
        return;
      }

      const res = await fetch(`${API_BASE_URL}/cart/customer-profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const customer = data?.customer || {};

      const resolvedProfilePic =
        customer?.profile_picture || customer?.profile_pic || null;
      const resolvedPhone = String(customer?.phone || "").trim();
      const resolvedEmail = String(customer?.email || user?.email || "").trim();
      const resolvedAddress = String(customer?.address || "").trim();
      const resolvedCity = String(customer?.city || "").trim();
      const lat = Number(customer?.latitude);
      const lng = Number(customer?.longitude);

      const profilePicToShow = cachedProfilePic || resolvedProfilePic || null;
      setProfilePic(profilePicToShow);
      setPhone(resolvedPhone);
      setEmail(resolvedEmail);
      setSavedAddress({
        address: resolvedAddress,
        city: resolvedCity,
        latitude: Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lng) ? lng : null,
      });

      if (resolvedProfilePic) {
        await AsyncStorage.multiSet([
          [profilePicCacheKey, resolvedProfilePic],
          ["@profile_pic", resolvedProfilePic],
        ]);
      }
    } catch (error) {
      console.error("Failed to load customer profile:", error);
    } finally {
      setProfileLoading(false);
    }
  }, [profilePicCacheKey, user?.email]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile]),
  );

  const handleLogout = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setLoggingOut(true);
          try {
            await logout();
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  }, [logout]);

  const initial = (user?.name || "U").charAt(0).toUpperCase();

  return (
    <SafeAreaView style={st.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* ── Header ── */}
      <View style={st.header}>
        <Text style={st.headerTitle}>Profile</Text>
      </View>

      <ScrollView
        contentContainerStyle={st.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════ PROFILE CARD ══════ */}
        <View style={st.profileCard}>
          <View style={st.avatarWrap}>
            {profilePic ? (
              <OptimizedImage uri={profilePic} style={st.avatarImg} />
            ) : (
              <View style={st.avatarFallback}>
                <Text style={st.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={st.onlineDot} />
          </View>
          <Text style={st.userName}>{user?.name || "User"}</Text>
          <Text style={st.userSub}>
            {profileLoading ? "Loading..." : phone || email || "Not provided"}
          </Text>
          <Pressable
            style={st.editBtn}
            onPress={() =>
              navigation.navigate("EditProfile", {
                prefill: {
                  name: user?.name || "",
                  email: email || "",
                  phone: phone || "",
                  profilePic: profilePic || null,
                },
              })
            }
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={st.editBtnTxt}>Edit Profile</Text>
          </Pressable>
        </View>

        {/* ══════ SAVED ADDRESS ══════ */}
        <View style={st.sectionCard}>
          <View style={st.sectionHeader}>
            <View style={st.sectionIconWrap}>
              <Ionicons name="location" size={18} color="#06C168" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionTitle}>Saved Address</Text>
              <Text style={st.sectionSubtitle} numberOfLines={2}>
                {savedAddress?.address
                  ? `${savedAddress.address}${savedAddress?.city ? `, ${savedAddress.city}` : ""}`
                  : "Not provided"}
              </Text>
            </View>
            <Pressable
              style={st.sectionAction}
              onPress={() => navigation.navigate("EditAddressDetails")}
            >
              <Text style={st.sectionActionTxt}>
                {savedAddress?.address ? "Change" : "Add"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#06C168" />
            </Pressable>
          </View>
        </View>

        <View style={st.sectionCard}>
          <View style={st.sectionHeader}>
            <View style={st.sectionIconWrap}>
              <Ionicons name="navigate" size={18} color="#06C168" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.sectionTitle}>Delivery Location</Text>
              <Text style={st.sectionSubtitle} numberOfLines={2}>
                {hasDeliveryPin ? "Location pinned" : "Not provided"}
              </Text>
            </View>
            <Pressable
              style={st.sectionAction}
              onPress={() => navigation.navigate("AddressPicker")}
            >
              <Text style={st.sectionActionTxt}>
                {hasDeliveryPin ? "Change" : "Add"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="#06C168" />
            </Pressable>
          </View>
        </View>

        {/* ══════ MENU ITEMS ══════ */}
        <View style={st.menuCard}>
          <MenuItem
            icon="notifications-outline"
            label="Notifications"
            onPress={() =>
              navigation.navigate("Home", { screen: "Notifications" })
            }
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() =>
              navigation.navigate("WebView", {
                url: "https://jolly-sundae-255ee6.netlify.app/",
                title: "Help & Support",
              })
            }
          />
          <MenuItem
            icon="document-text-outline"
            label="Terms & Conditions"
            onPress={() =>
              navigation.navigate("WebView", {
                url: "https://tranquil-medovik-7b2e45.netlify.app/",
                title: "Terms & Conditions",
              })
            }
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Privacy Policy"
            onPress={() =>
              navigation.navigate("WebView", {
                url: "https://mellow-daifuku-051f2e.netlify.app/",
                title: "Privacy Policy",
              })
            }
          />
        </View>

        {/* ══════ LOGOUT ══════ */}
        <Pressable
          style={st.logoutBtn}
          onPress={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? (
            <ActivityIndicator size="small" color="#EF4444" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={st.logoutTxt}>Logout</Text>
            </>
          )}
        </Pressable>

        <Text style={st.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Menu Item ─── */
function MenuItem({ icon, label, onPress, color = "#374151" }) {
  return (
    <Pressable
      style={({ pressed }) => [st.menuItem, pressed && { opacity: 0.6 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[st.menuLabel, { color }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
    </Pressable>
  );
}

/* ═══════════════════════ STYLES ═══════════════════════ */

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FFFFFF" },

  /* header */
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
  },

  scroll: { paddingHorizontal: 16, paddingBottom: 40 },

  /* ── profile card ── */
  profileCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  avatarWrap: { marginBottom: 14, position: "relative" },
  avatarImg: { width: 88, height: 88, borderRadius: 44 },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#06C168",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarInitial: { fontSize: 36, fontWeight: "800", color: "#fff" },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#06C168",
    borderWidth: 3,
    borderColor: "#fff",
  },
  userName: { fontSize: 20, fontWeight: "700", color: "#111827" },
  userSub: { fontSize: 13, color: "#6B7280", marginTop: 3 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#06C168",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 14,
  },
  editBtnTxt: { fontSize: 13, fontWeight: "600", color: "#fff" },

  /* ── section card ── */
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  sectionSubtitle: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  sectionAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  sectionActionTxt: { fontSize: 13, fontWeight: "600", color: "#06C168" },

  /* ── menu card ── */
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuLabel: { flex: 1, fontSize: 14, fontWeight: "500" },

  /* ── logout ── */
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 14,
    paddingVertical: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  logoutTxt: { fontSize: 15, fontWeight: "600", color: "#EF4444" },

  version: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
    marginBottom: 20,
  },
});
