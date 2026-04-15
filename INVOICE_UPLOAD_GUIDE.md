# Invoice Upload Feature Implementation

## Overview
This feature adds invoice PDF upload capability to the order details page. When a user uploads an invoice PDF:

1. **PDF Processing**: The FastAPI service (`invoice_pdf_service`) extracts tracking IDs from the PDF
2. **Payment Status Update**: Tracking IDs marked as "Delivered" are matched to fulfillment orders
3. **Auto Payment**: Corresponding orders are automatically marked as "paid" in the system

## Architecture

### Components

#### 1. FastAPI Service (Backend)
- **Location**: `services/invoice_pdf_service/`
- **Endpoint**: `POST /extract-tracking-ids`
- **Function**: Extracts all tracking IDs from invoice PDF
- **Returns**: List of tracking IDs with processing details

#### 2. Next.js API Handler
- **Location**: `app/api/invoices/upload/route.ts` (NEW)
- **Endpoint**: `POST /api/invoices/upload`
- **Function**: 
  - Receives extracted tracking IDs from FastAPI
  - Maps tracking IDs to fulfillment orders
  - Updates payment status to "paid"
  - Logs the invoice processing

#### 3. UI Components
- **Location**: `app/admin/shopify-orders/page.tsx`
- **New Button**: "Upload Invoice" button in order details modal
- **New Modal**: Invoice upload interface with:
  - PDF file input with drag & drop
  - File validation
  - Processing progress indicator
  - Success/error feedback
  - Summary of updated orders

## Setup Instructions

### 1. Environment Configuration

Add the following to your `.env.local` file:

```bash
# FastAPI Service URL (invoice PDF processor)
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

**Notes:**
- For local development: `http://localhost:8000`
- For production: Update to your FastAPI service URL (e.g., `https://invoice-service.example.com`)
- The `NEXT_PUBLIC_` prefix makes it available in the browser (required for direct FastAPI calls)

### 2. FastAPI Service Setup

The FastAPI service is already created and configured. To run it:

```bash
cd services/invoice_pdf_service

# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
# or
uvicorn main:app --reload
```

The service will be available at `http://localhost:8000`

### 3. Database

The system uses an `InvoiceLog` model to track all uploads:

```typescript
// Fields:
- fileName: Name of uploaded invoice
- uploadedAt: Timestamp
- status: "processed"
- processing.trackingIdsFound: Count of IDs found
- processing.trackingIds: Array of all IDs
- processing.deliveredIds: Array of delivered IDs
- matchedOrders: List of updated orders
- failedMatches: List of unmatched tracking IDs
```

## Workflow

### User Journey

1. **User opens order details modal**
   - Clicks "Upload Invoice" button in order details

2. **User uploads PDF**
   - Selects a PDF invoice file
   - File is validated (must be PDF, < 50MB)
   - User clicks "Upload & Process"

3. **System processes invoice**
   - Frontend sends PDF to FastAPI service
   - FastAPI extracts tracking IDs from PDF
   - Frontend receives extracted tracking IDs
   - Frontend sends IDs to Next.js API handler
   - Handler matches IDs to fulfillment orders
   - Handler updates payment status to "paid"

4. **User sees results**
   - Success message showing:
     - Total tracking IDs found
     - Number of orders updated
     - List of updated orders
     - Any unmatched tracking IDs

### Payment Status Update Logic

```typescript
// For each delivered tracking ID:
1. Find fulfillment order with matching trackingNumber
2. Update order.payment.status = "paid"
3. Update order.updatedAt timestamp
4. Log the update in InvoiceLog

// Result:
- orderId: Shopify order ID
- orderNumber: Human-readable order number
- trackingId: The matching tracking ID
```

## Tracking ID Extraction

The FastAPI service uses the `PDFProcessor` class to:

1. **Extract text from PDF** using PyPDF2
2. **Apply pattern matching** to find tracking IDs
3. **Filter false positives** using keyword validation
4. **Return results** as a list of extracted IDs

### Patterns Recognized:
- 10-15 digit numeric tracking numbers
- Format: "Tracking Number: XXX"
- Format: "Reference ID: XXX"
- Format: "Order Number: XXX"
- Custom patterns for PostEx, TCS, Leopards, SendCo

## Files Modified/Created

### New Files:
- `app/api/invoices/upload/route.ts` - Invoice processing API
- `INVOICE_UPLOAD_GUIDE.md` - This documentation

### Modified Files:
- `app/admin/shopify-orders/page.tsx` - Added upload button and modal

### Database Models Used:
- `FulfillmentOrder` - Updated for payment status
- `InvoiceLog` - For tracking upload history

## Error Handling

### Validation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "File must be a PDF" | Wrong file format | Select a `.pdf` file |
| "File size exceeds 50MB" | File too large | Use a smaller PDF |
| "Empty file received" | File has no content | Check the PDF file |
| "No tracking IDs found" | PDF has no recognizable IDs | Verify invoice format |

### Matching Errors

- **"No matching fulfillment order found"**: Tracking ID doesn't exist in system
  - Check if the order was previously fulfilled
  - Verify tracking number format is correct
  - Contact support if order should exist

## Testing

### Test with Sample Data

1. Create a test fulfillment order with tracking number
2. Create a PDF invoice containing that tracking number
3. Upload the invoice
4. Verify order payment status changes to "paid"

### Manual Testing

```bash
# 1. Start FastAPI service
cd services/invoice_pdf_service
python main.py

# 2. Test PDF extraction
curl -X POST http://localhost:8000/extract-tracking-ids \
  -F "file=@test_invoice.pdf"

# 3. Check response
# Should return: { "success": true, "tracking_ids": [...] }
```

## Advanced Configuration

### Customize Tracking Patterns

Edit `services/invoice_pdf_service/pdf_processor.py`:

```python
TRACKING_PATTERNS = [
    # Add your custom regex patterns here
    r'your_custom_pattern_here',
]
```

### Customize Delivery Status Detection

Currently, all extracted tracking IDs are treated as "Delivered". To customize:

Edit `app/api/invoices/upload/route.ts`:

```typescript
// Add logic to detect delivery status from PDF content
const deliveredTrackingIds = trackingIds.filter(id => {
  // Your custom logic here
  return isDelivered(id, extractedText);
});
```

## Monitoring & Logging

### Application Logs

Check the Next.js console for invoice processing logs:

```
[Invoice Upload] Sending PDF to FastAPI service...
[Invoice Upload] Found 5 tracking IDs. Updating payment status...
[Invoice Upload] ✅ Updated order ABC123 (tracking: 123456789) to PAID
[Invoice Upload] Summary: Found 5 matching orders
```

### Database Logs

Query the `InvoiceLog` collection to see all uploads:

```javascript
db.invoicelogs.find({}).sort({ uploadedAt: -1 }).limit(10)
```

## Troubleshooting

### FastAPI Service Connection Failed

**Problem**: "Failed to fetch tracking IDs" error

**Solution**:
1. Verify FastAPI service is running
2. Check `NEXT_PUBLIC_FASTAPI_URL` environment variable
3. Verify CORS settings in FastAPI (`main.py`)
4. Check firewall/network connectivity

### No Matching Orders

**Problem**: All tracking IDs fail to match

**Solution**:
1. Verify fulfillment orders exist in database
2. Check if tracking numbers in PDF match database exactly
3. Look for typos or formatting differences
4. Review logs in both systems

### PDF Extraction Fails

**Problem**: "PDF appears to be image-based or encrypted"

**Solution**:
1. Ensure PDF is text-based, not scanned image
2. Remove any PDF encryption
3. Try exporting PDF in text format from source
4. Contact support if issue persists

## Future Enhancements

1. **Delivery Status Detection**: Parse PDF text to determine actual delivery status
2. **Batch Invoice Processing**: Support uploading multiple invoices at once
3. **Invoice Template Support**: Auto-detect common invoice formats (PostEx, TCS, etc.)
4. **Webhook Integration**: Receive delivery notifications directly from couriers
5. **Payment Reconciliation**: Automatically match platform payments to invoice uploads
6. **Invoice Storage**: Archive uploaded invoices in cloud storage

## API Reference

### Extract Tracking IDs (FastAPI)

**Endpoint**: `POST http://localhost:8000/extract-tracking-ids`

**Request**:
```bash
curl -X POST http://localhost:8000/extract-tracking-ids \
  -F "file=@invoice.pdf"
```

**Response**:
```json
{
  "success": true,
  "tracking_ids": ["123456789", "987654321"],
  "tracking_ids_count": 2,
  "extracted_text": "...",
  "text_length": 1500,
  "error": null,
  "debug": {}
}
```

### Process Invoice (Next.js API)

**Endpoint**: `POST /api/invoices/upload`

**Request**:
```json
{
  "trackingIds": ["123456789", "987654321"],
  "deliveredTrackingIds": ["123456789"],
  "invoiceFilename": "invoice.pdf",
  "extractedText": "...",
  "orderId": "order_mongo_id"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Processed invoice: 1 orders marked as paid",
  "summary": {
    "totalTrackingIds": 2,
    "deliveredTrackingIds": 1,
    "successfulUpdates": 1,
    "failedMatches": 1
  },
  "updatedOrders": [
    {
      "trackingId": "123456789",
      "orderId": "shopify_123",
      "orderNumber": "#12345",
      "status": "updated"
    }
  ],
  "failedMatches": [
    {
      "trackingId": "987654321",
      "reason": "No matching fulfillment order found"
    }
  ],
  "invoiceLogId": "mongo_id"
}
```

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs
3. Check FastAPI service logs
4. Verify database connectivity
