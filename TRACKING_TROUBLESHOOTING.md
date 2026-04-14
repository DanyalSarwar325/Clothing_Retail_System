# Tracking Information Troubleshooting Checklist

## ✅ Quick Diagnosis

### 1. Check if Order is Fulfilled in Shopify
- [ ] Go to Shopify Admin → Orders
- [ ] Find your order
- [ ] Check if status shows "Fulfilled"
- [ ] If not fulfilled: The webhook won't be sent yet
- **Action**: Fulfill the order in Shopify → Shopify will send `order_fulfilled` webhook

### 2. Verify Webhook Configuration
- [ ] Go to Shopify Admin → Settings → Apps and integrations → Webhooks
- [ ] Look for both webhooks:
  - `orders/created` → Your app domain/api/shopify/order-created
  - `orders/fulfilled` → Your app domain/api/shopify/order-fulfilled
- [ ] If missing: Add the webhook
- [ ] If disabled: Enable the webhook
- **Action**: Create webhook with details below

### 3. Check Database Directly
Run in MongoDB to see what's stored:
```javascript
// Find order by order number
db.fulfillmentorders.findOne({ orderNumber: "47090" })

// Check tracking field
db.fulfillmentorders.findOne(
  { orderNumber: "47090" },
  { "fulfillment.trackingNumber": 1, "fulfillment.trackingCompany": 1 }
)
```

**Expected result:**
```javascript
{
  fulfillment: {
    status: "fulfilled",
    trackingCompany: "PostEx",
    trackingNumber: "21101030039978",
    trackingUrl: "https://postex.pk/tracking?cn=21101030039978"
  }
}
```

### 4. Check Server Logs
Look for webhook response logs:
```
=== ORDER FULFILLED WEBHOOK RECEIVED ===
Raw body length: XXXX
Parsed body keys: [..., tracking_number, tracking_company, ...]

📍 TRACKING INFORMATION ANALYSIS:
  ✓ tracking_number: 21101030039978
  ✓ tracking_company: PostEx
  ✓ tracking_numbers array: ["21101030039978"]

✅ TRACKING EXTRACTION: {
  trackingNumber: "21101030039978",
  trackingCompany: "PostEx",
  trackingUrl: "https://postex.pk/tracking?cn=21101030039978"
}
```

## 🔧 Fix Options by Problem

### Problem: Only seeing "No tracking info" in UI
**Most Common Cause**: Only `order-created` webhook was sent, not `order-fulfilled`

**Fix Steps**:
1. Go to Shopify Orders page
2. Find the order
3. Click "Fulfill order" button
4. Add tracking details:
   - Tracking number: `21101030039978`
   - Tracking URL/Company: `PostEx`
5. Submit
6. Shopify will send `order_fulfilled` webhook with tracking data
7. Check UI again (may take 1-2 seconds)

---

### Problem: Fulfillment shows but no tracking number
**Possible Cause**: Shopify fulfillment webhook doesn't include tracking

**Fix Steps**:
1. Check Shopify order - does it show tracking number?
   - If NO: Add tracking in Shopify first
   - If YES: Proceed to step 2

2. Check if webhook actually received tracking:
   - Check server logs for `⚠️ WARNING: No tracking data found`
   - If warning shown: Shopify webhook didn't include tracking

3. Manual Fix: Add tracking via API
   ```bash
   curl -X PUT http://localhost:3000/api/fulfillments?id={fulfillmentId} \
     -H "Content-Type: application/json" \
     -d '{
       "fulfillment": {
         "trackingCompany": "PostEx",
         "trackingNumber": "21101030039978",
         "trackingUrl": "https://postex.pk/tracking?cn=21101030039978"
       }
     }'
   ```

---

### Problem: Two different webhooks, one shows tracking, one doesn't
**Possible Cause**: One webhook sends complete fulfillment data, other doesn't

**Analysis**:
1. Check which webhook each order is using
2. Orders from fulfillment webhook should have tracking
3. Orders from creation webhook won't have tracking until fulfilled

**Fix**:
- Ensure all orders flow through `order_fulfilled` webhook
- Configure webhook in Shopify: `orders/fulfilled` event

---

### Problem: Tracking URL is broken or shows "#"
**Cause**: Courier company name doesn't match known carriers

**Known Carriers**:
- PostEx → `https://postex.pk/tracking?cn={number}`
- TCS → `https://www.tcscourier.com/tracking/`
- Leopards → `https://www.leopardscourier.com/tracking`
- SendCo/SendCube → `https://sendcube.com/tracking/{number}`

**Fix**: 
1. Check what company Shopify has: `fulfillment.tracking_company`
2. Add mapping in transformation if new courier:
   - Edit: `/app/libs/utils/transformShopifyData.ts`
   - Find: "Build tracking URL if not provided"
   - Add new company mapping

---

## 🚀 Verify End-to-End

### Test with Manual Webhook
1. Get an order ID from Shopify (example: `7140601004352`)
2. Create test fulfillment data:
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

3. Send POST to webhook endpoint (use Postman/curl):
```bash
curl -X POST http://yourdomain.com/api/shopify/order-fulfilled \
  -H "Content-Type: application/json" \
  -d '{...json from step 2...}'
```

4. Check response:
```json
{
  "success": true,
  "message": "saved",
  "fulfillmentId": "...",
  "structuredFulfillmentId": "..."
}
```

5. Verify in UI:
   - Go to Admin → Fulfillment Orders
   - Look for order
   - Should show tracking number "21101030039978"
   - Should show company "PostEx"

---

## 📊 Summary Table

| Issue | Cause | Solution |
|-------|-------|----------|
| No tracking info shown | Order not fulfilled in Shopify | Fulfill order in Shopify |
| Fulfillment shows but no tracking | Webhook didn't include tracking | Add tracking in Shopify or use PUT API |
| Shows different data between orders | Multiple webhooks, inconsistent data | Check webhook configuration |
| Tracking URL broken | Unknown courier company | Add company to transformation code |
| No orders showing at all | Webhook not configured | Add webhook in Shopify settings |

---

## 🔗 Webhook Setup in Shopify

**Admin Path**: Settings → Apps and integrations → Webhooks

**Create New Webhook**:
- **Event**: `orders/fulfilled`
- **URL**: `https://yourdomain.com/api/shopify/order-fulfilled`
- **API version**: Latest
- **Topic**: `orders/fulfilled`

**Expected Data**:
Webhook will include:
- `id` - Fulfillment ID
- `order_id` - Order ID
- `status` - "success" / "pending"
- `tracking_number` - Courier tracking number
- `tracking_company` - Courier name (PostEx, TCS, etc.)
- `tracking_numbers` - Array of tracking numbers
- `line_items` - Items in fulfillment

