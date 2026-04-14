# Tracking Data Display Guide

## Overview
This document explains how tracking information from Shopify fulfillment webhooks is captured, processed, and displayed in the Admin Fulfillment Orders page.

## Data Flow

### 1. Webhook Reception (`/api/shopify/order-fulfilled`)
When Shopify sends an `order_fulfilled` webhook, it includes fulfillment data with tracking information:

```json
{
  "id": 6344106344768,
  "order_id": 7140601004352,
  "status": "success",
  "tracking_company": "PostEx",
  "tracking_number": "21101030039978",
  "tracking_numbers": ["21101030039978"],
  "tracking_info": {
    "number": "21101030039978",
    "company": "PostEx",
    "url": "https://postex.pk/tracking?cn=21101030039978"
  }
}
```

**Key Webhook Endpoints:**
- `POST /api/shopify/order-fulfilled` - Receives fulfillment webhooks
- `POST /api/shopify/order-created` - Receives order webhooks (different data structure)

### 2. Data Transformation (`/app/libs/utils/transformShopifyData.ts`)
The `transformShopifyFulfillmentData()` function extracts tracking information with multiple fallbacks:

**Tracking Number Extraction (Priority Order):**
1. `fulfillment.tracking_number`
2. `fulfillment.tracking_info.number`
3. `fulfillment.tracking_numbers[0]`

**Tracking Company Extraction (Priority Order):**
1. `fulfillment.tracking_company`
2. `fulfillment.tracking_info.company`
3. Default: `"Unknown"`

**Tracking URL Generation:**
Automatically generates tracking links for major Pakistan couriers:
- **PostEx**: `https://postex.pk/tracking?cn={trackingNumber}`
- **TCS**: `https://www.tcscourier.com/tracking/`
- **Leopards**: `https://www.leopardscourier.com/tracking`
- **SendCo/SendCube**: `https://sendcube.com/tracking/{trackingNumber}`

### 3. Data Storage
Transformed data is saved to MongoDB:
```
Collection: fulfillmentorders
{
  orderId: string,
  orderNumber: string,
  customer: {...},
  shippingAddress: {...},
  product: {...},
  payment: {...},
  fulfillment: {
    status: string,
    trackingCompany: string,
    trackingNumber: string,
    trackingUrl: string
  },
  pricing: {...}
}
```

### 4. UI Display (`/app/admin/fulfillment-orders/page.tsx`)

#### Table View (List)
Shows tracking information in the main table:
- **Tracking Number**: Displayed in monospace font with gray background
- **Courier Company**: Shown in smaller text below the number
- **Status**: "No tracking info" placeholder if data is missing
- **Track Package Link**: Direct link to courier's tracking page (if available)

#### Details Modal
Shows detailed tracking information when viewing order details:
- Overview section with tracking number prominently displayed
- Courier company information
- "Track Package" button with link
- Warning message if tracking information is not yet available

## Troubleshooting

### Issue: Tracking information not showing in UI

**Possible Causes:**

1. **Order-Created Webhook Only**
   - Problem: Only `order-created` webhook was received, not `order-fulfilled`
   - Solution: Wait for Shopify to send the `order-fulfilled` webhook, or manually mark orders as fulfilled in Shopify
   - Note: The `order-created` webhook does NOT contain fulfillment/tracking data

2. **Incomplete Webhook Data**
   - Problem: Shopify sent incomplete fulfillment data
   - Solution: Check server logs for "⚠️ WARNING: No tracking data found"
   - Manual Fix: Use the PUT endpoint to update tracking manually:
     ```javascript
     fetch(`/api/fulfillments?id={fulfillmentId}`, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         fulfillment: {
           status: 'fulfilled',
           trackingCompany: 'PostEx',
           trackingNumber: '21101030039978',
           trackingUrl: 'https://postex.pk/tracking?cn=21101030039978'
         }
       })
     })
     ```

3. **Data Mismatch Between Webhooks**
   - Problem: Order from `order-created` doesn't match `order-fulfilled` data
   - Check: Ensure both webhooks are using the same `order_id` in Shopify
   - Verify: Look at database to see if records are linked correctly

## Webhook Configuration in Shopify

### Required Webhooks
1. **orders/fulfilled**
   - Endpoint: `https://yourdomain.com/api/shopify/order-fulfilled`
   - Events: Fulfillment created/updated
   - Contains: Order ID, fulfillment status, tracking company, tracking numbers

2. **orders/created** (Optional - for archival)
   - Endpoint: `https://yourdomain.com/api/shopify/order-created`
   - Events: New order created
   - Note: Does NOT contain fulfillment/tracking data

### Testing Webhooks
Send test webhook with tracking data:
```json
{
  "id": 6344106344768,
  "order_id": 7140601004352,
  "status": "success",
  "tracking_company": "PostEx",
  "tracking_number": "21101030039978",
  "tracking_numbers": ["21101030039978"]
}
```

## Server Logs for Debugging

Look for these log patterns:

**Successful Tracking:**
```
✅ TRACKING EXTRACTION: {
  trackingNumber: "21101030039978",
  trackingCompany: "PostEx",
  trackingUrl: "https://postex.pk/tracking?cn=21101030039978"
}
```

**Missing Tracking (Warning):**
```
⚠️ WARNING: No tracking data found in any expected field!
```

**Complete Logs:**
```
📍 TRACKING INFORMATION ANALYSIS:
  ✓ tracking_number: 21101030039978
  ✓ tracking_company: PostEx
  ✓ tracking_numbers array: ["21101030039978"]
```

## API Endpoints for Manual Updates

### Get Fulfillment
```
GET /api/fulfillments?orderId=7140601004352
```

### Update Fulfillment Tracking
```
PUT /api/fulfillments?id={fulfillmentId}
Body: {
  fulfillment: {
    trackingCompany: "PostEx",
    trackingNumber: "21101030039978",
    trackingUrl: "https://postex.pk/tracking?cn=21101030039978"
  }
}
```

### Delete Fulfillment
```
DELETE /api/fulfillments?id={fulfillmentId}
```

## Summary

✅ **Working State**: Tracking information from `order-fulfilled` webhooks is automatically extracted and displayed
⚠️ **Check**: Ensure your Shopify account is sending `orders/fulfilled` webhooks to the correct endpoint
🔧 **Manual Override**: Use PUT endpoint if webhook data is incomplete
📊 **Monitoring**: Check browser network tab and server logs for webhook data

