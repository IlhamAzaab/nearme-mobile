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

// ✅ simple emoji category icons (web svg -> RN easiest)
const CategoryIcon = ({ type }) => {
  const map = {
    pizza: "🍕",
    burger: "🍔",
    biryani: "🍛",
    desserts: "🧁",
    drinks: "🥤",
  };
  return <Text style={styles.catEmoji}>{map[type] || "🍕"}</Text>;
};

export default function HomeScreen({ navigation }) {
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
      { id: 1, name: "Pizza", type: "pizza" },
      { id: 2, name: "Burger", type: "burger" },
      { id: 3, name: "Biryani", type: "biryani" },
      { id: 4, name: "Desserts", type: "desserts" },
      { id: 5, name: "Drinks", type: "drinks" },
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

  const fetchRestaurants = async (search = "") => {
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/public/restaurants${search ? `?search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      setRestaurants(data.restaurants || []);
    } catch (err) {
      console.log("restaurants error:", err?.message);
      setRestaurants([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllFoods = async (search = "") => {
    try {
      setLoading(true);
      const url = `${API_BASE_URL}/public/foods${search ? `?search=${encodeURIComponent(search)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      setAllFoods(data.foods || []);
    } catch (err) {
      console.log("foods error:", err?.message);
      setAllFoods([]);
    } finally {
      setLoading(false);
    }
  };

  // 🔍 search debounce + tab switch
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === "food") fetchAllFoods(searchQuery);
      else fetchRestaurants(searchQuery);
    }, 300);

    return () => clearTimeout(t);
  }, [searchQuery, activeTab]);

  const featuredRestaurant = restaurants?.[0];

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
          <View style={styles.brandRow}>
            <View style={styles.logoBox}>
              <Text style={styles.logoText}>N</Text>
            </View>
            <View>
              <Text style={styles.brandTitle}>Near Me</Text>
              <Text style={styles.brandSub}>Nearby restaurants & food</Text>
            </View>
          </View>

          {/* Notifications */}
          <Pressable
            onPress={() => navigation.navigate("Notifications")}
            style={({ pressed }) => [styles.bellBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔎</Text>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search restaurants or dishes near you"
            placeholderTextColor="#9CA3AF"
            style={styles.searchInput}
          />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Promo banner */}
        <View style={styles.banner}>
          <Image
            source={{
              uri: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200&q=80",
            }}
            style={styles.bannerImg}
          />
          <View style={styles.bannerOverlay} />
          <View style={styles.bannerTextWrap}>
            <Text style={styles.bannerTitle}>Get Up To 20% Discount{"\n"}On Your First Order</Text>
            <Text style={styles.bannerSub}>Enjoy delicious meals from nearby restaurants</Text>
          </View>
        </View>

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
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Finding delicious options...</Text>
          </View>
        ) : activeTab === "restaurant" ? (
          <>
            {/* Featured */}
            {!!featuredRestaurant && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 6, marginBottom: 10 }]}>
                  Featured Restaurant
                </Text>

                <Pressable
                  onPress={() =>
                    navigation.navigate("RestaurantFoods", { restaurantId: featuredRestaurant.id })
                  }
                  style={styles.featureCard}
                >
                  <Image
                    source={{
                      uri:
                        featuredRestaurant.logo_url ||
                        "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800",
                    }}
                    style={styles.featureImg}
                  />
                  <View style={styles.featureOverlay} />
                  <View style={styles.featureBottom}>
                    <Text style={styles.featureName}>{featuredRestaurant.restaurant_name}</Text>
                    <Text style={styles.featureMeta}>
                      {featuredRestaurant.cuisine || "Multi-cuisine"}
                      {featuredRestaurant.delivery_time ? ` • ${featuredRestaurant.delivery_time}` : ""}
                    </Text>
                  </View>
                  <View style={styles.featureTag}>
                    <Text style={styles.featureTagText}>⭐ Featured</Text>
                  </View>
                </Pressable>
              </>
            )}

            {/* All Restaurants list */}
            <Text style={[styles.sectionTitle, { marginTop: 16, marginBottom: 10 }]}>
              All Restaurants
            </Text>

            {restaurants.length === 0 ? (
              <EmptyState />
            ) : (
              <FlatList
                data={restaurants}
                keyExtractor={(item) => String(item.id)}
                scrollEnabled={false}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => navigation.navigate("RestaurantFoods", { restaurantId: item.id })}
                    style={({ pressed }) => [styles.rowCard, pressed && { opacity: 0.92 }]}
                  >
                    <Image
                      source={{
                        uri:
                          item.logo_url ||
                          "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=400",
                      }}
                      style={styles.rowImg}
                    />
                    <View style={styles.rowBody}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {item.restaurant_name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {item.cuisine || "Multi-cuisine"}
                      </Text>
                      <Text style={styles.rowMeta}>
                        {item.rating ? `★ ${item.rating}  ` : ""}
                        {item.delivery_time ? `${item.delivery_time}  ` : ""}
                        {item.delivery_fee === 0 ? "Free delivery" : item.delivery_fee ? `Rs. ${item.delivery_fee}` : ""}
                      </Text>
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF2F7",
  },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },

  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  brandTitle: { fontSize: 18, fontWeight: "900", color: "#111827" },
  brandSub: { fontSize: 12, color: "#6B7280", marginTop: 2 },

  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  bellIcon: { fontSize: 18 },
  badge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 11 },

  searchWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
  },
  searchIcon: { fontSize: 16, opacity: 0.7, marginRight: 8 },
  searchInput: { flex: 1, color: "#111827", fontSize: 14 },

  content: { padding: 14 },

  banner: { borderRadius: 22, overflow: "hidden", height: 190, marginBottom: 16 },
  bannerImg: { width: "100%", height: "100%" },
  bannerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  bannerTextWrap: { position: "absolute", left: 16, right: 16, top: 26 },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "900", lineHeight: 26 },
  bannerSub: { color: "rgba(255,255,255,0.9)", marginTop: 8, fontSize: 13 },

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

  featureCard: { borderRadius: 22, overflow: "hidden", height: 220 },
  featureImg: { width: "100%", height: "100%" },
  featureOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  featureBottom: { position: "absolute", left: 16, right: 16, bottom: 16 },
  featureName: { color: "#fff", fontSize: 20, fontWeight: "900" },
  featureMeta: { color: "rgba(255,255,255,0.9)", marginTop: 6 },
  featureTag: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "#10b981",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  featureTagText: { color: "#fff", fontWeight: "900", fontSize: 12 },

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