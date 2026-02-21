import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../../constants/api";
import { fuzzySearchRestaurants, fuzzySearchFoods } from "../../utils/fuzzySearch";

// ✅ simple emoji category icons (web svg -> RN easiest)
const CategoryIcon = ({ type }) => {
  const map = {
    kothu: "🥘",
    friedrice: "🍚",
    biryani: "🍛",
    parotta: "🫓",
    shorteats: "🥟",
  };
  return <Text style={styles.catEmoji}>{map[type] || "🍛"}</Text>;
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
    []
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
      const res = await fetch(`${API_BASE_URL}/customer/notifications?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const unread = (data.notifications || []).filter((n) => !n.is_read).length;
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
          (cart.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {/* Logo */}
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>N</Text>
          </View>

          {/* Search */}
          <View style={styles.searchWrap}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search restaurants or dishes"
              placeholderTextColor="#9CA3AF"
              style={styles.searchInput}
            />
          </View>

          {/* Notifications */}
          <Pressable
            onPress={() => navigation.navigate("Notifications")}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.bellIconWrap}>
              <Text style={styles.bellIcon}>🔔</Text>
            </View>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Categories */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Category</Text>
          <Pressable>
            <Text style={styles.sectionLink}>See All</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          {categories.map((c) => {
            const active = selectedCategory === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => onSelectCategory(c)}
                style={({ pressed }) => [
                  styles.catCard,
                  active ? styles.catCardActive : styles.catCardIdle,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={styles.catIconBox}>
                  <CategoryIcon type={c.type} />
                </View>
                <Text style={[styles.catText, active ? { color: "#fff" } : { color: "#10b981" }]}>
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
              activeTab === "restaurant" ? styles.toggleActive : styles.toggleIdle,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={activeTab === "restaurant" ? styles.toggleTextActive : styles.toggleTextIdle}>
              🍽️ Restaurants
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab("food")}
            style={({ pressed }) => [
              styles.toggleBtn,
              activeTab === "food" ? styles.toggleActive : styles.toggleIdle,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={activeTab === "food" ? styles.toggleTextActive : styles.toggleTextIdle}>
              🍕 Food Items
            </Text>
          </Pressable>
        </View>

        {/* Loading */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10b981" />
            <Text style={styles.loadingText}>Finding delicious options...</Text>
          </View>
        ) : activeTab === "restaurant" ? (
          <>
            {/* All Restaurants as Featured Cards */}
            <Text style={[styles.sectionTitle, { marginTop: 6, marginBottom: 10 }]}>
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
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => navigation.navigate("RestaurantFoods", { restaurantId: item.id })}
                    style={({ pressed }) => [styles.featureCard, pressed && { opacity: 0.92 }]}
                  >
                    <Image
                      source={{
                        uri:
                          item.cover_image ||
                          item.logo_url ||
                          "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
                      }}
                      style={styles.featureImg}
                    />
                    <View style={styles.featureOverlay} />
                    
                    {/* Closed Badge - Top Left */}
                    {item.is_open === false && (
                      <View style={styles.closedTag}>
                        <Text style={styles.closedTagText}>Closed</Text>
                      </View>
                    )}
                    
                    {/* Featured Badge - Top Right */}
                    <View style={styles.featureTag}>
                      <Text style={styles.featureTagText}>⭐ Featured</Text>
                    </View>
                    
                    {/* Bottom Info with Logo */}
                    <View style={styles.featureBottom}>
                      <View style={styles.featureInfoRow}>
                        <Image
                          source={{
                            uri:
                              item.logo_url ||
                              "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=100",
                          }}
                          style={styles.featureLogo}
                        />
                        <View style={styles.featureTextWrap}>
                          <Text style={styles.featureName}>{item.restaurant_name}</Text>
                          <Text style={styles.featureMeta}>
                            {item.cuisine || "Multi-cuisine"}
                            {item.delivery_time ? ` • ${item.delivery_time}` : ""}
                          </Text>
                        </View>
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
            <Text style={[styles.sectionTitle, { marginTop: 6, marginBottom: 10 }]}>
              Popular Dishes
            </Text>

            {allFoods.length === 0 ? (
              <EmptyState />
            ) : (
              <FlatList
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
                    style={({ pressed }) => [styles.foodCard, pressed && { opacity: 0.92 }]}
                  >
                    <Image
                      source={{
                        uri:
                          item.image_url ||
                          "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400",
                      }}
                      style={styles.foodImg}
                    />
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
      <Text style={styles.emptySub}>Try adjusting your search or browse categories</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F9FAFB" },

  header: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10 },

  logoBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10b981",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoText: { color: "#fff", fontWeight: "900", fontSize: 18 },

  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  bellIconWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  bellIcon: { fontSize: 20 },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 10 },

  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: { fontSize: 14, opacity: 0.6, marginRight: 8 },
  searchInput: { flex: 1, color: "#111827", fontSize: 14 },

  content: { padding: 14 },

  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionLink: { color: "#10b981", fontWeight: "800" },

  catRow: { gap: 12, paddingVertical: 12 },
  catCard: {
    width: 96,
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  catCardActive: { backgroundColor: "#10b981" },
  catCardIdle: { backgroundColor: "#ECFDF5" },
  catIconBox: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  catEmoji: { fontSize: 22 },
  catText: { fontSize: 13, fontWeight: "800" },

  toggleRow: { flexDirection: "row", gap: 10, marginTop: 6, marginBottom: 12 },
  toggleBtn: { flex: 1, height: 44, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  toggleActive: { backgroundColor: "#10b981" },
  toggleIdle: { backgroundColor: "#fff", borderWidth: 2, borderColor: "#10b981" },
  toggleTextActive: { color: "#fff", fontWeight: "900" },
  toggleTextIdle: { color: "#10b981", fontWeight: "900" },

  loadingBox: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  loadingText: { color: "#6B7280", fontWeight: "700" },

  featureCard: { 
    borderRadius: 22, 
    overflow: "hidden", 
    height: 200,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  featureImg: { width: "100%", height: "100%" },
  featureOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  featureBottom: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 14, backgroundColor: "rgba(0,0,0,0.3)" },
  featureInfoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureLogo: { 
    width: 48, 
    height: 48, 
    borderRadius: 12, 
    borderWidth: 2, 
    borderColor: "#fff",
  },
  featureTextWrap: { flex: 1 },
  featureName: { color: "#fff", fontSize: 18, fontWeight: "900" },
  featureMeta: { color: "rgba(255,255,255,0.9)", marginTop: 4, fontSize: 13 },
  featureTag: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  featureTagText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  closedTag: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "#EF4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 4,
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
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  foodImg: { width: "100%", height: 120 },
  foodBody: { padding: 10 },
  foodTitle: { fontWeight: "900", color: "#111827" },
  foodSub: { color: "#6B7280", marginTop: 2, fontSize: 12 },
  foodRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  foodPrice: { color: "#10b981", fontWeight: "900" },
  foodTime: { color: "#9CA3AF", fontSize: 11 },

  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 6 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontWeight: "900", color: "#374151", fontSize: 16 },
  emptySub: { color: "#6B7280", textAlign: "center" },

  fabCart: {
    position: "absolute",
    right: 16,
    bottom: 18,
    backgroundColor: "#10b981",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#10b981",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  fabText: { color: "#fff", fontWeight: "900" },
});