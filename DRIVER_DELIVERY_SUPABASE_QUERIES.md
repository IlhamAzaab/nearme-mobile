# Supabase Queries to Verify Driver Delivery Status Fix

Use these queries to verify the backend implementation is working correctly.

## Quick Reference

### Check Delivery Status Was Updated
```sql
SELECT id, driver_id, status, updated_at 
FROM driver_deliveries 
WHERE id = 'YOUR_DELIVERY_UUID'
LIMIT 1;
```
**Expected after pickup**: status should be `picked_up` or `on_the_way`, updated_at should be recent

---

## Detailed Test Queries

### Test 1: Verify Status Column Updated Correctly

**Run BEFORE driver marks pickup:**
```sql
SELECT 
  id,
  delivery_id,
  driver_id,
  status as current_status,
  created_at,
  updated_at as last_update
FROM driver_deliveries
WHERE id = 'DELIVERY_UUID_FROM_APP'
LIMIT 1;
```

**Expected output**:
```
id                                   | delivery_id | driver_id | current_status | created_at | last_update
12345678-1234-1234-1234-123456789abc | ORDER-1     | DRIVER-1  | accepted       | 2026-04-29 | 2026-04-29 10:00:00
```

**Then mark delivery as picked up in the mobile app**

**Run AFTER driver marks pickup:**
```sql
SELECT 
  id,
  delivery_id,
  driver_id,
  status as current_status,
  created_at,
  updated_at as last_update
FROM driver_deliveries
WHERE id = 'DELIVERY_UUID_FROM_APP'
LIMIT 1;
```

**Expected output** (status and updated_at should have changed):
```
id                                   | delivery_id | driver_id | current_status | created_at | last_update
12345678-1234-1234-1234-123456789abc | ORDER-1     | DRIVER-1  | on_the_way     | 2026-04-29 | 2026-04-29 10:15:30
```

**✅ PASSED** if:
- `current_status` changed from `accepted` to `on_the_way` (single delivery auto-promoted)
- OR `current_status` changed to `picked_up` (multiple deliveries, no auto-promotion yet)
- `last_update` timestamp is recent (close to when you marked pickup)

**❌ FAILED** if:
- `current_status` is still `accepted` (status not updated)
- `last_update` timestamp hasn't changed (not in database)

---

### Test 2: Verify Auto-Promotion (Single Delivery Only)

**Scenario**: Driver has 1 active delivery

**Run these queries to verify auto-promotion:**

```sql
-- Get the most recent on_the_way status from today
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  created_at,
  updated_at
FROM driver_deliveries
WHERE status = 'on_the_way'
  AND DATE(updated_at) = CURRENT_DATE
  AND driver_id = 'DRIVER_UUID_HERE'
ORDER BY updated_at DESC
LIMIT 5;
```

**Expected output** (all should show `on_the_way`):
```
id    | delivery_id | driver_id | status      | created_at | updated_at
123.. | ORDER-1     | DRIVER-1  | on_the_way  | 2026-04-29 | 2026-04-29 10:15:30
124.. | ORDER-2     | DRIVER-1  | on_the_way  | 2026-04-29 | 2026-04-29 09:45:20
```

**✅ PASSED** if all results show `status = 'on_the_way'` and recent timestamps

**❌ FAILED** if you see `status = 'picked_up'` when driver only had 1 delivery

---

### Test 3: Verify Multiple Deliveries Don't Auto-Promote Incorrectly

**Scenario**: Driver has 2+ active deliveries

**Run this to see all active deliveries for a driver:**
```sql
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  created_at,
  updated_at
FROM driver_deliveries
WHERE driver_id = 'DRIVER_UUID_HERE'
  AND status IN ('accepted', 'assigned', 'preparing', 'picked_up', 'on_the_way', 'at_customer')
ORDER BY created_at ASC;
```

**Expected output** (should show multiple different statuses):
```
id    | delivery_id | driver_id | status      | created_at | updated_at
123.. | ORDER-1     | DRIVER-1  | picked_up   | 2026-04-29 | 2026-04-29 10:15:30
124.. | ORDER-2     | DRIVER-1  | accepted    | 2026-04-29 | 2026-04-29 09:00:00
125.. | ORDER-3     | DRIVER-1  | accepted    | 2026-04-29 | 2026-04-29 08:30:00
```

**✅ PASSED** if:
- Only the delivery you marked is `picked_up`
- Other deliveries remain `accepted` or other statuses
- NOT all promoted to `on_the_way` prematurely

**❌ FAILED** if:
- All deliveries show `on_the_way` (auto-promotion logic too aggressive)
- Multiple deliveries show `picked_up` when only one was marked

---

### Test 4: Verify Terminal States Not Auto-Promoted

**Scenario**: Delivery marked as `delivered` should not transition further

**Run this to check:**
```sql
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  created_at,
  updated_at
FROM driver_deliveries
WHERE status IN ('delivered', 'cancelled')
  AND DATE(updated_at) = CURRENT_DATE
ORDER BY updated_at DESC
LIMIT 10;
```

**Expected output** (should show only `delivered` or `cancelled`):
```
id    | delivery_id | driver_id | status    | created_at | updated_at
123.. | ORDER-1     | DRIVER-1  | delivered | 2026-04-29 | 2026-04-29 14:30:00
124.. | ORDER-2     | DRIVER-1  | cancelled | 2026-04-29 | 2026-04-29 14:20:00
```

**✅ PASSED** if all results show only `delivered` or `cancelled` - no intermediate statuses

**❌ FAILED** if you see a `delivered` status that was then promoted to something else

---

### Test 5: Compare Driver Deliveries with Main Deliveries Table

**Verify both tables are in sync:**

```sql
-- Check if driver_deliveries.status matches deliveries.status
SELECT 
  dd.id as driver_delivery_id,
  dd.delivery_id,
  dd.status as driver_status,
  d.status as delivery_status,
  CASE 
    WHEN dd.status = d.status THEN '✓ MATCH'
    ELSE '✗ MISMATCH'
  END as sync_status,
  dd.updated_at as driver_updated,
  d.updated_at as delivery_updated
FROM driver_deliveries dd
LEFT JOIN deliveries d ON dd.delivery_id = d.id
WHERE dd.driver_id = 'DRIVER_UUID_HERE'
  AND dd.status IN ('accepted', 'assigned', 'preparing', 'picked_up', 'on_the_way', 'at_customer', 'delivered')
ORDER BY dd.updated_at DESC
LIMIT 10;
```

**Expected output**:
```
driver_delivery_id | delivery_id | driver_status | delivery_status | sync_status | driver_updated | delivery_updated
123..              | ORDER-1     | picked_up     | picked_up       | ✓ MATCH     | 2026-04-29 .. | 2026-04-29 ..
```

**✅ PASSED** if all show `✓ MATCH` - both tables have same status

**❌ FAILED** if you see `✗ MISMATCH` - tables are out of sync (backend bug)

---

### Test 6: Check Performance - Auto-Promotion Query (for Backend Developers)

**This query is run by backend after each pickup - verify it's efficient:**

```sql
-- This is approximately what the backend runs
SELECT 
  id,
  status,
  driver_id
FROM driver_deliveries
WHERE driver_id = 'DRIVER_UUID_HERE'
  AND status IN ('accepted', 'assigned', 'preparing', 'picked_up', 'on_the_way', 'at_customer')
LIMIT 100;
```

**Expected**: Should return results in < 100ms

**If slow**:
- Check indexes on `driver_deliveries(driver_id, status)`
- Run: `SELECT * FROM pg_indexes WHERE tablename = 'driver_deliveries';`

---

### Test 7: Find Errored Pickup Attempts

**If pickups are failing, check for error patterns:**

```sql
-- Look for deliveries stuck in intermediate states for too long
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  created_at,
  updated_at,
  EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 as minutes_stuck
FROM driver_deliveries
WHERE status IN ('accepted', 'assigned', 'preparing')
  AND DATE(created_at) = CURRENT_DATE
  AND EXTRACT(EPOCH FROM (NOW() - updated_at)) / 60 > 60  -- Stuck > 1 hour
ORDER BY minutes_stuck DESC
LIMIT 10;
```

**Expected**: Very few or no results (most should progress through states quickly)

**⚠️ WARNING** if many deliveries stuck in same state for hours - may indicate backend error or network issue

---

## Complete Flow Verification Script

**Run all these in order after implementing the fix:**

```sql
-- 1. Find a delivery that was recently updated
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  updated_at
FROM driver_deliveries
WHERE status IN ('picked_up', 'on_the_way')
  AND DATE(updated_at) = CURRENT_DATE
ORDER BY updated_at DESC
LIMIT 1;

-- Copy the ID from result above, then run:
-- 2. Check the specific delivery
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  latitude,
  longitude,
  created_at,
  updated_at
FROM driver_deliveries
WHERE id = '(PASTE_ID_HERE)';

-- 3. Check the corresponding order/delivery record
SELECT 
  d.id,
  d.order_id,
  d.status,
  d.driver_id,
  d.updated_at
FROM deliveries d
WHERE d.id = '(PASTE_delivery_id_HERE)';

-- 4. Verify customer can see the status
SELECT 
  o.id as order_id,
  o.order_number,
  o.customer_id,
  d.id as delivery_id,
  d.status,
  d.driver_id,
  d.updated_at
FROM orders o
LEFT JOIN deliveries d ON o.id = d.order_id
WHERE o.id = '(PASTE_order_id_HERE)';
```

---

## Copy-Paste Ready Commands

### For Single Delivery (Quick Test)
```sql
SELECT id, delivery_id, driver_id, status, updated_at 
FROM driver_deliveries 
WHERE id = 'DELIVERY_UUID'
ORDER BY updated_at DESC LIMIT 1;
```

### For All Driver's Deliveries
```sql
SELECT id, delivery_id, status, updated_at 
FROM driver_deliveries 
WHERE driver_id = 'DRIVER_UUID'
ORDER BY created_at DESC LIMIT 10;
```

### For Auto-Promotion Verification
```sql
SELECT status, COUNT(*) as count 
FROM driver_deliveries 
WHERE DATE(updated_at) = CURRENT_DATE
GROUP BY status
ORDER BY count DESC;
```

---

## Troubleshooting

| Symptom | Query to Run | Expected | Action |
|---------|-------------|----------|--------|
| Status not updating | Test 1 | status changes | Check backend logs for errors |
| Auto-promotion not working | Test 2 | all on_the_way | Verify backend auto-promotion logic |
| Multiple deliveries auto-promoting wrong | Test 3 | mixed statuses | Reduce auto-promotion conditions |
| Terminal states changing | Test 4 | only delivered/cancelled | Check for errant UPDATE statements |
| Tables out of sync | Test 5 | ✓ MATCH | Backend should update both tables |
| Query performance issues | Test 6 | < 100ms | Add index on driver_id, status |
| Deliveries stuck in states | Test 7 | few/no results | Investigate error handling |

