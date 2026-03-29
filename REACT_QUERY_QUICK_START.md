# React Query Refactoring - Quick Start Guide

**TL;DR: Migrate AvailableDeliveriesScreen.jsx from manual fetch to React Query in 10 minutes**

---

## 📚 Documentation Files Created

These 4 files have been created to guide your refactoring:

1. **REACT_QUERY_REFACTORING_GUIDE.md** (Start here!)
   - Complete step-by-step implementation
   - All code blocks explained
   - Benefits & approach

2. **REACT_QUERY_MIGRATION_CODE.md** (Apply changes from this)
   - 10 specific code changes
   - Exact line numbers and replacements
   - What to add, remove, replace

3. **REACT_QUERY_ARCHITECTURE_REFERENCE.md** (For understanding)
   - Visual diagrams of data flow
   - Before/after architecture
   - 10 common questions answered
   - Complete testing checklist
   - Debugging guide

4. **This file** - Quick start & overview

---

## ⚡ 5-Minute Summary

### What's Changing?

```javascript
// BEFORE: Manual fetch + setState in component
const [deliveries, setDeliveries] = useState([]);

const fetchDeliveries = async () => {
  const res = await fetch(url);
  setDeliveries(data); // ← Manual state management
};

useEffect(() => {
  fetchDeliveries();
}, []);

// AFTER: React Query handles all this automatically
const { data: queryData } = useQuery({
  queryKey: ["driver", "deliveries", "available"],
  queryFn: queryFnFetchDeliveries, // ← Single place
});

const deliveries = queryData?.deliveriesArray || [];
```

### What Stays the Same?

- ✅ All UI components (DeliveryCard, SkeletonCard, styles)
- ✅ Location tracking (every 3s)
- ✅ Movement threshold logic (100m+)
- ✅ Safety refresh (120s)
- ✅ Accept/Decline functionality
- ✅ Error handling
- ✅ AsyncStorage caching
- ✅ Navigation
- ✅ Animations
- ✅ Map rendering with polylines

### What Changes?

- ❌ ~~Manual setState()~~ → React Query auto-updates
- ❌ ~~AbortController management~~ → React Query handles it
- ❌ ~~Manual fetch() calls~~ → Query function wrapping
- ❌ ~~Manual interval refetches~~ → useQuery config
- ❌ ~~Cache persistence code~~ → Integrated with React Query

---

## 🚀 Implementation Roadmap

### Step 1: Install React Query (2 min)

```bash
npm install @tanstack/react-query
# or
yarn add @tanstack/react-query
```

### Step 2: Review Architecture (3 min)

- Read: **REACT_QUERY_ARCHITECTURE_REFERENCE.md** (sections: Data Flow Diagrams, Component Architecture)
- Get a mental model of how it works

### Step 3: Apply Code Changes (30 min)

- Open: **REACT_QUERY_MIGRATION_CODE.md**
- Follow each CHANGE #1 through #10
- Make edits to `AvailableDeliveriesScreen.jsx`
- Use the detailed refactoring guide for explanations

### Step 4: Test (15 min)

- Run app on device/emulator
- Follow testing checklist from **REACT_QUERY_ARCHITECTURE_REFERENCE.md**
- Check console logs with [QUERY] prefix

### Step 5: Deploy (after testing)

---

## 📋 The 10 Code Changes (Summary)

| #   | What                                         | Where               | Type    |
| --- | -------------------------------------------- | ------------------- | ------- |
| 1   | Import useQuery, useQueryClient              | Top of file         | ADD     |
| 2   | Create queryFnFetchDeliveries()              | After cache helpers | ADD     |
| 3   | Update cache helpers (add persistQueryCache) | Lines 65-84         | UPDATE  |
| 4   | Initialize useQuery hook & state             | Lines 114-148       | REPLACE |
| 5   | Add cache persistence useEffect              | After error mapping | ADD     |
| 6   | Update initScreen()                          | Lines 198-238       | REPLACE |
| 7   | Clean cleanup()                              | Lines 240-255       | UPDATE  |
| 8   | Replace fetch functions                      | Lines 416-517       | REPLACE |
| 9   | Update Accept handler (invalidate query)     | Around line 710     | UPDATE  |
| 10  | Update onRefresh dependencies                | Lines 762-764       | UPDATE  |

**Detailed code in:** REACT_QUERY_MIGRATION_CODE.md

---

## 🎯 Key Concepts

### Query Key

```javascript
["driver", "deliveries", "available", locationStr]
     ↑         ↑               ↑            ↑
   scope   resource         resource   unique
                             type     parameter
```

- Changes to this key → New fetch
- Same key → Reuse cache

### Query Function

```javascript
const queryFnFetchDeliveries = async ({ queryKey, signal }) => {
  // Extract location from key
  // Fetch data with signal (for cancellation)
  // Return structured data
  // React Query handles the rest
};
```

### Query Config

```javascript
useQuery({
  queryKey: [...],           // Cache identifier
  queryFn: ...,              // Fetch function
  staleTime: 30000,          // Data fresh for 30s
  gcTime: 60000,             // Keep in cache 60s (old: cacheTime)
  retry: 1,                  // Retry failed requests 1x
})
```

### Invalidation

```javascript
// After accept delivery:
queryClient.invalidateQueries({
  queryKey: ["driver", "deliveries", "available"],
});
// React Query: "Hey, that data is stale, refetch it"
```

---

## 🔥 Most Important Points

### 1. Location Tracking Still Works

```javascript
// Every 3 seconds watchPositionAsync fires
// Calls: fetchPendingDeliveriesRef.current()
// Which calls: fetchPendingDeliveriesWithLocation()
// Which updates: setCurrentLocationStr()
// Which triggers: React Query refetch
// ✅ Same behavior, cleaner code
```

### 2. Safety Refresh Changed Slightly

```javascript
// BEFORE:
setInterval(() => {
  fetchDeliveriesWithCurrentLocation(true); // Manual function
}, 120000);

// AFTER:
setInterval(() => {
  refetchQuery(); // React Query function
}, 120000);

// Both achieve same result - fresh data every 120s
```

### 3. Accept Delivery Changes

```javascript
// BEFORE: Manual refetch
await fetchPendingDeliveriesWithLocation(driverLocation, false);

// AFTER: Invalidate & auto-refetch
await queryClient.invalidateQueries({
  queryKey: ["driver", "deliveries", "available"],
});

// React Query auto-refetches with current location
// ✅ Simpler, more explicit
```

### 4. Cache Integration

```javascript
// AsyncStorage cache still used:
// 1. App opens → Load from AsyncStorage (instant display)
// 2. React Query fetches → Returns fresh data
// 3. Successfully → persistQueryCache() saves to AsyncStorage
// 4. App closes → Next open reloads from AsyncStorage

// ✅ Best of both worlds: speed + freshness
```

---

## ⚠️ Common Mistakes to Avoid

### ❌ WRONG: Forgetting useQueryClient

```javascript
// ERROR: useQueryClient is undefined
const handleAccept = () => {
  queryClient.invalidateQueries(...)  // ← Red error!
}

// FIX:
const queryClient = useQueryClient();  // ← Add this
```

### ❌ WRONG: Trying to setState directly

```javascript
// ERROR: No setDeliveries anymore!
setDeliveries(data); // ← queryData already updated

// FIX: Use values from queryData
const deliveries = queryData?.deliveriesArray || [];
```

### ❌ WRONG: Creating new AbortController

```javascript
// ERROR: React Query already handles this
const abortControllerRef = useRef(new AbortController());

// FIX: Remove it, pass signal from queryFn
const { signal } = queryKeyParams; // Query provides this
```

### ❌ WRONG: Not updating fetch function refs

```javascript
// ERROR: Location tracking uses stale function
fetchPendingDeliveriesRef.current = oldFunctionVersion;

// FIX: Use useEffect to keep ref in sync
useEffect(() => {
  fetchPendingDeliveriesRef.current = fetchPendingDeliveriesWithLocation;
}, [fetchPendingDeliveriesWithLocation]);
```

### ❌ WRONG: Forgetting currentLocationStr state

```javascript
// ERROR: Query never updates based on location
setCurrentLocationStr(); // ← This is crucial!

// This is what triggers location-based refetch
```

---

## ✅ Verification Checklist (Quick)

After making all changes:

```javascript
import { useQuery, useQueryClient } from "@tanstack/react-query";      // ✓ Line 1?
const queryFnFetchDeliveries = async ({ queryKey, signal }) => { ... } // ✓ Added?
const queryClient = useQueryClient();                                   // ✓ Inside component?
const { data: queryData, isLoading: initialLoading, ... } = useQuery({  // ✓ Hook setup?
const deliveries = queryData?.deliveriesArray || [];                    // ✓ Derived state?
setCurrentLocationStr(locationStr);                                     // ✓ Used for refetch?
refetchQuery();                                                         // ✓ Called in safety interval?
queryClient.invalidateQueries({ queryKey: [...] });                     // ✓ On accept?
persistQueryCache();                                                    // ✓ After fetch?
const [currentLocationStr, setCurrentLocationStr] = useState("default");// ✓ State added?
```

---

## 🆘 If Something Goes Wrong

### Error: "queryClient is undefined"

→ Did you call `useQueryClient()` at top of component?
→ Did you add it to the component? (not inside hooks)

### Error: "deliveries is undefined"

→ Are you trying to use state variables that don't exist?
→ Use: `const deliveries = queryData?.deliveriesArray || []`

### Error: "Query never fetches"

→ Is `currentLocationStr` actually being updated?
→ Check: `setCurrentLocationStr()` called before query runs

### Error: "Too many refetch loops"

→ Check interval timers aren't being created multiple times
→ Check `cleanup()` properly clears intervals
→ Check `staleTime` is reasonable (30s)

### Problem: "Accept delivery doesn't update"

→ Did you add `queryClient.invalidateQueries()`?
→ Check query key matches exactly
→ Check query key in console logs

### Problem: "Location tracking broken"

→ Check `fetchPendingDeliveriesRef.current` updates in useEffect
→ Check `useCallback` dependencies include new function

### Problem: "Performance is worse"

→ Check `staleTime` (30s) isn't too aggressive
→ Check you're not creating new function instances excessively
→ Use React Query DevTools to see request duplication

---

## 📞 Support Resources

### Documentation

- React Query docs: https://tanstack.com/query/latest
- React Query API: https://tanstack.com/query/latest/docs/react/api

### Debugging

- React Query DevTools: `npm install @tanstack/react-query-devtools`
- Console logs with `[QUERY]` prefix
- Browser DevTools Network tab check requests

### Files in This Project

1. REACT_QUERY_REFACTORING_GUIDE.md - Full explanation
2. REACT_QUERY_MIGRATION_CODE.md - Apply changes here
3. REACT_QUERY_ARCHITECTURE_REFERENCE.md - Deep dive

---

## 🎯 Expected Results After Refactoring

### Performance

- ✅ Initial load: Same (cached data displays instantly)
- ✅ Accept delivery: Faster (query invalidation cleaner than manual refetch)
- ✅ Location tracking: Same (still every 3s)
- ✅ Safety refresh: Same (still every 120s)

### Code Quality

- ✅ Fewer useState hooks (fetch logic in queryFn)
- ✅ No AbortController management needed
- ✅ Built-in error handling & retries
- ✅ Easier to test (pure functions)
- ✅ Automatic deduplication of requests

### Maintainability

- ✅ Changes to API endpoint = 1 place to update (queryFn)
- ✅ Changes to cache strategy = React Query config
- ✅ Changes to error handling = useQuery error field
- ✅ Future scaling easier (mutations, prefetching, etc.)

---

## 🚀 Next: Start Here!

### **Step 1:** Read this section:

→ **REACT_QUERY_ARCHITECTURE_REFERENCE.md**
→ "Component Architecture Before & After" (5 min)

### **Step 2:** Make the changes:

→ **REACT_QUERY_MIGRATION_CODE.md**
→ Follow CHANGE #1 through #10 (30 min)

### **Step 3:** Test your changes:

→ **REACT_QUERY_ARCHITECTURE_REFERENCE.md**
→ "Testing Checklist (Detailed)" (15 min)

### **Step 4:** If issues, debug:

→ **REACT_QUERY_ARCHITECTURE_REFERENCE.md**
→ "Debugging Tips" section

---

## ✨ Final Thoughts

This refactoring:

- **Maintains 100% feature parity** - Everything works exactly the same
- **Reduces complexity** - Let React Query handle caching, errors, retries
- **Improves maintainability** - One place to change fetch logic
- **Enables future improvements** - Optimistic updates, prefetching, mutations

The migration is conservative and safe - all the business logic and UI stays exactly the same. We're just using a better tool for data fetching.

---

**Total implementation time: ~45 minutes**

Good luck! 🚀
