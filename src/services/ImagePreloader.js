import { prefetchImageUrls } from "../lib/imageCache";

let cachedRestaurants = [];
let cachedFoodItems = [];

function collectUris(item, keys) {
  if (!item || !Array.isArray(keys)) return [];

  return keys
    .map((key) => String(item?.[key] || "").trim())
    .filter((uri) => /^https?:\/\//i.test(uri));
}

export function setImageCatalog(restaurants = [], foodItems = []) {
  cachedRestaurants = Array.isArray(restaurants) ? restaurants : [];
  cachedFoodItems = Array.isArray(foodItems) ? foodItems : [];
}

export function getCachedRestaurants() {
  return cachedRestaurants;
}

export function getCachedFoodItems() {
  return cachedFoodItems;
}

export async function preloadAllAppImages(restaurants = [], foodItems = []) {
  const safeRestaurants = Array.isArray(restaurants) ? restaurants : [];
  const safeFoodItems = Array.isArray(foodItems) ? foodItems : [];

  const restaurantImageKeys = [
    "logo_url",
    "restaurant_logo_url",
    "restaurant_logo",
    "logo",
    "cover_image_url",
    "restaurant_cover_url",
    "cover_url",
    "banner_image_url",
    "image_url",
    "image",
  ];

  const foodImageKeys = [
    "image_url",
    "food_image_url",
    "food_image",
    "image",
    "photo_url",
  ];

  const urls = [
    ...safeRestaurants.flatMap((restaurant) =>
      collectUris(restaurant, restaurantImageKeys),
    ),
    ...safeFoodItems.flatMap((food) => collectUris(food, foodImageKeys)),
  ];

  const uniqueUrls = [...new Set(urls)];
  setImageCatalog(safeRestaurants, safeFoodItems);

  if (uniqueUrls.length === 0) {
    console.log("[ImagePreloader] No remote images found to preload.");
    return;
  }

  console.log(
    `[ImagePreloader] Preloading ${uniqueUrls.length} Cloudinary images...`,
  );
  await prefetchImageUrls(uniqueUrls);
  console.log("[ImagePreloader] Done. All images cached to disk.");
}
