# Shopify Webhook Debugging Guide

## Understanding Your Two Webhooks

### 1. **Order Created Webhook** (`order-created`)
- **Trigger**: When order is placed in Shopify
- **Data**: Complete order information
- **Purpose**: Store initial order details
- **Endpoint**: `/api/shopify/order-created`

### 2. **Order Fulfilled Webhook** (`order-fulfilled`)
- **Trigger**: When fulfillment is created (you fulfill an order)
- **Data**: Fulfillment information + order reference
- **Purpose**: Track shipments and delivery
- **Endpoint**: `/api/shopify/order-fulfilled`

---

## Common Issues & Solutions

### Issue 1: Order ID showing ".1" instead of just the ID
**Root Cause**: Shopify sometimes includes relation suffixes in webhook data
**Data Structure**: 
```json
{
  "id": "123456789",
  "order_id": "987654321",
  // In fulfillment webhooks, these might have ".1" suffix
}
```
**Solution**: The code automatically extracts and cleans these values

### Issue 2: Amount/Total showing as Zero
**Root Cause**: The transform function has fallback chain for extracting prices
**Possible Locations**:
```json
{
  "total_price": "5499.00",           // Primary location
  "order": { "total_price": "..." },  // Nested location
  "subtotal_price": "...",            // Alternative field
}
```
**Debug Steps**:
1. Click the 👁️ (eye) button on any order
2. Go to **Shopify Raw Response** tab
3. Search for these fields to see which one contains the data

### Issue 3: Customer Name showing as "N/A"
**Root Cause**: Customer data missing or in unexpected location
**Expected Locations in Webhook**:
```json
{
  "customer": {
    "first_name": "John",
    "last_name": "Doe"
  },
  "shipping_address": {
    "name": "John Doe"
  },
  "destination": {
    "name": "John Doe"  // In some fulfillment webhooks
  }
}
```
**Debug Steps**:
1. Check Shopify Raw Response for these fields
2. If customer data is missing, it means Shopify didn't include it in that webhook

---

## How to Debug Issues Now

### Step 1: View Raw Shopify Response
1. Go to **Fulfillment Orders** page
2. Click the 👁️ **eye icon** on any order row
3. Click **Shopify Raw Response** tab (second tab)

### Step 2: Analyze the JSON
The raw JSON shows exactly what Shopify sent:
- Search for missing fields
- Check data types and values
- Look for nested objects you might not expect

### Step 3: Copy JSON for Analysis
- Click **Copy JSON to Clipboard**
- Paste in your text editor or [jsoncrack.com](https://jsoncrack.com) for visualization

---

## Webhook Data Structure Examples

### Order Created Webhook Structure:
```json
{
  "id": 123456789,
  "order_number": 1001,
  "name": "#1001",
  "email": "customer@example.com",
  "total_price": "5499.00",
  "currency": "PKR",
  "financial_status": "paid",
  "fulfillment_status": "unfulfilled",
  "customer": {
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  },
  "shipping_address": {
    "name": "John Doe",
    "address1": "123 Main St",
    "city": "Karachi",
    "province": "Sindh",
    "zip": "75600",
    "country": "Pakistan",
    "phone": "03001234567"
  },
  "line_items": [
    {
      "title": "Product Name",
      "variant_title": "Size L",
      "sku": "SKU123",
      "quantity": 1,
      "price": "5499.00"
    }
  ]
}
```

### Order Fulfilled Webhook Structure:
```json
{
  "id": 987654321,
  "order_id": "123456789",  // ← Points back to order
  "status": "success",
  "tracking_number": "TRK123456",
  "tracking_company": "PostEx",  // ← This is why you see "PostEx"
  "created_at": "2024-04-13T10:00:00Z",
  "line_items": [
    {
      "id": 111,
      "title": "Product Name",
      "quantity": 1
    }
  ],
  "receipt": {
    // Carrier-specific receipt data
  },
  "order": {
    // Partial or full order data (nested)
    "total_price": "0.00"  // ← May override with 0!
  }
}
```

---

## Why "PostEx" ID Appears in Fulfillment Webhook

The fulfillment webhook includes:
- `tracking_company`: "PostEx" (the shipping carrier)
- `tracking_number`: The actual package number

This is **correct behavior** - Shopify is telling you which courier was used and the tracking number. The transform function correctly extracts both.

---

## Database Storage

### Raw Payload Saved:
Every webhook saves the complete raw payload in MongoDB:
- **Collection**: `fulfillmentorders` or `shopifulfillments`
- **Field**: `rawPayload` - exact JSON from Shopify

### This Enables:
- ✅ Historical debugging - see what Shopify sent
- ✅ Retransformation - reprocess data if logic changes
- ✅ Audit trail - track data changes

---

## Next Steps for Debugging

1. **Check orders with issues** using the new Raw Response tab
2. **Identify pattern** - what fields are missing/different
3. **Report findings**:
   - Field name that's missing
   - Where the data actually is (if present)
   - Expected vs actual values

4. **Adjust transform function** if needed in:
   - `app/libs/utils/transformShopifyData.ts`

---

## Contact Shopify Support Issues

If you need to report to Shopify:
- Use Order ID from raw JSON: `"id"` field
- Use Fulfillment ID from raw JSON: `"id"` in fulfillment object
- Share relevant fields from Raw Response tab

