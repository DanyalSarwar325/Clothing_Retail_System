#!/bin/bash

# Test script for Order with TA webhook
# Add your domain below

DOMAIN="https://clothing-retail-system-rrbm.vercel.app"
ENDPOINT="/api/shopify/order-with-ta/test"

echo "🧪 Testing Order with TA Endpoint..."
echo "URL: $DOMAIN$ENDPOINT"
echo ""

# Test 1: Send sample fulfillment data
echo "📤 Sending test fulfillment data..."
curl -X POST "$DOMAIN$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "order_id": 123456789,
    "order_number": "1001",
    "customer_id": 987654321,
    "fulfillment": {
      "id": "fff111222",
      "line_items": [{"id": 123, "quantity": 1}],
      "tracking_info": {
        "number": "TRK123456",
        "company": "PostEx"
      }
    }
  }' -s | jq .

echo ""
echo "---"
echo ""

# Test 2: Get saved data
echo "📥 Retrieving saved data..."
curl -X GET "$DOMAIN$ENDPOINT" -s | jq .

echo ""
echo "✅ Test complete!"
echo ""
echo "If you see data in the response above, your webhook is working!"
echo "If not, check the error message for troubleshooting."
