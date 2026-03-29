# React Query Refactoring Complete Documentation Index

**Status:** ✅ Complete - Ready for implementation

**Target File:** `src/screens/driver/AvailableDeliveriesScreen.jsx` (2019 lines)

**Goal:** Migrate from manual fetch + setState to React Query with **ZERO breaking changes**

---

## 📚 Documentation Files

All 4 documentation files have been created in the project root:

### 1️⃣ **REACT_QUERY_QUICK_START.md** (START HERE)

- **Read time:** 5 minutes
- **Purpose:** High-level overview and quick navigation
- **Contains:**
  - 5-minute summary
  - What's changing vs. staying same
  - 10 code changes summary table
  - Common mistakes to avoid
  - Quick verification checklist
  - Support resources

### 2️⃣ **REACT_QUERY_REFACTORING_GUIDE.md** (IMPLEMENT FROM THIS)

- **Read time:** 15 minutes
- **Purpose:** Complete step-by-step implementation guide
- **Contains:**
  - Step 1-10 detailed explanations
  - Every code change with context
  - Query function creation
  - Cache persistence strategy
  - Initialization logic
  - Location tracking integration
  - Accept delivery handler updates
  - Testing checklist (10 items)
  - Troubleshooting guide
  - Optional enhancements for future

### 3️⃣ **REACT_QUERY_MIGRATION_CODE.md** (APPLY CHANGES FROM THIS)

- **Read time:** 20 minutes to apply
- **Purpose:** Exact code to copy/paste
- **Contains:**
  - CHANGE #1: Add imports
  - CHANGE #2: Create query function
  - CHANGE #3: Update cache helpers
  - CHANGE #4: Rewrite component initialization
  - CHANGE #5: Add cache persistence effect
  - CHANGE #6: Update initScreen()
  - CHANGE #7: Update cleanup()
  - CHANGE #8: Replace fetch functions
  - CHANGE #9: Update accept handler
  - CHANGE #10: Update refresh callback
  - Installation instructions
  - Verification checklist

### 4️⃣ **REACT_QUERY_ARCHITECTURE_REFERENCE.md** (FOR UNDERSTANDING & DEBUGGING)

- **Read time:** 30 minutes (reference)
- **Purpose:** Deep dive into architecture and troubleshooting
- **Contains:**
  - Before/after architecture diagrams
  - Data flow scenarios (4 common flows)
  - Query key strategy
  - 10 common questions answered
  - Error scenario handling (3 types)
  - Complete testing checklist (10 scenarios)
  - Debugging tips & tools
  - Performance metrics
  - Pro tips for production
  - Next steps after refactoring

---

## 🗂️ File Organization

```
nearme-mobile/
├── src/screens/driver/
│   └── AvailableDeliveriesScreen.jsx (TARGET FILE - 2019 lines)
│
├── REACT_QUERY_QUICK_START.md          ← START HERE (overview)
├── REACT_QUERY_REFACTORING_GUIDE.md    ← UNDERSTAND approach
├── REACT_QUERY_MIGRATION_CODE.md       ← APPLY changes from this
└── REACT_QUERY_ARCHITECTURE_REFERENCE.md ← DEBUG if needed
```

---

## 🚀 Implementation Timeline

### Phase 1: Setup (5 min)

1. Read: REACT_QUERY_QUICK_START.md
2. Install: `npm install @tanstack/react-query`

### Phase 2: Understanding (15 min)

1. Read: REACT_QUERY_ARCHITECTURE_REFERENCE.md
   - "Component Architecture Before & After"
   - "Data Flow Diagrams"

### Phase 3: Implementation (30 min)

1. Open: REACT_QUERY_MIGRATION_CODE.md
2. Follow: CHANGE #1 through #10
3. Reference: REACT_QUERY_REFACTORING_GUIDE.md for explanations
4. Verify: Each change matches described behavior

### Phase 4: Testing (20 min)

1. Follow: REACT_QUERY_ARCHITECTURE_REFERENCE.md
2. "Testing Checklist (Detailed)" - 10 test scenarios
3. Verify: All features work identically

### Phase 5: Deployment (Optional, after QA)

**Total Time: ~45-60 minutes**

---

## ✅ What Gets Refactored

### Files Modified

- `src/screens/driver/AvailableDeliveriesScreen.jsx` ✏️

### Code Changes

- Add React Query imports
- Create query function
- Replace manual fetch functions
- Update state initialization
- Update interval setup
- Update accept delivery handler
- Add cache persistence
- Update cleanup

### Lines of Code Changed

- Lines to ADD: ~150 (query function + new useEffect)
- Lines to REPLACE: ~200 (fetch functions, initialization)
- Lines to REMOVE: ~20 (manual abort controller, old setState calls)
- Net result: ~50-70 more lines (offset by cleaner structure)

---

## ✨ What's Preserved

### Component Logic

- ✅ All UI remains identical
- ✅ All animations (toast, skeleton, transitions)
- ✅ All user interactions (accept, decline, refresh)
- ✅ Navigation (all navigation calls work same)
- ✅ Error handling (same error messages)

### Features

- ✅ Location tracking every 3 seconds
- ✅ Movement threshold (100m refresh trigger)
- ✅ Safety refresh interval (120 seconds)
- ✅ AsyncStorage caching
- ✅ Delivery card rendering with maps
- ✅ Polyline rendering (straight & curved)
- ✅ Stacked delivery bonuses
- ✅ Accept/Decline functionality
- ✅ Route details and timeline

### External Integrations

- ✅ Socket connection detection
- ✅ Navigation stack integration
- ✅ rateLimitedFetch utility
- ✅ AsyncStorage for persistence
- ✅ FreeMapView component
- ✅ All constants and styles

---

## 🎯 Success Criteria

After implementation, verify:

1. **Initial Load**
   - [ ] Skeleton cards appear
   - [ ] Cached data displays instantly
   - [ ] Fresh data arrives after 1-2 seconds
   - [ ] Console shows [QUERY] logs

2. **Location Tracking**
   - [ ] Driver marker updates every 3s smoothly
   - [ ] No API call until 100m+ moved
   - [ ] After 100m: API refresh triggers
   - [ ] Console shows movement distance

3. **Accept Delivery**
   - [ ] Toast shows "Accepting..."
   - [ ] Skeleton cards appear
   - [ ] Toast shows "✅ Delivery accepted!"
   - [ ] New deliveries list loads

4. **Safety Refresh**
   - [ ] App idle for ~2 minutes
   - [ ] API request fires automatically
   - [ ] Console shows [DATA REFRESH] message

5. **Error Handling**
   - [ ] Offline → Error banner appears
   - [ ] Retry works when connection back
   - [ ] Server error → Proper message shown

6. **Performance**
   - [ ] No lag when scrolling deliveries
   - [ ] No duplicate API calls
   - [ ] Smooth animations throughout

---

## 📋 Code Changes Summary

| Change                  | Type    | Scope          | Difficulty   |
| ----------------------- | ------- | -------------- | ------------ |
| Add imports             | ADD     | 1 line         | ⭐ Easy      |
| Create queryFn          | ADD     | 45 lines       | ⭐ Easy      |
| Update cache helpers    | REPLACE | 20 lines       | ⭐ Easy      |
| Initialize useQuery     | REPLACE | 35 lines       | ⭐⭐ Medium  |
| Add persistence effect  | ADD     | 8 lines        | ⭐ Easy      |
| Update initScreen       | REPLACE | 40 lines       | ⭐⭐ Medium  |
| Update cleanup          | UPDATE  | 6 lines        | ⭐ Easy      |
| Replace fetch functions | REPLACE | 100 lines      | ⭐⭐ Medium  |
| Update accept handler   | UPDATE  | 8 lines        | ⭐ Easy      |
| Update refresh callback | UPDATE  | 2 lines        | ⭐ Easy      |
| **TOTAL**               |         | **~265 lines** | **Moderate** |

---

## 🔧 Installation Requirements

### Dependencies

```bash
npm install @tanstack/react-query
```

### Optional (for debugging)

```bash
npm install @tanstack/react-query-devtools
```

### Peer Dependencies (already installed)

- react-native
- react (~18+)
- @react-navigation/native
- @react-native-async-storage/async-storage
- expo-location

---

## 📊 Complexity Analysis

### Before Refactoring

- **State hooks:** 12+ useState calls
- **Refs:** 7+ useRef calls
- **useEffect:** 3+ useEffect hooks
- **Manual management:** AbortController, intervals, setState batching
- **Error handling:** Manual try-catch in fetch function
- **Caching:** Manual AsyncStorage calls

### After Refactoring

- **State hooks:** 6 useState (reduced!)
- **Refs:** 5 useRef (reduced!)
- **useEffect:** 4 useEffect (similar, but cleaner)
- **Manual management:** None (React Query handles)
- **Error handling:** Automatic (queryError state)
- **Caching:** Automatic (gcTime) + Manual AsyncStorage (kept)

---

## 🎓 Learning Resources

### React Query Concepts Used

1. **useQuery** - Main hook for fetching data
2. **queryKey** - Cache key strategy
3. **queryFn** - Async function that returns data
4. **staleTime** - How long data is fresh
5. **gcTime** - How long to keep in memory (old: cacheTime)
6. **refetch** - Manual request trigger
7. **invalidateQueries** - Mark data as stale
8. **useQueryClient** - Access cache programmatically

### Recommended Reading (in order)

1. [React Query Overview](https://tanstack.com/query/latest/docs/react/overview)
2. [useQuery Hook](https://tanstack.com/query/latest/docs/react/reference/useQuery)
3. [Query Keys](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
4. [Caching Behavior](https://tanstack.com/query/latest/docs/react/guides/caching)

---

## ❓ Common Questions

**Q: Will this change user experience?**
A: No! Everything works identically. Users won't see any difference.

**Q: Do I need to change any other screens?**
A: No! Only AvailableDeliveriesScreen.jsx needs changes. Other screens can refactor later.

**Q: Can I still use AsyncStorage?**
A: Yes! We integrate it with React Query for best of both worlds.

**Q: Is this a breaking change?**
A: No! All component props, navigation, and external interfaces stay the same.

**Q: How long will this take?**
A: 45-60 minutes from start to fully tested.

**Q: Can I revert if something goes wrong?**
A: Yes! Keep backup of original file or use git to revert commits.

---

## 🚨 Known Gotchas

1. **Query Key Changes Trigger Refetch**
   - Updating `currentLocationStr` causes new fetch
   - This is intentional! Use it for location-based updates

2. **Data Structure Changed**
   - Query returns object with `deliveriesArray`, `currentRoute`, `driverLocation`
   - Use: `const deliveries = queryData?.deliveriesArray || []`

3. **Error is Mapped to Local State**
   - `queryError` → `fetchError` in component
   - Error display stays unchanged

4. **Deps in useCallback Matter**
   - Watch dependencies in `fetchDeliveriesWithCurrentLocation`
   - Stale references will cause bugs

5. **ref Updates Must Be in useEffect**
   - `fetchPendingDeliveriesRef` needs useEffect to sync
   - Don't set directly during render

---

## 📞 Troubleshooting Quick Reference

| Problem                   | Solution                            | Doc               |
| ------------------------- | ----------------------------------- | ----------------- |
| API never called          | Check `currentLocationStr` updates  | Migration Code #4 |
| Too many requests         | Check `staleTime` and `gcTime`      | Architecture Ref  |
| Query returns undefined   | Use optional chaining `queryData?.` | Migration Code #4 |
| Location tracking broken  | Check ref updates in useEffect      | Migration Code #8 |
| Accept doesn't refetch    | Check `invalidateQueries` query key | Migration Code #9 |
| Console errors about deps | Check useCallback dependencies      | Migration Code #8 |
| App crashes on open       | Check all useState calls exist      | Migration Code #4 |

---

## ✅ Pre-Implementation Checklist

Before you start:

- [ ] Read REACT_QUERY_QUICK_START.md
- [ ] Installed @tanstack/react-query
- [ ] Created backup of original file (git or copy)
- [ ] Have AvailableDeliveriesScreen.jsx open in editor
- [ ] Have REACT_QUERY_MIGRATION_CODE.md open in reference
- [ ] Understand basic useEffect and useState concepts
- [ ] Set aside 45-60 minutes uninterrupted time
- [ ] Have device/emulator ready for testing

---

## 📝 Implementation Checklist

As you implement:

- [ ] CHANGE #1: Add imports
- [ ] CHANGE #2: Create queryFnFetchDeliveries
- [ ] CHANGE #3: Update cache helpers
- [ ] CHANGE #4: Initialize useQuery + state
- [ ] CHANGE #5: Add cache persistence effect
- [ ] CHANGE #6: Update initScreen
- [ ] CHANGE #7: Update cleanup
- [ ] CHANGE #8: Replace fetch functions
- [ ] CHANGE #9: Update accept handler
- [ ] CHANGE #10: Update refresh callback
- [ ] Verify no syntax errors (VS Code shows no red squiggles)
- [ ] Run app (should compile without errors)
- [ ] Test initial load
- [ ] Test location tracking
- [ ] Test accept delivery
- [ ] Test error scenarios
- [ ] All 10 testing scenarios pass

---

## 🎉 Completion

After successfully implementing and testing:

1. **Code Review**
   - Ask team to review changes
   - Point to REACT_QUERY_ARCHITECTURE_REFERENCE.md for context

2. **QA Testing**
   - Real device testing (if not already done)
   - Edge cases (poor network, rapid movements, etc.)

3. **Monitoring**
   - Watch production logs for 1 week
   - Look for unexpected API calls or errors

4. **Documentation**
   - Keep these 4 docs in repo
   - Add note to codebase wiki
   - Link to React Query docs

5. **Next Optimization** (Optional)
   - Consider useAcceptDelivery mutation hook
   - Consider prefetching next screen data
   - Consider optimistic updates

---

## 📚 Final Notes

- **Scope:** Only affects AvailableDeliveriesScreen.jsx
- **Safety:** 100% backward compatible, zero breaking changes
- **Benefit:** Cleaner, more maintainable, better error handling
- **Future:** Opens door for mutations, prefetching, optimistic updates

This refactoring is **conservative and well-documented**. Every step has been explained. You've got this! 💪

---

**Ready to start? → Open REACT_QUERY_QUICK_START.md**
