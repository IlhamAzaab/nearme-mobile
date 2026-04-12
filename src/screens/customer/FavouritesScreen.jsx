import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import OptimizedImage from "../../components/common/OptimizedImage";
import { useFavourites } from "../../context/FavouritesContext";

export default function FavouritesScreen({ navigation }) {
  const { favourites, removeFavourite } = useFavourites();

  const handleRemove = useCallback(
    (item) => {
      Alert.alert("Remove Favourite", `Remove "${item.name}" from favourites?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeFavourite(item.id),
        },
      ]);
    },
    [removeFavourite],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <View style={st.card}>
        <View style={st.imgWrap}>
          {item.image_url ? (
            <OptimizedImage uri={item.image_url} style={st.img} transition={100} />
          ) : (
            <View style={st.imgFallback}>
              <Ionicons name="fast-food" size={24} color="#06C168" />
            </View>
          )}
        </View>

        <View style={st.info}>
          <Text style={st.name} numberOfLines={1}>
            {item.name || "Food Item"}
          </Text>
          {item.restaurant_name ? (
            <Text style={st.restaurant} numberOfLines={1}>
              {item.restaurant_name}
            </Text>
          ) : null}
          <Text style={st.price}>
            {item.offer_price
              ? `Rs. ${Number(item.offer_price).toFixed(2)}`
              : item.regular_price
              ? `Rs. ${Number(item.regular_price).toFixed(2)}`
              : ""}
          </Text>
        </View>

        <Pressable
          style={st.removeBtn}
          onPress={() => handleRemove(item)}
          hitSlop={10}
        >
          <Ionicons name="heart-dislike" size={18} color="#EF4444" />
        </Pressable>
      </View>
    ),
    [handleRemove],
  );

  return (
    <SafeAreaView style={st.root} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#EDFBF2" />

      {/* ── Header ── */}
      <View style={st.header}>
        <Pressable style={st.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </Pressable>
        <Text style={st.headerTitle}>Favourites</Text>
        <View style={{ width: 40 }} />
      </View>

      {favourites.length === 0 ? (
        <View style={st.emptyWrap}>
          <View style={st.emptyIconWrap}>
            <Ionicons name="heart-outline" size={48} color="#D1D5DB" />
          </View>
          <Text style={st.emptyTitle}>No favourites yet</Text>
          <Text style={st.emptySubtitle}>
            Tap the heart icon on any food item to save it here.
          </Text>
          <Pressable
            style={st.browseBtn}
            onPress={() => navigation.navigate("Home")}
          >
            <Text style={st.browseBtnTxt}>Browse Foods</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={favourites}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={st.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
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

  list: { paddingHorizontal: 16, paddingBottom: 30, paddingTop: 4 },

  /* card */
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 12,
  },
  imgWrap: { borderRadius: 10, overflow: "hidden" },
  img: { width: 60, height: 60, borderRadius: 10 },
  imgFallback: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: "#E6F9EE",
    justifyContent: "center",
    alignItems: "center",
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#111827" },
  restaurant: { fontSize: 12, color: "#6B7280", marginTop: 2 },
  price: { fontSize: 14, fontWeight: "700", color: "#06C168", marginTop: 4 },

  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    justifyContent: "center",
    alignItems: "center",
  },

  /* empty state */
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#374151" },
  emptySubtitle: {
    fontSize: 13,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 6,
    lineHeight: 19,
  },
  browseBtn: {
    marginTop: 20,
    backgroundColor: "#06C168",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  browseBtnTxt: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
