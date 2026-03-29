# React Query Refactoring - Architecture Reference

## 🏗️ Component Architecture Before & After

### BEFORE: Manual Fetch Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│                  AvailableDeliveriesScreen                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  useState: [ deliveries, currentRoute, driverLocation, ... ]        │
│                                                                     │
│  useEffect (on init):                                              │
│    1. Load AsyncStorage cache                                      │
│    2. Call fetchPendingDeliveriesWithLocation()                    │
│    3. Start interval for location tracking (3s)                    │
│    4. Start interval for safety refresh (120s)                     │
│                                                                     │
│  fetchPendingDeliveriesWithLocation():                             │
│    1. Call API with location + token                               │
│    2. On success: setState() x3 (deliveries, route, location)      │
│    3. Save to AsyncStorage                                         │
│    4. On error: setState() for error                               │
│                                                                     │
│  Location Tracking (every 3s):                                      │
│    1. Get current position                                         │
│    2. If moved 100m+: call fetchPendingDeliveriesWithLocation()   │
│                                                                     │
│  Accept Delivery:                                                   │
│    1. Call accept API endpoint                                     │
│    2. If success: clear state + re-fetch                           │
│                                                                     │
│  Cleanup: Clear intervals, abort fetch controller                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### AFTER: React Query Pattern

```
┌──────────────────────────────────────────────────────────────────────┐
│                   AvailableDeliveriesScreen                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  useQuery({                                                          │
│    queryKey: ["driver", "deliveries", "available", locationStr],   │
│    queryFn: queryFnFetchDeliveries,                                 │
│    staleTime: 30s, gcTime: 60s                                      │
│  }) → { data: queryData, isLoading, isFetching, error, refetch }   │
│                                                                      │
│  useState: [ currentLocationStr, declinedIds, ... ]                 │
│                                                                      │
│  Computed values:                                                    │
│    deliveries = queryData?.deliveriesArray || []                    │
│    currentRoute = queryData?.currentRoute || {}                     │
│                                                                      │
│  useEffect (on init):                                               │
│    1. Load AsyncStorage cache (show immediately)                    │
│    2. Call fetchPendingDeliveriesWithLocation(location)             │
│       → Updates currentLocationStr                                  │
│       → React Query automatically fetches                           │
│    3. Start location tracking (3s) - unchanged                      │
│    4. Start interval for safety refresh (120s)                      │
│       → Calls refetchQuery() instead of manual fetch                │
│                                                                      │
│  fetchPendingDeliveriesWithLocation():                              │
│    1. Update currentLocationStr                                     │
│    2. React Query automatically:                                    │
│       - Detects query key change                                    │
│       - Calls queryFnFetchDeliveries with new location              │
│       - Handles loading/error/success states                        │
│       - Updates queryData                                           │
│                                                                      │
│  Location Tracking (every 3s):                                       │
│    1. Get current position                                          │
│    2. If moved 100m+: call fetchPendingDeliveriesWithLocation()    │
│       → Same function, now uses React Query!                        │
│                                                                      │
│  Accept Delivery:                                                    │
│    1. Call accept API endpoint                                      │
│    2. If success: invalidate query                                  │
│       → queryClient.invalidateQueries()                             │
│       → React Query auto-refetches with invalidated data            │
│                                                                      │
│  Cleanup: Clear intervals (React Query handles AbortController)    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagrams

### SCENARIO 1: Initial Load

```
START
  ↓
Load legacy cache from AsyncStorage
  ↓
Display cached data (instant UX)
  ↓
Get device location
  ↓
Update currentLocationStr
  ↓
React Query detects key change
  ↓
Call queryFnFetchDeliveries with new location
  ↓
API returns fresh data
  ↓
Update queryData
  ↓
React Query updates component
  ↓
persistQueryCache() saves to AsyncStorage
  ↓
END (fresh data now displayed)
```

### SCENARIO 2: Location Movement (Every 3s)

```
watchPositionAsync fires
  ↓
Calculate distance from lastFetchLocation
  ↓
If distance < 100m:
  └─→ Just update driver marker
      └─→ No API call

If distance >= 100m:
  └─→ Update currentLocationStr
      └─→ React Query detects key change
          └─→ Calls queryFnFetchDeliveries with new location
              └─→ API fetches new nearby deliveries
                  └─→ persistQueryCache() saves result
```

### SCENARIO 3: Accept Delivery

```
User taps Accept
  ↓
Call POST /driver/deliveries/{id}/accept API
  ↓
If success:
  ├─→ Show toast "Delivery accepted!"
  ├─→ Clear local deliveries state
  ├─→ After 500ms: invalidate query
  │   └─→ queryClient.invalidateQueries()
  │       └─→ React Query marks data as stale
  │           └─→ Auto-refetch with current location
  │               └─→ New deliveries list loads
  └─→ Set isLoadingAfterAccept = false
```

### SCENARIO 4: Safety Refresh (Every 120s)

```
BEFORE (Manual):
  setInterval(() => {
    fetchDeliveriesWithCurrentLocation()  ← Manual function
      └─→ setIsRefreshing(true)
          └─→ Manual fetch() call
              └─→ setState()
  }, 120000)

AFTER (React Query):
  setInterval(() => {
    refetchQuery()  ← React Query built-in
      └─→ Calls queryFnFetchDeliveries
          └─→ Returns data
              └─→ Auto-updates component
  }, 120000)
```

---

## 🔑 Query Key Strategy

### Query Key Structure:

```javascript
["driver", "deliveries", "available", locationStr];
//  scope    resource      type         unique-param
```

### What Triggers Refetch:

```javascript
// 1. Location change (most common - every 100m)
setCurrentLocationStr(JSON.stringify(newLocation))
  → Changes query key
  → React Query auto-refetches

// 2. Manual refetch (safety interval - every 120s)
refetchQuery()
  → Calls queryFn with current queryKey
  → Returns fresh data

// 3. Query invalidation (after accept)
queryClient.invalidateQueries({
  queryKey: ["driver", "deliveries", "available"]
})
  → Marks all matching queries as stale
  → Auto-refetches if component is mounted
```

### Cache Hierarchy:

```
MEMORY CACHE (React Query)
  - staleTime: 30s (fresh data served instantly)
  - gcTime: 60s (keep in memory for 1 minute)

ASYNC STORAGE (Fallback)
  - CACHE_EXPIRY: 60s
  - Used on app reopen if memory cache empty
  - Provides instant display of stale data
```

---

## ❓ Common Questions During Migration

### Q1: "How does React Query know WHEN to fetch?"

**A:** React Query refetches when:

1. Query key changes → `setCurrentLocationStr()` does this
2. Data becomes stale → After `staleTime: 30s`
3. Component mounts → First mount triggers fetch
4. Manual refetch called → `refetchQuery()`
5. Query is invalidated → `invalidateQueries()`

---

### Q2: "What about AbortController? Do I need to manage it?"

**A:** NO! React Query handles it automatically:

- Passes `signal` to queryFn
- We pass it to `rateLimitedFetch()`
- React Query auto-aborts when new fetch starts
- No manual abort() calls needed

---

### Q3: "Will the component re-render too much?"

**A:** No, React Query is smart:

- Only updates when `queryData` changes
- Deduplicates simultaneous requests
- Batches updates efficiently
- Your component won't see all the internal state changes

---

### Q4: "What if user closes app while fetching?"

**A:** React Query handles it:

- `signal` is aborted automatically
- Component cleanup runs
- No memory leaks
- Next open uses AsyncStorage cache

---

### Q5: "Can I still manually call the fetch function?"

**A:** Yes! That's exactly how location tracking works:

```javascript
// Location tracker calls this
fetchPendingDeliveriesRef.current(newLocation)
  ↓ (calls)
fetchPendingDeliveriesWithLocation(newLocation)
  ↓ (updates)
setCurrentLocationStr(JSON.stringify(newLocation))
  ↓ (triggers)
React Query auto-fetch with new key!
```

---

### Q6: "How do I test if it's working?"

**A:** Check the console logs:

```
[QUERY] Requesting available deliveries from: ...
[QUERY] Response status: 200
[QUERY] Response data: { total_available: 5, ... }
[LOCATION] 🚗 Driver moved 150m (...) - Triggering refresh
[DATA REFRESH] Safety fallback check (120s interval)...
```

Plus use React Query DevTools (optional):

```bash
npm install @tanstack/react-query-devtools
```

Then add to component:

```javascript
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
// In JSX: <ReactQueryDevtools initialIsOpen={false} />
```

---

### Q7: "What if the API changes the response format?"

**A:** You only change the query function:

```javascript
// If API now returns: { availableOrders: [...] } instead of { available_deliveries: [...] }
// Just update this one line in queryFnFetchDeliveries:

// Before:
return { deliveriesArray: data.available_deliveries || [], ... }

// After:
return { deliveriesArray: data.availableOrders || [], ... }

// Everything else stays the same!
```

---

### Q8: "What about error retries? Can I customize?"

**A:** Yes! Modify the useQuery config:

```javascript
const { ... } = useQuery({
  queryKey: [...],
  queryFn: queryFnFetchDeliveries,
  retry: (failureCount, error) => {
    // Retry max 3 times, but not on 401 (auth error)
    return failureCount < 3 && error.status !== 401;
  },
  retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  ...
});
```

---

### Q9: "The toast shows but query still runs. Is that normal?"

**A:** Yes! This is actually good:

```
Toast shown (user feedback): "No internet connection"
  ↓ (at same time)
React Query retrying: retry: 1 configured
  ↓ (after retry completes)
If it succeeds: Data updates, error clears
If it fails again: Toast stays, user can retry manually
```

---

### Q10: "Can I use React Query with the existing Socket integration?"

**A:** Yes! They work independently:

- React Query: Handles HTTP polling (location changes, safety interval)
- Socket: Real-time updates from server
- You can layer them:
  ```javascript
  // When socket sends new delivery
  socket.on("new-delivery", () => {
    queryClient.invalidateQueries({
      queryKey: ["driver", "deliveries", "available"],
    });
    // React Query auto-refetches = fresh data
  });
  ```

---

## 🎯 Performance Metrics

### BEFORE (Manual Fetch):

- Memory: Always holds refetch controller in ref
- Network: Every 3s location update could trigger fetch (aggressive)
- CPU: setState() triggers full re-render each fetch
- Cache: AsyncStorage only, no memory dedupe

### AFTER (React Query):

- Memory: Automatic cleanup, garbage collected if component unmounts
- Network: Still 3s, but React Query smart-deduplicates simultaneous requests
- CPU: Only updates affected components (optimized)
- Cache: Memory + AsyncStorage = faster cold starts + instant responses

---

## 🚨 Error Scenarios & Handling

### Scenario A: Network Error

```
User offline
  ↓
rateLimitedFetch() throws NetworkError
  ↓
qFn throws error
  ↓
React Query catches it
  ↓
Sets error state
  ↓
useEffect maps to fetchError
  ↓
Error banner shows "No internet connection. Retrying..."
  ↓
React Query retries 1 time
  ↓
If still fails: User can tap "Retry" button
```

### Scenario B: 401 Authentication Error

```
Token expired
  ↓
API returns 401
  ↓
qFn throws "HTTP 401" error
  ↓
Error message: "Authentication failed. Please log in again."
  ↓
IMPORTANT: You should add navigation to login screen here
```

### Scenario C: Server Error (500)

```
Server maintenance
  ↓
API returns 500
  ↓
qFn throws "HTTP 500" error
  ↓
Error message: "Server error. Please try again."
  ↓
React Query retries 1 time automatically
  ↓
If still 500: Show retry button
```

---

## 📱 Testing Checklist (Detailed)

### 1. Initial Load Test

```
✓ App opens
✓ Skeleton cards show (from cached data)
✓ Console shows: [QUERY] Requesting...
✓ Fresh data arrives
✓ Cards update smoothly
✓ Console shows: [QUERY] Response data: {...}
```

### 2. Location Tracking Test

```
✓ Simulate position change via Xcode/Android Emulator
✓ First few movements: console shows "moved Xm (< 100m)" NO API call
✓ After 100m+: console shows "moved 150m (threshold: 100m) - Triggering refresh"
✓ New API request fires
✓ [QUERY] logs appear
✓ Deliveries list updates if data changed
```

### 3. Safety Refresh Test

```
✓ App running, just sitting idle
✓ After ~2 minutes: console shows [DATA REFRESH] message
✓ [QUERY] logs appear for API request
✓ Network tab shows fresh GET request (every 120s)
```

### 4. Accept Delivery Test

```
✓ Tap "Accept Delivery" button
✓ Toast shows: "Accepting..."
✓ Skeleton cards briefly appear
✓ Toast shows: "✅ Delivery accepted!"
✓ Console shows: invalidateQueries([driver, deliveries, available])
✓ New API request fires
✓ Deliveries list updates
```

### 5. Decline Delivery Test

```
✓ Tap decline button (trash icon)
✓ Card immediately moves to bottom (opacity reduced)
✓ Banner shows "Moved to bottom"
✓ Still clickable to accept
✓ No API call (local state only) ✓
```

### 6. Refresh Control Test (Pull-to-Refresh)

```
✓ Pull down on list
✓ Spinner appears
✓ [QUERY] logs show
✓ New data arrives
✓ List updates
✓ Spinner hides
```

### 7. Error Handling Test

```
✓ Turn off networking
✓ Pull refresh or wait for next auto-fetch
✓ Error banner appears: "No internet connection"
✓ Retry button clickable
✓ Tap retry when network back on
✓ Data loads successfully
```

### 8. Navigation Test

```
✓ Accept delivery → navigate to Active screen
✓ Go back → Available screen still has cache
✓ Deliveries still visible (didn't reload from scratch)
```

### 9. Cache Persistence Test

```
✓ App showing deliveries
✓ Force close app (don't clear data)
✓ Reopen app
✓ Deliveries immediately visible (from AsyncStorage)
✓ Then fresh data arrives and updates
```

### 10. Stacked Delivery Test

```
✓ Accept delivery with active_deliveries > 0
✓ Next delivery shows bonus box
✓ Bonus earnings display correctly
✓ Curved routes render (stacked view mode)
✓ Accept/decline works with stacked data
```

---

## 🔍 Debugging Tips

### Enable React Query DevTools

```javascript
// At top of file
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

// In JSX (temporary, remove later):
return (
  <>
    <View>{/* ... component ... */}</View>
    <ReactQueryDevtools initialIsOpen={true} />
  </>
);
```

### Check Query Cache State

```javascript
const queryClient = useQueryClient();

// In a button, for debugging:
<Pressable
  onPress={() => {
    const cache = queryClient.getQueryData([
      "driver",
      "deliveries",
      "available",
    ]);
    console.log("Current cache:", cache);
  }}
>
  {/* ... */}
</Pressable>;
```

### Monitor all queries

```javascript
// Add this to see all query state changes
queryClient.getQueryCache().subscribe((event) => {
  console.log("[REACT_QUERY_EVENT]", event);
});
```

---

## 💡 Pro Tips

1. **Keep staleTime low** (30s) so users always see somewhat fresh data
2. **Match gcTime to AsyncStorage cache** (both 60s) for consistency
3. **Use queryClient.prefetchQuery()** before navigating to other screens
4. **Add optimistic updates** for accept/decline (advanced)
5. **Monitor DevTools** during QA to spot duplicate requests
6. **Log [QUERY] messages** for one week in production to verify behavior

---

## 🎬 Next Steps After Refactoring

1. **Test thoroughly** using the checklist above
2. **Monitor production** for 1-2 weeks
3. **Consider optimizations**:
   - Prefetching next set of deliveries
   - Optimistic updates for accept
   - Better retry strategy for errors
4. **Convert mutations** to useAcceptDelivery, useDeclineDelivery hooks (bonus)
5. **Setup React Query** globally in app root with custom config
