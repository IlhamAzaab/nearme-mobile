import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../app/providers/AuthProvider";
import { API_URL } from "../../config/env";
import { getAccessToken } from "../../lib/authStorage";

const fetchAdminProfile = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const response = await fetch(`${API_URL}/admin/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load profile");
  }

  return data?.admin || null;
};

const fetchAdminRestaurant = async () => {
  const token = await getAccessToken();
  if (!token) throw new Error("No authentication token");

  const response = await fetch(`${API_URL}/admin/restaurant`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || "Failed to load restaurant");
  }

  return data?.restaurant || null;
};

const ProfileSkeleton = ({ opacity }) => {
  const animatedOpacity = { opacity };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerWrap}>
          <Animated.View
            style={[
              styles.skeletonLine,
              styles.skeletonHeaderTitle,
              animatedOpacity,
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonLine,
              styles.skeletonHeaderSubtitle,
              animatedOpacity,
            ]}
          />
        </View>

        <View style={styles.profileCard}>
          <Animated.View style={[styles.skeletonAvatar, animatedOpacity]} />
          <Animated.View style={[styles.skeletonPill, animatedOpacity]} />
          <Animated.View
            style={[
              styles.skeletonLine,
              styles.skeletonProfileName,
              animatedOpacity,
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonLine,
              styles.skeletonProfileRole,
              animatedOpacity,
            ]}
          />

          <View style={styles.metaBadgesRow}>
            <Animated.View style={[styles.skeletonBadge, animatedOpacity]} />
            <Animated.View style={[styles.skeletonBadge, animatedOpacity]} />
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.sectionHeaderRow}>
            <Animated.View
              style={[styles.skeletonSectionIcon, animatedOpacity]}
            />
            <View style={styles.sectionTitleWrap}>
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonSectionTitle,
                  animatedOpacity,
                ]}
              />
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonSectionSubtitle,
                  animatedOpacity,
                ]}
              />
            </View>
          </View>

          <Animated.View style={[styles.skeletonDetailRow, animatedOpacity]} />
          <Animated.View style={[styles.skeletonDetailRow, animatedOpacity]} />
          <Animated.View
            style={[styles.skeletonDetailRowShort, animatedOpacity]}
          />
        </View>

        <View style={styles.actionCard}>
          <View style={styles.actionLeft}>
            <Animated.View
              style={[styles.skeletonSectionIcon, animatedOpacity]}
            />
            <View style={styles.actionTextWrap}>
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonActionTitle,
                  animatedOpacity,
                ]}
              />
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonActionSubtitle,
                  animatedOpacity,
                ]}
              />
            </View>
          </View>
          <Animated.View style={[styles.skeletonChevron, animatedOpacity]} />
        </View>

        <View style={styles.securityCard}>
          <View style={styles.actionLeft}>
            <Animated.View
              style={[styles.skeletonSectionIcon, animatedOpacity]}
            />
            <View style={styles.actionTextWrap}>
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonActionTitle,
                  animatedOpacity,
                ]}
              />
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonActionSubtitle,
                  animatedOpacity,
                ]}
              />
            </View>
          </View>
          <View style={styles.securityBottomRow}>
            <View>
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonPasswordLabel,
                  animatedOpacity,
                ]}
              />
              <Animated.View
                style={[
                  styles.skeletonLine,
                  styles.skeletonPasswordHidden,
                  animatedOpacity,
                ]}
              />
            </View>
            <Animated.View
              style={[styles.skeletonChangePassword, animatedOpacity]}
            />
          </View>
        </View>

        <Animated.View style={[styles.skeletonLogout, animatedOpacity]} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default function Profile() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(18)).current;
  const skeletonOpacity = useRef(new Animated.Value(0.55)).current;

  const profileQuery = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: fetchAdminProfile,
    staleTime: 60 * 1000,
  });

  const restaurantQuery = useQuery({
    queryKey: ["admin", "restaurant"],
    queryFn: fetchAdminRestaurant,
    staleTime: 60 * 1000,
  });

  const admin = profileQuery.data;
  const restaurant = restaurantQuery.data;

  const displayName = useMemo(
    () => admin?.username || admin?.name || "Admin",
    [admin],
  );

  const displayEmail = useMemo(() => admin?.email || "-", [admin]);

  const displayPhone = useMemo(
    () => admin?.mobile_number || admin?.phone || "-",
    [admin],
  );

  const isInitialLoading =
    (profileQuery.isLoading && !profileQuery.data) ||
    (restaurantQuery.isLoading && !restaurantQuery.data);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateYAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, translateYAnim]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonOpacity, {
          toValue: 0.55,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [skeletonOpacity]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "profile"] }),
        queryClient.invalidateQueries({ queryKey: ["admin", "restaurant"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  if (isInitialLoading) {
    return <ProfileSkeleton opacity={skeletonOpacity} />;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: translateYAnim }],
        }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#06C168"]}
            />
          }
        >
          <View style={styles.headerWrap}>
            <Text style={styles.headerTitle}>My Account</Text>
            <Text style={styles.headerSubtitle}>
              Manage your admin profile and account security
            </Text>
          </View>

          {(profileQuery.error || restaurantQuery.error) && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {profileQuery.error?.message ||
                  restaurantQuery.error?.message ||
                  "Unable to load profile details"}
              </Text>
            </View>
          )}

          <View style={styles.profileCard}>
            <View style={styles.avatarBox}>
              <Text style={styles.avatarText}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
            <Text style={styles.profileEmail}>{displayEmail}</Text>
            <Text style={styles.profileRole}>Admin Account</Text>

            <View style={styles.metaBadgesRow}>
              <View style={styles.metaBadgeGreen}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={12}
                  color="#05803E"
                />
                <Text style={styles.metaBadgeGreenText}>Admin Role</Text>
              </View>
              <View style={styles.metaBadgeBlue}>
                <Ionicons name="checkmark-outline" size={12} color="#1D4ED8" />
                <Text style={styles.metaBadgeBlueText}>Onboarded</Text>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.sectionHeaderRow}>
              <View style={styles.sectionIconGreen}>
                <Ionicons
                  name="person-circle-outline"
                  size={16}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.sectionTitleWrap}>
                <Text style={styles.sectionTitle}>Account Information</Text>
                <Text style={styles.sectionSubTitle}>
                  Your admin account details
                </Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>EMAIL ADDRESS</Text>
              <Text style={styles.detailValue}>{displayEmail}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>PHONE NUMBER</Text>
              <Text style={styles.detailValue}>{displayPhone}</Text>
            </View>

            <View style={styles.detailRowNoBorder}>
              <Text style={styles.detailLabel}>ACCOUNT STATUS</Text>
              <Text style={styles.detailHint}>
                {admin?.admin_status || "Not set"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionCard}
            activeOpacity={0.75}
            onPress={() => navigation.navigate("RestaurantDetail")}
          >
            <View style={styles.actionLeft}>
              <View style={styles.sectionIconOrange}>
                <Ionicons name="restaurant-outline" size={17} color="#FFFFFF" />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Restaurant Details</Text>
                <Text style={styles.actionSubTitle} numberOfLines={1}>
                  View and manage your restaurant profile, images and location
                </Text>
                {restaurant?.restaurant_name ? (
                  <Text style={styles.restaurantMiniText} numberOfLines={1}>
                    {restaurant.restaurant_name}
                  </Text>
                ) : null}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#98A2B3" />
          </TouchableOpacity>

          <View style={styles.securityCard}>
            <View style={styles.actionLeft}>
              <View style={styles.sectionIconGreen}>
                <Ionicons
                  name="lock-closed-outline"
                  size={17}
                  color="#FFFFFF"
                />
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={styles.actionTitle}>Security</Text>
                <Text style={styles.actionSubTitle}>Manage your password</Text>
              </View>
            </View>

            <View style={styles.securityBottomRow}>
              <View>
                <Text style={styles.passwordLabel}>Password</Text>
                <Text style={styles.passwordHidden}> (hidden)</Text>
              </View>
              <TouchableOpacity
                style={styles.changePasswordBtn}
                onPress={() => navigation.navigate("AdminProfile")}
              >
                <Text style={styles.changePasswordText}>Change Password</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  headerWrap: {
    paddingHorizontal: 4,
    paddingTop: 8,
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 33,
    lineHeight: 36,
    fontWeight: "700",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 2,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "500",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    marginBottom: 12,
  },
  avatarBox: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#07B95A",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "700",
  },
  activeBadge: {
    marginTop: -6,
    backgroundColor: "#B8F0D0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  activeBadgeText: {
    color: "#047857",
    fontSize: 12,
    fontWeight: "600",
  },
  profileEmail: {
    marginTop: 10,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "700",
    color: "#111827",
  },
  profileRole: {
    marginTop: 4,
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "500",
  },
  metaBadgesRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaBadgeGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EAF9F0",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaBadgeGreenText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#05803E",
  },
  metaBadgeBlue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E6EEFF",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaBadgeBlueText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1D4ED8",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionIconGreen: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06C168",
  },
  sectionIconOrange: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F97316",
  },
  sectionTitleWrap: {
    marginLeft: 10,
  },
  sectionTitle: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "700",
  },
  sectionSubTitle: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  detailRow: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingVertical: 10,
  },
  detailRowNoBorder: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingTop: 10,
    paddingBottom: 4,
  },
  detailLabel: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "700",
  },
  detailValue: {
    marginTop: 4,
    color: "#111827",
    fontSize: 17,
    fontWeight: "500",
  },
  detailHint: {
    marginTop: 4,
    color: "#9CA3AF",
    fontSize: 17,
    fontStyle: "italic",
  },
  actionCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  actionTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  actionTitle: {
    color: "#111827",
    fontSize: 17,
    fontWeight: "600",
  },
  actionSubTitle: {
    marginTop: 2,
    color: "#64748B",
    fontSize: 12,
  },
  restaurantMiniText: {
    marginTop: 4,
    color: "#06C168",
    fontSize: 12,
    fontWeight: "700",
  },
  securityCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  securityBottomRow: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  passwordLabel: {
    fontSize: 22,
    fontWeight: "500",
    color: "#111827",
  },
  passwordHidden: {
    marginTop: 2,
    color: "#94A3B8",
    fontSize: 14,
  },
  changePasswordBtn: {
    borderWidth: 1,
    borderColor: "#B8F0D0",
    borderRadius: 10,
    backgroundColor: "#EAF9F0",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  changePasswordText: {
    color: "#05803E",
    fontSize: 13,
    fontWeight: "700",
  },
  logoutBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  logoutText: {
    color: "#DC2626",
    fontSize: 14,
    fontWeight: "700",
  },
  skeletonLine: {
    backgroundColor: "#E2E8F0",
    borderRadius: 8,
  },
  skeletonHeaderTitle: {
    width: 200,
    height: 30,
  },
  skeletonHeaderSubtitle: {
    width: 265,
    height: 14,
    marginTop: 8,
  },
  skeletonAvatar: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  skeletonPill: {
    width: 56,
    height: 18,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    marginTop: 8,
  },
  skeletonProfileName: {
    width: 220,
    height: 30,
    marginTop: 10,
  },
  skeletonProfileRole: {
    width: 110,
    height: 14,
    marginTop: 8,
  },
  skeletonBadge: {
    width: 82,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
  skeletonSectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  skeletonSectionTitle: {
    width: 165,
    height: 16,
  },
  skeletonSectionSubtitle: {
    width: 145,
    height: 12,
    marginTop: 6,
  },
  skeletonDetailRow: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    marginTop: 2,
    height: 56,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  skeletonDetailRowShort: {
    borderTopWidth: 1,
    borderTopColor: "#EEF2F7",
    marginTop: 2,
    height: 50,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  skeletonActionTitle: {
    width: 130,
    height: 18,
  },
  skeletonActionSubtitle: {
    width: 210,
    height: 12,
    marginTop: 8,
  },
  skeletonChevron: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
  skeletonPasswordLabel: {
    width: 90,
    height: 20,
  },
  skeletonPasswordHidden: {
    width: 120,
    height: 14,
    marginTop: 8,
  },
  skeletonChangePassword: {
    width: 126,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },
  skeletonLogout: {
    height: 44,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
  },
});
