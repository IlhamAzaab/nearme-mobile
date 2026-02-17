import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Image,
  TouchableOpacity,
  Animated,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_MARGIN = 10;

/**
 * FoodCarousel3D - Horizontal scrolling food carousel with 3D-like effects
 * @param {Object} props - { items, onItemPress }
 */
const FoodCarousel3D = ({ items = [], onItemPress }) => {
  const scrollX = useRef(new Animated.Value(0)).current;

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_MARGIN * 2}
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {items.map((item, index) => {
          const inputRange = [
            (index - 1) * (CARD_WIDTH + CARD_MARGIN * 2),
            index * (CARD_WIDTH + CARD_MARGIN * 2),
            (index + 1) * (CARD_WIDTH + CARD_MARGIN * 2),
          ];

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.9, 1, 0.9],
            extrapolate: 'clamp',
          });

          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.6, 1, 0.6],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={item.id || index}
              style={[
                styles.card,
                { transform: [{ scale }], opacity },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onItemPress?.(item)}
              >
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.image} />
                ) : (
                  <View style={[styles.image, styles.placeholder]}>
                    <Text style={styles.placeholderText}>🍽️</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  {item.price && <Text style={styles.price}>ETB {item.price}</Text>}
                  {item.restaurant && (
                    <Text style={styles.restaurant} numberOfLines={1}>{item.restaurant}</Text>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 12 },
  scrollContent: { paddingHorizontal: 16 },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: CARD_MARGIN,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  image: { width: '100%', height: 160, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  placeholder: { backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  placeholderText: { fontSize: 40 },
  info: { padding: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  price: { fontSize: 14, fontWeight: '600', color: '#FF6B35', marginTop: 4 },
  restaurant: { fontSize: 12, color: '#888', marginTop: 2 },
});

export default FoodCarousel3D;
