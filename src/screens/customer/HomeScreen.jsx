import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Image,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { G, Path } from "react-native-svg";
import { useNotifications } from "../../app/providers/NotificationProvider";
import OptimizedImage from "../../components/common/OptimizedImage";
import SkeletonBlock from "../../components/common/SkeletonBlock";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import { prefetchImageUrls } from "../../lib/imageCache";
import { fetchJsonWithCache, getCachedJson } from "../../lib/publicDataCache";
import {
  fuzzySearchFoods,
  fuzzySearchRestaurants,
} from "../../utils/fuzzySearch";

const RESTAURANT_CARD_ESTIMATED_HEIGHT = 252;

const LAUNCH_PROMO_DEFAULTS = {
  first_km_rate: 1,
  max_km: 5,
  beyond_km_rate: 40,
};

const RESTAURANTS_CACHE_KEY = "public:restaurants";
const FOODS_CACHE_KEY = "public:foods";

const INITIAL_CACHED_RESTAURANTS = getCachedRestaurantsList();
const INITIAL_CACHED_FOODS = getCachedFoodsList();

function getCachedRestaurantsList() {
  const cached = getCachedJson(RESTAURANTS_CACHE_KEY, 120000);
  return Array.isArray(cached?.restaurants) ? cached.restaurants : [];
}

function getCachedFoodsList() {
  const cached = getCachedJson(FOODS_CACHE_KEY, 120000);
  return Array.isArray(cached?.foods) ? cached.foods : [];
}

function extractOrdersFromResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.orders)) return data.orders;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.data?.orders)) return data.data.orders;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function normalizeComparableStatus(status) {
  return String(status || "")
    .trim()
    .toLowerCase();
}

function hashString(input) {
  let hash = 0;
  const str = String(input || "");
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function toDeterministicRandomOrder(items, seed, getId) {
  return [...items].sort((a, b) => {
    const aKey = hashString(`${seed}:${getId(a)}`);
    const bKey = hashString(`${seed}:${getId(b)}`);
    if (aKey !== bKey) return aKey - bKey;
    return String(getId(a)).localeCompare(String(getId(b)));
  });
}

function getOrderRestaurantId(order) {
  return (
    order?.restaurant_id ||
    order?.restaurantId ||
    order?.restaurant?.id ||
    order?.restaurant?.restaurant_id ||
    null
  );
}

function getOrderItems(order) {
  if (Array.isArray(order?.order_items)) return order.order_items;
  if (Array.isArray(order?.items)) return order.items;
  if (Array.isArray(order?.orderItems)) return order.orderItems;
  return [];
}

function getItemFoodId(item) {
  return item?.food_id || item?.foodId || item?.id || item?.item_id || null;
}

function getItemFoodName(item) {
  return String(item?.food_name || item?.name || "")
    .trim()
    .toLowerCase();
}

function getItemQuantity(item) {
  const qty = Number(item?.quantity ?? item?.qty ?? item?.count ?? 1);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

function buildDeliveredOrderRanking(orders) {
  const restaurantCounts = {};
  const foodCounts = {};
  const foodNameCounts = {};
  let deliveredOrderCount = 0;

  for (const order of orders) {
    const status = normalizeComparableStatus(
      order?.effective_status || order?.delivery_status || order?.status,
    );
    if (status !== "delivered") continue;
    deliveredOrderCount += 1;

    const restaurantId = getOrderRestaurantId(order);
    if (restaurantId != null) {
      const key = String(restaurantId);
      restaurantCounts[key] = (restaurantCounts[key] || 0) + 1;
    }

    const orderItems = getOrderItems(order);
    for (const item of orderItems) {
      const foodId = getItemFoodId(item);
      const quantity = getItemQuantity(item);

      if (foodId != null) {
        const key = String(foodId);
        foodCounts[key] = (foodCounts[key] || 0) + quantity;
      }

      const foodNameKey = getItemFoodName(item);
      if (foodNameKey) {
        foodNameCounts[foodNameKey] =
          (foodNameCounts[foodNameKey] || 0) + quantity;
      }
    }
  }

  const hasDeliveredOrders = deliveredOrderCount > 0;

  return {
    hasDeliveredOrders,
    restaurantCounts,
    foodCounts,
    foodNameCounts,
  };
}

// Format 24h time string → "11.00a.m" style
const formatTime = (t) => {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "p.m" : "a.m";
  const h12 = hour % 12 || 12;
  return `${h12}.${m}${ampm}`;
};

const formatPrice = (price) => {
  const value = Number(price);
  if (Number.isNaN(value)) return "Rs. 0.00";
  return `Rs. ${value.toFixed(2)}`;
};

function getRestaurantId(item) {
  return item?.id ?? item?.restaurant_id;
}

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
            backgroundColor: "#06C168",
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

const CATEGORY_ORDER = [
  "Koththu",
  "Fried Rice",
  "Biriyani",
  "BBQ",
  "parotta",
  "rice and curry",
  "curry",
  "short eats",
  "dolphin",
  "sea food",
  "others",
];

const CATEGORY_LABEL_LOOKUP = new Map(
  CATEGORY_ORDER.map((label) => [label.toLowerCase(), label]),
);

const CATEGORY_IMAGE_BY_KEY = {
  koththu: require("../../assets/category-images/koththu.jpg"),
  "fried rice": require("../../assets/category-images/fried-rice.jpg"),
  biriyani: require("../../assets/category-images/biriyani.jpg"),
  bbq: require("../../assets/category-images/bbq.jpg"),
  parotta: require("../../assets/category-images/parotta.jpg"),
  "rice and curry": require("../../assets/category-images/rice-and-curry.jpg"),
  curry: require("../../assets/category-images/curry.jpg"),
  "short eats": require("../../assets/category-images/short-eats.jpg"),
  dolphin: require("../../assets/category-images/dolphin.jpg"),
  "sea food": require("../../assets/category-images/sea-food.jpg"),
  others: require("../../assets/category-images/others.jpg"),
};

const FIXED_CATEGORIES = CATEGORY_ORDER.map((name, index) => ({
  id: index + 1,
  name,
}));

function normalizeCategoryLabel(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  return CATEGORY_LABEL_LOOKUP.get(key) || "others";
}

const CategoryIcon = ({ category }) => {
  const key = normalizeCategoryLabel(category).toLowerCase();
  const imageSource =
    CATEGORY_IMAGE_BY_KEY[key] || CATEGORY_IMAGE_BY_KEY.others;

  return (
    <View style={styles.catIconImageWrap}>
      <Image source={imageSource} style={styles.catImage} resizeMode="cover" />
    </View>
  );
};

const CategorySection = React.memo(function CategorySection({
  categories,
  selectedCategory,
  onSelectCategory,
}) {
  return (
    <>
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>Category</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {categories.map((c) => {
          const active = selectedCategory === c.name;
          return (
            <View key={c.id}>
              <Pressable
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
                  <CategoryIcon category={c.name} />
                </View>
                <Text style={[styles.catText, active && styles.catTextActive]}>
                  {c.name}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </>
  );
});

export default function HomeScreen({ navigation }) {
  const randomSortSeed = useMemo(() => `${Date.now()}-${Math.random()}`, []);

  // Full data from API (not filtered)
  const [allRestaurants, setAllRestaurants] = useState(
    () => INITIAL_CACHED_RESTAURANTS,
  );
  const [allFoodsData, setAllFoodsData] = useState(() => INITIAL_CACHED_FOODS);
  const [orderRanking, setOrderRanking] = useState({
    hasDeliveredOrders: false,
    restaurantCounts: {},
    foodCounts: {},
    foodNameCounts: {},
  });

  // Filtered/displayed data
  const [restaurants, setRestaurants] = useState(
    () => INITIAL_CACHED_RESTAURANTS,
  );
  const [allFoods, setAllFoods] = useState(() => INITIAL_CACHED_FOODS);
  const [isRestaurantsLoading, setIsRestaurantsLoading] = useState(
    () => INITIAL_CACHED_RESTAURANTS.length === 0,
  );
  const [isFoodsLoading, setIsFoodsLoading] = useState(
    () => INITIAL_CACHED_FOODS.length === 0,
  );
  const [hasLoadedRestaurants, setHasLoadedRestaurants] = useState(
    () => INITIAL_CACHED_RESTAURANTS.length > 0,
  );
  const [hasLoadedFoods, setHasLoadedFoods] = useState(
    () => INITIAL_CACHED_FOODS.length > 0,
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("restaurant"); // restaurant | food
  const [selectedCategory, setSelectedCategory] = useState(null);

  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [cartCount, setCartCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [launchPromo, setLaunchPromo] = useState(null);
  const [showLaunchPromoModal, setShowLaunchPromoModal] = useState(false);
  const [acknowledgingPromo, setAcknowledgingPromo] = useState(false);

  const categories = useMemo(() => FIXED_CATEGORIES, []);

  const fetchLaunchPromotionStatus = useCallback(async (tokenArg) => {
    try {
      const token = tokenArg || (await getAccessToken());
      if (!token) {
        setShowLaunchPromoModal(false);
        return;
      }

      const res = await fetch(`${API_BASE_URL}/customer/launch-promotion`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setShowLaunchPromoModal(false);
        return;
      }

      const data = await res.json().catch(() => ({}));
      setLaunchPromo(data);
      setShowLaunchPromoModal(Boolean(data?.should_show_popup));
    } catch (err) {
      console.log("Launch promotion status fetch error:", err?.message || err);
    }
  }, []);

  const handleLaunchPromoOk = useCallback(async () => {
    try {
      setAcknowledgingPromo(true);
      const token = await getAccessToken();
      if (!token) {
        setShowLaunchPromoModal(false);
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/customer/launch-promotion/acknowledge`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        setShowLaunchPromoModal(false);
        await fetchLaunchPromotionStatus(token);
      }
    } catch (err) {
      console.log("Launch promotion acknowledge error:", err?.message || err);
    } finally {
      setAcknowledgingPromo(false);
    }
  }, [fetchLaunchPromotionStatus]);

  // 🔐 auth check
  useEffect(() => {
    const init = async () => {
      const token = await getAccessToken();
      const role = await AsyncStorage.getItem("role");

      if (token && role === "customer") {
        setIsLoggedIn(true);
        fetchCartCount(token);
        fetchLaunchPromotionStatus(token);
      }
    };
    init();
  }, [fetchLaunchPromotionStatus]);

  const fetchCartCount = async (tokenArg) => {
    try {
      const token = tokenArg || (await getAccessToken());
      if (!token) return;
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

  // Refresh cart count every time HomeScreen gains focus
  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        fetchCartCount();
        refreshUnreadCount({ force: true });
      }
    }, [isLoggedIn, refreshUnreadCount]),
  );

  useFocusEffect(
    useCallback(() => {
      if (isLoggedIn) {
        fetchLaunchPromotionStatus();
      }
    }, [isLoggedIn, fetchLaunchPromotionStatus]),
  );

  const promoConfig = launchPromo?.promotion || LAUNCH_PROMO_DEFAULTS;

  const sortRestaurantsForHome = useCallback(
    (list) => {
      if (!Array.isArray(list) || list.length <= 1) return list || [];

      if (!orderRanking.hasDeliveredOrders) {
        return toDeterministicRandomOrder(
          list,
          randomSortSeed,
          (item) => item?.id ?? item?.restaurant_id ?? item?.restaurant_name,
        );
      }

      return [...list].sort((a, b) => {
        const aCount =
          orderRanking.restaurantCounts[String(getRestaurantId(a))] || 0;
        const bCount =
          orderRanking.restaurantCounts[String(getRestaurantId(b))] || 0;

        if (aCount !== bCount) return bCount - aCount;

        const aName = String(a?.restaurant_name || "");
        const bName = String(b?.restaurant_name || "");
        return aName.localeCompare(bName);
      });
    },
    [orderRanking, randomSortSeed],
  );

  const sortFoodsForHome = useCallback(
    (list) => {
      if (!Array.isArray(list) || list.length <= 1) return list || [];

      if (!orderRanking.hasDeliveredOrders) {
        return toDeterministicRandomOrder(
          list,
          randomSortSeed,
          (item) => item?.id ?? item?.food_id ?? item?.name,
        );
      }

      return [...list].sort((a, b) => {
        const aIdCount =
          orderRanking.foodCounts[String(a?.id ?? a?.food_id)] || 0;
        const bIdCount =
          orderRanking.foodCounts[String(b?.id ?? b?.food_id)] || 0;

        const aNameKey = String(a?.name || "")
          .trim()
          .toLowerCase();
        const bNameKey = String(b?.name || "")
          .trim()
          .toLowerCase();
        const aNameCount = orderRanking.foodNameCounts[aNameKey] || 0;
        const bNameCount = orderRanking.foodNameCounts[bNameKey] || 0;

        const aCount = Math.max(aIdCount, aNameCount);
        const bCount = Math.max(bIdCount, bNameCount);

        if (aCount !== bCount) return bCount - aCount;

        const aName = String(a?.name || "");
        const bName = String(b?.name || "");
        return aName.localeCompare(bName);
      });
    },
    [orderRanking, randomSortSeed],
  );

  const fetchDeliveredOrderRanking = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setOrderRanking({
          hasDeliveredOrders: false,
          restaurantCounts: {},
          foodCounts: {},
          foodNameCounts: {},
        });
        return;
      }

      const res = await fetch(
        `${API_BASE_URL}/orders/my-orders?status=past&limit=200&offset=0`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        setOrderRanking({
          hasDeliveredOrders: false,
          restaurantCounts: {},
          foodCounts: {},
          foodNameCounts: {},
        });
        return;
      }

      const payload = await res.json().catch(() => ({}));
      const orders = extractOrdersFromResponse(payload);
      const deliveredOrders = orders.filter(
        (order) =>
          normalizeComparableStatus(
            order?.effective_status || order?.delivery_status || order?.status,
          ) === "delivered",
      );

      if (deliveredOrders.length === 0) {
        setOrderRanking({
          hasDeliveredOrders: false,
          restaurantCounts: {},
          foodCounts: {},
          foodNameCounts: {},
        });
        return;
      }

      const deliveredOrderDetails = await Promise.allSettled(
        deliveredOrders.map(async (order) => {
          const orderId = order?.id || order?.order_id || order?.orderId;
          if (!orderId) return order;

          const detailRes = await fetch(`${API_BASE_URL}/orders/${orderId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!detailRes.ok) return order;

          const detailPayload = await detailRes.json().catch(() => ({}));
          return detailPayload?.order || order;
        }),
      );

      const normalizedDeliveredOrders = deliveredOrderDetails
        .map((result, index) =>
          result.status === "fulfilled" ? result.value : deliveredOrders[index],
        )
        .filter(Boolean);

      setOrderRanking(buildDeliveredOrderRanking(normalizedDeliveredOrders));
    } catch (err) {
      console.log("Delivered order ranking error:", err?.message);
      setOrderRanking({
        hasDeliveredOrders: false,
        restaurantCounts: {},
        foodCounts: {},
        foodNameCounts: {},
      });
    }
  }, []);

  // Fetch all restaurants (no search filter, we'll do fuzzy search client-side)
  const fetchRestaurants = async () => {
    try {
      if (allRestaurants.length === 0) {
        setIsRestaurantsLoading(true);
      }
      const url = `${API_BASE_URL}/public/restaurants`;
      const data = await fetchJsonWithCache(
        RESTAURANTS_CACHE_KEY,
        async () => {
          const res = await fetch(url);
          return res.json().catch(() => ({}));
        },
        { ttlMs: 120000 },
      );
      const fetchedRestaurants = data.restaurants || [];
      const orderedRestaurants = sortRestaurantsForHome(fetchedRestaurants);
      setAllRestaurants(orderedRestaurants);
      setRestaurants(orderedRestaurants); // Initially show all
      prefetchImageUrls(
        fetchedRestaurants.flatMap((item) => [
          item?.cover_image_url,
          item?.logo_url,
        ]),
      );
    } catch (err) {
      console.log("restaurants error:", err?.message);
      setAllRestaurants([]);
      setRestaurants([]);
    } finally {
      setIsRestaurantsLoading(false);
      setHasLoadedRestaurants(true);
    }
  };

  // Fetch all foods (no search filter, we'll do fuzzy search client-side)
  const fetchAllFoods = async () => {
    try {
      if (allFoodsData.length === 0) {
        setIsFoodsLoading(true);
      }
      const url = `${API_BASE_URL}/public/foods`;
      const data = await fetchJsonWithCache(
        FOODS_CACHE_KEY,
        async () => {
          const res = await fetch(url);
          return res.json().catch(() => ({}));
        },
        { ttlMs: 120000 },
      );
      const fetchedFoods = data.foods || [];
      const orderedFoods = sortFoodsForHome(fetchedFoods);
      setAllFoodsData(orderedFoods);
      setAllFoods(orderedFoods); // Initially show all
      prefetchImageUrls(fetchedFoods.map((item) => item?.image_url));
    } catch (err) {
      console.log("foods error:", err?.message);
      setAllFoodsData([]);
      setAllFoods([]);
    } finally {
      setIsFoodsLoading(false);
      setHasLoadedFoods(true);
    }
  };

  // 🔍 Initial data fetch on mount and tab switch
  useEffect(() => {
    fetchDeliveredOrderRanking();
  }, [fetchDeliveredOrderRanking]);

  useEffect(() => {
    if (activeTab === "food") {
      if (allFoodsData.length === 0) {
        fetchAllFoods();
      }
    } else {
      if (allRestaurants.length === 0) fetchRestaurants();
    }
  }, [activeTab, allFoodsData.length, allRestaurants.length]);

  useEffect(() => {
    if (allFoodsData.length === 0) {
      fetchAllFoods();
    }
  }, [allFoodsData.length]);

  // 🔍 Fuzzy search filter when search query changes
  useEffect(() => {
    const t = setTimeout(() => {
      if (activeTab === "food") {
        if (searchQuery.trim()) {
          if (
            selectedCategory &&
            normalizeCategoryLabel(searchQuery) ===
              normalizeCategoryLabel(selectedCategory)
          ) {
            const filteredByCategory = allFoodsData.filter(
              (food) =>
                normalizeCategoryLabel(food?.category) ===
                normalizeCategoryLabel(selectedCategory),
            );
            setAllFoods(sortFoodsForHome(filteredByCategory));
          } else {
            // Search by food name + category + description + restaurant name.
            const filtered = fuzzySearchFoods(allFoodsData, searchQuery);
            setAllFoods(sortFoodsForHome(filtered));
          }
        } else {
          // Show all foods when search is empty
          setAllFoods(sortFoodsForHome(allFoodsData));
        }
      } else {
        if (searchQuery.trim()) {
          // Apply fuzzy search
          const filtered = fuzzySearchRestaurants(allRestaurants, searchQuery);
          setRestaurants(sortRestaurantsForHome(filtered));
        } else {
          // Show all restaurants when search is empty
          setRestaurants(sortRestaurantsForHome(allRestaurants));
        }
      }
    }, 300);

    return () => clearTimeout(t);
  }, [
    searchQuery,
    activeTab,
    allRestaurants,
    allFoodsData,
    selectedCategory,
    sortFoodsForHome,
    sortRestaurantsForHome,
  ]);

  const onSelectCategory = useCallback(
    (category) => {
      const normalized = normalizeCategoryLabel(category?.name);
      const filteredByCategory = allFoodsData.filter(
        (food) => normalizeCategoryLabel(food?.category) === normalized,
      );

      setSelectedCategory(normalized);
      setActiveTab("food");
      setSearchQuery(normalized);
      setAllFoods(sortFoodsForHome(filteredByCategory));
    },
    [allFoodsData, sortFoodsForHome],
  );

  const handleSearchChange = useCallback(
    (value) => {
      setSearchQuery(value);
      if (
        selectedCategory &&
        normalizeCategoryLabel(value) !==
          normalizeCategoryLabel(selectedCategory)
      ) {
        setSelectedCategory(null);
      }
    },
    [selectedCategory],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSelectedCategory(null);

    // Reset visible list immediately without waiting for debounce.
    if (activeTab === "food") {
      setAllFoods(sortFoodsForHome(allFoodsData));
    } else {
      setRestaurants(sortRestaurantsForHome(allRestaurants));
    }

    Keyboard.dismiss();
  }, [
    activeTab,
    allFoodsData,
    allRestaurants,
    sortFoodsForHome,
    sortRestaurantsForHome,
  ]);

  const prewarmFoodDetail = useCallback(
    (item) => {
      const restaurantId = item?.restaurant_id;
      const foodId = item?.id;
      if (!restaurantId || !foodId) return;

      navigation.preload?.("FoodDetail", {
        restaurantId,
        foodId,
      });

      const restaurantCacheKey = `public:restaurant:${restaurantId}`;
      const foodCacheKey = `public:restaurant:${restaurantId}:food:${foodId}`;

      fetchJsonWithCache(
        restaurantCacheKey,
        async () => {
          const res = await fetch(
            `${API_BASE_URL}/public/restaurants/${restaurantId}`,
          );
          const payload = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(payload.message || "Restaurant not found");
          return payload;
        },
        { ttlMs: 180000 },
      )
        .then((restaurantData) => {
          prefetchImageUrls([
            restaurantData?.restaurant?.logo_url,
            restaurantData?.restaurant?.cover_image_url,
            item?.image_url,
          ]);
        })
        .catch(() => {
          // Prewarm should never block UI.
        });

      fetchJsonWithCache(
        foodCacheKey,
        async () => {
          const res = await fetch(
            `${API_BASE_URL}/public/restaurants/${restaurantId}/foods/${foodId}`,
          );
          const payload = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(payload.message || "Food not found");
          return payload;
        },
        { ttlMs: 180000 },
      ).catch(() => {
        // Prewarm should never block UI.
      });
    },
    [navigation],
  );

  const renderRestaurantItem = useCallback(
    ({ item }) => {
      const restaurantId = getRestaurantId(item);
      if (!restaurantId) return null;

      return (
        <Pressable
          onPress={() =>
            navigation.navigate("RestaurantFoods", {
              restaurantId,
            })
          }
          style={({ pressed }) => [
            styles.restaurantCard,
            pressed && { opacity: 0.92 },
          ]}
        >
          {/* Image Container */}
          <View style={styles.restaurantImageContainer}>
            <OptimizedImage
              uri={
                item.cover_image_url ||
                "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800"
              }
              style={styles.restaurantImage}
              transition={80}
            />

            {/* Rating Badge - Top Right */}
            {item.rating && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>⭐ {item.rating}</Text>
              </View>
            )}
          </View>

          {/* Info Section Below Image */}
          <View style={styles.restaurantInfo}>
            <View style={styles.restaurantInfoRow}>
              {/* Logo */}
              {item.logo_url ? (
                <OptimizedImage
                  uri={item.logo_url}
                  style={styles.restaurantLogo}
                  transition={80}
                />
              ) : (
                <View
                  style={[styles.restaurantLogo, styles.restaurantLogoFallback]}
                >
                  <Ionicons name="restaurant" size={18} color="#06C168" />
                </View>
              )}
              <View style={styles.restaurantInfoText}>
                <View style={styles.restaurantNameRow}>
                  <Text style={styles.restaurantName} numberOfLines={1}>
                    {item.restaurant_name}
                  </Text>
                  <VerifiedBadge size={20} />
                </View>

                {item.cuisine && (
                  <Text style={styles.restaurantCuisine} numberOfLines={1}>
                    {item.cuisine}
                  </Text>
                )}

                {item.city && (
                  <Text style={styles.restaurantCity} numberOfLines={1}>
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
      );
    },
    [navigation],
  );

  const renderFoodItem = useCallback(
    ({ item, index }) => (
      <View style={styles.foodCardAnimWrap}>
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
          {(() => {
            const regularPrice = item.regular_price ?? item.price;
            const restaurantName =
              item?.restaurants?.restaurant_name ||
              item?.restaurant_name ||
              "Restaurant";
            const hasOffer =
              item.offer_price != null &&
              Number(item.offer_price) > 0 &&
              Number(item.offer_price) < Number(regularPrice || 0);

            return (
              <>
                <View style={styles.foodImgWrap}>
                  <OptimizedImage
                    uri={
                      item.image_url ||
                      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400"
                    }
                    style={styles.foodImg}
                    transition={120}
                  />
                  {Number(item.stars || 0) > 0 && (
                    <View style={styles.foodRatingBadge}>
                      <Ionicons name="star" size={11} color="#FBBF24" />
                      <Text style={styles.foodRatingText}>{item.stars}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.foodBody}>
                  <Text style={styles.foodTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.foodRestaurant} numberOfLines={1}>
                    {restaurantName}
                  </Text>
                  <Text style={styles.foodDesc} numberOfLines={2}>
                    {item.description || ""}
                  </Text>

                  <View style={styles.foodRow}>
                    {hasOffer ? (
                      <View style={styles.priceGroup}>
                        <Text style={styles.foodPrice}>
                          {formatPrice(item.offer_price)}
                        </Text>
                        <Text style={styles.oldPrice}>
                          {formatPrice(regularPrice)}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.foodPrice}>
                        {formatPrice(regularPrice)}
                      </Text>
                    )}
                    <Text style={styles.foodTime}>
                      {item.prep_time ? `Prep ${item.prep_time}` : ""}
                    </Text>
                  </View>
                </View>
              </>
            );
          })()}
        </Pressable>
      </View>
    ),
    [navigation],
  );

  const renderDiscoveryHeader = useCallback(
    () => (
      <>
        <CategorySection
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <Pressable
            onPress={() =>
              setActiveTab((prev) =>
                prev === "restaurant" ? prev : "restaurant",
              )
            }
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
            onPress={() =>
              setActiveTab((prev) => (prev === "food" ? prev : "food"))
            }
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

        <Text style={[styles.sectionTitle, { marginTop: 6, marginBottom: 10 }]}>
          {activeTab === "restaurant" ? "Restaurants" : "Popular Dishes"}
        </Text>
      </>
    ),
    [activeTab, categories, selectedCategory, onSelectCategory],
  );

  const isRestaurantDataReady =
    hasLoadedRestaurants || allRestaurants.length > 0;
  const isFoodDataReady = hasLoadedFoods || allFoodsData.length > 0;

  const shouldShowRestaurantSkeleton =
    activeTab === "restaurant" &&
    !isRestaurantDataReady &&
    isRestaurantsLoading &&
    restaurants.length === 0;
  const shouldShowFoodSkeleton =
    activeTab === "food" &&
    !isFoodDataReady &&
    isFoodsLoading &&
    allFoods.length === 0;
  const shouldShowSkeleton =
    shouldShowRestaurantSkeleton || shouldShowFoodSkeleton;

  return (
    <SafeAreaView style={styles.page} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={{ flex: 1 }}>
        <Modal
          visible={showLaunchPromoModal}
          transparent
          animationType="fade"
          statusBarTranslucent
        >
          <View style={styles.promoBackdrop}>
            <View style={styles.promoCard}>
              <View style={styles.promoHeroWrap}>
                <OptimizedImage
                  uri="https://images.unsplash.com/photo-1547592166-23ac45744acd?q=80&w=1200&auto=format&fit=crop"
                  style={styles.promoHeroImage}
                  transition={120}
                />
                <View style={styles.promoHeroFade} />
              </View>

              <View style={styles.promoBody}>
                <Text style={styles.promoKicker}>Launch Offer</Text>
                <Text style={styles.promoTitle}>Welcome to Meezo</Text>
                <Text style={styles.promoSubtitle}>
                  Your first delivery gets a special offer.
                </Text>

                <View style={styles.promoPriceCard}>
                  <Text style={styles.promoPriceTag}>Delivery fees</Text>
                  <Text style={styles.promoPriceTag1}>Only</Text>
                  <Text style={styles.promoPriceMain}>
                    Rs.{Number(promoConfig?.first_km_rate || 1).toFixed(0)}
                    <Text style={styles.promoPriceSuffix}> / per km</Text>
                  </Text>
                  <Text style={styles.promoPriceSub}>
                    Up to {Number(promoConfig?.max_km || 5).toFixed(0)}km. This
                    offer applies only to your first order.
                  </Text>
                </View>

                <Pressable
                  onPress={handleLaunchPromoOk}
                  disabled={acknowledgingPromo}
                  style={({ pressed }) => [
                    styles.promoCtaBtn,
                    acknowledgingPromo && styles.promoCtaBtnDisabled,
                    pressed && !acknowledgingPromo
                      ? styles.promoCtaPressed
                      : null,
                  ]}
                >
                  <LinearGradient
                    colors={["#006E20", "#06C168"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.promoCtaGradient}
                  >
                    <Text style={styles.promoCtaText}>
                      {acknowledgingPromo ? "Saving..." : "Get Started"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {/* Header - Glass Morphism */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {/* Logo & Delivery Info */}
            <View style={styles.logoSection}>
              <View style={styles.logoBox}>
                <Svg width={40} height={40} viewBox="1650 1600 2750 2050">
                  <G transform="translate(0,6000) scale(1,-1)" stroke="none">
                    <Path
                      fill="#000000"
                      d="M2392 3486 c-24 -6 -40 -15 -36 -19 4 -4 2 -7 -3 -7 -18 0 -78 -63 -92 -98 -7 -17 -18 -32 -23 -32 -5 0 -7 -4 -4 -9 4 -5 1 -11 -4 -13 -6 -2 -12 -10 -13 -18 -1 -8 -22 -51 -46 -95 -25 -44 -44 -82 -43 -85 0 -3 -5 -12 -12 -20 -7 -8 -24 -37 -37 -65 -13 -27 -27 -52 -31 -55 -4 -3 -32 -53 -61 -110 -88 -170 -131 -252 -160 -301 -25 -43 -26 -47 -10 -53 10 -4 92 -6 183 -5 161 2 260 17 260 39 0 6 7 10 17 10 9 0 14 2 11 6 -3 3 8 20 26 38 17 19 51 73 76 121 54 104 61 117 80 141 13 16 13 17 0 9 -8 -4 -6 2 6 16 11 13 33 51 49 84 32 67 69 105 102 105 25 0 93 -37 93 -52 0 -5 4 -7 9 -4 5 3 11 -1 15 -9 3 -8 12 -15 21 -15 8 0 15 -3 15 -8 0 -4 18 -18 39 -32 22 -13 37 -29 34 -34 -4 -6 -3 -8 1 -4 5 4 25 -4 46 -17 27 -17 40 -21 48 -13 6 6 19 12 29 13 18 2 74 25 83 35 3 3 21 13 40 22 59 29 195 91 200 92 3 1 31 15 64 31 53 27 110 74 112 93 2 14 18 47 41 84 13 21 23 45 23 53 0 9 5 13 10 10 6 -3 10 1 10 9 0 8 11 35 24 60 l24 46 -26 -7 c-15 -3 -64 -25 -109 -48 -45 -23 -93 -45 -107 -49 -14 -3 -26 -11 -26 -17 0 -6 -4 -7 -10 -4 -5 3 -10 2 -10 -3 0 -5 -24 -17 -54 -26 -30 -10 -60 -24 -67 -32 -6 -8 -18 -14 -27 -14 -8 0 -39 -13 -68 -30 -50 -28 -54 -29 -83 -14 -17 9 -28 20 -25 26 4 6 -2 8 -16 3 -15 -5 -20 -4 -16 3 4 6 -21 30 -56 53 -35 24 -69 49 -76 56 -7 7 -17 13 -21 13 -4 0 -17 8 -29 18 -54 45 -63 52 -71 52 -4 0 -16 9 -26 20 -10 11 -21 17 -25 15 -5 -3 -10 -2 -12 2 -17 40 -169 63 -256 39z"
                    />
                    <Path
                      fill="#000000"
                      d="M3768 3488 c-16 -5 -28 -14 -28 -19 0 -5 -6 -9 -13 -9 -7 0 -18 -12 -24 -27 -16 -37 -104 -197 -112 -203 -3 -3 -33 -58 -65 -123 -33 -66 -70 -134 -83 -153 -12 -19 -23 -41 -23 -49 0 -8 -4 -15 -9 -15 -5 0 -13 -10 -17 -22 -3 -13 -14 -32 -23 -42 -11 -13 -12 -17 -2 -11 8 4 1 -12 -16 -36 -17 -24 -38 -62 -49 -84 -10 -22 -23 -43 -28 -47 -6 -4 -7 -8 -2 -8 5 0 2 -8 -6 -17 -24 -29 -59 -104 -53 -113 3 -5 87 -8 188 -7 171 2 185 4 232 27 47 23 95 61 95 76 0 3 10 20 22 37 12 17 23 37 24 44 1 6 13 27 27 45 36 49 43 63 26 53 -11 -7 -11 -5 1 9 18 23 82 138 146 264 26 50 51 92 57 92 6 0 8 3 4 6 -3 4 5 27 20 53 42 76 71 128 100 179 31 52 38 92 20 104 -17 11 -376 8 -409 -4z"
                    />
                  </G>
                </Svg>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons
                name="search"
                size={26}
                color="#94A3B8"
                style={styles.searchIcon}
              />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearchChange}
                placeholder="Search..."
                placeholderTextColor="#94A3B8"
                style={styles.searchInput}
              />
              {searchQuery.trim().length > 0 && (
                <Pressable
                  onPress={handleClearSearch}
                  style={styles.searchClearBtn}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </Pressable>
              )}
            </View>

            {/* Notifications */}
            <Pressable
              onPress={() => {
                navigation.navigate("Notifications");
              }}
              style={({ pressed }) => [
                styles.bellBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="notifications" size={32} color="#06C168" />
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

        {shouldShowSkeleton ? (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            disableIntervalMomentum
          >
            {renderDiscoveryHeader()}
            {activeTab === "food" ? (
              <View style={{ gap: 12 }}>
                {[1, 2, 3].map((row) => (
                  <View key={row} style={{ flexDirection: "row", gap: 12 }}>
                    {[1, 2].map((col) => (
                      <View
                        key={`${row}-${col}`}
                        style={{
                          flex: 1,
                          backgroundColor: "#fff",
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: "#F1F5F9",
                          overflow: "hidden",
                          height: 242,
                        }}
                      >
                        <SkeletonBlock
                          width="100%"
                          height={130}
                          borderRadius={0}
                        />
                        <View style={{ padding: 10, gap: 6 }}>
                          <SkeletonBlock
                            width="70%"
                            height={14}
                            borderRadius={6}
                          />
                          <SkeletonBlock
                            width="45%"
                            height={11}
                            borderRadius={6}
                          />
                          <SkeletonBlock
                            width="90%"
                            height={11}
                            borderRadius={6}
                          />
                          <SkeletonBlock
                            width="75%"
                            height={11}
                            borderRadius={6}
                          />
                          <View
                            style={{
                              flexDirection: "row",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 8,
                            }}
                          >
                            <SkeletonBlock
                              width="48%"
                              height={14}
                              borderRadius={6}
                            />
                            <SkeletonBlock
                              width="28%"
                              height={12}
                              borderRadius={6}
                            />
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ gap: 20 }}>
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
                        <SkeletonBlock
                          width="65%"
                          height={16}
                          borderRadius={8}
                        />
                        <SkeletonBlock
                          width="40%"
                          height={12}
                          borderRadius={6}
                        />
                        <SkeletonBlock
                          width="50%"
                          height={10}
                          borderRadius={5}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            )}
            <View style={{ height: 90 }} />
          </ScrollView>
        ) : activeTab === "restaurant" ? (
          <FlatList
            key="restaurantList"
            data={restaurants}
            keyExtractor={(item, index) =>
              String(getRestaurantId(item) ?? `restaurant-${index}`)
            }
            ListHeaderComponent={renderDiscoveryHeader}
            ListEmptyComponent={
              <EmptyState activeTab="restaurant" searchQuery={searchQuery} />
            }
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            renderItem={renderRestaurantItem}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            initialNumToRender={6}
            maxToRenderPerBatch={6}
            updateCellsBatchingPeriod={40}
            windowSize={5}
            removeClippedSubviews
            getItemLayout={(_, index) => ({
              length: RESTAURANT_CARD_ESTIMATED_HEIGHT,
              offset: RESTAURANT_CARD_ESTIMATED_HEIGHT * index,
              index,
            })}
            decelerationRate="fast"
            disableIntervalMomentum
            ListFooterComponent={<View style={{ height: 90 }} />}
          />
        ) : (
          <FlatList
            key="foodList"
            data={allFoods}
            keyExtractor={(item) => String(item.id)}
            numColumns={2}
            ListHeaderComponent={renderDiscoveryHeader}
            ListEmptyComponent={
              <EmptyState activeTab="food" searchQuery={searchQuery} />
            }
            renderItem={renderFoodItem}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={[styles.content, { gap: 12 }]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={12}
            updateCellsBatchingPeriod={24}
            windowSize={6}
            removeClippedSubviews
            decelerationRate="fast"
            disableIntervalMomentum
            ListFooterComponent={<View style={{ height: 90 }} />}
          />
        )}

        {/* Floating Cart */}
        {cartCount > 0 && (
          <Pressable
            onPress={() => navigation.navigate("Cart")}
            style={({ pressed }) => [
              styles.fabCart,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.fabText}>
              🛒 {cartCount} item{cartCount !== 1 ? "s" : ""} →
            </Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function EmptyState({ activeTab, searchQuery }) {
  const hasSearch = String(searchQuery || "").trim().length > 0;
  const title = hasSearch
    ? "No matches yet"
    : activeTab === "restaurant"
      ? "No restaurants available"
      : "No food items available";
  const subTitle = hasSearch
    ? "Try another keyword, item name, or category."
    : "Please check back shortly while we refresh this section.";

  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="file-tray-outline" size={34} color="#0B8A49" />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{subTitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FFFFFF" },

  promoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(25,28,27,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  promoCard: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#0B3B1E",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 28,
    elevation: 14,
  },
  promoHeroWrap: {
    width: "100%",
    height: 250,
    position: "relative",
  },
  promoHeroImage: {
    width: "100%",
    height: "100%",
  },
  promoHeroFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: "rgba(255,255,255,0)",
  },
  promoBody: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 20,
    marginTop: -42,
  },
  promoKicker: {
    alignSelf: "flex-start",
    color: "#1f1f1f",
    backgroundColor: "#06C168",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    textTransform: "uppercase",
  },
  promoTitle: {
    marginTop: 18,
    color: "#191C1B",
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  promoSubtitle: {
    marginTop: 8,
    color: "#526353",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  promoPriceCard: {
    marginTop: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: "rgba(0,110,32,0.18)",
    backgroundColor: "#F2F4F2",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  promoPriceTag: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  promoPriceTag1: {
    color: "#1f1f1f",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  promoPriceMain: {
    marginTop: 6,
    color: "#06C168",
    fontSize: 40,
    lineHeight: 46,
    fontWeight: "900",
    letterSpacing: -1,
  },
  promoPriceSuffix: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: "#06C168",
  },
  promoPriceSub: {
    marginTop: 8,
    color: "#526353",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  promoCtaBtn: {
    marginTop: 18,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#06C168",
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 7,
  },
  promoCtaBtnDisabled: {
    opacity: 0.65,
  },
  promoCtaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.985 }],
  },
  promoCtaGradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  promoCtaText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  header: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 6,
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
    width: 48,
    height: 48,
    borderRadius: 100,
    backgroundColor: "#06C168",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },

  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
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
    backgroundColor: "#FFFFFF",
    borderRadius: 999,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchIcon: { marginRight: 10 },
  searchInput: {
    flex: 1,
    color: "#111827",
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 0,
  },
  searchClearBtn: {
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
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
  sectionLink: { color: "#06C168", fontWeight: "800", fontSize: 13 },

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
    borderColor: "#06C168",
    shadowColor: "#06C168",
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  catIconImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    backgroundColor: "#F8FAFC",
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
  catTextActive: { color: "#06C168" },

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
    backgroundColor: "#06C168",
    shadowColor: "#06C168",
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
    backgroundColor: "#06C168",
  },
  restaurantName: {
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  restaurantCuisine: {
    color: "#06C168",
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
    backgroundColor: "#06C168",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#06C168",
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

  foodCardAnimWrap: {
    flex: 1,
    minWidth: 0,
  },
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
    height: 258,
  },
  foodImgWrap: {
    position: "relative",
    width: "100%",
    height: 130,
  },
  foodImg: { width: "100%", height: "100%" },
  foodRatingBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  foodRatingText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#111827",
  },
  foodBody: {
    flex: 1,
    paddingTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 14,
  },
  foodTitle: {
    fontWeight: "700",
    color: "#111827",
    fontSize: 14,
    marginBottom: 2,
  },
  foodRestaurant: {
    fontSize: 11,
    color: "#06C168",
    fontWeight: "700",
    marginBottom: 3,
  },
  foodDesc: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 15,
    marginBottom: 6,
  },
  foodRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: "auto",
    paddingBottom: 2,
  },
  priceGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  foodPrice: { color: "#06C168", fontWeight: "900", fontSize: 14 },
  oldPrice: {
    fontSize: 11,
    color: "#DC2626",
    textDecorationLine: "line-through",
    textDecorationColor: "#DC2626",
  },
  foodTime: { color: "#94A3B8", fontSize: 11, fontWeight: "600" },

  emptyBox: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 30,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: "#F8FCFA",
    borderWidth: 1,
    borderColor: "#DDF5E8",
    gap: 10,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E6F9EF",
    borderWidth: 1,
    borderColor: "#C7EED8",
  },
  emptyTitle: {
    fontWeight: "800",
    color: "#1E293B",
    fontSize: 18,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  emptySub: {
    color: "#475569",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },

  fabCart: {
    position: "absolute",
    right: 16,
    bottom: 24,
    backgroundColor: "#06C168",
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 14,
    shadowColor: "#06C168",
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
