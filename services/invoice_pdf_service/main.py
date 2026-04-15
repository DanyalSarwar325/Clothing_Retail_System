"""
FastAPI service for PDF invoice processing using PyPDF2
Reliable tracking ID extraction for retail fulfillment system
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging
import os
from dotenv import load_dotenv

from pdf_processor import PDFProcessor

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Invoice PDF Processor Service",
    description="FastAPI service for extracting tracking IDs from PDF invoices using PyPDF2",
    version="1.0.0"
)

# Configure CORS for Next.js integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        os.getenv("NEXT_APP_URL", "http://localhost:3000"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models
class TrackingDetail(BaseModel):
    """Detailed information about a single tracking ID"""
    id: str
    sequence: int
    line_number: int
    status: str
    context: str
    pattern_type: str


class TrackingIDResponse(BaseModel):
    success: bool
    tracking_ids: List[str]
    tracking_details: List[TrackingDetail] = []  # NEW: Detailed info
    tracking_ids_count: int = 0
    extracted_text: str = ""
    text_length: int
    error: Optional[str] = None
    debug: dict = {}


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Invoice PDF Processor",
        "version": "1.0.0"
    }


@app.post("/extract-tracking-ids", response_model=TrackingIDResponse)
async def extract_tracking_ids(file: UploadFile = File(...)):
    """
    Extract tracking IDs from invoice PDF
    
    Takes a PDF file and extracts all tracking IDs using PyPDF2 text extraction
    followed by intelligent pattern matching.
    
    Args:
        file: PDF file to process
        
    Returns:
        TrackingIDResponse with extracted tracking IDs and debug info
    """
    
    # Validate file
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400,
            detail="File must be a PDF. Received: " + file.filename
        )
    
    try:
        # Read file
        pdf_bytes = await file.read()
        
        if not pdf_bytes or len(pdf_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty file received")
        
        if len(pdf_bytes) > 50 * 1024 * 1024:  # 50MB limit
            raise HTTPException(status_code=413, detail="File size exceeds 50MB limit")
        
        logger.info(f"Processing PDF: {file.filename}, Size: {len(pdf_bytes)} bytes")
        
        # Process PDF
        result = PDFProcessor.process_pdf(pdf_bytes)
        
        logger.info(f"Extraction result: {len(result['tracking_ids'])} IDs found, Success: {result['success']}")
        
        return TrackingIDResponse(
            success=result['success'],
            tracking_ids=result['tracking_ids'],
            tracking_details=result.get('tracking_details', []),  # NEW: Include detailed info
            tracking_ids_count=len(result['tracking_ids']),
            extracted_text=result['extracted_text'],
            text_length=result['text_length'],
            error=result['error'],
            debug=result['debug']
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error processing PDF: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing PDF: {str(e)}"
        )


@app.post("/validate-pdf")
async def validate_pdf(file: UploadFile = File(...)):
    """
    Validate PDF and get extraction details without storing
    
    Args:
        file: PDF file to validate
        
    Returns:
        Validation details and extraction statistics
    """
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        pdf_bytes = await file.read()
        text, success, error_msg = PDFProcessor.extract_text_from_pdf(pdf_bytes)
        
        return {
            "valid": success,
            "file_name": file.filename,
            "file_size": len(pdf_bytes),
            "extraction_success": success,
            "text_length": len(text),
            "error": error_msg if error_msg else None,
            "sample_text": text[:500] if text else "",
            "recommendations": _get_recommendations(success, text)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/debug-extraction")
async def debug_extraction(file: UploadFile = File(...)):
    """
    Debug PDF extraction - returns raw text and processing details
    
    Args:
        file: PDF file to analyze
        
    Returns:
        Detailed extraction and pattern matching information
    """
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    try:
        pdf_bytes = await file.read()
        
        # Extract text
        text, success, error_msg = PDFProcessor.extract_text_from_pdf(pdf_bytes)
        
        if not success:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Extract tracking IDs to get debug info
        tracking_ids, candidates, debug_info = PDFProcessor.extract_tracking_ids(text)
        
        # Split text into lines for analysis
        lines = text.split('\n')
        
        # Find lines that might contain tracking numbers
        potential_tracking_lines = []
        for idx, line in enumerate(lines):
            if len(line.strip()) > 5 and any(x in line.upper() for x in ['TRACK', 'CPR', 'TRK', 'NUMBER', 'ID']):
                potential_tracking_lines.append({
                    'line_number': idx + 1,
                    'content': line[:200],
                    'length': len(line)
                })
        
        return {
            "success": success,
            "file_name": file.filename,
            "file_size": len(pdf_bytes),
            "text_length": len(text),
            "total_lines": len(lines),
            "extracted_tracking_ids": list(tracking_ids),
            "all_candidates_found": candidates,
            "candidates_count": len(candidates),
            "debug_info": debug_info,
            "potential_tracking_lines": potential_tracking_lines,
            "full_extracted_text": text,
            "first_1000_chars": text[:1000],
            "recommendations": [
                f"Found {len(tracking_ids)} valid tracking IDs",
                f"Found {len(candidates)} candidate codes during extraction",
                f"Filtered {debug_info.get('validation_filters', 0)} false positives",
                "Review 'potential_tracking_lines' to see lines with tracking-related keywords",
                "Check 'full_extracted_text' for raw PDF content"
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _get_recommendations(success: bool, text: str) -> List[str]:
    """Get recommendations based on extraction result"""
    recommendations = []
    
    if not success:
        recommendations.append("PDF may be image-based. Use OCR conversion tool.")
        recommendations.append("Ensure PDF is not encrypted or password-protected.")
        recommendations.append("Try opening the PDF in Adobe Reader to verify it's readable.")
    elif len(text) < 100:
        recommendations.append("PDF contains very little text. Check if content is visible.")
    else:
        recommendations.append("PDF extraction successful. Ready for tracking ID processing.")
    
    return recommendations


@app.get("/")
async def root():
    """Root endpoint with API documentation"""
    return {
        "name": "Invoice PDF Processor Service",
        "version": "1.0.0",
        "description": "Extract tracking IDs from invoice PDFs using PyPDF2",
        "endpoints": {
            "health": "/health",
            "extract_tracking_ids": "/extract-tracking-ids (POST)",
            "validate_pdf": "/validate-pdf (POST)",
            "docs": "/docs"
        },
        "usage": "POST a PDF file to /extract-tracking-ids to extract tracking IDs"
    }


# Error handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


if __name__ == "__main__":
    import uvicorn
    
    port = int(os.getenv("PORT", 8000))
    host = os.getenv("HOST", "127.0.0.1")
    
    logger.info(f"Starting Invoice PDF Processor Service on {host}:{port}")
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=os.getenv("ENVIRONMENT", "production") == "development"
    )
