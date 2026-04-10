# Shopify Order Fulfillment Data Pipeline

This document explains the complete data pipeline for processing Shopify order fulfillment webhooks.

## Overview

When Shopify sends a fulfillment webhook, the system:
1. Receives raw Shopify webhook data
2. Validates the webhook (HMAC verification)
3. Transforms the raw data into a structured format
4. Saves both raw and structured data to MongoDB

## Architecture

### 1. **Data Transformation** (`app/libs/utils/transformShopifyData.ts`)

The `transformShopifyFulfillmentData()` function converts raw Shopify webhook data into this structured format:

```json
{
  "orderId": "7120090104128",
  "orderNumber": "46872",
  "customer": {
    "name": "hussain asghar",
    "email": "m.sherazi700@gmail.com",
    "phone": "03049558700"
  },
  "shippingAddress": {
    "city": "Sargodha",
    "address": "farooq colony street 15 house no 6",
    "province": "Punjab",
    "postalCode": "40000",
    "country": "Pakistan"
  },
  "product": {
    "name": "Basil 3Pc - Embroidered Lawn Dress",
    "variant": "Ice Blue / Medium / Lawn",
    "sku": "SKU123",
    "quantity": 1,
    "price": 6999
  },
  "payment": {
    "method": "COD",
    "status": "pending"
  },
  "fulfillment": {
    "status": "fulfilled",
    "trackingCompany": "PostEx",
    "trackingNumber": "25101030039800",
    "trackingUrl": "https://postex.pk/tracking?cn=25101030039800"
  },
  "pricing": {
    "subtotal": 6034,
    "tax": 965.38,
    "shipping": 0,
    "total": 6999,
    "currency": "PKR"
  },
  "createdAt": "2026-04-09T14:42:48+05:00"
}
```

#### Key Features:
- **Flexible Field Mapping**: Handles variations in Shopify webhook structure
- **Automatic Calculations**: Computes missing values where possible
- **Tracking URL Generation**: Automatically creates tracking URLs for known carriers (PostEx, TCS, Leopards)
- **Default Values**: Uses sensible defaults for missing data (e.g., "COD" for payment method)
- **Robust Parsing**: Safely handles null/undefined values

### 2. **Database Models**

#### `FulfillmentOrder` Model (`app/libs/models/fulfillmentOrder.ts`)
Stores the structured fulfillment data with the following key fields:
- `orderId` (unique index) - Primary identifier
- `orderNumber` - Human-readable order number
- `customer` - Customer details
- `shippingAddress` - Shipping information
- `product` - First product details from order
- `payment` - Payment information
- `fulfillment` - Fulfillment and tracking details
- `pricing` - Complete pricing breakdown
- `shopifyOrderId` - Reference to Shopify order ID
- `rawPayload` - Original Shopify webhook data
- Timestamps - Auto-managed by Mongoose

#### `ShopifyFulfillment` Model (Existing)
Continues to store raw Shopify webhook payloads for audit trail and debugging.

### 3. **Webhook Endpoint** (`app/api/shopify/order-fulfilled/route.ts`)

**Endpoint**: `POST /api/shopify/order-fulfilled`

When a Shopify fulfillment webhook is received:

```
Raw Shopify Data 
    ↓
Validation (HMAC verification)
    ↓
Transformation (transformShopifyFulfillmentData)
    ↓
Parallel Saving to MongoDB:
    ├─ ShopifyFulfillment (raw payload)
    └─ FulfillmentOrder (structured data)
    ↓
Response with both IDs
```

## API Endpoints

### 1. Get Fulfillment Orders

**Endpoint**: `GET /api/fulfillments`

**Query Parameters**:
- `orderId` (string) - Filter by specific order ID
- `status` (string) - Filter by fulfillment status (e.g., "fulfilled", "pending")
- `startDate` (ISO string) - Filter orders from this date
- `endDate` (ISO string) - Filter orders until this date
- `limit` (number, default: 50, max: 100) - Results per page
- `skip` (number, default: 0) - Pagination offset

**Example Requests**:

```bash
# Get all fulfillments
GET /api/fulfillments

# Get specific order
GET /api/fulfillments?orderId=7120090104128

# Get fulfilled orders from last 30 days
GET /api/fulfillments?status=fulfilled&startDate=2026-03-11&endDate=2026-04-10

# Pagination
GET /api/fulfillments?limit=20&skip=0
```

**Response**:
```json
{
  "success": true,
  "data": [
    { /* FulfillmentOrder document */ },
    ...
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "skip": 0,
    "returned": 50,
    "pages": 3
  }
}
```

### 2. Update Fulfillment Order

**Endpoint**: `PUT /api/fulfillments?id=<fulfillment_id>`

**Request Body**: JSON with fields to update

```bash
curl -X PUT /api/fulfillments?id=507f1f77bcf86cd799439011 \
  -H "Content-Type: application/json" \
  -d '{"fulfillment.status": "delivered"}'
```

### 3. Delete Fulfillment Order

**Endpoint**: `DELETE /api/fulfillments?id=<fulfillment_id>`

```bash
curl -X DELETE /api/fulfillments?id=507f1f77bcf86cd799439011
```

## Data Flow Examples

### Example 1: Shopify Webhook → Database

**Shopify sends** (partial example):
```json
{
  "id": 123456789,
  "order_id": 7120090104128,
  "order": {
    "id": 7120090104128,
    "order_number": 46872,
    "customer": {
      "first_name": "Hussain",
      "last_name": "Asghar",
      "email": "m.sherazi700@gmail.com",
      "phone": "03049558700"
    },
    "shipping_address": {
      "address1": "farooq colony street 15 house no 6",
      "city": "Sargodha",
      "province": "Punjab",
      "zip": "40000",
      "country": "Pakistan"
    },
    "line_items": [
      {
        "title": "Basil 3Pc - Embroidered Lawn Dress",
        "variant_title": "Ice Blue / Medium / Lawn",
        "sku": "SKU123",
        "quantity": 1,
        "price": "6999.00"
      }
    ],
    "total_price": "6999.00",
    "total_tax": "965.38",
    "currency": "PKR"
  },
  "status": "fulfilled",
  "tracking_info": {
    "number": "25101030039800",
    "company": "PostEx"
  }
}
```

**Gets transformed to** (stored in FulfillmentOrder):
```json
{
  "_id": "ObjectId(...)",
  "orderId": "7120090104128",
  "orderNumber": "46872",
  "customer": {
    "name": "Hussain Asghar",
    "email": "m.sherazi700@gmail.com",
    "phone": "03049558700"
  },
  "shippingAddress": {
    "city": "Sargodha",
    "address": "farooq colony street 15 house no 6",
    "province": "Punjab",
    "postalCode": "40000",
    "country": "Pakistan"
  },
  "product": {
    "name": "Basil 3Pc - Embroidered Lawn Dress",
    "variant": "Ice Blue / Medium / Lawn",
    "sku": "SKU123",
    "quantity": 1,
    "price": 6999
  },
  "payment": {
    "method": "COD",
    "status": "pending"
  },
  "fulfillment": {
    "status": "fulfilled",
    "trackingCompany": "PostEx",
    "trackingNumber": "25101030039800",
    "trackingUrl": "https://postex.pk/tracking?cn=25101030039800"
  },
  "pricing": {
    "subtotal": 6033.62,
    "tax": 965.38,
    "shipping": 0,
    "total": 6999,
    "currency": "PKR"
  },
  "createdAt": "2026-04-09T14:42:48+05:00",
  "shopifyOrderId": "7120090104128",
  "rawPayload": { /* original webhook data */ }
}
```

## Handling Different Shopify Data Formats

The transformation function gracefully handles:

1. **Nested Order Data**: If Shopify nests order info in an `order` field vs. root level
2. **Missing Fields**: Provides sensible defaults where needed
3. **Variant Tracking URLs**: Auto-generates proper tracking URLs for:
   - PostEx: `https://postex.pk/tracking?cn=<number>`
   - TCS: `https://www.tcscourier.com/tracking/`
   - Leopards: `https://www.leopardscourier.com/tracking`
4. **Multiple Line Items**: Extracts the first item as primary product
5. **Various Currency/Number Formats**: Safely parses numeric values

## Error Handling

### Webhook Endpoint (POST)
- ✅ Validates Shopify HMAC signature
- ✅ Handles malformed JSON gracefully
- ✅ Returns 400 for missing order ID
- ✅ Returns 401 for HMAC verification failure
- ✅ Logs detailed information for debugging

### Fulfillments Endpoint (GET/PUT/DELETE)
- ✅ Validates required query parameters
- ✅ Returns 404 for missing records
- ✅ Returns 500 with error message on database issues
- ✅ Logs all operations for audit trail

## Logging & Debugging

The system provides detailed console logging:

```
=== ORDER FULFILLED WEBHOOK RECEIVED ===
...
=== COMPLETE SHOPIFY FULFILLMENT DATA ===
📦 FULL OBJECT STRUCTURE:
[JSON output]
📝 FIELDS ANALYSIS:
...
Transformation completed: {orderId, orderNumber, customerName, total}
Raw fulfillment saved successfully with _id: ...
Structured fulfillment saved successfully with _id: ...
=== ORDER FULFILLED WEBHOOK COMPLETED SUCCESSFULLY ===
```

## Database Indexes

The `FulfillmentOrder` model has these indexes for performance:
- `orderId` (unique, sparse) - Fast lookups by order ID
- `shopifyOrderId` (sparse) - Reference to Shopify orders
- `createdAt` (via timestamps) - Efficient date range queries

## Testing the Pipeline

### 1. Send Test Webhook (using curl or Postman)

```bash
curl -X POST http://localhost:3000/api/shopify/order-fulfilled \
  -H "Content-Type: application/json" \
  -d '{
    "id": 123456789,
    "order_id": 7120090104128,
    "order": {
      "id": 7120090104128,
      "order_number": 46872,
      "customer": { /* ... */ },
      "shipping_address": { /* ... */ },
      "line_items": [ /* ... */ ]
    }
  }'
```

### 2. Verify in Database

```bash
# MongoDB query
db.fulfillmentorders.findOne({ orderId: "7120090104128" })
```

### 3. Retrieve via API

```bash
curl "http://localhost:3000/api/fulfillments?orderId=7120090104128"
```

## Future Enhancements

- [ ] Batch processing for multiple line items (current: uses first item only)
- [ ] Support for multiple shipments per order
- [ ] Webhook retry mechanism
- [ ] Email notifications on fulfillment status
- [ ] Integration with shipping providers for real-time tracking updates
- [ ] Analytics dashboard for fulfillment metrics
