# Driver Delivery Status Auto-Update Fix

## Problem Statement
When a driver marks an order as `picked_up` by swiping the "SWIPE TO PICK UP" button, the database row in the `driver_deliveries` table is NOT being automatically updated to `picked_up` status. Additionally, the auto-promotion to `on_the_way` for single delivery scenarios is not working.

### Current Broken Behavior
1. Driver swipes "SWIPE TO PICK UP" → Frontend shows overlay
2. Frontend sends PATCH to `/driver/deliveries/{id}/status` with `status: "picked_up"`
3. Backend receives request BUT does NOT update `driver_deliveries.status` column
4. Frontend shows success/error overlay based on response, but database is not actually updated
5. When driver re-opens map, old status is still there (database has not changed)

### Expected Fixed Behavior
1. Driver swipes "SWIPE TO PICK UP" → Frontend shows overlay
2. Frontend sends PATCH to `/driver/deliveries/{id}/status` with `status: "picked_up"`
3. **Backend updates `driver_deliveries.status` → `picked_up`** ✓ (FIX NEEDED)
4. **Backend checks: if this driver has only 1 active delivery, auto-update to `on_the_way`** ✓ (FIX NEEDED)
5. Backend returns updated delivery + promotedDelivery (if auto-promoted)
6. Frontend shows success overlay → calls refetch → database reflects actual status
7. User sees correct persistent status in UI after reload

---

## Database Schema (Supabase)

### `driver_deliveries` Table
```sql
driver_deliveries (
  id: UUID PRIMARY KEY,
  delivery_id: UUID (FK -> deliveries.id),
  driver_id: UUID (FK -> drivers.id),
  status: TEXT (enum: accepted | assigned | preparing | picked_up | on_the_way | at_customer | delivered | cancelled),
  latitude: FLOAT NULL,
  longitude: FLOAT NULL,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  -- other fields...
)
```

### Key Rules for Status Transitions
- **Active Statuses**: accepted, assigned, preparing, picked_up, on_the_way, at_customer
- **Terminal Statuses** (DO NOT AUTO-TRANSITION): delivered, cancelled
- **Auto-Promotion Logic**: 
  - When status changes to `picked_up` AND there are no more rows with status in [accepted, assigned, preparing]
  - THEN auto-update this same row to `on_the_way`
  - UNLESS there are multiple active deliveries (in which case driver manually selects next one)

---

## BACKEND FIX REQUIRED

### File: `/backend/routes/driverDelivery.js`

### Endpoint: PATCH `/driver/deliveries/:deliveryId/status`

**Current Issue**: This endpoint likely exists but does NOT:
1. Update the `driver_deliveries.status` column
2. Auto-promote to `on_the_way` when appropriate
3. Return the updated delivery row

**REQUIRED Implementation**:

```javascript
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * PATCH /driver/deliveries/:deliveryId/status
 * 
 * Updates delivery status from 'picked_up' to 'on_the_way' with auto-promotion logic
 * 
 * Request Body:
 * {
 *   status: "picked_up" | "delivered" | "on_the_way" (as needed),
 *   latitude: FLOAT,
 *   longitude: FLOAT
 * }
 * 
 * Response:
 * {
 *   delivery: { id, status, driver_id, ... },
 *   promotedDelivery: { id, status, driver_id, ... } or null
 * }
 */
router.patch('/driver/deliveries/:deliveryId/status', authenticateDriver, async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { status, latitude, longitude } = req.body;
    const driverId = req.user.id;

    // ========================================================================
    // 1. VALIDATE INPUT
    // ========================================================================
    const VALID_STATUSES = ['accepted', 'assigned', 'preparing', 'picked_up', 'on_the_way', 'at_customer', 'delivered', 'cancelled'];
    
    if (!deliveryId) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: 'deliveryId is required' 
      });
    }
    
    if (!status || !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ 
        error: 'Bad Request', 
        message: `status must be one of: ${VALID_STATUSES.join(', ')}` 
      });
    }

    // ========================================================================
    // 2. FETCH THE CURRENT DELIVERY ROW
    // ========================================================================
    const { data: currentDelivery, error: fetchError } = await supabase
      .from('driver_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
      .single();

    if (fetchError || !currentDelivery) {
      return res.status(404).json({ 
        error: 'Not Found', 
        message: 'Delivery not found or does not belong to this driver' 
      });
    }

    // ========================================================================
    // 3. UPDATE THE STATUS COLUMN (THE MISSING STEP!)
    // ========================================================================
    const { data: updatedDelivery, error: updateError } = await supabase
      .from('driver_deliveries')
      .update({
        status,
        latitude: latitude ?? currentDelivery.latitude,
        longitude: longitude ?? currentDelivery.longitude,
        updated_at: new Date().toISOString()
      })
      .eq('id', deliveryId)
      .eq('driver_id', driverId)
      .select()
      .single();

    if (updateError || !updatedDelivery) {
      console.error('[Driver Delivery Status Update] Update failed:', updateError);
      return res.status(500).json({ 
        error: 'Internal Server Error', 
        message: 'Failed to update delivery status' 
      });
    }

    // ========================================================================
    // 4. AUTO-PROMOTION LOGIC: picked_up → on_the_way
    // ========================================================================
    let promotedDelivery = null;

    if (status === 'picked_up') {
      // Check if this driver has only 1 active delivery (the one we just updated)
      const { data: allActiveDeliveries, error: countError } = await supabase
        .from('driver_deliveries')
        .select('id, status')
        .eq('driver_id', driverId)
        .in('status', ['accepted', 'assigned', 'preparing', 'picked_up', 'on_the_way', 'at_customer']);

      if (!countError && allActiveDeliveries) {
        const totalActiveCount = allActiveDeliveries.length;
        const pendingPickups = allActiveDeliveries.filter(
          d => ['accepted', 'assigned', 'preparing'].includes(d.status)
        ).length;

        console.log(`[Driver Delivery Status] Driver ${driverId}: total active=${totalActiveCount}, pending_pickups=${pendingPickups}`);

        // Auto-promote to on_the_way if:
        // - This is the ONLY active delivery (total count = 1)
        // - OR no more pending pickups remain (all earlier orders were picked up)
        if (totalActiveCount === 1 || pendingPickups === 0) {
          const { data: promoted, error: promoteError } = await supabase
            .from('driver_deliveries')
            .update({
              status: 'on_the_way',
              updated_at: new Date().toISOString()
            })
            .eq('id', deliveryId)
            .eq('driver_id', driverId)
            .select()
            .single();

          if (!promoteError && promoted) {
            promotedDelivery = promoted;
            console.log(`[Driver Delivery Status] Auto-promoted delivery ${deliveryId} to on_the_way`);
          } else {
            console.warn(`[Driver Delivery Status] Auto-promotion failed for ${deliveryId}:`, promoteError);
          }
        }
      }
    }

    // ========================================================================
    // 5. UPDATE CUSTOMER/ORDER STATUS (if changed to picked_up or delivered)
    // ========================================================================
    // Also update the related order/delivery record so customer sees the update
    if (status === 'picked_up' || status === 'delivered' || status === 'on_the_way') {
      // Find the delivery_id for this driver_delivery
      const { data: linkedDelivery } = await supabase
        .from('driver_deliveries')
        .select('delivery_id')
        .eq('id', deliveryId)
        .single();

      if (linkedDelivery?.delivery_id) {
        await supabase
          .from('deliveries')
          .update({
            status: status,
            updated_at: new Date().toISOString()
          })
          .eq('id', linkedDelivery.delivery_id);
      }
    }

    // ========================================================================
    // 6. EMIT SOCKET EVENTS FOR REAL-TIME UPDATES
    // ========================================================================
    if (req.io) {
      // Notify customer of status change
      req.io.to(`customer:${currentDelivery.customer_id}`).emit('delivery:status_updated', {
        deliveryId: currentDelivery.delivery_id,
        status: promotedDelivery?.status || status,
        timestamp: new Date().toISOString()
      });

      // Notify admin of status change
      req.io.to('admin').emit('driver:delivery_status_updated', {
        driverId,
        deliveryId: currentDelivery.delivery_id,
        status: promotedDelivery?.status || status,
        timestamp: new Date().toISOString()
      });
    }

    // ========================================================================
    // 7. RETURN RESPONSE
    // ========================================================================
    return res.json({
      delivery: promotedDelivery || updatedDelivery,
      promotedDelivery: promotedDelivery || null,
      message: promotedDelivery 
        ? `Status updated to picked_up and auto-promoted to on_the_way` 
        : `Status updated to ${status}`
    });

  } catch (error) {
    console.error('[Driver Delivery Status] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message 
    });
  }
});

module.exports = router;
```

---

## Frontend Implementation (VERIFICATION)

### File: `/src/screens/driver/DriverMapScreen.jsx`

The frontend implementation is **mostly correct** but review these key points:

#### ✓ CORRECT - patchDeliveryStatus function (line 1149)
```javascript
const patchDeliveryStatus = async (targetId, status) => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Authentication session is unavailable");
  }

  const res = await fetch(
    API_BASE_URL + "/driver/deliveries/" + targetId + "/status",
    {
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        latitude: driverLocation ? driverLocation.latitude : null,
        longitude: driverLocation ? driverLocation.longitude : null,
      }),
    },
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || "Failed to update delivery status");
  }

  return data;
};
```
✅ Status: CORRECT - Properly awaits response and throws on error

#### ✓ CORRECT - handlePickedUp function (line 1193)
```javascript
const handlePickedUp = async () => {
  if (!currentTarget || updating || isMapRefreshing) return;

  const actionTarget = currentTarget;
  const targetId = normalizeDeliveryId(actionTarget?.delivery_id);
  if (!targetId) return;

  setUpdating(true);
  setOverlayStatus("processing");
  setOverlayVisible(true);

  try {
    const data = await patchDeliveryStatus(targetId, "picked_up");
    const promotedDelivery = data?.promotedDelivery || null;

    await applyOptimisticWorkflow({
      action: "picked_up",
      target: actionTarget,
      promotedDelivery,
    });

    setOverlayStatus("success");
    overlayCallbackRef.current = async () => {
      await refreshMapAfterStatusAction();
      finishStatusAction();
    };
  } catch (e) {
    setOverlayErrorMsg(e?.message || "Pickup status update failed");
    setOverlayStatus("error");
    overlayCallbackRef.current = async () => {
      await refreshMapAfterStatusAction();
      finishStatusAction();
    };
  }
};
```
✅ Status: CORRECT - Properly awaits backend, handles errors, refetches data

#### ✓ CORRECT - refreshMapAfterStatusAction function (line 1176)
```javascript
const refreshMapAfterStatusAction = async () => {
  const refreshLocation =
    driverLocation || lastFetchLocationRef.current || DEFAULT_LOCATION;
  await fetchPickupsAndDeliveries(refreshLocation, {
    force: true,
    immediate: true,
  });
};
```
✅ Status: CORRECT - Forces refetch from backend with no cache

#### ✓ CORRECT - Overlay handling
StatusTransitionOverlay is shown during processing and hidden after backend response is handled.
✅ Status: CORRECT

---

## FRONTEND ENHANCEMENT (Optional but Recommended)

The frontend is working correctly, but add this defensive check to ensure the backend response actually contains the updated status:

### File: `src/screens/driver/DriverMapScreen.jsx` (line ~1215)

```javascript
// BEFORE: Current code
const data = await patchDeliveryStatus(targetId, "picked_up");
const promotedDelivery = data?.promotedDelivery || null;

// AFTER: With validation
const data = await patchDeliveryStatus(targetId, "picked_up");

// IMPORTANT: Verify backend actually updated the database
if (!data?.delivery || !['picked_up', 'on_the_way'].includes(data.delivery.status)) {
  throw new Error(
    `Backend validation failed: delivery status is ${data?.delivery?.status || 'unknown'}, expected picked_up or on_the_way`
  );
}

const promotedDelivery = data?.promotedDelivery || null;
```

This ensures the frontend doesn't accept a success response if the backend didn't actually update the status.

---

## SUPABASE QUERIES TO VERIFY THE FIX

### 1. Check current status of a delivery
```sql
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  created_at,
  updated_at
FROM driver_deliveries
WHERE id = 'DELIVERY_UUID_HERE'
LIMIT 1;
```

### 2. Check all active deliveries for a driver
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

### 3. Monitor status changes (run before marking pickup, then run again after)
```sql
SELECT 
  id,
  delivery_id,
  driver_id,
  status,
  updated_at
FROM driver_deliveries
WHERE driver_id = 'DRIVER_UUID_HERE'
ORDER BY updated_at DESC
LIMIT 10;
```

### 4. Verify auto-promotion (should see both picked_up→on_the_way transition)
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
  AND status = 'on_the_way'
ORDER BY updated_at DESC
LIMIT 1;
```

### 5. Verify related order status was also updated (customer side)
```sql
SELECT 
  d.id as delivery_id,
  d.status as delivery_status,
  o.id as order_id,
  o.status as order_status,
  d.updated_at
FROM deliveries d
LEFT JOIN orders o ON d.order_id = o.id
WHERE d.id = 'DELIVERY_UUID_HERE';
```

---

## TESTING CHECKLIST

### Test 1: Single Delivery Pickup & Auto-Promotion
- [ ] Driver has 1 accepted delivery
- [ ] Driver marks as picked up
- [ ] Check Supabase: `driver_deliveries.status` should be `on_the_way` (NOT `picked_up`)
- [ ] Check Supabase: `updated_at` should show current timestamp
- [ ] Frontend UI should show `on_the_way` status
- [ ] Reload app: status persists as `on_the_way`

### Test 2: Multiple Deliveries (Only One Marked)
- [ ] Driver has 2+ accepted deliveries
- [ ] Driver marks first delivery as picked up
- [ ] Check Supabase: first delivery status should be `picked_up` (NOT `on_the_way` yet)
- [ ] Check Supabase: second delivery status should remain `accepted`
- [ ] Frontend UI should show `picked_up` status
- [ ] Driver can then swipe to mark second as picked up, which will auto-promote to `on_the_way`

### Test 3: Terminal States (Should NOT Auto-Transition)
- [ ] Driver marks delivery as `delivered`
- [ ] Check Supabase: status should be `delivered`, NOT auto-transitioned
- [ ] Driver marks delivery as `cancelled`
- [ ] Check Supabase: status should be `cancelled`, NOT auto-transitioned

### Test 4: Error Handling
- [ ] Disconnect network while swiping
- [ ] Frontend should show error overlay
- [ ] Frontend should NOT update optimistic UI state
- [ ] Reconnect network and refresh
- [ ] Status should reflect database truth (not the failed attempt)

---

## DEPLOYMENT STEPS

1. **Backend**: Deploy the fixed `/driver/deliveries/:deliveryId/status` endpoint
   - Ensure it updates `driver_deliveries.status` column
   - Ensure it implements auto-promotion logic
   - Test with curl/Postman before deploying

2. **Database**: Ensure column exists
   ```sql
   -- Verify the column exists and is correct type
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'driver_deliveries' 
   AND column_name = 'status';
   ```

3. **Frontend**: Deploy the optional validation enhancement (line ~1215)
   - Adds defensive check on backend response
   - Ensures status is actually updated before showing success

4. **Monitor**: Check logs for any errors during first 24 hours

---

## Summary of Changes

| Component | Issue | Fix | File | Status |
|-----------|-------|-----|------|--------|
| Backend | Not updating `driver_deliveries.status` | Add UPDATE statement in endpoint | `/backend/routes/driverDelivery.js` | 🔴 NOT IMPLEMENTED |
| Backend | Not auto-promoting to `on_the_way` | Add auto-promotion logic after picked_up | `/backend/routes/driverDelivery.js` | 🔴 NOT IMPLEMENTED |
| Backend | Not returning updated delivery | Add SELECT in PATCH response | `/backend/routes/driverDelivery.js` | 🔴 NOT IMPLEMENTED |
| Frontend | None (working correctly) | Optional: Add response validation | `src/screens/driver/DriverMapScreen.jsx` | 🟢 READY |
| Database | Column may not be updated | Verify schema, run tests | Supabase | 🟡 VERIFY |

