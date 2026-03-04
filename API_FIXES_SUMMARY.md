# API Response Structure Fixes - Deposits & Withdrawals

## Problem

The deposits and withdrawals screens were showing amounts as 0 because they were trying to access the wrong data properties from API responses.

## Root Cause

- Mobile implementation was looking for `data` property in responses, but API returns different property names
- Field names in the response objects were also different

## Fixed API Calls

### Withdrawals Screen (DriverWithdrawalsScreen.jsx)

**Before:**

```javascript
const sData = await sRes.json();
if (sData.success) setSummary(sData.data); // ❌ Wrong property
const hData = await hRes.json();
if (hData.success) setHistory(hData.data || []); // ❌ Wrong property
```

**After:**

```javascript
const sData = await sRes.json();
if (sData.success) setSummary(sData.summary || {}); // ✅ Correct property
const hData = await hRes.json();
if (hData.success) setHistory(hData.payments || []); // ✅ Correct property
```

### Deposits Screen (DriverDepositsScreen.jsx)

**Before:**

```javascript
const bData = await bRes.json();
if (bData.success) setBalance(bData.data); // ❌ Wrong property
const hData = await hRes.json();
if (hData.success) setHistory(hData.data || []); // ❌ Wrong property
```

**After:**

```javascript
const bData = await bRes.json();
if (bData.success) setBalance(bData.balance || {}); // ✅ Correct property
const hData = await hRes.json();
if (hData.success) setHistory(hData.deposits || []); // ✅ Correct property
```

## Fixed Field Names

### Withdrawals Summary Fields

| Old Field                | New Field                   | Description              |
| ------------------------ | --------------------------- | ------------------------ |
| `summary.total_received` | `summary.total_withdrawals` | Total amounts paid out   |
| `summary.total_earned`   | `summary.total_earnings`    | Total earnings by driver |
| `summary.today`          | `summary.today_withdrawals` | Withdrawals made today   |

### Deposits Balance Calculation

**Before:**

```javascript
Rs {Number(balance?.pending_amount || 0).toFixed(2)}  // ❌ Wrong field
Rs {Number(balance?.total_deposited || 0).toFixed(2)}  // ❌ Not available
{balance?.pending_count || 0}  // ❌ Not available
```

**After:**

```javascript
Rs {Number(balance?.pending_deposit || 0).toFixed(2)}  // ✅ Correct field from API
Rs {history.reduce((sum, d) => sum + Number(d.amount || 0), 0).toFixed(2)}  // ✅ Calculate from history
{history.filter(d => d.status === "pending").length}  // ✅ Calculate from history
```

## API Response Structure (from Backend)

### `/driver/withdrawals/my/summary`

```javascript
{
  success: true,
  summary: {
    total_earnings: 50000,
    total_withdrawals: 30000,
    remaining_balance: 20000,
    today_withdrawals: 5000,
    payment_count: 10
  }
}
```

### `/driver/withdrawals/my/history`

```javascript
{
  success: true,
  payments: [
    {
      id: "...",
      amount: 5000,
      created_at: "2024-02-20T10:30:00",
      status: "completed",
      proof_url: "..."
    }
  ]
}
```

### `/driver/deposits/balance`

```javascript
{
  success: true,
  balance: {
    pending_deposit: 10000,
    hours_until_midnight: 6
  }
}
```

### `/driver/deposits/history`

```javascript
{
  success: true,
  deposits: [
    {
      id: "...",
      amount: 5000,
      created_at: "2024-02-20T10:30:00",
      status: "pending",
      note: "Optional review note",
      approved_amount: 5000
    }
  ]
}
```

## What Was Changed

### Files Modified:

1. **src/screens/driver/DriverWithdrawalsScreen.jsx**
   - Fixed API response property mapping: `sData.data` → `sData.summary`
   - Fixed history property mapping: `hData.data` → `hData.payments`
   - Updated field names: `total_received` → `total_withdrawals`
   - Updated field names: `total_earned` → `total_earnings`
   - Updated field names: `today` → `today_withdrawals`

2. **src/screens/driver/DriverDepositsScreen.jsx**
   - Fixed API response property mapping: `bData.data` → `bData.balance`
   - Fixed history property mapping: `hData.data` → `hData.deposits`
   - Updated field name: `pending_amount` → `pending_deposit`
   - Changed total_deposited to calculate from history
   - Changed pending_count to calculate from history

## Testing

After these changes:

- Withdrawals screen should display correct earnings and payment amounts
- Deposits screen should display correct pending deposit amount
- History lists should show proper deposit/payment records
- All calculations (progress bars, remaining balance, etc.) should be accurate

## References

- Website implementation: `C:\Users\HP\nearme\frontend\src\pages\driver\DriverDeposits.jsx`
- Website implementation: `C:\Users\HP\nearme\frontend\src\pages\driver\DriverWithdrawals.jsx`
