# Invoice Upload Feature - Quick Start

## What Was Built

A complete invoice upload system that:
1. ✅ Adds "Upload Invoice" button to order details modal
2. ✅ Accepts PDF invoice files
3. ✅ Calls FastAPI service to extract tracking IDs
4. ✅ Automatically marks matching orders as "paid"
5. ✅ Shows detailed results and error handling

## Files Created

### Backend API
- **`app/api/invoices/upload/route.ts`** - Processes extracted tracking IDs and updates payment status

### Frontend
- **Updated `app/admin/shopify-orders/page.tsx`** with:
  - Upload Invoice button in order details modal
  - Invoice upload modal with file handling
  - Integration with FastAPI service
  - Success/error feedback UI

### Documentation
- **`INVOICE_UPLOAD_GUIDE.md`** - Complete implementation guide
- **`.env.local.example`** - Environment configuration example

## Setup Steps

### Step 1: Environment Configuration
Create/update `.env.local` in your Next.js root directory:

```bash
NEXT_PUBLIC_FASTAPI_URL=http://localhost:8000
```

### Step 2: Start FastAPI Service (If Not Running)
```bash
cd services/invoice_pdf_service
pip install -r requirements.txt
python main.py
```

The service will be available at `http://localhost:8000`

### Step 3: Start Next.js Dev Server
```bash
npm run dev
```

### Step 4: Test the Feature
1. Navigate to Admin → Order Details (Fulfillment tab)
2. Click "Upload Invoice" button in order modal
3. Select a PDF invoice file
4. Click "Upload & Process"
5. See results of tracking ID extraction and payment status updates

## How It Works

### User Flow
```
1. User clicks "Upload Invoice" button
   ↓
2. Invoice Upload Modal opens
   ↓
3. User selects PDF file
   ↓
4. User clicks "Upload & Process"
   ↓
5. PDF sent to FastAPI service (/extract-tracking-ids)
   ↓
6. FastAPI extracts tracking IDs from PDF
   ↓
7. Frontend calls /api/invoices/upload with extracted IDs
   ↓
8. Backend matches tracking IDs to fulfillment orders
   ↓
9. Payment status updated to "paid" for matched orders
   ↓
10. Results displayed to user
```

### Data Flow

```
PDF Invoice
    ↓
FastAPI Service (port 8000)
    ├─ Extract text from PDF
    ├─ Apply pattern matching
    └─ Return list of tracking IDs
    ↓
Next.js Frontend
    ├─ Receive extracted tracking IDs
    ├─ Display confirmation
    └─ Call /api/invoices/upload
    ↓
Next.js Backend (/api/invoices/upload)
    ├─ Match tracking IDs to FulfillmentOrder records
    ├─ Update payment.status = "paid"
    ├─ Log in InvoiceLog collection
    └─ Return results to frontend
    ↓
MongoDB Database
    ├─ FulfillmentOrder updated
    └─ InvoiceLog created
```

## API Endpoints

### Existing (FastAPI)
- `POST /extract-tracking-ids` - Extract tracking IDs from PDF

### New (Next.js)
- `POST /api/invoices/upload` - Process extracted IDs and update payment status

## Key Features

### File Validation
- ✅ Only PDF files accepted
- ✅ Max file size: 50MB
- ✅ Empty file detection

### Processing
- ✅ Automatic tracking ID extraction
- ✅ Pattern matching for multiple formats
- ✅ False positive filtering
- ✅ Automatic order matching

### User Feedback
- ✅ Processing progress indicator
- ✅ Detailed success messages
- ✅ Clear error messages
- ✅ Summary of updated orders
- ✅ List of failed matches with reasons

### Data Logging
- ✅ All uploads logged in `InvoiceLog` collection
- ✅ Processing details saved
- ✅ Before/after payment status tracked

## Database Schema

### InvoiceLog Model (Updated)
```typescript
{
  fileName: String,
  uploadedAt: Date,
  status: String,
  processing: {
    trackingIdsFound: {
      total: Number,
      delivered: Number
    },
    trackingIds: [String],
    deliveredIds: [String]
  },
  textLength: Number,
  matchedOrders: {
    total: Number,
    updated: Number,
    details: [{
      trackingId: String,
      orderId: String,
      orderNumber: String,
      status: String
    }]
  },
  failedMatches: [{
    trackingId: String,
    reason: String
  }]
}
```

### FulfillmentOrder Model (Existing)
Used fields:
- `fulfillment.trackingNumber` - Matched against extracted tracking IDs
- `payment.status` - Updated to "paid" when match is found
- `updatedAt` - Set to current timestamp when updated

## Testing

### Test Scenario
1. Create a fulfillment order with a specific tracking number (e.g., "123456789")
2. Create a PDF invoice that contains this tracking number
3. Upload the invoice
4. Verify:
   - Tracking ID is extracted correctly
   - Order is matched by tracking number
   - Payment status changes to "paid"
   - Results show in success message

### Manual API Testing

Extract Tracking IDs:
```bash
curl -X POST http://localhost:8000/extract-tracking-ids \
  -F "file=@invoice.pdf"
```

Process Invoice:
```bash
curl -X POST http://localhost:3000/api/invoices/upload \
  -H "Content-Type: application/json" \
  -d '{
    "trackingIds": ["123456789"],
    "deliveredTrackingIds": ["123456789"],
    "invoiceFilename": "invoice.pdf",
    "extractedText": "...",
    "orderId": "order_id"
  }'
```

## Troubleshooting

### FastAPI Service Not Responding
**Error**: `Failed to fetch tracking IDs`

**Solution**:
1. Check if FastAPI is running: `http://localhost:8000/health`
2. Verify `NEXT_PUBLIC_FASTAPI_URL` in `.env.local`
3. Check firewall settings
4. Restart FastAPI service

### No Orders Updated
**Error**: All tracking IDs show "No matching fulfillment order"

**Solution**:
1. Verify fulfillment orders exist in database
2. Check if tracking numbers in PDF exactly match database values
3. Look for formatting issues (spaces, hyphens, case sensitivity)
4. Use MongoDB to verify data

### PDF Extraction Fails
**Error**: `PDF appears to be image-based or encrypted`

**Solution**:
1. Use text-based PDF (not scanned image)
2. Remove PDF password protection
3. Re-export PDF from source in text format
4. Try a different PDF file to test

## Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `NEXT_PUBLIC_FASTAPI_URL` | FastAPI service URL | `http://localhost:8000` |

## Performance Considerations

- **PDF Processing**: Large PDFs (10MB+) may take 5-10 seconds
- **Order Matching**: Database lookup is optimized with index on `fulfillment.trackingNumber`
- **Concurrency**: Multiple invoices can be processed simultaneously

## Security Notes

- ✅ PDF files validated before processing
- ✅ File size limited to 50MB
- ✅ CORS configured in FastAPI (see `main.py`)
- ✅ Input validation on all API endpoints
- ✅ Protected routes require admin role

## Next Steps

1. **Test with live data**: Upload an actual invoice from your system
2. **Customize patterns**: Add tracking ID patterns specific to your couriers
3. **Setup automation**: Consider webhook integration for automatic delivery updates
4. **Monitor logs**: Regularly check InvoiceLog for upload history
5. **Train staff**: Ensure users know how to use the upload feature

## Support Document

For detailed documentation, see: `INVOICE_UPLOAD_GUIDE.md`

## Quick Commands

Start FastAPI:
```bash
cd services/invoice_pdf_service && python main.py
```

Start Next.js:
```bash
npm run dev
```

Access Admin:
```
http://localhost:3000/admin/shopify-orders
```

Check Logs:
```javascript
// MongoDB terminal
db.invoicelogs.find({}).sort({ uploadedAt: -1 }).limit(5)
```
