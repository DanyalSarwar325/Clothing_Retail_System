# Quick Start Checklist

Complete checklist to get the PyPDF2 Invoice Processing Service up and running.

## Pre-Installation

- [ ] Python 3.8+ installed (`python --version`)
- [ ] Node.js 16+ installed (via Next.js)
- [ ] PDF test file ready (invoice.pdf)
- [ ] Terminal/Command Prompt access
- [ ] Text editor for .env file

## Installation (Choose One)

### Quick Start (Windows)
```bash
cd services/invoice_pdf_service
run.bat
```
- [ ] Script executed without errors
- [ ] Service started on http://127.0.0.1:8000
- [ ] Virtual environment created
- [ ] Dependencies installed

### Quick Start (Linux/Mac)
```bash
cd services/invoice_pdf_service
chmod +x run.sh
./run.sh
```
- [ ] Script executed without errors
- [ ] Service started on http://127.0.0.1:8000
- [ ] Virtual environment created
- [ ] Dependencies installed

### Docker Option
```bash
cd services/invoice_pdf_service
docker-compose up -d
```
- [ ] Docker installed
- [ ] Container running
- [ ] Service accessible at http://127.0.0.1:8000

## Configuration

### Python Service (.env)
```env
HOST=127.0.0.1
PORT=8000
ENVIRONMENT=production
LOG_LEVEL=info
NEXT_APP_URL=http://localhost:3000
```
- [ ] .env file created from .env.example
- [ ] Configuration values verified

### Next.js App (.env.local)
```env
PDF_SERVICE_URL=http://127.0.0.1:8000
```
- [ ] PDF_SERVICE_URL added to .env.local
- [ ] Correct port number (8000)
- [ ] No trailing slash

## Service Testing

### Health Check
```bash
curl http://127.0.0.1:8000/health
```
- [ ] Returns {"status": "healthy", ...}
- [ ] Service is responsive
- [ ] Port 8000 is accessible

### Swagger Documentation
- [ ] http://127.0.0.1:8000/docs loads
- [ ] Interactive API documentation visible
- [ ] Endpoints listed and accessible

### Test PDF Extraction
```bash
curl -X POST "http://127.0.0.1:8000/extract-tracking-ids" \
  -F "file=@invoice.pdf"
```
- [ ] Request succeeds (status 200)
- [ ] Returns valid JSON response
- [ ] "tracking_ids" field visible
- [ ] Tracking IDs extracted correctly

## Integration

### Option A: Automatic (Recommended)
- [ ] Backup current: `cp app/api/invoices/process-pdf/route.ts route.ts.backup`
- [ ] Copy new route: `cp services/invoice_pdf_service/route-with-python-service.ts app/api/invoices/process-pdf/route.ts`
- [ ] Next.js app reloaded automatically
- [ ] No errors in Next.js console

### Option B: Manual Integration
- [ ] Review route-with-python-service.ts implementation
- [ ] Copy PDF service call logic to your route
- [ ] Update FormData and fetch handling
- [ ] Test with sample PDF

## Final Verification

### Both Services Running
Terminal 1 - Next.js:
```bash
npm run dev
```
- [ ] Server running on http://localhost:3000
- [ ] No errors in console

Terminal 2 - PDF Service:
```bash
cd services/invoice_pdf_service
./run.sh
```
- [ ] Service running on http://127.0.0.1:8000
- [ ] No errors in console

### End-to-End Test
1. Open http://localhost:3000
2. Navigate to Invoices section
3. Upload a test PDF invoice
4. Verify:
   - [ ] File uploaded successfully
   - [ ] Tracking IDs extracted
   - [ ] Orders marked as paid (if applicable)
   - [ ] No errors in console

### Network Communication
- [ ] Next.js → Python Service requests successful
- [ ] No CORS errors in browser console
- [ ] Response times reasonable (< 5 seconds)

## Production Setup

### Before Going Live
- [ ] Custom tracking ID patterns added if needed
- [ ] Error logging configured
- [ ] File size limits appropriate
- [ ] CORS settings reviewed

### Python Service Deployment
- [ ] Docker image built
- [ ] Environment variables set
- [ ] Health checks configured
- [ ] Logging enabled

### Next.js Deployment
- [ ] .env.production updated with production PDF_SERVICE_URL
- [ ] Build succeeds without warnings
- [ ] Deployment platform configured
- [ ] Environment variables applied

## Troubleshooting

### Service Won't Start
- [ ] Python 3.8+ verified
- [ ] pip install completed without errors
- [ ] requirements.txt available
- [ ] Port 8000 not in use

### CORS Errors
- [ ] NEXT_APP_URL set in Python .env
- [ ] Value matches http://localhost:3000
- [ ] Python service restarted
- [ ] Browser cache cleared

### PDF Extraction Issues
- [ ] Used /validate-pdf endpoint to diagnose
- [ ] PDF is text-based (not scanned)
- [ ] PDF not encrypted
- [ ] Tracking ID format matches patterns

### Integration Problems
- [ ] PDF_SERVICE_URL in Next.js .env.local
- [ ] Both services running
- [ ] No firewall blocking port 8000
- [ ] Network communication verified

## Daily Operations

### Monitoring
- [ ] Check /health endpoint regularly
- [ ] Monitor error logs
- [ ] Track processing times
- [ ] Monitor disk usage

### Maintenance
- [ ] Review logs for errors
- [ ] Update patterns if needed
- [ ] Test with new invoice formats
- [ ] Backup database regularly

### Support
- [ ] Reference /docs endpoint for API
- [ ] Use /validate-pdf for diagnosis
- [ ] Check INTEGRATION.md for issues
- [ ] Review logs with LOG_LEVEL=debug

---

**Status:** ☐ All items completed - Ready for production!
