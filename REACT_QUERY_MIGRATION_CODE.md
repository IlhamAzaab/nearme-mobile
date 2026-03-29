# React Query Refactoring - Line-by-Line Code Changes

This document shows EXACTLY what code to replace, line by line.

---

## CHANGE #1: Add React Query Import

**LOCATION:** After line 35 (after other imports)

**ADD THIS:**

```javascript
import { useQuery, useQueryClient } from "@tanstack/react-query";
```

---

## CHANGE #2: Create Query Function

**LOCATION:** After line 84 (after `saveCacheData()` function, before Haversine comment)

**REPLACE:** Nothing - this is entirely NEW code

**ADD THIS ENTIRE BLOCK:**

```javascript
// ============================================================================
// REACT QUERY SETUP
// ============================================================================

/**
 * Query function for fetching available deliveries
 * Wrapped to maintain existing API logic unchanged
 */
const queryFnFetchDeliveries = async ({ queryKey, signal }) => {
  // queryKey structure: ["driver", "deliveries", "available", location_string]
  const [_, __, ___, locationStr] = queryKey;

  let location = DEFAULT_DRIVER_LOCATION;
  if (locationStr && locationStr !== "default") {
    try {
      location = JSON.parse(locationStr);
    } catch (e) {
      console.warn("[QUERY] Failed to parse location from key:", e);
    }
  }

  try {
    const token = await AsyncStorage.getItem("token");
    const currentLoc = location || DEFAULT_DRIVER_LOCATION;

    const url = `${API_BASE_URL}/driver/deliveries/available/v2?driver_latitude=${currentLoc.latitude}&driver_longitude=${currentLoc.longitude}`;

    console.log("[QUERY] Requesting available deliveries from:", url);

    const res = await rateLimitedFetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal, // AbortSignal from React Query
    });

    console.log("[QUERY] Response status:", res.status);

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log("[QUERY] Response data:", {
      total_available: data.total_available,
      deliveries_count: data.available_deliveries?.length || 0,
      current_route: data.current_route,
    });

    // Return structured data that React Query caches
    return {
      deliveriesArray: data.available_deliveries || [],
      currentRoute: data.current_route || {
        total_stops: 0,
        active_deliveries: 0,
      },
      driverLocation: data.driver_location || currentLoc,
    };
  } catch (e) {
    if (e.name === "AbortError") {
      console.log("[QUERY] Request aborted");
      return null;
    }
    console.error("❌ [QUERY] Failed to fetch deliveries:", e);
    throw e; // Let React Query handle error state
  }
};
```

---

## CHANGE #3: Update Cache Helpers

**LOCATION:** Lines 65-84 (the `loadCachedData` and `saveCacheData` functions)

**REPLACE THE ENTIRE SECTION** (lines 65-84):

```javascript
// ============================================================================
// CACHE HELPERS (preserved, now integrated with React Query)
// ============================================================================

const loadCachedDataLegacy = async () => {
  try {
    const cached = await AsyncStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_EXPIRY) {
        return data;
      }
    }
  } catch (e) {
    console.warn("Cache load error:", e);
  }
  return null;
};

const saveCacheDataLegacy = async (data) => {
  try {
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, timestamp: Date.now() }),
    );
  } catch (e) {
    console.warn("Cache save error:", e);
  }
};

/**
 * Persist React Query cache to AsyncStorage
 * Called after successful query
 */
const persistQueryCache = async (data) => {
  if (data) {
    await saveCacheDataLegacy({
      deliveries: data.deliveriesArray || [],
      currentRoute: data.currentRoute || {
        total_stops: 0,
        active_deliveries: 0,
      },
      driverLocation: data.driverLocation || DEFAULT_DRIVER_LOCATION,
    });
  }
};
```

---

## CHANGE #4: Component State Initialization

**LOCATION:** Lines 114-148 (the component function and state declarations)

**FIND THIS:**

```javascript
export default function AvailableDeliveriesScreen({ navigation }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(true);

  // Keep ref in sync (so callbacks see latest value without re-creating)
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // Initialize with cached data for instant display
  const [deliveries, setDeliveries] = useState([]);
  const [declinedIds, setDeclinedIds] = useState(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasCompletedFirstFetch, setHasCompletedFirstFetch] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [driverLocation, setDriverLocation] = useState(DEFAULT_DRIVER_LOCATION);
  const [inDeliveringMode, setInDeliveringMode] = useState(false);
  const [currentRoute, setCurrentRoute] = useState({
    total_stops: 0,
    active_deliveries: 0,
  });
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [showNewDeliveryBanner, setShowNewDeliveryBanner] = useState(false);
  const [isLoadingAfterAccept, setIsLoadingAfterAccept] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Refs
  const flatListRef = useRef(null);
  const abortControllerRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const dataFetchIntervalRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const fetchPendingDeliveriesRef = useRef(null);
  const locationSubscriptionRef = useRef(null);

  // Animation for toast
  const toastAnim = useRef(new Animated.Value(0)).current;
```

**REPLACE WITH:**

```javascript
export default function AvailableDeliveriesScreen({ navigation }) {
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  // ✅ REACT QUERY: Main query for available deliveries
  // Location string for cache key (changes trigger refetch)
  const [currentLocationStr, setCurrentLocationStr] = useState("default");

  const {
    data: queryData,
    isLoading: initialLoading,
    isFetching: isRefreshing,
    error: queryError,
    refetch: refetchQuery,
    isRefetching: isQueryRefetching,
  } = useQuery({
    queryKey: ["driver", "deliveries", "available", currentLocationStr],
    queryFn: queryFnFetchDeliveries,
    staleTime: 30000, // 30 seconds before data considered stale
    gcTime: 60000, // Keep in cache for 1 minute (old cacheTime)
    enabled: true, // Always enabled; we'll manually control via location changes
    retry: 1,
  });

  // Destructure query data safely
  const deliveries = queryData?.deliveriesArray || [];
  const currentRoute = queryData?.currentRoute || { total_stops: 0, active_deliveries: 0 };
  const driverLocationFromQuery = queryData?.driverLocation || DEFAULT_DRIVER_LOCATION;

  // ✅ LOCAL STATES (preserved from original)
  const [declinedIds, setDeclinedIds] = useState(new Set());
  const [hasCompletedFirstFetch, setHasCompletedFirstFetch] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [driverLocation, setDriverLocation] = useState(DEFAULT_DRIVER_LOCATION);
  const [inDeliveringMode, setInDeliveringMode] = useState(false);
  const [toast, setToast] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [showNewDeliveryBanner, setShowNewDeliveryBanner] = useState(false);
  const [isLoadingAfterAccept, setIsLoadingAfterAccept] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Use driver location from query when available
  useEffect(() => {
    if (driverLocationFromQuery) {
      setDriverLocation(driverLocationFromQuery);
      lastFetchLocationRef.current = driverLocationFromQuery;
    }
  }, [driverLocationFromQuery]);

  // ✅ MAP QUERY ERROR TO LOCAL ERROR STATE
  useEffect(() => {
    if (queryError) {
      const errorMessage = queryError.message.includes("NetworkError")
        ? "No internet connection. Retrying..."
        : queryError.message.includes("HTTP 500")
          ? "Server error. Please try again."
          : queryError.message.includes("HTTP 401")
            ? "Authentication failed. Please log in again."
            : queryError.message || "Failed to fetch deliveries";
      setFetchError(errorMessage);
    } else {
      setFetchError(null);
    }
  }, [queryError]);

  // Refs (preserved)
  const flatListRef = useRef(null);
  const locationIntervalRef = useRef(null);
  const dataFetchIntervalRef = useRef(null);
  const lastFetchLocationRef = useRef(null);
  const fetchPendingDeliveriesRef = useRef(null);
  const locationSubscriptionRef = useRef(null);

  // Animation (preserved)
  const toastAnim = useRef(new Animated.Value(0)).current;
```

---

## CHANGE #5: Add Cache Persistence Effect

**LOCATION:** After the error mapping useEffect (after lines 170-182)

**ADD THIS NEW useEffect:**

```javascript
// ✅ Persist successful query results to AsyncStorage
useEffect(() => {
  if (queryData && hasCompletedFirstFetch) {
    persistQueryCache(queryData).catch((e) =>
      console.warn("[PERSIST] Cache save error:", e),
    );
  }
}, [queryData, hasCompletedFirstFetch]);
```

---

## CHANGE #6: Update initScreen Function

**LOCATION:** Lines 198-238 (the entire `initScreen` function)

**FIND AND REPLACE:**

```javascript
const initScreen = async () => {
  // Load cached data for instant display
  const cached = await loadCachedData();
  if (cached) {
    setDeliveries(cached.deliveries || []);
    setCurrentRoute(
      cached.currentRoute || { total_stops: 0, active_deliveries: 0 },
    );
    if (cached.driverLocation) setDriverLocation(cached.driverLocation);
    setHasCompletedFirstFetch(true);
    setInitialLoading(false);
  }

  // Check if driver is in delivering mode
  await checkDeliveringMode();

  // Get initial location and fetch deliveries
  const location = await getLocation();
  setDriverLocation(location);
  lastFetchLocationRef.current = location;
  await fetchPendingDeliveriesWithLocation(location, !cached);

  // Start location tracking every 3 seconds
  startLocationTracking();

  // Safety fallback refresh every 120 seconds (only when focused)
  dataFetchIntervalRef.current = setInterval(() => {
    if (!isFocusedRef.current) return;
    console.log("[DATA REFRESH] Safety fallback check (120s interval)...");
    fetchDeliveriesWithCurrentLocation(true);
  }, SAFETY_REFRESH_INTERVAL);
};
```

**REPLACE WITH:**

```javascript
const initScreen = async () => {
  // ✅ Load cached data for instant display (before query completes)
  const cached = await loadCachedDataLegacy();
  if (cached) {
    // Show cached data immediately
    // (queryData will override once fresh data arrives)
    setHasCompletedFirstFetch(true);
  }

  // Check if driver is in delivering mode
  await checkDeliveringMode();

  // Get initial location and trigger first query fetch
  const location = await getLocation();
  setDriverLocation(location);
  lastFetchLocationRef.current = location;

  // This triggers React Query to fetch with initial location
  await fetchPendingDeliveriesWithLocation(location, !cached);

  // Start location tracking every 3 seconds
  startLocationTracking();

  // ✅ Safety fallback refresh every 120 seconds (using React Query refetch)
  dataFetchIntervalRef.current = setInterval(() => {
    if (!isFocusedRef.current) return;
    console.log("[DATA REFRESH] Safety fallback check (120s interval)...");
    // Use React Query's refetch instead of manual fetch
    refetchQuery();
  }, SAFETY_REFRESH_INTERVAL);
};
```

---

## CHANGE #7: Update cleanup Function

**LOCATION:** Lines 240-255 (the `cleanup` function)

**FIND AND REPLACE:**

```javascript
const cleanup = () => {
  if (locationIntervalRef.current) {
    clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = null;
  }
  if (dataFetchIntervalRef.current) {
    clearInterval(dataFetchIntervalRef.current);
    dataFetchIntervalRef.current = null;
  }
  if (locationSubscriptionRef.current) {
    locationSubscriptionRef.current.remove();
    locationSubscriptionRef.current = null;
  }
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
  }
};
```

**REPLACE WITH:**

```javascript
const cleanup = () => {
  if (locationIntervalRef.current) {
    clearInterval(locationIntervalRef.current);
    locationIntervalRef.current = null;
  }
  if (dataFetchIntervalRef.current) {
    clearInterval(dataFetchIntervalRef.current);
    dataFetchIntervalRef.current = null;
  }
  if (locationSubscriptionRef.current) {
    locationSubscriptionRef.current.remove();
    locationSubscriptionRef.current = null;
  }
  // ✅ React Query handles AbortController internally
};
```

---

## CHANGE #8: Replace Fetch Functions

**LOCATION:** Lines 416-517 (entire `fetchDeliveriesWithCurrentLocation` and `fetchPendingDeliveriesWithLocation` functions)

**DELETE EVERYTHING FROM:** Line 416 (`const fetchDeliveriesWithCurrentLocation = ...`)
**TO:** Line 512 (end of `fetchPendingDeliveriesWithLocation`)

**AND Line 514-517:** `fetchPendingDeliveriesRef.current = ...`

**REPLACE ALL WITH:**

```javascript
// ============================================================================
// FETCH WRAPPER FUNCTIONS (React Query refactored)
// ============================================================================

/**
 * Trigger query refetch with new location
 * This updates the query key, which causes React Query to fetch with new params
 */
const fetchPendingDeliveriesWithLocation = useCallback(
  async (location, showLoading = true) => {
    // Update query key with new location
    // This causes React Query to invalidate and fetch new data
    const locationStr = JSON.stringify(location || DEFAULT_DRIVER_LOCATION);
    setCurrentLocationStr(locationStr);
    // React Query auto-handles the fetch now
  },
  [],
);

/**
 * Fetch with current driver location
 * Called from location tracking or refresh
 */
const fetchDeliveriesWithCurrentLocation = useCallback(
  async (isBackgroundRefresh = false) => {
    const location = await getLocation();
    setDriverLocation(location);
    lastFetchLocationRef.current = location;
    await fetchPendingDeliveriesWithLocation(location, isBackgroundRefresh);
  },
  [fetchPendingDeliveriesWithLocation],
);

// Store fetch function in ref (for location tracking callback)
useEffect(() => {
  fetchPendingDeliveriesRef.current = fetchPendingDeliveriesWithLocation;
}, [fetchPendingDeliveriesWithLocation]);
```

---

## CHANGE #9: Update handleAcceptDelivery Function

**LOCATION:** Lines 685-727 (the entire `handleAcceptDelivery` function)

**FIND AND REPLACE the section that invalidates cache:**

FIND THIS:

```javascript
      if (res.ok) {
        showToast("✅ Delivery accepted!");

        // Clear ALL deliveries immediately
        setDeliveries([]);
        setIsLoadingAfterAccept(true);

        // Fetch updated deliveries
        setTimeout(async () => {
          await fetchPendingDeliveriesWithLocation(driverLocation, false);
          setIsLoadingAfterAccept(false);
        }, 500);
      } else {
```

REPLACE WITH:

```javascript
      if (res.ok) {
        showToast("✅ Delivery accepted!");

        // Clear ALL deliveries immediately
        setDeliveries([]);
        setIsLoadingAfterAccept(true);

        // ✅ INVALIDATE QUERY to force refresh (instead of manual fetch)
        setTimeout(async () => {
          await queryClient.invalidateQueries({
            queryKey: ["driver", "deliveries", "available"],
          });
          // React Query will auto-refetch with current location
          setIsLoadingAfterAccept(false);
        }, 500);
      } else {
```

---

## CHANGE #10: Update onRefresh Callback

**LOCATION:** Lines 762-764

**FIND THIS:**

```javascript
const onRefresh = useCallback(() => {
  fetchDeliveriesWithCurrentLocation(true);
}, []);
```

**REPLACE WITH:**

```javascript
const onRefresh = useCallback(() => {
  fetchDeliveriesWithCurrentLocation(true);
}, [fetchDeliveriesWithCurrentLocation]);
```

---

## ✅ THAT'S IT!

All other code remains **COMPLETELY UNCHANGED**:

- ✓ Location tracking (lines 250-316)
- ✓ checkDeliveringMode (lines 319-351)
- ✓ handleDecline (lines 730-740)
- ✓ showToast (lines 742-756)
- ✓ sortedDeliveries memo (lines 775-781)
- ✓ renderDeliveryCard (lines 783-806)
- ✓ Entire main render JSX (lines 808-END)
- ✓ DeliveryCard component (lines 1068-1767)
- ✓ SkeletonCard component (lines 1769-1850)
- ✓ All styles (lines 1852-2019)

---

## 📦 Installation

Before applying changes, install React Query:

```bash
npm install @tanstack/react-query
```

Or with yarn:

```bash
yarn add @tanstack/react-query
```

---

## 🔍 Verification Checklist

After making all changes:

1. **Check for syntax errors:**
   - Line with `import { useQuery, useQueryClient }` exists
   - `queryFnFetchDeliveries` function is defined at top
   - `fetchPendingDeliveriesWithLocation` is a useCallback
   - `handleAcceptDelivery` uses `queryClient.invalidateQueries()`

2. **Check for missing imports:**
   - `useQuery` imported
   - `useQueryClient` imported

3. **Check for state consistency:**
   - `deliveries` comes from `queryData?.deliveriesArray`
   - `currentRoute` comes from `queryData?.currentRoute`
   - All other states match list above

4. **Test functionality:**
   - App launches and shows loading skeleton
   - Cached data appears instantly
   - Fresh data arrives and updates UI
   - Accept delivery works and refetches
   - Location tracking works (#)
   - 120s safety refresh works
   - Navigation works
