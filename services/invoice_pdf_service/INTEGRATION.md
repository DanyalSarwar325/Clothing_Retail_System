# Integration Guide: PyPDF2 Invoice Processing Service

Complete step-by-step guide to integrate the Python PyPDF2 service with your Next.js retail application.

## Overview

You now have two services running in parallel:
- **Next.js App** (port 3000) - Frontend and API routes
- **Python PDF Service** (port 8000) - Reliable PDF text extraction using PyPDF2

The diagram below shows the architecture:

```
┌─────────────────────────────────────┐
│    Next.js Application              │
│  (Frontend + API Routes)            │
│         Port 3000                   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ /api/invoices/process-pdf    │   │
│  │ (Route Handler)              │   │
│  └──────────────┬───────────────┘   │
│                 │ HTTP POST          │
└─────────────────┼───────────────┘
                  │ FormData + PDF
                  ↓
┌─────────────────────────────────────┐
│   Python FastAPI Service            │
│      PyPDF2-Powered                 │
│         Port 8000                   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ /extract-tracking-ids        │   │
│  │ (PDF Processing)             │   │
│  └──────────────────────────────┘   │
│                                     │
│  ✓ PyPDF2 Text Extraction           │
│  ✓ Pattern Matching                 │
│  ✓ Validation & Filtering           │
└─────────────────────────────────────┘
```

## Step 1: Start the Python PDF Service

### Option A: Using Batch Script (Windows)

```bash
cd services/invoice_pdf_service
run.bat
```

### Option B: Using Shell Script (Linux/Mac)

```bash
cd services/invoice_pdf_service
chmod +x run.sh
./run.sh
```

### Option C: Using Docker

```bash
cd services/invoice_pdf_service
docker-compose up -d
```

**Expected output:**
```
Starting Invoice PDF Processor Service
Service will be available at: http://127.0.0.1:8000
API Documentation: http://127.0.0.1:8000/docs
```

### Verify Service is Running

Open in browser: http://127.0.0.1:8000/docs

You should see the interactive Swagger API documentation.

## Step 2: Configure Next.js Environment

### Add Environment Variable

Edit `.env.local` in your Next.js root:

```env
# Invoice PDF Processing Service
PDF_SERVICE_URL=http://127.0.0.1:8000
```

For production deployment:
```env
PDF_SERVICE_URL=https://your-pdf-service.com
```

## Step 3: Replace the Invoice Route

### Current Implementation
Your current route is at: `app/api/invoices/process-pdf/route.ts`

It uses the Node.js `pdf-parse` library which has extraction issues.

### New Implementation

A reference implementation is provided at:
`services/invoice_pdf_service/route-with-python-service.ts`

### How to Update

**Option A: Full Replacement (Recommended)**

1. Backup current file:
```bash
cp app/api/invoices/process-pdf/route.ts app/api/invoices/process-pdf/route.ts.backup
```

2. Copy reference implementation:
```bash
# Windows
copy services\invoice_pdf_service\route-with-python-service.ts app\api\invoices\process-pdf\route.ts

# Linux/Mac
cp services/invoice_pdf_service/route-with-python-service.ts app/api/invoices/process-pdf/route.ts
```

**Option B: Manual Update**

Replace the method that extracts tracking IDs. Key changes:

```typescript
// OLD (Node.js only):
const pdfParse = require('pdf-parse');
const pdfData = await pdfParse(fileBuffer);
extractedText = pdfData.text;

// NEW (Call Python service):
const pdfFormData = new FormData();
pdfFormData.append('file', file);

const pdfResponse = await fetch(`${PDF_SERVICE_URL}/extract-tracking-ids`, {
  method: 'POST',
  body: pdfFormData,
});

const pdfResult = await pdfResponse.json();
const trackingIds = pdfResult.tracking_ids;
```

## Step 4: Run Both Services

### Terminal 1: Start Next.js App
```bash
npm run dev
```

Expected output:
```
  ▲ Next.js 16.1.1
  - Local:        http://localhost:3000
✓ Ready in 2.5s
```

### Terminal 2: Start PDF Service

```bash
cd services/invoice_pdf_service
./run.sh  # or run.bat on Windows
```

Expected output:
```
Starting Invoice PDF Processor Service
Service will be available at: http://127.0.0.1:8000
API Documentation: http://127.0.0.1:8000/docs
```

Both services are now running and ready to process invoices!

## Step 5: Test the Integration

### Using Swagger UI

1. Open http://127.0.0.1:8000/docs
2. Click "Try it out" on `/extract-tracking-ids`
3. Upload a test PDF invoice
4. Review extracted tracking IDs

### Using Your Next.js App

1. Open http://localhost:3000
2. Navigate to Invoices section
3. Upload a PDF invoice
4. See tracking IDs extracted and orders updated

### Using curl (Command Line)

```bash
# Test the PDF service directly
curl -X POST "http://127.0.0.1:8000/extract-tracking-ids" \
  -F "file=@invoice.pdf"

# Response:
{
  "success": true,
  "tracking_ids": [
    "CPR-123456789",
    "TRK-987654321"
  ],
  "extracted_text": "...full text...",
  "text_length": 3456,
  "debug": {...}
}
```

## Step 6: Remove Old Dependencies (Optional)

Once confirmed working, remove the old PDF libraries:

```bash
npm uninstall pdf-parse pdfjs-dist
```

Update `package.json` to verify they're removed.

## Troubleshooting

### Problem: "PDF processing service is not available"

**Solution:** Make sure Python service is running
```bash
cd services/invoice_pdf_service
./run.sh
```

### Problem: CORS error in browser console

**Solution:** Python service is running but CORS not configured correctly
- Check `.env` file has `NEXT_APP_URL=http://localhost:3000`
- Restart PDF service: `./run.sh`

### Problem: "Invalid PDF" or extraction fails

**Solution:** PDF might be image-based (scanned)
- Use Swagger UI: http://127.0.0.1:8000/docs
- Try `/validate-pdf` endpoint to diagnose
- Check sample text in debug output

### Problem: Tracking IDs not matching in database

**Solution:** May need to adjust tracking ID patterns
- Edit `services/invoice_pdf_service/pdf_processor.py`
- Modify `TRACKING_PATTERNS` list
- Restart service

### Problem: High memory usage with large PDFs

**Solution:** Python service has 50MB file limit
- Adjust in `main.py` if needed
- Split large PDFs before upload

## Performance Monitoring

### View Logs

**Python Service:**
```bash
# If running directly (not Docker)
Logs appear in the terminal where you ran run.sh
```

If running with Docker:
```bash
docker logs invoice-pdf-service -f
```

**Next.js App:**
Check browser console and server console output

### Check Service Health

```bash
curl http://127.0.0.1:8000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "Invoice PDF Processor",
  "version": "1.0.0"
}
```

## Production Deployment

### Option 1: Deploy Both Services Separately

**Python Service:**
- Heroku: See [Heroku Deployment](DEPLOYMENT.md#heroku)
- Docker: Push to Docker Hub/Registry
- Railway.app: Automatic from GitHub
- Azure: App Service with Python

**Next.js App:**
- Vercel (recommended)
- Deploy using existing setup
- Update `PDF_SERVICE_URL` to production URL

### Option 2: Containerized Deployment

```bash
# Build and push Docker image
docker build -t your-registry/invoice-pdf-service services/invoice_pdf_service/
docker push your-registry/invoice-pdf-service

# Deploy with docker-compose or Kubernetes
```

### Environment Variables for Production

**Next.js (.env.production):**
```env
PDF_SERVICE_URL=https://your-pdf-service.com
```

**Python Service (.env):**
```env
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=production
LOG_LEVEL=info
NEXT_APP_URL=https://your-nextjs-app.com
```

## Advanced Configuration

### Custom Tracking ID Patterns

Edit `services/invoice_pdf_service/pdf_processor.py`:

```python
TRACKING_PATTERNS = [
    r'(?:Tracking\s+Number[:\s]+)([A-Z0-9\-]{8,30})',
    # Add your custom pattern:
    r'(?:Your-Pattern[:\s]+)([A-Z0-9\-]{8,30})',
]
```

Restart service for changes to take effect.

### Increase File Size Limit

In `main.py`, modify:
```python
if len(pdf_bytes) > 50 * 1024 * 1024:  # 50MB limit
```

### Enable Debug Logging

In `.env`:
```env
LOG_LEVEL=debug
```

## Support & Issues

1. **Service won't start**: Check Python 3.8+ is installed
2. **CORS errors**: Verify `NEXT_APP_URL` environment variable
3. **Tracking IDs not extracted**: Use `/validate-pdf` endpoint
4. **Need help?** Check `/docs` endpoint for API testing

## Next Steps

- Test with production invoice samples
- Customize tracking ID patterns if needed
- Set up error logging/monitoring
- Configure production deployment
- Load test with expected volume

---

For detailed API documentation, visit: http://127.0.0.1:8000/docs
