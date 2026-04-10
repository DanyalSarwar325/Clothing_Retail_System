# Fulfillment Pipeline - Quick Reference

## 📋 What Was Built

A **complete data pipeline** that:
1. Receives raw Shopify fulfillment webhooks
2. Transforms them into your standardized format
3. Saves to MongoDB in a queryable structure
4. Provides APIs to retrieve and manage the data

## 📁 Files Created/Updated

| File | Purpose |
|------|---------|
| `app/libs/models/fulfillmentOrder.ts` | Database model for structured fulfillment data |
| `app/libs/utils/transformShopifyData.ts` | Transform function (Shopify → Structured format) |
| `app/api/shopify/order-fulfilled/route.ts` | ✏️ Updated to save transformed data |
| `app/api/fulfillments/route.ts` | New API endpoints for fulfillment CRUD |

## 🔄 Data Flow

```
Shopify Webhook Data
        ↓
  Validate & Parse
        ↓
  Transform (Shopify format → Your format)
        ↓
  Parallel saves:
  ├─ ShopifyFulfillment (raw payload)
  └─ FulfillmentOrder (structured)
        ↓
  Return success response
```

## 🚀 Quick Start

### 1. Deploy/Restart Server
```bash
npm run dev
```

### 2. Configure Shopify Webhook
In Shopify Admin → Settings → Apps and Integrations → Webhooks:
- **Event**: Fulfillments → Fulfillment created/updated
- **URL**: `https://yourdomain.com/api/shopify/order-fulfilled`
- **API Version**: Latest stable

### 3. Test the Pipeline
```bash
# Send test webhook
curl -X POST http://localhost:3000/api/shopify/order-fulfilled \
  -H "Content-Type: application/json" \
  -d @test-webhook.json

# Get fulfillments
curl "http://localhost:3000/api/fulfillments"

# Get specific order
curl "http://localhost:3000/api/fulfillments?orderId=7120090104128"

# Filter by status & date
curl "http://localhost:3000/api/fulfillments?status=fulfilled&startDate=2026-04-01&limit=20"
```

## 📊 Database Structure

### FulfillmentOrder Collection
```javascript
{
  _id: ObjectId,
  orderId: "7120090104128",          // ← Primary key
  orderNumber: "46872",
  customer: {
    name: "hussain asghar",
    email: "m.sherazi700@gmail.com",
    phone: "03049558700"
  },
  shippingAddress: {
    city: "Sargodha",
    address: "farooq colony street 15 house no 6",
    province: "Punjab",
    postalCode: "40000",
    country: "Pakistan"
  },
  product: {
    name: "Basil 3Pc - Embroidered Lawn Dress",
    variant: "Ice Blue / Medium / Lawn",
    sku: "SKU123",
    quantity: 1,
    price: 6999
  },
  payment: {
    method: "COD",
    status: "pending"
  },
  fulfillment: {
    status: "fulfilled",
    trackingCompany: "PostEx",
    trackingNumber: "25101030039800",
    trackingUrl: "https://postex.pk/tracking?cn=25101030039800"
  },
  pricing: {
    subtotal: 6033.62,
    tax: 965.38,
    shipping: 0,
    total: 6999,
    currency: "PKR"
  },
  createdAt: "2026-04-09T14:42:48+05:00",
  updatedAt: "2026-04-09T14:42:48+05:00",
  shopifyOrderId: "7120090104128",
  rawPayload: { /* original Shopify webhook */ }
}
```

## 🔌 API Endpoints

### GET /api/fulfillments
Fetch fulfillment orders with filtering

```bash
# All fulfillments (paginated, 50 per page)
GET /api/fulfillments

# By order ID
GET /api/fulfillments?orderId=7120090104128

# By status
GET /api/fulfillments?status=fulfilled

# By date range
GET /api/fulfillments?startDate=2026-04-01&endDate=2026-04-10

# Combined filters with pagination
GET /api/fulfillments?status=fulfilled&startDate=2026-04-01&limit=20&skip=0
```

### PUT /api/fulfillments?id=<id>
Update a fulfillment order

```bash
curl -X PUT "http://localhost:3000/api/fulfillments?id=507f1f77bcf86cd799439011" \
  -H "Content-Type: application/json" \
  -d '{
    "fulfillment.status": "delivered",
    "fulfillment.trackingNumber": "NEW123456"
  }'
```

### DELETE /api/fulfillments?id=<id>
Delete a fulfillment order

```bash
curl -X DELETE "http://localhost:3000/api/fulfillments?id=507f1f77bcf86cd799439011"
```

## ✅ Features

- ✅ Auto-extracts data from any Shopify webhook structure
- ✅ Handles missing fields gracefully (defaults provided)
- ✅ Auto-generates tracking URLs (PostEx, TCS, Leopards)
- ✅ Robust number/currency parsing
- ✅ Parallel data saving (raw + transformed)
- ✅ Full CRUD API with filtering
- ✅ Pagination support (limit/skip)
- ✅ Date range filtering
- ✅ CORS enabled
- ✅ Detailed logging for debugging

## 🐛 Debugging

### Check Logs
```bash
# Terminal output shows detailed transformation logs:
# - Shopify webhook received
# - Data structure analysis
# - Transformation progress
# - Database save status
```

### MongoDB Queries
```javascript
// View all fulfillments
db.fulfillmentorders.find().pretty()

// Find by order ID
db.fulfillmentorders.findOne({ orderId: "7120090104128" })

// Count by status
db.fulfillmentorders.count({ "fulfillment.status": "fulfilled" })

// Recent orders
db.fulfillmentorders.find().sort({ createdAt: -1 }).limit(10)

// Date range
db.fulfillmentorders.find({
  createdAt: {
    $gte: ISODate("2026-04-01"),
    $lte: ISODate("2026-04-10")
  }
})
```

## 🔧 Customization

### Add More Tracking Carriers
Edit in `app/libs/utils/transformShopifyData.ts`, function `transformShopifyFulfillmentData()`:

```typescript
if (trackingCompany.toLowerCase().includes("yourcarrier")) {
  finalTrackingUrl = `https://yourcarrier.com/tracking/${trackingNumber}`;
}
```

### Modify Transformation Logic
Edit `transformShopifyFulfillmentData()` to:
- Extract additional fields
- Change default values
- Add custom validations
- Change price calculations

### Add More Fields to Database
Update `FulfillmentOrderSchema` in `fulfillmentOrder.ts`:

```typescript
const FulfillmentOrderSchema = new Schema({
  // ... existing fields
  customField: { type: String },
  // ... more fields
});
```

## 📞 Support

### Common Issues

**Q: Webhook not being received?**
- Check Shopify webhook configuration
- Verify webhook URL is accessible
- Check server logs for errors

**Q: Data not being saved?**
- Check MongoDB connection
- Verify database credentials
- Check browser console for errors

**Q: Wrong data in database?**
- Review transformation function
- Check Shopify webhook format
- Verify field mappings

See `FULFILLMENT_PIPELINE_DOCS.md` for detailed documentation.
