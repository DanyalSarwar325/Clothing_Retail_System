# Invoice PDF Processor Service

A FastAPI-based microservice for extracting tracking IDs from invoice PDFs using **PyPDF2**. Built for reliability and accuracy in the retail fulfillment system.

## Features

✅ **PyPDF2-powered extraction** - Reliability tested library for text extraction  
✅ **Multiple pattern matching** - Extracts various tracking ID formats (CPR, TRK, custom patterns)  
✅ **Robust validation** - Filters false positives with intelligent heuristics  
✅ **Debug information** - Detailed extraction analytics for troubleshooting  
✅ **CORS-enabled** - Ready for Next.js integration  
✅ **Error handling** - Comprehensive error messages and image PDF detection  
✅ **FastAPI + Swagger UI** - Interactive API documentation at `/docs`  

## Quick Start

### Prerequisites

- Python 3.8+
- pip

### Installation & Setup

#### On Windows:
```bash
cd services/invoice_pdf_service
run.bat
```

#### On Linux/Mac:
```bash
cd services/invoice_pdf_service
chmod +x run.sh
./run.sh
```

### Manual Setup

```bash
# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate.bat
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment config
copy .env.example .env

# Run the service
python main.py
```

The service will start on `http://127.0.0.1:8000`

## API Endpoints

### 1. Extract Tracking IDs

**POST** `/extract-tracking-ids`

Upload a PDF invoice and extract all tracking IDs.

**Request:**
```bash
curl -X POST "http://127.0.0.1:8000/extract-tracking-ids" \
  -F "file=@invoice.pdf"
```

**Response:**
```json
{
  "success": true,
  "tracking_ids": [
    "CPR-123456789",
    "TRK-987654321",
    "ABC123DEF456"
  ],
  "extracted_text": "Full text from PDF...",
  "text_length": 3456,
  "error": null,
  "debug": {
    "extraction_method": "pypdf2",
    "page_count": 3,
    "pattern_analysis": {
      "column": 2,
      "pattern_0": 2,
      "total_candidates": 25,
      "filtered_count": 23
    }
  }
}
```

### 2. Validate PDF

**POST** `/validate-pdf`

Check if PDF is readable and get extraction statistics without processing.

**Response:**
```json
{
  "valid": true,
  "file_name": "invoice.pdf",
  "file_size": 245678,
  "extraction_success": true,
  "text_length": 3456,
  "error": null,
  "sample_text": "First 500 chars...",
  "recommendations": [
    "PDF extraction successful. Ready for tracking ID processing."
  ]
}
```

### 3. Health Check

**GET** `/health`

```json
{
  "status": "healthy",
  "service": "Invoice PDF Processor",
  "version": "1.0.0"
}
```

## Integration with Next.js

### Option 1: Replace Existing Implementation (Recommended)

Update your `app/api/invoices/process-pdf/route.ts`:

```typescript
// app/api/invoices/process-pdf/route.ts
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/app/libs/dbConnect';
import InvoiceLog from '@/app/libs/models/invoiceLog';

const PDF_SERVICE_URL = process.env.PDF_SERVICE_URL || 'http://127.0.0.1:8000';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 });
    }

    // Forward to Python service
    const serviceFormData = new FormData();
    serviceFormData.append('file', file);

    const response = await fetch(`${PDF_SERVICE_URL}/extract-tracking-ids`, {
      method: 'POST',
      body: serviceFormData,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const pdfResult = await response.json();

    if (!pdfResult.success || pdfResult.tracking_ids.length === 0) {
      return NextResponse.json({
        error: pdfResult.error || 'No tracking IDs found in PDF',
        debug: pdfResult.debug,
      }, { status: 400 });
    }

    // Rest of your fulfillment logic...
    // Update orders, mark as paid, etc.
    const FulfillmentOrder = require('@/app/libs/models/fulfillmentOrder').default;
    
    const trackingIds = pdfResult.tracking_ids;
    let markedPaidCount = 0;
    let notFoundCount = 0;

    for (const trackingId of trackingIds) {
      try {
        const fulfillment = await FulfillmentOrder.findOne({
          'fulfillment.trackingNumber': trackingId,
        });

        if (fulfillment && fulfillment.fulfillment?.status?.toLowerCase() === 'delivered') {
          fulfillment.payment.status = 'paid';
          await fulfillment.save();
          markedPaidCount++;
        } else {
          notFoundCount++;
        }
      } catch (err) {
        console.error(`Error processing tracking ID ${trackingId}:`, err);
      }
    }

    // Save invoice log
    const invoiceLog = new InvoiceLog({
      fileName: file.name,
      fileSize: file.size,
      uploadedBy: 'admin',
      trackingIdsFound: trackingIds.length,
      trackingIds,
      parsingStatus: 'success',
      parsingMethod: 'pypdf2-service',
      processingSummary: {
        totalTracking: trackingIds.length,
        markedPaid: markedPaidCount,
        notFound: notFoundCount,
      },
    });
    await invoiceLog.save();

    return NextResponse.json({
      success: true,
      trackingIds,
      markedPaid: markedPaidCount,
      notFound: notFoundCount,
      message: `Successfully processed ${trackingIds.length} tracking IDs`,
    });

  } catch (error) {
    console.error('Error in PDF processing:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
```

### Option 2: Keep Both Services Running

Run the PDF service separately and call it from your Next.js app:

1. **Terminal 1** - Start Next.js:
```bash
npm run dev
```

2. **Terminal 2** - Start PDF Service:
```bash
cd services/invoice_pdf_service
./run.bat  # or run.sh on Linux/Mac
```

## Configuration

Edit `.env` file:

```env
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=production  # or development for auto-reloading
LOG_LEVEL=info
NEXT_APP_URL=http://localhost:3000
```

In Next.js app, set environment variable:

```env
# .env.local
PDF_SERVICE_URL=http://127.0.0.1:8000
```

## Supported Tracking ID Formats

The service automatically detect these formats:

- `CPR-123456789`
- `TRK-987654321`
- `TRACK-XXXXXX`
- `Tracking Number: ABC123DEF456`
- `Reference #: XYZ789`
- Any 8-30 character alphanumeric code in designated format columns

## Error Handling

### Common Issues

**1. "PDF appears to be image-based"**
- Your PDF is a scanned document
- **Solution**: Use an online PDF OCR converter first, then upload

**2. "PDF is encrypted"**
- PDF is password-protected
- **Solution**: Remove password protection in Adobe Reader

**3. "No tracking IDs found"**
- Tracking IDs not in recognized format
- **Check**: Add your format to `TRACKING_PATTERNS` in `pdf_processor.py`

### Debugging

Check the `debug` field in API response for detailed information:

```json
"debug": {
  "extraction_method": "pypdf2",
  "page_count": 5,
  "pattern_analysis": {
    "column": 3,
    "pattern_0": 2,
    "total_candidates": 25,
    "filtered_count": 20
  }
}
```

## Performance

- **File size limit**: 50MB
- **Text extraction**: < 1 second for typical invoices
- **Pattern matching**: < 500ms
- **Memory efficient**: Uses BytesIO for streaming PDF processing

## Troubleshooting

### Service won't start
```bash
# Check Python version
python --version  # Must be 3.8+

# Check dependencies
pip list | grep -i fastapi
pip list | grep -i pypdf2

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### CORS errors in Next.js
- Ensure `NEXT_APP_URL` in PDF service matches your Next.js URL
- Check that PDF service is running before Next.js makes requests

### Tracking IDs not extracted
- Check PDF is text-based (open in Adobe Reader and verify)
- Use `/validate-pdf` endpoint to diagnose
- Review sample text in response to see PDF content

## Development

### Adding Custom Tracking ID Formats

Edit `pdf_processor.py` - `TRACKING_PATTERNS` list:

```python
TRACKING_PATTERNS = [
    r'(?:Tracking\s+(?:Number|ID)[:\s]+)([A-Z0-9\-]{8,30})',
    r'YOUR_CUSTOM_PATTERN',  # Add here
]
```

### Logging

Set `LOG_LEVEL=debug` in `.env` for verbose output:

```
LOG_LEVEL=debug
```

## Dependencies

- **PyPDF2** - PDF text extraction (text-based PDFs)
- **FastAPI** - Modern web framework
- **Uvicorn** - ASGI server
- **Pydantic** - Data validation
- **Python-multipart** - File upload handling

## Production Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for:
- Docker containerization
- Heroku/Railway deployment
- Azure App Service setup
- Kubernetes deployment

## License

Same as parent retail project

## Support

For issues or feature requests, check:
1. Server logs: Enable `LOG_LEVEL=debug`
2. `/docs` endpoint for API testing
3. `/validate-pdf` for PDF diagnosis
