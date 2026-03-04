import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import {
  fuzzySearchFoods,
  fuzzySearchRestaurants,
} from "../../utils/fuzzySearch";

// Format 24h time string → "11.00a.m" style
const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "p.m" : "a.m";
  const h12 = hour % 12 || 12;
  return `${h12}.${m}${ampm}`;
};

// Verified badge (scalloped seal with checkmark)
function VerifiedBadge({ size = 17 }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {[0, 30, 60].map((deg) => (
        <View
          key={deg}
          style={{
            position: "absolute",
            width: size * 0.88,
            height: size * 0.88,
            borderRadius: size * 0.23,
            backgroundColor: "#1db95b",
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      ))}
      <Ionicons
        name="checkmark"
        size={size * 0.72}
        color="#fff"
        style={{ zIndex: 10 }}
      />
    </View>
  );
}

// ✅ Circular category images with fallback
const CATEGORY_IMAGES = {
  kothu:
    "https://images.unsplash.com/photo-1631452180519-c014fe946bc7?w=200&h=200&fit=crop",
  friedrice:
    "https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=200&h=200&fit=crop",
  biryani:
    "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=200&h=200&fit=crop",
  parotta:
    "https://images.unsplash.com/photo-1604152135912-04a022e23696?w=200&h=200&fit=crop",
  shorteats:
    "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=200&h=200&fit=crop",
};
const CATEGORY_EMOJI = {
  kothu: "🍜",
  friedrice: "🍚",
  biryani: "🍛",
  parotta: "🫓",
  shorteats: "🍢",
};
const CategoryIcon = ({ type }) => {
  const [failed, setFailed] = useState(false);
  const uri = CATEGORY_IMAGES[type] || CATEGORY_IMAGES.biryani;
  const emoji = CATEGORY_EMOJI[type] || "🍽️";

  if (failed) {
    return (
      <View style={[styles.catImage, styles.catFallback]}>
        <Text style={{ fontSize: 32 }}>{emoji}</Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.catImage}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
};

export default function HomeScreen({ navigation }) {
  // Full data from API (not filtered)
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [allFoodsData, setAllFoodsData] = useState([]);

  // Filtered/displayed data
  const [restaurants, setRestaurants] = useState([]);
  const [allFoods, setAllFoods] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("restaurant"); // restaurant | food
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [unreadCount, setUnreadCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const categories = useMemo(
    () => [
      { id: 1, name: "Kothu", type: "kothu" },
      { id: 2, name: "Fried Rice", type: "friedrice" },
      { id: 3, name: "Biryani", type: "biryani" },
      { id: 4, name: "Parotta", type: "parotta" },
      { id: 5, name: "Short Eats", type: "shorteats" },
    ],
    [],
  );

  // 🔐 auth check
  useEffect(() => {
    const init = async () => {
      const token = await AsyncStorage.getItem("token");
      const role = await AsyncStorage.getItem("role");

      if (token && role === "customer") {
        setIsLoggedIn(true);
        fetchNotificationCount(token);
        fetchCartCount(token);
      }
    };
    init();
  }, []);

  const fetchNotificationCount = async (token) => {
    try {
      const res = await fetch(
        `${API_BASE_URL}/customer/notifications?limit=100`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await res.json().catch(() => ({}));
      const unread = (data.notifications || []).filter(
        (n) => !n.is_read,
      ).length;
      setUnreadCount(unread);
    } catch (err) {
      console.log("Fetch notifications error:", err?.message);
    }
  };

  const fetchCartCount = async (token) => {
    try {
      const res = await fetch(`${API_BASE_URL}/cart`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const totalItems = (data.carts || []).reduce((sum, cart) => {
        return (
          sum +
          (cart.items || []).reduce(
            (itemSum, item) => itemSum + (item.quantity || 0),
            0,
          )
        );
      }, 0);
      setCartCount(totalItems);
    } catch (err) {
      console.log("Fetch cart error:", err?.message);
    }
  };

  // Fetch all restaurants (no search filter, we'll do fuzzy search client-side)
  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/public/restaurants`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const fetchedRestaurants = data.restaurants || [];
      setAllRestaurants(fetchedRestaurants);
      setRestaurants(fetchedRestaurants); // Initially show all
    } catch (err) {
      console.log("restaurants error:", err?.message);
      setAllRestaurants([]);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch all foods (no search filter, we'll do fuzzy search client-side)
  const fetchAllFoods = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/public/foods`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      const fetchedFoods = data.foods || [];
      setAllFoodsData(fetchedFoods);
      setAllFoods(fetchedFoods); // Initially show all
    } catch (err) {
      console.log("foods error:", err?.message);
      setAllFoodsData([]);
      setAllFoods([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Initial data fetch on mount and tab switch
  useEffect(() => {
    if (activeTab === "food") {
      if (allFoodsData.length === 0) fetchAllFoods();
    } else {
      if (allRestaurants.length === 0) fetchRestaurants();
    }
  }, [activeTab]);

  // 🔍 Fuzzy search filter when search query changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === "food") {
        if (searchQuery.trim()) {
          // Apply fuzzy search
          const filtered = fuzzySearchFoods(allFoodsData, searchQuery);
          setAllFoods(filtered);
        } else {
          // Show all foods when search is empty
          setAllFoods(allFoodsData);
        }
      } else {
        if (searchQuery.trim()) {
          // Apply fuzzy search
          const filtered = fuzzySearchRestaurants(allRestaurants, searchQuery);
          setRestaurants(filtered);
        } else {
          // Show all restaurants when search is empty
          setRestaurants(allRestaurants);
        }
      }
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, activeTab, allRestaurants, allFoodsData]);

  const onSelectCategory = (category) => {
    setSelectedCategory(category.id);
    setActiveTab("food");
    setSearchQuery(category.name);
  };

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      {/* Header - Glass Morphism */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Logo & Delivery Info */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>N</Text>
            </View>
            <View style={styles.deliveryInfo}>
              <Text style={styles.deliverLabel}></Text>
              <Text style={styles.deliverAddress}></Text>
            </View>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Ionicons
              name="search"
              size={26}
              color="#fff"
              style={styles.searchIcon}
            />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search..."
              placeholderTextColor="rgba(255,255,255,0.6)"
              style={styles.searchInput}
            />
          </View>

          {/* Notifications */}
          <Pressable
            onPress={() => navigation.navigate("Notifications")}
            style={({ pressed }) => [
              styles.bellBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="notifications" size={22} color="#10B981" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? "9+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Category</Text>
          <Pressable>
            <Text style={styles.sectionLink}>See All</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catRow}
        >
          {categories.map((c) => {
            const active = selectedCategory === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => onSelectCategory(c)}
                style={({ pressed }) => [
                  styles.catCard,
                  active && styles.catCardActive,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <View
                  style={[styles.catIconBox, active && styles.catIconBoxActive]}
                >
                  <CategoryIcon type={c.type} />
                </View>
                <Text style={[styles.catText, active && styles.catTextActive]}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() => setActiveTab("restaurant")}
            style={({ pressed }) => [
              styles.toggleBtn,
              activeTab === "restaurant" && styles.toggleActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={
                activeTab === "restaurant"
                  ? styles.toggleTextActive
                  : styles.toggleTextIdle
              }
            >
              Restaurants
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("food")}
            style={({ pressed }) => [
              styles.toggleBtn,
              activeTab === "food" && styles.toggleActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={
                activeTab === "food"
                  ? styles.toggleTextActive
                  : styles.toggleTextIdle
              }
            >
              Food Items
            </Text>
          </Pressable>
        </View>

        {/* Loading */}
        {loading ? (
          <View style={{ gap: 20 }}>
            {/* Restaurant skeleton cards */}
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  backgroundColor: "#fff",
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <SkeletonBlock width="100%" height={180} borderRadius={0} />
                <View
                  style={{
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <SkeletonBlock width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1, gap: 8 }}>
                    <SkeletonBlock width="65%" height={16} borderRadius={8} />
                    <SkeletonBlock width="40%" height={12} borderRadius={6} />
                    <SkeletonBlock width="50%" height={10} borderRadius={5} />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : activeTab === "restaurant" ? (
          <>
            {/* All Restaurants as Featured Cards */}
            <Text
              style={[styles.sectionTitle, { marginTop: 6, marginBottom: 10 }]}
            >
              Restaurants
            </Text>

            {restaurants.length === 0 ? (
              <EmptyState />
            ) : (
              <FlatList
                data={restaurants}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
                renderItem={({ item, index }) => (
                  <Pressable
                    onPress={() =>
                      navigation.navigate("RestaurantFoods", {
                        restaurantId: item.id,
                      })
                    }
                    style={({ pressed }) => [
                      styles.restaurantCard,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    {/* Image Container */}
                    <View style={styles.restaurantImageContainer}>
                      <Image
                        source={{
                          uri:
                            item.cover_image_url ||
                            "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
                        }}
                        style={styles.restaurantImage}
                      />

                      {/* Rating Badge - Top Right */}
                      {item.rating && (
                        <View style={styles.ratingBadge}>
                          <Text style={styles.ratingText}>
                            ⭐ {item.rating}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Info Section Below Image */}
                    <View style={styles.restaurantInfo}>
                      <View style={styles.restaurantInfoRow}>
                        {/* Logo */}
                        {item.logo_url ? (
                          <Image
                            source={{ uri: item.logo_url }}
                            style={styles.restaurantLogo}
                          />
                        ) : (
                          <View
                            style={[
                              styles.restaurantLogo,
                              styles.restaurantLogoFallback,
                            ]}
                          >
                            <Ionicons
                              name="restaurant"
                              size={18}
                              color="#10b981"
                            />
                          </View>
                        )}
                        <View style={styles.restaurantInfoText}>
                          <View style={styles.restaurantNameRow}>
                            <Text
                              style={styles.restaurantName}
                              numberOfLines={1}
                            >
                              {item.restaurant_name}
                            </Text>
                            <VerifiedBadge size={20} />
                          </View>

                          {item.cuisine && (
                            <Text
                              style={styles.restaurantCuisine}
                              numberOfLines={1}
                            >
                              {item.cuisine}
                            </Text>
                          )}

                          {item.city && (
                            <Text
                              style={styles.restaurantCity}
                              numberOfLines={1}
                            >
                              {item.city}
                            </Text>
                          )}

                          {/* Opening/Closing Time */}
                          {(item.opening_time || item.close_time) && (
                            <Text style={styles.restaurantTiming}>
                              {formatTime(item.opening_time)} -{" "}
                              {formatTime(item.close_time)}
                            </Text>
                          )}
                        </View>

                        {/* Closed badge - right side */}
                        {item.is_open === false && (
                          <View style={styles.closedPill}>
                            <Text style={styles.closedPillText}>Closed</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </>
        ) : (
          <>
            {/* Foods */}
            <Text
              style={[styles.sectionTitle, { marginTop: 6, marginBottom: 10 }]}
            >
              Popular Dishes
            </Text>

            {allFoods.length === 0 ? (
              <EmptyState />
            ) : (
              <FlatList
                key="foodList"
                data={allFoods}
                keyExtractor={(item) => String(item.id)}
                numColumns={2}
                columnWrapperStyle={{ gap: 12 }}
                scrollEnabled={false}
                contentContainerStyle={{ gap: 12 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() =>
                      navigation.navigate("FoodDetail", {
                        restaurantId: item.restaurant_id,
                        foodId: item.id,
                      })
                    }
                    style={({ pressed }) => [
                      styles.foodCard,
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    <View style={styles.foodImgWrap}>
                      <Image
                        source={{
                          uri:
                            item.image_url ||
                            "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400",
                        }}
                        style={styles.foodImg}
                      />
                      {item.is_available === false && (
                        <View style={styles.notAvailBadge}>
                          <Text style={styles.notAvailText}>Not Available</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.foodBody}>
                      <Text style={styles.foodTitle} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.foodSub} numberOfLines={1}>
                        {item?.restaurants?.restaurant_name || "Restaurant"}
                      </Text>
                      <View style={styles.foodRow}>
                        <Text style={styles.foodPrice}>Rs. {item.price}</Text>
                        <Text style={styles.foodTime}>
                          {item.prep_time ? `⏱ ${item.prep_time}` : ""}
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                )}
              />
            )}
          </>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* Floating Cart */}
      {cartCount > 0 && (
        <Pressable
          onPress={() => navigation.navigate("Cart")}
          style={({ pressed }) => [styles.fabCart, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.fabText}>🛒 {cartCount} items →</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyBox}>
      <Text style={styles.emptyEmoji}>🔍</Text>
      <Text style={styles.emptyTitle}>No results found</Text>
      <Text style={styles.emptySub}>
        Try adjusting your search or browse categories
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12 },

  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "#10b981/10",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
  },
  logoIcon: { fontSize: 20 },
  deliveryInfo: { flexShrink: 0 },
  deliverLabel: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#94A3B8",
    textTransform: "uppercase",
  },
  deliverAddress: { fontSize: 13, fontWeight: "700", color: "#1E293B" },

  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 2,
    borderColor: "#10B981",
    flexShrink: 0,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 9 },

  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#10B981",
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    paddingVertical: 0,
  },

  content: { padding: 16, paddingBottom: 100 },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  sectionLink: { color: "#10b981", fontWeight: "800", fontSize: 13 },

  catRow: { gap: 16, paddingVertical: 8, marginBottom: 8 },
  catCard: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexShrink: 0,
  },
  catCardActive: {
    transform: [{ scale: 1.05 }],
  },
  catCardIdle: {},
  catIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  catIconBoxActive: {
    borderWidth: 3,
    borderColor: "#10b981",
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  catImage: {
    width: 72,
    height: 72,
  },
  catFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 36,
  },
  catText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  catTextActive: { color: "#10b981" },

  toggleRow: {
    flexDirection: "row",
    gap: 0,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 999,
    padding: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  toggleBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleActive: {
    backgroundColor: "#10b981",
    shadowColor: "#10b981",
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  toggleIdle: {
    backgroundColor: "transparent",
  },
  toggleTextActive: { color: "#fff", fontWeight: "900", fontSize: 13 },
  toggleTextIdle: { color: "#64748B", fontWeight: "800", fontSize: 13 },

  loadingBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: { color: "#64748B", fontWeight: "600", fontSize: 13 },

  restaurantCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    backgroundColor: "#fff",
  },
  restaurantImageContainer: {
    position: "relative",
    width: "100%",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
  },
  restaurantImage: {
    width: "100%",
    height: "100%",
  },
  restaurantInfo: {
    padding: 12,
    paddingTop: 10,
  },
  restaurantInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "space-between",
  },
  restaurantLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  restaurantLogoFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  restaurantInfoText: {
    flex: 1,
  },
  restaurantNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  openDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
  },
  restaurantName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  restaurantCuisine: {
    color: "#10b981",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
  restaurantCity: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  restaurantTiming: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  metaText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  metaDot: {
    color: "#94A3B8",
    fontSize: 11,
    marginHorizontal: 2,
  },
  ratingBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    backdropFilter: "blur(10px)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ratingText: { fontSize: 12, fontWeight: "900", color: "#0F172A" },
  featureTag: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  featureTagText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  closedPill: {
    borderWidth: 1.5,
    borderColor: "#EF4444",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "center",
    flexShrink: 0,
  },
  closedPillText: {
    color: "#EF4444",
    fontWeight: "800",
    fontSize: 12,
  },
  closedTag: {
    position: "absolute",
    top: 16,
    left: 16,
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#EF4444",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  closedTagText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  rowCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rowImg: { width: 84, height: 84, borderRadius: 14 },
  rowBody: { flex: 1, justifyContent: "center" },
  rowTitle: { fontWeight: "900", color: "#111827", fontSize: 14 },
  rowSub: { color: "#6B7280", marginTop: 3 },
  rowMeta: { color: "#9CA3AF", marginTop: 6, fontSize: 12 },

  foodCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  foodImgWrap: {
    position: "relative",
    width: "100%",
    height: 140,
  },
  foodImg: { width: "100%", height: "100%" },
  notAvailBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  notAvailText: {
    backgroundColor: "#000",
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: "hidden",
  },
  foodBody: { padding: 12 },
  foodTitle: {
    fontWeight: "800",
    color: "#0F172A",
    fontSize: 14,
    letterSpacing: -0.3,
  },
  foodSub: { color: "#10b981", marginTop: 4, fontSize: 12, fontWeight: "600" },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  foodPrice: { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  foodTime: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },

  emptyBox: { alignItems: "center", paddingVertical: 60, gap: 8 },
  emptyEmoji: { fontSize: 56, opacity: 0.3 },
  emptyTitle: {
    fontWeight: "800",
    color: "#334155",
    fontSize: 17,
    letterSpacing: -0.3,
  },
  emptySub: {
    color: "#64748B",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "500",
  },

  fabCart: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#10b981",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#10b981",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fabText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: 0.5,
  },
});
