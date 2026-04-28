# Backend Order Cancellation Fix (404 Error)

## Problem
Frontend is sending request to cancel order with UUID: `71d2cb8f-cce0-43c9-86c5-d774956883ed`
Backend returns: **404 Not Found** - "Order not found"

## Root Cause Analysis

### What the Frontend is Doing ✅
```
POST /orders/71d2cb8f-cce0-43c9-86c5-d774956883ed/cancel
Body: { cancelled_reason: "User's reason" }
Authorization: Bearer {token}
```

### What the Backend Needs to Do
1. Extract `orderId` from URL path parameter
2. Query database for order by UUID ID
3. Verify order exists
4. Check if order can be cancelled (status is "placed")
5. Update order and delivery records
6. Emit socket event to admin
7. Return success response

---

## Database Schema Reference

### Orders Table
```sql
orders (
  id: UUID PRIMARY KEY,
  order_number: TEXT UNIQUE,
  customer_id: UUID (FK),
  restaurant_id: UUID (FK),
  ...
  status: TEXT (default: null - use deliveries.status instead),
  cancelled_at: TIMESTAMP NULL,
  cancellation_reason: TEXT NULL,
  payment_status: payment_status_type,
  created_at: TIMESTAMP,
  updated_at: TIMESTAMP,
  ...
)
```

### Deliveries Table
```sql
deliveries (
  id: UUID PRIMARY KEY,
  order_id: UUID (FK -> orders.id) UNIQUE,
  status: delivery_status (placed|pending|accepted|picked_up|on_the_way|at_customer|delivered|failed|cancelled),
  driver_id: UUID NULL,
  cancelled_at: TIMESTAMP NULL,
  cancelled_reason: TEXT NULL,
  rejection_reason: TEXT NULL,
  ...
)
```

### Key Relationships
- **One-to-One**: Each order has exactly ONE delivery (unique constraint on order_id)
- **Cascade Delete**: If order deleted, delivery is also deleted
- Foreign Key: `deliveries.order_id` → `orders.id`

---

## Backend Implementation - Node.js/Express Example

### CORRECT Implementation

```javascript
// POST /orders/:orderId/cancel
router.post('/orders/:orderId/cancel', authenticateUser, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cancelled_reason } = req.body;
    const customerId = req.user.id;

    // 1. VALIDATE INPUT
    if (!orderId || !cancelled_reason?.trim()) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'orderId and cancelled_reason are required'
      });
    }

    console.log('[Order Cancel] Processing cancel for orderId:', orderId);

    // 2. QUERY ORDER AND DELIVERY (JOIN both tables)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        customer_id,
        restaurant_id,
        payment_status,
        cancelled_at,
        deliveries (
          id,
          status,
          driver_id,
          cancelled_at
        )
      `)
      .eq('id', orderId)
      .single();

    // 3. ERROR HANDLING: Order Not Found
    if (orderError) {
      console.error('[Order Cancel] Database error:', orderError);
      return res.status(404).json({
        error: 'Order not found',
        message: 'The order could not be found in the system'
      });
    }

    if (!order) {
      console.error('[Order Cancel] Order not found in database:', orderId);
      return res.status(404).json({
        error: 'Order not found',
        message: 'The order does not exist'
      });
    }

    // 4. AUTHORIZATION: Only customer who placed order can cancel
    if (order.customer_id !== customerId) {
      return res.status(403).json({
        error: 'Unauthorized',
        message: 'You can only cancel your own orders'
      });
    }

    // 5. GET DELIVERY
    const delivery = order.deliveries?.[0];
    if (!delivery) {
      console.error('[Order Cancel] No delivery found for order:', orderId);
      return res.status(400).json({
        error: 'Invalid state',
        message: 'Order has no delivery record'
      });
    }

    // 6. BUSINESS LOGIC: Check if order can be cancelled
    const cancellableStatuses = new Set(['placed', 'pending']);
    
    if (!cancellableStatuses.has(delivery.status)) {
      console.warn('[Order Cancel] Cannot cancel order in status:', delivery.status);
      return res.status(409).json({
        error: 'Cannot cancel',
        message: `Cannot cancel order in ${delivery.status} status. The restaurant has already accepted your order.`
      });
    }

    // 7. PREVENT DOUBLE CANCELLATION
    if (delivery.cancelled_at) {
      return res.status(409).json({
        error: 'Already cancelled',
        message: 'This order has already been cancelled'
      });
    }

    // 8. UPDATE ORDER IN DATABASE
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancelled_reason.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateOrderError) {
      console.error('[Order Cancel] Failed to update order:', updateOrderError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to cancel order'
      });
    }

    // 9. UPDATE DELIVERY IN DATABASE
    const { error: updateDeliveryError } = await supabase
      .from('deliveries')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_reason: cancelled_reason.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', delivery.id);

    if (updateDeliveryError) {
      console.error('[Order Cancel] Failed to update delivery:', updateDeliveryError);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to cancel order'
      });
    }

    console.log('[Order Cancel] Successfully cancelled order:', orderId);

    // 10. EMIT SOCKET EVENT TO ADMIN (in real-time)
    const restaurantId = order.restaurant_id;
    if (restaurantId && global.io) {
      global.io.to(`restaurant:${restaurantId}`).emit('order_cancelled', {
        order_id: orderId,
        orderId: orderId,
        order_number: order.order_number,
        delivery_id: delivery.id,
        cancelled_reason: cancelled_reason.trim(),
        cancelled_at: new Date().toISOString(),
        customer_id: customerId
      });
      console.log('[Order Cancel] Socket event emitted to restaurant:', restaurantId);
    }

    // 11. RETURN SUCCESS RESPONSE
    return res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order: {
        id: orderId,
        order_number: order.order_number,
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: cancelled_reason.trim()
      }
    });

  } catch (err) {
    console.error('[Order Cancel] Unexpected error:', err);
    return res.status(500).json({
      error: 'Server error',
      message: 'Failed to process order cancellation'
    });
  }
});
```

---

## Common Issues & Solutions

### Issue 1: "Order not found" (404) ❌

**Wrong Implementation:**
```javascript
// ❌ Wrong - Looking in wrong place
const order = await supabase
  .from('deliveries')  // ← WRONG TABLE!
  .select('*')
  .eq('id', orderId)   // ← Delivery has its own UUID, not order UUID
  .single();
```

**Correct Implementation:**
```javascript
// ✅ Correct - Query orders table with order UUID
const order = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)   // ← Query by order.id, not delivery.id
  .single();
```

### Issue 2: Not Getting Delivery ❌

**Wrong Implementation:**
```javascript
// ❌ Wrong - Not joining delivery
const { data: order } = await supabase
  .from('orders')
  .select('*')  // ← Missing delivery data
  .eq('id', orderId)
  .single();
```

**Correct Implementation:**
```javascript
// ✅ Correct - Join delivery relation
const { data: order } = await supabase
  .from('orders')
  .select(`
    *,
    deliveries (*)
  `)  // ← Include delivery data via foreign key
  .eq('id', orderId)
  .single();
```

### Issue 3: UUID Type Mismatch ❌

**Wrong Implementation:**
```javascript
// ❌ Wrong - Comparing UUID to string without casting
.eq('id', orderId)  // orderId is string, db expects UUID

// Or comparing with integer
.eq('id', parseInt(orderId))  // ← This breaks UUID!
```

**Correct Implementation:**
```javascript
// ✅ Correct - UUID is string in PostgreSQL
const { data: order } = await supabase
  .from('orders')
  .select('*')
  .eq('id', orderId)  // orderId is already UUID string format
  .single();
```

### Issue 4: Not Checking Order Status ❌

**Wrong Implementation:**
```javascript
// ❌ Wrong - Allows cancellation of any order
const { error: updateDeliveryError } = await supabase
  .from('deliveries')
  .update({ status: 'cancelled' })
  .eq('order_id', orderId);
```

**Correct Implementation:**
```javascript
// ✅ Correct - Only allow cancellation in specific statuses
const cancellableStatuses = ['placed', 'pending'];
if (!cancellableStatuses.includes(delivery.status)) {
  return res.status(409).json({
    error: 'Cannot cancel',
    message: `Order in ${delivery.status} status cannot be cancelled`
  });
}
```

### Issue 5: Not Emitting Socket Event ❌

**Wrong Implementation:**
```javascript
// ❌ Wrong - Order cancelled but admin not notified
const { error: updateDeliveryError } = await supabase
  .from('deliveries')
  .update({ status: 'cancelled' })
  .eq('order_id', orderId);

return res.status(200).json({ success: true });
// ← No socket event, admin doesn't know order was cancelled!
```

**Correct Implementation:**
```javascript
// ✅ Correct - Emit socket event after successful update
const { error: updateDeliveryError } = await supabase
  .from('deliveries')
  .update({ status: 'cancelled', cancelled_reason })
  .eq('order_id', orderId);

if (!updateDeliveryError) {
  // Emit socket event to notify restaurant/admin
  global.io.to(`restaurant:${order.restaurant_id}`)
    .emit('order_cancelled', {
      order_id: orderId,
      order_number: order.order_number,
      cancelled_reason: cancelled_reason
    });
}
```

---

## Debugging Checklist

- [ ] Backend receives request with correct orderId UUID format
- [ ] Backend queries `orders` table (NOT `deliveries`)
- [ ] Query returns the order record
- [ ] Order has associated delivery record
- [ ] Delivery status is one of: 'placed' or 'pending'
- [ ] Order is not already cancelled
- [ ] UPDATE to orders table succeeds
- [ ] UPDATE to deliveries table succeeds
- [ ] Socket event emitted to restaurant
- [ ] Response status is 200 OK

## Testing the Fix

### 1. Direct Database Query (PostgreSQL)
```sql
-- Check if order exists
SELECT * FROM orders WHERE id = '71d2cb8f-cce0-43c9-86c5-d774956883ed';

-- Check if delivery exists
SELECT * FROM deliveries WHERE order_id = '71d2cb8f-cce0-43c9-86c5-d774956883ed';

-- Check delivery status
SELECT id, status, cancelled_at FROM deliveries 
WHERE order_id = '71d2cb8f-cce0-43c9-86c5-d774956883ed';
```

### 2. Test API Endpoint
```bash
curl -X POST http://localhost:3000/orders/71d2cb8f-cce0-43c9-86c5-d774956883ed/cancel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"cancelled_reason": "Changed my mind"}'

# Expected Response (200 OK):
{
  "success": true,
  "message": "Order cancelled successfully",
  "order": {
    "id": "71d2cb8f-cce0-43c9-86c5-d774956883ed",
    "order_number": "ORD-12345",
    "status": "cancelled",
    "cancelled_at": "2026-04-27T10:30:00Z",
    "cancellation_reason": "Changed my mind"
  }
}
```

### 3. Verify Socket Event
Check backend logs for:
```
[Order Cancel] Socket event emitted to restaurant: {restaurant_id}
```

---

## Summary

**The 404 "Order not found" error means:**
1. ❌ Backend is NOT finding the order in the database
2. ❌ Query is probably looking in wrong table or with wrong parameter
3. ❌ UUID format might be wrong or not matching
4. ❌ Order creation might have failed (order not persisted)

**Steps to fix:**
1. ✅ Query `orders` table directly by UUID id
2. ✅ Include delivery data via foreign key join
3. ✅ Verify order and delivery exist before update
4. ✅ Check order status is cancellable
5. ✅ Update both orders and deliveries tables
6. ✅ Emit socket event to admin
7. ✅ Return proper response

---

## UPDATED: Your Specific Backend Issue

### Your Current Backend Code Issue

You have this code:
```javascript
const { data: order, error: orderError } = await supabaseAdmin
  .from("orders")
  .select(...)
  .eq("id", orderId)
  .single();

if (orderError || !order) {
  return res.status(404).json({ message: "Order not found" });
}
```

**Problem:** The error message is too generic. You don't know WHY the order wasn't found. Is it:
- The orderId format is wrong?
- The order truly doesn't exist?
- There's a query error?
- Supabase connection issue?

### FIXED Backend Code with Enhanced Debugging

```javascript
router.post("/:id/cancel", authenticate, async (req, res) => {
  const orderId = req.params.id;
  const userId = req.user.id;
  const userRole = req.user.role;
  const { cancelled_reason } = req.body;

  console.log('[Order Cancel] Request received:', {
    orderId,
    userId,
    userRole,
    cancelled_reason: cancelled_reason?.substring(0, 50)
  });

  if (userRole !== "customer") {
    console.warn('[Order Cancel] User is not customer:', userRole);
    return res.status(403).json({ message: "Only customers can cancel orders" });
  }

  if (!orderId || !cancelled_reason?.trim()) {
    console.error('[Order Cancel] Missing required fields:', {
      orderId: !!orderId,
      cancelled_reason: !!cancelled_reason?.trim()
    });
    return res.status(400).json({
      message: "Order ID and cancelled_reason are required",
    });
  }

  // ✅ VALIDATE UUID FORMAT
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    console.error('[Order Cancel] Invalid UUID format:', orderId);
    return res.status(400).json({
      message: "Invalid order ID format",
      orderId: orderId,
      format: "Expected UUID"
    });
  }

  try {
    console.log('[Order Cancel] Querying order from database:', orderId);

    // ✅ FIRST: Just try to get the order (simpler query)
    const { data: rawOrder, error: rawOrderError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, customer_id, restaurant_id, cancelled_at")
      .eq("id", orderId)
      .single();

    if (rawOrderError) {
      console.error('[Order Cancel] Error fetching order:', {
        error: rawOrderError.message,
        code: rawOrderError.code,
        orderId: orderId
      });
      return res.status(404).json({
        message: "Order not found",
        error: rawOrderError.message,
        code: rawOrderError.code
      });
    }

    if (!rawOrder) {
      console.error('[Order Cancel] Order query returned null:', orderId);
      return res.status(404).json({
        message: "Order not found - returned null"
      });
    }

    console.log('[Order Cancel] Order found:', {
      id: rawOrder.id,
      order_number: rawOrder.order_number,
      customer_id: rawOrder.customer_id
    });

    // ✅ SECOND: Get delivery separately (sometimes nested queries fail)
    const { data: deliveries, error: deliveryError } = await supabaseAdmin
      .from("deliveries")
      .select("id, status, driver_id, cancelled_at, cancelled_reason")
      .eq("order_id", orderId)
      .limit(1);

    if (deliveryError) {
      console.error('[Order Cancel] Error fetching delivery:', deliveryError);
      return res.status(400).json({
        message: "Order has no delivery record",
        error: deliveryError.message
      });
    }

    const delivery = deliveries?.[0];
    if (!delivery) {
      console.error('[Order Cancel] No delivery found for order:', orderId);
      return res.status(400).json({
        message: "Order has no delivery record"
      });
    }

    console.log('[Order Cancel] Delivery found:', {
      id: delivery.id,
      status: delivery.status,
      cancelled_at: delivery.cancelled_at
    });

    // ✅ Authorization check
    if (rawOrder.customer_id !== userId) {
      console.warn('[Order Cancel] Authorization failed:', {
        orderId: orderId,
        orderCustomer: rawOrder.customer_id,
        requestUser: userId
      });
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ Check if already cancelled
    if (rawOrder.cancelled_at || delivery.cancelled_at || delivery.status === "cancelled") {
      console.warn('[Order Cancel] Order already cancelled:', {
        orderId: orderId,
        order_cancelled_at: rawOrder.cancelled_at,
        delivery_cancelled_at: delivery.cancelled_at,
        delivery_status: delivery.status
      });
      return res.status(409).json({ message: "This order has already been cancelled" });
    }

    // ✅ Check if order is in cancellable status
    const cancellableStatuses = new Set(["placed", "pending"]);
    if (!cancellableStatuses.has(delivery.status)) {
      console.warn('[Order Cancel] Cannot cancel - wrong status:', {
        orderId: orderId,
        status: delivery.status,
        cancellable: Array.from(cancellableStatuses)
      });
      return res.status(409).json({
        message: `Cannot cancel order in ${delivery.status} status`,
      });
    }

    const now = new Date().toISOString();
    const cleanReason = cancelled_reason.trim();

    console.log('[Order Cancel] Updating order:', orderId);

    // ✅ Update order
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        cancelled_at: now,
        cancellation_reason: cleanReason,
        updated_at: now,
      })
      .eq("id", orderId);

    if (orderUpdateError) {
      console.error('[Order Cancel] Order update error:', orderUpdateError);
      return res.status(500).json({
        message: "Failed to cancel order",
        error: orderUpdateError.message
      });
    }

    console.log('[Order Cancel] Updating delivery:', delivery.id);

    // ✅ Update delivery
    const { error: deliveryUpdateError } = await supabaseAdmin
      .from("deliveries")
      .update({
        status: "cancelled",
        cancelled_at: now,
        cancelled_reason: cleanReason,
        updated_at: now,
      })
      .eq("id", delivery.id);

    if (deliveryUpdateError) {
      console.error('[Order Cancel] Delivery update error:', deliveryUpdateError);
      return res.status(500).json({
        message: "Failed to cancel order",
        error: deliveryUpdateError.message
      });
    }

    console.log('[Order Cancel] Successfully cancelled order:', orderId);

    // ✅ Notify admin
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from("admins")
      .select("id")
      .eq("restaurant_id", rawOrder.restaurant_id);

    if (adminsError) {
      console.error('[Order Cancel] Error fetching admins:', adminsError);
    } else if (admins && admins.length > 0) {
      console.log('[Order Cancel] Notifying', admins.length, 'admin(s)');
      admins.forEach((admin) => {
        notifyAdmin(admin.id, "order:status_update", {
          type: "order_cancelled",
          title: "Order Cancelled",
          message: `Order ${rawOrder.order_number} was cancelled by the customer.`,
          order_id: orderId,
          order_number: rawOrder.order_number,
          status: "cancelled",
          reason: cleanReason,
          customer_id: userId,
          restaurant_id: rawOrder.restaurant_id,
        });
      });
    }

    console.log('[Order Cancel] Returning success response');

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order: {
        id: orderId,
        order_number: rawOrder.order_number,
        status: "cancelled",
        cancelled_at: now,
        cancellation_reason: cleanReason,
      },
    });

  } catch (error) {
    console.error('[Order Cancel] Unexpected error:', {
      message: error.message,
      stack: error.stack,
      orderId: orderId
    });
    return res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});
```

### Key Fixes Applied:

1. **✅ UUID Validation** - Verify orderId is valid UUID format before querying
2. **✅ Separate Queries** - Query order and delivery separately (nested queries sometimes fail)
3. **✅ Detailed Logging** - Every step is logged with all relevant data
4. **✅ Better Error Messages** - Errors include error code and message
5. **✅ Two-stage Query** - First query just order, then query delivery
6. **✅ Error Details in Response** - Client gets actual error message, not generic 404

### What This Reveals:

When you run this and get the error, the logs will tell you exactly:
- Is orderId format valid?
- Does order exist in database?
- Does delivery exist?
- What's the exact database error?

### Debug Checklist:

After deploying this, try cancelling an order and check backend logs for:

```
[Order Cancel] Request received: { orderId: '8b9a52a6-d9cf-4581-9c32-a873689563a0', ... }
[Order Cancel] Querying order from database: 8b9a52a6-d9cf-4581-9c32-a873689563a0
[Order Cancel] Error fetching order: { error: '...', code: '...', orderId: '...' }
```

The error message/code will tell you:
- **PGRST116** = No rows returned (order doesn't exist in DB)
- **Syntax error** = Query format wrong
- **Connection error** = Supabase connection issue

### Common Causes & Solutions:

**If you see "No rows returned":**
1. Check if order ID in database matches what frontend sends
2. Run SQL: `SELECT * FROM orders WHERE id = '8b9a52a6-d9cf-4581-9c32-a873689563a0';`
3. If query returns nothing, order wasn't created
4. If query returns results, there's a query filter issue in the endpoint

**If you see "Syntax error":**
1. Supabase client version issue
2. Check Supabase connection string
3. Try simpler query first (without nested selects)

**If authorization fails:**
1. Check `req.user.id` is being set correctly by auth middleware
2. Verify order.customer_id matches req.user.id

Try deploying this and share the backend logs when you get the 404 error. The logs will tell us exactly what's wrong!
