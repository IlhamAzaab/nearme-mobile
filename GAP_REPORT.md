# GAP REPORT: Website vs Mobile Implementation Parity

**Generated:** March 28, 2026  
**Purpose:** Identify what screens need React Query migration and UI/animation alignment  
**Scope:** All authenticated user roles (Admin, Driver, Customer, Manager)

---

## EXECUTIVE SUMMARY

| Metric                            | Value                                |
| --------------------------------- | ------------------------------------ |
| **Total Mobile Screens**          | 22 (core functionality)              |
| **Using React Query**             | 1 (4.5%)                             |
| **Using Manual Fetch**            | 21 (95.5%)                           |
| **Needs Migration**               | 21 screens                           |
| **Estimated Implementation Time** | 2-3 weeks (full parity)              |
| **Priority Implementation Path**  | 8 screens (1 week for critical path) |

**Overall Gap:** Mobile is 95% behind website on React Query caching, background refresh, and query invalidation patterns.

---

## DETAILED SCREEN-BY-SCREEN GAP ANALYSIS

### 🔴 ADMIN STACK (7 Screens)

#### 1. **AdminDashboard.jsx** - PRIORITY: 🔴 CRITICAL

| Aspect             | Status | Website Pattern                                                       | Mobile Current                  | Gap    |
| ------------------ | ------ | --------------------------------------------------------------------- | ------------------------------- | ------ |
| React Query        | ❌ NO  | useQuery (2 queries)                                                  | Manual useState                 | HIGH   |
| Query Keys         | ❌ NO  | `["admin", "dashboard", "stats"]`, `["admin", "dashboard", "orders"]` | None                            | HIGH   |
| Stale Time         | ❌ NO  | 20-60s depending on resource                                          | Uses `refetchInterval` manually | MEDIUM |
| Background Refresh | ❌ NO  | Enabled globally                                                      | Manual only                     | MEDIUM |
| Skeleton Loading   | ✅ YES | CSS animate-pulse                                                     | Custom skeleton View            | LOW    |
| API Endpoints      | ✓ SAME | `/admin/dashboard-stats`, `/admin/orders`                             | Same ✓                          | NONE   |

**Action Items:**

- [ ] Convert to `useQuery` with keys: `["admin", "dashboard", "stats"]`
- [ ] Implement grouped invalidation under `["admin", "dashboard"]`
- [ ] Use global staleTime: 20s, refetchInterval: 30s
- [ ] Enhance skeleton with `Animated.loop` like AdminWithdrawals

---

#### 2. **AdminWithdrawals.jsx** - PRIORITY: ✅ DONE

| Aspect      | Status      | Notes                                                                        |
| ----------- | ----------- | ---------------------------------------------------------------------------- |
| React Query | ✅ YES      | Fully migrated (Message 14-16)                                               |
| Query Keys  | ✅ YES      | `["admin", "withdrawals", "summary"]`, `["admin", "withdrawals", "history"]` |
| Animation   | ✅ YES      | Animated skeleton with 900ms loop                                            |
| Status      | ✅ COMPLETE | Reference implementation for other screens                                   |

---

#### 3. **Earnings.jsx** - PRIORITY: 🟠 HIGH

| Aspect           | Status | Website Pattern                           | Mobile Current   | Gap  |
| ---------------- | ------ | ----------------------------------------- | ---------------- | ---- |
| React Query      | ❌ NO  | useQuery fetches earnings by period       | Manual useState  | HIGH |
| Query Keys       | ❌ NO  | `["admin", "earnings", period]` (dynamic) | None             | HIGH |
| Period Selector  | ✓ SAME | Toggle: Week/Month/Year                   | Has selector ✓   | NONE |
| Chart Data       | ✓ SAME | Revenue trend chart                       | Chart included ✓ | NONE |
| Skeleton Loading | ✅ YES | CSS animate-pulse                         | Custom skeleton  | LOW  |

**Action Items:**

- [ ] Convert to `useQuery` with keys: `["admin", "earnings", { period }]`
- [ ] Make query reactive to period selector change
- [ ] Implement staleTime: 60s, refetchInterval: 60s
- [ ] Upgrade skeleton to Animated.loop pattern

---

#### 4. **Orders.jsx** - PRIORITY: 🟠 HIGH

| Aspect            | Status | Website Pattern                                       | Mobile Current    | Gap    |
| ----------------- | ------ | ----------------------------------------------------- | ----------------- | ------ |
| React Query       | ❌ NO  | useQuery with tabs (pending/accepted/ready/delivered) | Manual useState   | HIGH   |
| Query Keys        | ❌ NO  | `["admin", "orders", { status }]`                     | None              | HIGH   |
| Status Tabs       | ✓ SAME | Filters by order status                               | Has tabs ✓        | NONE   |
| Order Counts      | ✓ SAME | Shows count per tab                                   | Displays counts ✓ | NONE   |
| Real-time Updates | ❌ NO  | WebSocket in web                                      | Uses polling only | MEDIUM |
| Skeleton Loading  | ✅ YES | CSS animate-pulse                                     | Stats skeleton    | LOW    |

**Action Items:**

- [ ] Convert to `useQuery` with keys: `["admin", "orders", { status, period }]`
- [ ] Implement query key change on tab/filter switch
- [ ] Add WebSocket listener for order updates (optional, can be follow-up)
- [ ] Enhance skeleton to Animated.loop

---

#### 5. **Products.jsx** - PRIORITY: 🟠 HIGH

| Aspect                 | Status | Website Pattern                                                | Mobile Current                 | Gap    |
| ---------------------- | ------ | -------------------------------------------------------------- | ------------------------------ | ------ |
| React Query            | ❌ NO  | useQuery for foods list + mutations for add/edit/delete        | Manual useState                | HIGH   |
| Query Keys             | ❌ NO  | `["admin", "products"]`, `["admin", "products", "categories"]` | None                           | HIGH   |
| Add/Edit/Delete        | ✓ SAME | Modal forms                                                    | Modal UX ✓                     | NONE   |
| Skeleton Loading       | ✅ YES | CSS animate-pulse                                              | renderLoadingSkeleton function | LOW    |
| Refetch After Mutation | ❌ NO  | Auto-refetch via invalidateQueries                             | Manual refetch                 | MEDIUM |

**Action Items:**

- [ ] Convert to `useQuery` for products list
- [ ] Implement `useMutation` with invalidation on create/update/delete
- [ ] Use keys: `["admin", "products"]` with grouped invalidation
- [ ] Upgrade skeleton to Animated.loop

---

#### 6. **Profile.jsx (Admin)** - PRIORITY: 🟡 MEDIUM

| Aspect           | Status | Website Pattern                  | Mobile Current         | Gap    |
| ---------------- | ------ | -------------------------------- | ---------------------- | ------ |
| React Query      | ❌ NO  | useQuery for `/admin/me`         | Manual useState        | MEDIUM |
| Query Keys       | ❌ NO  | `["admin", "profile"]`           | None                   | MEDIUM |
| API Endpoints    | ✓ SAME | `/admin/me`, `/admin/restaurant` | Same ✓                 | NONE   |
| Skeleton Loading | ❌ NO  | CSS animate-pulse                | ActivityIndicator only | MEDIUM |

**Action Items:**

- [ ] Convert to `useQuery` with key: `["admin", "profile"]`
- [ ] Add animated skeleton loading
- [ ] Use staleTime: 60s (profile doesn't change often)

---

#### 7. **AdminProfile.jsx** - PRIORITY: 🟡 MEDIUM

| Aspect       | Status                                                        | Notes                                       |
| ------------ | ------------------------------------------------------------- | ------------------------------------------- |
| Type         | Form-only screen                                              | Password change form, no data fetching      |
| React Query  | ❌ NO                                                         | Could use `useMutation` for password update |
| Action Items | [ ] Add `useMutation` for password change with error handling |

**Summary:** 7 admin screens identified; **1 done (AdminWithdrawals)**, **6 remaining.**

---

### 🔵 DRIVER STACK (7 Screens)

#### 1. **DriverDashboard.jsx** - PRIORITY: 🔴 CRITICAL

| Aspect                | Status | Website Pattern                        | Mobile Current        | Gap  |
| --------------------- | ------ | -------------------------------------- | --------------------- | ---- |
| React Query           | ❌ NO  | useQuery for available jobs            | Manual useState       | HIGH |
| Query Keys            | ❌ NO  | `["driver", "dashboard", "available"]` | None                  | HIGH |
| Refetch Interval      | ❌ NO  | 30s background refresh                 | Manual refresh button | HIGH |
| Skeleton Loading      | ❌ NO  | CSS animate-pulse                      | ActivityIndicator     | HIGH |
| Online/Offline Toggle | ✓ SAME | Toggle button updates status           | Implemented ✓         | NONE |

**Action Items:**

- [ ] Convert to `useQuery` with key: `["driver", "dashboard"]`
- [ ] Enable refetchInterval: 30s globally
- [ ] Add animated skeleton loading (critical for UX)
- [ ] Implement grouped invalidation on toggle

---

#### 2. **DriverEarningsScreen.jsx** - PRIORITY: 🟠 HIGH

| Aspect           | Status | Website Pattern                      | Mobile Current    | Gap    |
| ---------------- | ------ | ------------------------------------ | ----------------- | ------ |
| React Query      | ❌ NO  | useQuery for earnings by period      | Manual useState   | HIGH   |
| Query Keys       | ❌ NO  | `["driver", "earnings", { period }]` | None              | HIGH   |
| Period Selector  | ✓ SAME | Week/Month/Year periods              | Implemented ✓     | NONE   |
| Chart/Stats      | ✓ SAME | Trend visualization                  | Included ✓        | NONE   |
| Skeleton Loading | ❌ NO  | CSS animate-pulse                    | ActivityIndicator | MEDIUM |

**Action Items:**

- [ ] Convert to `useQuery` with keys: `["driver", "earnings", { period }]`
- [ ] Make query reactive to period change
- [ ] Add animated skeleton loading

---

#### 3. **DriverWithdrawalsScreen.jsx** - PRIORITY: 🟠 HIGH

| Aspect           | Status | Website Pattern                                                                | Mobile Current    | Gap    |
| ---------------- | ------ | ------------------------------------------------------------------------------ | ----------------- | ------ |
| React Query      | ❌ NO  | useQuery for withdrawal summary + history                                      | Manual useState   | HIGH   |
| Query Keys       | ❌ NO  | `["driver", "withdrawals", "summary"]`, `["driver", "withdrawals", "history"]` | None              | HIGH   |
| API Endpoints    | ✓ SAME | `/driver/withdrawals/my/summary`, `/driver/withdrawals/my/history`             | Same ✓            | NONE   |
| Skeleton Loading | ❌ NO  | CSS animate-pulse                                                              | ActivityIndicator | MEDIUM |
| Mutation Pattern | ❌ NO  | useMutation for new withdrawal                                                 | Manual fetch      | MEDIUM |

**Action Items:**

- [ ] Mirror AdminWithdrawals implementation exactly
- [ ] Convert to `useQuery` with same pattern
- [ ] Add `useMutation` for withdrawal requests with invalidation
- [ ] Add animated skeleton loading

---

#### 4. **DriverDepositsScreen.jsx** - PRIORITY: 🟡 MEDIUM

| Aspect           | Status | Website Pattern                                                          | Mobile Current    | Gap    |
| ---------------- | ------ | ------------------------------------------------------------------------ | ----------------- | ------ |
| React Query      | ❌ NO  | useQuery for deposit balance + history                                   | Manual useState   | MEDIUM |
| Query Keys       | ❌ NO  | `["driver", "deposits", "balance"]`, `["driver", "deposits", "history"]` | None              | MEDIUM |
| Skeleton Loading | ❌ NO  | CSS animate-pulse                                                        | ActivityIndicator | MEDIUM |

**Action Items:**

- [ ] Convert to `useQuery` with grouped keys: `["driver", "deposits"]`
- [ ] Add animated skeleton loading

---

#### 5. **ActiveDeliveriesScreen.jsx** - PRIORITY: 🔴 CRITICAL

| Aspect            | Status     | Website Pattern                       | Mobile Current             | Gap  |
| ----------------- | ---------- | ------------------------------------- | -------------------------- | ---- |
| React Query       | ❌ NO      | useQuery with refetchInterval: 15-30s | Manual fetch with caching  | HIGH |
| Query Keys        | ❌ NO      | `["driver", "deliveries", "active"]`  | None (uses custom cache)   | HIGH |
| Real-time Updates | ⚠️ PARTIAL | WebSocket for live updates            | Polling only, custom cache | HIGH |
| Skeleton Loading  | ✅ YES     | CSS animate-pulse                     | SkeletonCard shimmer       | LOW  |

**Action Items:**

- [ ] Convert custom caching to React Query
- [ ] Use keys: `["driver", "deliveries", "active"]`
- [ ] Set refetchInterval: 15s (critical for active jobs)
- [ ] Keep existing skeleton shimmer

---

#### 6. **AvailableDeliveriesScreen.jsx** - PRIORITY: 🔴 CRITICAL

| Aspect           | Status     | Website Pattern                         | Mobile Current                   | Gap    |
| ---------------- | ---------- | --------------------------------------- | -------------------------------- | ------ |
| React Query      | ❌ NO      | useQuery with refetchInterval: 30s      | Manual fetch with custom caching | HIGH   |
| Query Keys       | ❌ NO      | `["driver", "deliveries", "available"]` | None                             | HIGH   |
| Refetch Behavior | ⚠️ PARTIAL | Background refresh                      | Manual cache only                | HIGH   |
| Skeleton Loading | ❌ NO      | CSS animate-pulse                       | ActivityIndicator                | MEDIUM |
| Bonus Stacking   | ✓ SAME     | Display stacked delivery bonuses        | Implemented ✓                    | NONE   |

**Action Items:**

- [ ] Convert to `useQuery` with key: `["driver", "deliveries", "available"]`
- [ ] Enable background refetch (30s)
- [ ] Add animated skeleton loading

---

#### 7. **DriverMapScreen.jsx** - PRIORITY: 🔴 CRITICAL (High Frequency)

| Aspect            | Status     | Website Pattern                     | Mobile Current                  | Gap    |
| ----------------- | ---------- | ----------------------------------- | ------------------------------- | ------ |
| React Query       | ❌ NO      | useQuery for route data             | Manual fetch with rate limiting | HIGH   |
| Query Keys        | ❌ NO      | `["driver", "map", { deliveryId }]` | None                            | HIGH   |
| Real-time Updates | ⚠️ PARTIAL | WebSocket for GPS + OSRM ETA        | Polling with rateLimitedFetch   | MEDIUM |
| Rate Limiting     | ✓ SAME     | Built-in retry logic                | rateLimitedFetch function ✓     | NONE   |
| Location Updates  | ✓ SAME     | Real-time GPS tracking              | Implemented ✓                   | NONE   |

**Action Items:**

- [ ] Convert to `useQuery` for route queries
- [ ] Use key: `["driver", "map", { deliveryId }]`
- [ ] Implement proper retry logic via React Query
- [ ] Keep rate limiting but integrate with React Query

**Summary:** 7 driver screens identified; **0 done**, **7 remaining** (3 critical for user experience).

---

### 🟢 CUSTOMER STACK (5 Screens)

#### 1. **HomeScreen.jsx** - PRIORITY: 🔴 CRITICAL

| Aspect           | Status | Website Pattern                                        | Mobile Current         | Gap    |
| ---------------- | ------ | ------------------------------------------------------ | ---------------------- | ------ |
| React Query      | ❌ NO  | useQuery for restaurants + foods                       | Manual useState        | HIGH   |
| Query Keys       | ❌ NO  | `["customer", "restaurants"]`, `["customer", "foods"]` | None                   | HIGH   |
| Search/Filter    | ✓ SAME | Real-time search                                       | SearchBox ✓            | NONE   |
| Skeleton Loading | ✅ YES | CSS animate-pulse                                      | SkeletonBlock          | LOW    |
| Refetch Behavior | ❌ NO  | Pull-to-refresh + background                           | Manual pull-to-refresh | MEDIUM |

**Action Items:**

- [ ] Convert to `useQuery` with keys: `["customer", "restaurants"]`, `["customer", "foods"]`
- [ ] Implement search reactivity
- [ ] Enable background refresh (60s)
- [ ] Enhance skeleton to Animated.loop

---

#### 2. **OrdersScreen.jsx** - PRIORITY: 🟠 HIGH

| Aspect           | Status | Website Pattern                | Mobile Current    | Gap    |
| ---------------- | ------ | ------------------------------ | ----------------- | ------ |
| React Query      | ❌ NO  | useQuery for order history     | Uses OrderContext | MEDIUM |
| Query Keys       | ❌ NO  | `["customer", "orders"]`       | Context-based     | MEDIUM |
| Status Filters   | ✓ SAME | Filter by status (active/past) | Tabs ✓            | NONE   |
| Skeleton Loading | ✅ YES | CSS animate-pulse              | SkeletonBlock     | LOW    |

**Action Items:**

- [ ] Convert to `useQuery` with key: `["customer", "orders", { status }]`
- [ ] Keep context for other components but sync with query
- [ ] Enhance skeleton to Animated.loop

---

#### 3. **CartScreen.jsx** - PRIORITY: 🟠 HIGH

| Aspect           | Status     | Website Pattern                 | Mobile Current    | Gap    |
| ---------------- | ---------- | ------------------------------- | ----------------- | ------ |
| React Query      | ⚠️ PARTIAL | useQuery for cart items on load | CartContext state | MEDIUM |
| Query Keys       | ❌ NO      | `["customer", "cart"]`          | Context only      | MEDIUM |
| Add/Remove Items | ✓ SAME     | Immediate update                | Works ✓           | NONE   |
| Persistence      | ✓ SAME     | Stored in backend               | Uses context ✓    | NONE   |

**Action Items:**

- [ ] Sync CartContext with React Query (hydrate from query, sync mutations)
- [ ] Use key: `["customer", "cart"]`
- [ ] Implement `useMutation` for add/remove operations

---

#### 4. **ProfileScreen.jsx** - PRIORITY: 🟡 MEDIUM

| Aspect           | Status | Website Pattern               | Mobile Current    | Gap    |
| ---------------- | ------ | ----------------------------- | ----------------- | ------ |
| React Query      | ❌ NO  | useQuery for customer profile | AsyncStorage only | MEDIUM |
| Query Keys       | ❌ NO  | `["customer", "profile"]`     | No remote query   | MEDIUM |
| Data Source      | ✓ SAME | Loaded from auth + API        | Local storage ✓   | NONE   |
| Skeleton Loading | ❌ NO  | CSS animate-pulse             | Direct render     | MEDIUM |

**Action Items:**

- [ ] Convert to `useQuery` with key: `["customer", "profile"]`
- [ ] Use staleTime: 60s (profile doesn't change often)
- [ ] Add skeleton loading

---

#### 5. **OrderTrackingScreen.jsx** - PRIORITY: 🔴 CRITICAL (Real-Time)

| Aspect            | Status     | Website Pattern                                   | Mobile Current         | Gap  |
| ----------------- | ---------- | ------------------------------------------------- | ---------------------- | ---- |
| React Query       | ❌ NO      | useQuery for order details + WebSocket for status | Manual fetch + context | HIGH |
| Query Keys        | ❌ NO      | `["customer", "orders", { orderId }]`             | None                   | HIGH |
| Real-time Updates | ⚠️ PARTIAL | WebSocket for delivery status                     | Context listeners only | HIGH |
| Map Display       | ✓ SAME     | Real-time driver location                         | Mapped ✓               | NONE |
| Skeleton Loading  | ✅ YES     | CSS animate-pulse                                 | SkeletonBlock          | LOW  |

**Action Items:**

- [ ] Convert to `useQuery` with key: `["customer", "orders", { orderId }, "tracking"]`
- [ ] Set refetchInterval: 15s (live tracking needs fresh data)
- [ ] Integrate WebSocket for real-time driver updates
- [ ] Keep existing map display logic

**Summary:** 5 customer screens identified; **0 done**, **5 remaining** (2 critical for performance).

---

### 🟣 MANAGER STACK (Estimated 5+ Screens) - ADDITIONAL GAP

The mobile app has Manager role screens but they were less detailed in the initial scan. Based on the web routes, these likely exist:

- ManagerDashboard (Platform metrics)
- DriverManagement (Driver list + actions)
- AdminManagement (Restaurant admin list)
- ManagerEarnings (Platform revenue)
- Plus reporting screens

**Status:** Likely not using React Query either. Recommend adding to Phase 2.

---

## IMPLEMENTATION PRIORITY MATRIX

### 🔴 CRITICAL PATH (Week 1) - Implement First

These affect multiple daily active users and financial operations:

| Priority | Screen                    | Reason                                        | Estimated Time | Impact                |
| -------- | ------------------------- | --------------------------------------------- | -------------- | --------------------- |
| **1**    | AdminDashboard            | Most-viewed admin screen; financial metrics   | 3-4 hours      | Revenue tracking      |
| **2**    | AvailableDeliveriesScreen | Driver income depends on quick job visibility | 3-4 hours      | Delivery availability |
| **3**    | ActiveDeliveriesScreen    | Live tracking; real-time critical             | 3 hours        | Driver experience     |
| **4**    | HomeScreen                | Highest traffic customer screen               | 3-4 hours      | Customer retention    |
| **5**    | DriverMapScreen           | Active delivery; high refresh required        | 4 hours        | GPS tracking          |
| **6**    | OrderTrackingScreen       | Real-time updates for customers               | 3-4 hours      | Order experience      |
| **7**    | Orders.jsx (Admin)        | Order management for restaurants              | 3 hours        | Restaurant operations |
| **8**    | Earnings.jsx (Admin)      | Financial reporting                           | 2-3 hours      | Revenue clarity       |

**Week 1 Total Time:** ~27-31 hours (3-4 days with dev time)

---

### 🟠 HIGH PRIORITY (Week 2) - Implement Second

These have good traffic but less critical than Week 1:

| Priority | Screen                  | Reason                            | Estimated Time | Impact            |
| -------- | ----------------------- | --------------------------------- | -------------- | ----------------- |
| **9**    | Products.jsx (Admin)    | Menu management; frequent updates | 3-4 hours      | Inventory control |
| **10**   | DriverEarningsScreen    | Driver financial visibility       | 2-3 hours      | Driver retention  |
| **11**   | DriverWithdrawalsScreen | Financial transactions            | 2-3 hours      | Compliance        |
| **12**   | OrdersScreen (Customer) | Order history access              | 2-3 hours      | User convenience  |
| **13**   | Profile.jsx (Admin)     | Profile/settings; low traffic     | 2 hours        | Stability         |

**Week 2 Total Time:** ~13-16 hours (1.5-2 days)

---

### 🟡 MEDIUM PRIORITY (Week 2-3) - Implement Third

These are useful but not urgent:

| Priority | Screen                   | Reason                          | Estimated Time | Impact       |
| -------- | ------------------------ | ------------------------------- | -------------- | ------------ |
| **14**   | DriverDepositsScreen     | Financial feature; lower volume | 2-3 hours      | Payment flow |
| **15**   | CartScreen               | Sync context with query         | 2-3 hours      | Consistency  |
| **16**   | ProfileScreen (Customer) | User profile viewing            | 1-2 hours      | UX polish    |
| **17**   | AdminProfile.jsx         | Password change form            | 1 hour         | Security     |
| **18**   | Manager Screens (5+)     | TBD based on usage              | 10-12 hours    | Platform ops |

**Phase 3 Total Time:** ~16-21 hours (2-2.5 days)

---

**Total Estimated Implementation:** ~56-68 hours (7-9 development days full-time)

---

## IMPLEMENTATION CHECKLIST

### Template Pattern (Use AdminWithdrawals as Reference)

Every screen migration should follow this template:

```javascript
// 1. Import hooks
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useEffect } from "react";
import { Animated } from "react-native";

// 2. Define query function
const queryFn = async () => {
  // Fetch and return data
};

// 3. Set up query
const query = useQuery({
  queryKey: ["role", "feature", "subfeature"], // hierarchical
  staleTime: 20 * 1000, // Use global default or override
  refetchInterval: 30 * 1000, // If needed
  queryFn,
});

// 4. Set up skeleton animation (if loading state needed)
const skeletonOpacity = useRef(new Animated.Value(0.55)).current;
useEffect(() => {
  const loop = Animated.loop(
    Animated.sequence([
      Animated.timing(skeletonOpacity, { toValue: 1, duration: 900 }),
      Animated.timing(skeletonOpacity, { toValue: 0.55, duration: 900 }),
    ]),
  );
  loop.start();
}, []);

// 5. Render with query states
if (query.isLoading && !query.data)
  return <SkeletonLoader opacity={skeletonOpacity} />;
if (query.error) return <ErrorState />;
return <DataDisplay data={query.data} />;
```

### Validation Checklist for Each Screen

- [ ] useQuery hook properly configured with hierarchical keys
- [ ] Global staleTime/refetchInterval applied (or intentionally overridden)
- [ ] Skeleton loading uses Animated.loop (not static placeholders)
- [ ] Pull-to-refresh calls `queryClient.invalidateQueries()`
- [ ] Grouped invalidation for mutations: `invalidateQueries({ queryKey: ["role", "feature"] })`
- [ ] Error state properly handled
- [ ] No console warnings or TypeScript errors
- [ ] Tested with network dev tools (throttle to verify refresh behavior)

---

## RISK ASSESSMENT

### Low Risk

- ✅ AdminWithdrawals already proven
- ✅ Global queryClient already upgraded
- ✅ Existing skeleton loading patterns exist (just need animation upgrade)

### Medium Risk

- ⚠️ Real-time screens (DriverMap, OrderTracking) with WebSocket
- ⚠️ Drivers/ActiveDeliveries have manual caching logic (need careful refactor)
- ⚠️ Customer OrdersScreen uses OrderContext (need sync strategy)

### High Risk

- ❌ Manager screens (untested, new migration)
- ❌ WebSocket integration with React Query (need custom hooks)

---

## TEAM RECOMMENDATIONS

### Implementation Strategy

1. **Week 1 (Critical):** 8 screens covering Admin, Driver, Customer highest traffic
2. **Week 2 (High):** 5 screens filling gaps in each role
3. **Week 3 (Medium):** Polish & manager screens

### Before Starting Each Screen

1. Read AdminWithdrawals.jsx as reference
2. Identify current data sources (fetch URLs, context, storage)
3. Determine appropriate query key hierarchy
4. Check website for matching implementation

### Testing Strategy

1. Verify no compilation errors (`get_errors`)
2. Test manual refresh via `invalidateQueries`
3. Simulate network conditions (throttle to verify background refresh)
4. Compare behavior to website version
5. Check git diff for unintended changes

### Documentation

- Update this report as each screen is completed
- Keep reference implementations in comments
- Document any custom patterns (e.g., rate limiting, WebSocket integration)

---

## APPENDIX: Query Key Hierarchy Reference

```
Admin:
  ["admin", "dashboard", "stats"]
  ["admin", "dashboard", "orders"]
  ["admin", "withdrawals", "summary"]
  ["admin", "withdrawals", "history"]
  ["admin", "earnings", { period }]
  ["admin", "orders", { status, period }]
  ["admin", "products"]
  ["admin", "profile"]

Driver:
  ["driver", "dashboard"]
  ["driver", "deliveries", "available"]
  ["driver", "deliveries", "active"]
  ["driver", "map", { deliveryId }]
  ["driver", "earnings", { period }]
  ["driver", "withdrawals", "summary"]
  ["driver", "withdrawals", "history"]
  ["driver", "deposits", "balance"]
  ["driver", "deposits", "history"]

Customer:
  ["customer", "restaurants"]
  ["customer", "foods"]
  ["customer", "orders", { status }]
  ["customer", "orders", { orderId }, "tracking"]
  ["customer", "cart"]
  ["customer", "profile"]
```

---

**Next Step:** Execute Week 1 critical path implementation in priority order.
