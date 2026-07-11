import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../constants/api";
import { getAccessToken } from "../../lib/authStorage";
import OptimizedImage from "../common/OptimizedImage";

const { width } = Dimensions.get("window");
const BANNER_WIDTH = width - 32;
const BANNER_HEIGHT = BANNER_WIDTH * (9 / 21);

// Countdown Hook
const useCountdown = (endTime) => {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const diff = end - now;

      if (diff <= 0) return "EXPIRED";

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      if (d > 0) return `${d} days left`;
      if (h > 0) return `Ends in ${h}h ${m}m`;
      return `Ends in ${m}m ${s}s`;
    };

    setTimeLeft(calculateTimeLeft());
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft === "EXPIRED") {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return timeLeft;
};

const OfferBannerItem = ({ item, onPress }) => {
  const timeLeft = useCountdown(item.end_time);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      style={styles.bannerContainer}
      onPress={() => onPress(item)}
    >
      <OptimizedImage
        uri={item.image_url}
        style={styles.bannerImage}
        contentFit="cover"
      />
      
      {/* Top Right Timer */}
      <View style={styles.topRightOverlay}>
        <View style={styles.timerBadge}>
          <Ionicons name="time-outline" size={12} color="#FFFFFF" />
          <Text style={styles.timerText}>{timeLeft}</Text>
        </View>
      </View>

      {/* Bottom Overlay Gradient for Contrast */}
      <View style={styles.bottomOverlayContainer}>
        {/* Restaurant Info Bottom Left */}
        <View style={styles.restaurantInfo}>
          {item.restaurants?.logo_url ? (
            <OptimizedImage
              uri={item.restaurants.logo_url}
              style={styles.restaurantLogo}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.restaurantLogo, { backgroundColor: "#06C168", justifyContent: "center", alignItems: "center" }]}>
               <Ionicons name="restaurant" size={12} color="#fff" />
            </View>
          )}
          <View style={{ flexShrink: 1, flexDirection: "column" }}>
            <Text style={styles.restaurantName} numberOfLines={1}>
              {item.restaurants?.restaurant_name || "Meezo Special"}
            </Text>
            {item.description ? (
              <Text style={styles.offerDescription} numberOfLines={1}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Buy Now Button Bottom Right */}
        <View style={styles.buyNowBtn}>
          <Text style={styles.buyNowText}>Buy Now</Text>
          <Ionicons name="chevron-forward" size={14} color="#000" />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function OfferBanners() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      const token = await getAccessToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/public/offers`, { headers });
      const data = await res.json();
      if (res.ok && data.offers && data.offers.length > 0) {
        setOffers(data.offers);
      }
    } catch (error) {
      console.error("Failed to fetch offers:", error);
    } finally {
      setLoading(false);
    }
  };

  // Infinite Auto-Scroll Logic
  useEffect(() => {
    if (offers.length <= 1) return;

    const timer = setInterval(() => {
      let nextIndex = currentIndex + 1;
      
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      }
      setCurrentIndex(nextIndex);

      // If we just scrolled to the cloned first item (which is at index == offers.length),
      // wait for the slide animation to finish, then instantly snap back to the real first item (index 0).
      if (nextIndex === offers.length) {
        setTimeout(() => {
          if (flatListRef.current) {
            flatListRef.current.scrollToIndex({
              index: 0,
              animated: false,
            });
          }
          setCurrentIndex(0);
        }, 400); // 400ms is enough time for the slide animation to complete
      }
    }, 4000); // Auto slide every 4 seconds

    return () => clearInterval(timer);
  }, [currentIndex, offers.length]);

  const handlePressOffer = (offer) => {
    if (offer.restaurant_id && offer.food_id) {
      navigation.navigate("FoodDetail", {
        foodId: offer.food_id,
        restaurantId: offer.restaurant_id,
      });
    }
  };

  const handleScrollEnd = (e) => {
    const contentOffset = e.nativeEvent.contentOffset.x;
    let index = Math.round(contentOffset / (BANNER_WIDTH + 16));
    
    // Manual swipe seamless loop handling
    if (index === offers.length) {
      if (flatListRef.current) {
        flatListRef.current.scrollToIndex({
          index: 0,
          animated: false,
        });
      }
      setCurrentIndex(0);
    } else {
      setCurrentIndex(index);
    }
  };

  if (loading || offers.length === 0) return null;

  // Append the first item to the end of the array to create a seamless circular loop
  const displayOffers = offers.length > 1 ? [...offers, { ...offers[0], _isClone: true }] : offers;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={displayOffers}
        keyExtractor={(item, index) => item.id + (item._isClone ? "_clone" : "")}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        snapToInterval={BANNER_WIDTH + 16}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={handleScrollEnd}
        renderItem={({ item }) => (
          <OfferBannerItem item={item} onPress={handlePressOffer} />
        )}
      />

      {offers.length > 1 && (
        <View style={styles.pagination}>
          {offers.map((_, index) => {
            // Since we added a clone at the end, the real index for dots shouldn't exceed offers.length - 1
            const realIndex = index === offers.length ? 0 : index;
            const inputRange = [
              (realIndex - 1) * (BANNER_WIDTH + 16),
              realIndex * (BANNER_WIDTH + 16),
              (realIndex + 1) * (BANNER_WIDTH + 16),
            ];

            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });

            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.8, 1, 0.8],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                key={index.toString()}
                style={[
                  styles.dot,
                  { opacity, transform: [{ scale }] },
                ]}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
  },
  listContent: {
    paddingHorizontal: 4,
  },
  bannerContainer: {
    width: BANNER_WIDTH,
    height: BANNER_HEIGHT,
    marginHorizontal: 3,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  bannerImage: {
    width: "100%",
    height: "100%",
  },
  topRightOverlay: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  timerText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "bold",
  },
  bottomOverlayContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    padding: 12,
  },
  restaurantInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  restaurantLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#FFF",
  },
  restaurantName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4
  },
  offerDescription: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
    flexShrink: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4
  },
  buyNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 2,
  },
  buyNowText: {
    color: "#000000", // Dark text for contrast against white button
    fontSize: 12,
    fontWeight: "bold",
  },
  pagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#06C168",
    marginHorizontal: 4,
  },
});
