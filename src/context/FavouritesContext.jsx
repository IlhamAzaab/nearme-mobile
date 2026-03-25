import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@nearme_favourites";
const FavouritesContext = createContext(null);

export function useFavourites() {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used within FavouritesProvider");
  return ctx;
}

export function FavouritesProvider({ children }) {
  const [favourites, setFavourites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setFavourites(JSON.parse(raw));
      } catch (e) {
        console.error("Error loading favourites:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Persist helper
  const persist = async (items) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Error saving favourites:", e);
    }
  };

  /**
   * Add a food item to favourites.
   * Expected shape: { id, name, image_url, restaurant_id, restaurant_name, regular_price, offer_price }
   */
  const addFavourite = useCallback(
    (food) => {
      setFavourites((prev) => {
        if (prev.some((f) => f.id === food.id)) return prev;
        const next = [food, ...prev];
        persist(next);
        return next;
      });
    },
    [],
  );

  const removeFavourite = useCallback((foodId) => {
    setFavourites((prev) => {
      const next = prev.filter((f) => f.id !== foodId);
      persist(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback(
    (foodId) => favourites.some((f) => f.id === foodId),
    [favourites],
  );

  const toggleFavourite = useCallback(
    (food) => {
      if (isFavourite(food.id)) {
        removeFavourite(food.id);
      } else {
        addFavourite(food);
      }
    },
    [isFavourite, addFavourite, removeFavourite],
  );

  return (
    <FavouritesContext.Provider
      value={{ favourites, loading, addFavourite, removeFavourite, isFavourite, toggleFavourite }}
    >
      {children}
    </FavouritesContext.Provider>
  );
}
