# React Query Refactoring Guide: AvailableDeliveriesScreen

**Objective:** Migrate from manual fetch + setState to React Query while maintaining ALL existing complexity (animations, location tracking, error handling, caching, polyline logic, etc.).

---

## 📋 IMPLEMENTATION SUMMARY

### Phase 1: Add React Query Hook

### Phase 2: Replace Manual Fetch Functions

### Phase 3: Preserve Location/Refresh Logic

### Phase 4: Maintain Cache Integration

---

## 🔧 STEP 1: IMPORT STATEMENTS

**Current (Line 1-35):**

```javascript
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
// ... react-native imports ...
import FreeMapView from "../../components/maps/FreeMapView";
import { API_BASE_URL } from "../../constants/api";
import { rateLimitedFetch } from "../../utils/rateLimitedFetch";
```

**ADD AFTER these imports (react-query):**

```javascript
import { useQuery, useQueryClient } from "@tanstack/react-query";
```

---

## 🎯 STEP 2: CREATE QUERY FUNCTION

**INSERT AFTER CACHE HELPERS (After line 84, before HAVERSINE section):**

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

## 🔄 STEP 3: INITIALIZE REACT QUERY IN COMPONENT

**REPLACE the state initializers (lines 114-134) with this:**

```javascript
// ============================================================================
// STATE MANAGEMENT
// ============================================================================

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

## 🚀 STEP 4: REPLACE FETCH FUNCTIONS WITH WRAPPER

**REPLACE the original fetch functions (lines 416-517) with this:**

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

## 💾 STEP 5: UPDATE CACHE PERSISTENCE

**REPLACE the cache helpers (lines 65-84) with this enhanced version:**

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

## 🔄 STEP 6: UPDATE INITIALIZATION LOGIC

**REPLACE the initScreen function (lines 198-238) with this:**

```javascript
// ============================================================================
// INITIALIZATION
// ============================================================================

useEffect(() => {
  initScreen();
  return () => cleanup();
}, []);

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
};
```

---

## 📍 STEP 7: LOCATION TRACKING (NO CHANGES needed, keep as-is)

**Lines 250-316 - KEEP UNCHANGED:**

- `getLocation()` - No changes
- `startLocationTracking()` - No changes
- Movement threshold logic (100m check) - No changes
- Interval-based fallback - No changes

✅ **The location tracking already calls `fetchPendingDeliveriesRef.current()` which now uses React Query!**

---

## ✅ STEP 8: PERSIST CACHE AFTER SUCCESSFUL QUERY

**ADD new useEffect after the error mapping useEffect:**

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

## 🔧 STEP 9: UPDATE ACCEPT DELIVERY HANDLER

**REPLACE the handleAcceptDelivery function (lines 685-727) - Add query invalidation:**

```javascript
const handleAcceptDelivery = async (deliveryId) => {
  setAccepting(deliveryId);
  try {
    const token = await AsyncStorage.getItem("token");
    const delivery = deliveries.find((d) => d.delivery_id === deliveryId);

    const body = {
      driver_latitude: driverLocation?.latitude,
      driver_longitude: driverLocation?.longitude,
      earnings_data: delivery
        ? {
            delivery_sequence: currentRoute.active_deliveries + 1,
            base_amount:
              delivery.route_impact?.base_amount ||
              delivery.pricing?.total_trip_earnings ||
              0,
            extra_earnings: delivery.route_impact?.extra_earnings || 0,
            bonus_amount: delivery.route_impact?.bonus_amount || 0,
            tip_amount: parseFloat(delivery.pricing?.tip_amount || 0),
            r0_distance_km: delivery.route_impact?.r0_distance_km || null,
            r1_distance_km:
              delivery.route_impact?.r1_distance_km ||
              delivery.total_delivery_distance_km ||
              0,
            extra_distance_km: delivery.route_impact?.extra_distance_km || 0,
            total_distance_km: delivery.total_delivery_distance_km || 0,
          }
        : null,
    };

    const res = await fetch(
      `${API_BASE_URL}/driver/deliveries/${deliveryId}/accept`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();

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
      showToast(data.message || "Failed to accept delivery", "error");
    }
  } catch (e) {
    console.error("Accept error:", e);
    showToast("Failed to accept delivery", "error");
  } finally {
    setAccepting(null);
  }
};
```

---

## 🎨 STEP 10: RENDER LOGIC (NO CHANGES)

**Lines 759-842 - KEEP UNCHANGED:**

- `sortedDeliveries` - Works with `deliveries` state (now populated from queryData)
- `renderDeliveryCard` - No changes
- `onRefresh` - Already calls `fetchDeliveriesWithCurrentLocation()` which uses React Query

✅ **All UI rendering logic stays identical!**

---

## 📋 CHANGED STATE VARIABLES

### Variables to REMOVE:

- `isRefreshing` - replaced by React Query's `isFetching`
- `initialLoading` - replaced by React Query's `isLoading`
- ~~`abortControllerRef`~~ - React Query handles AbortSignal internally

### Variables KEPT:

- `declinedIds` - Still needed for UI state
- `driverLocation` - Local state (also in query data)
- `accepting` - Still needed for button loading state
- `inDeliveringMode` - Still needed
- `currentRoute` - Now from queryData
- `deliveries` - Now from queryData
- All animation refs (toastAnim, etc.)
- All interval refs (location tracking)

---

## 🔄 DATA FLOW COMPARISON

### BEFORE (Manual Fetch):

```
User Action / Interval
    ↓
fetchPendingDeliveriesWithLocation()
    ↓
rateLimitedFetch() + setState() + AsyncStorage.setItem()
    ↓
Component Re-renders
```

### AFTER (React Query):

```
User Action / Location Change / Interval
    ↓
Update query key or call refetchQuery()
    ↓
React Query automatically:
  - Calls queryFnFetchDeliveries()
  - Handles AbortSignal
  - Caches data in memory
  - Updates component
    ↓
persistQueryCache() saves to AsyncStorage
    ↓
Component Re-renders (same as before)
```

---

## ✨ BENEFITS OF THIS APPROACH

1. **Minimal Changes**: Only fetch functions modified, everything else stays same
2. **Better Performance**: React Query caches, deduplicates, and auto-refetches
3. **Easier Debugging**: Query status visible in React Query DevTools
4. **SafetyRefresh Still Works**: Uses `refetchQuery()` instead of manual interval
5. **AbortController Built-in**: React Query manages cancellation automatically
6. **Movement Threshold Works**: Location tracking still triggers query updates
7. **AsyncStorage Still Works**: We persist query results to AsyncStorage
8. **No Breaking Changes**: Component props, navigation, all other logic unchanged

---

## 🧪 TESTING CHECKLIST

- [ ] Initial load shows cached data, then fresh data arrives
- [ ] Location tracking every 3s updates driver marker (✓ unchanged)
- [ ] Movement threshold (100m) triggers API refresh
- [ ] Safety refresh (120s) triggers even if no movement
- [ ] Accept delivery invalidates query and refetches
- [ ] Decline hides card properly
- [ ] Error state shows proper message and retry button
- [ ] Toast notifications work
- [ ] Map polylines render correctly (✓ unchanged)
- [ ] Empty state and loading states display correctly
- [ ] Pull-to-refresh works
- [ ] Navigation between screens works (✓ unchanged)
- [ ] Socket connection indicator works (if implemented)
- [ ] Stacked delivery bonus/earnings display correctly (✓ unchanged)

---

## 📝 OPTIONAL ENHANCEMENTS (After Initial Migration)

Once basic refactoring works, consider:

1. **Mutation Hooks** for accept/decline (useAcceptDelivery, useDeclineDelivery)
2. **Query Device Tools**: Install `@tanstack/react-query-devtools`
3. **Optimistic Updates**: Update cache before server confirmation
4. **Background Refetch**: Use `background: true` in refetchOptions
5. **Prefetching**: Prefetch next screen's data
6. **Query Retry**: Customize retry strategy for specific errors

---

## 🚀 DEPLOYMENT

1. **Install React Query** (if not already): `npm install @tanstack/react-query`
2. **Make code changes** following steps 1-10 above
3. **Test thoroughly** using the checklist
4. **Monitor logs** for `[QUERY]` prefixed messages
5. **Compare perf** with previous version using React Native DevTools

---

## 📞 TROUBLESHOOTING

| Issue                      | Solution                                                                |
| -------------------------- | ----------------------------------------------------------------------- |
| "Query data undefined"     | Check if `queryData?.deliveriesArray` is being accessed safely          |
| "Fetch never completes"    | Check `signal` parameter in fetch - React Query passes AbortSignal      |
| "Duplicate API calls"      | React Query auto-deduplicates - check `staleTime` and `gcTime` settings |
| "Cache not persisting"     | Verify `persistQueryCache()` is called after successful query           |
| "Location tracking broken" | Verify `fetchPendingDeliveriesRef.current` is updated (see Step 8)      |
| "Intervals not triggering" | Check that `isFocusedRef.current` is being updated correctly            |
