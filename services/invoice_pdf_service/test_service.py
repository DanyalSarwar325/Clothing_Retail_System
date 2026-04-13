"""
Test script for Invoice PDF Processor Service
"""

import requests
import sys
from pathlib import Path

# Configuration
SERVICE_URL = "http://127.0.0.1:8000"
TEST_PDF_PATH = None  # Path to your test PDF


def test_health():
    """Test health check endpoint"""
    print("\n✓ Testing Health Check...")
    response = requests.get(f"{SERVICE_URL}/health")
    print(f"  Status: {response.status_code}")
    print(f"  Response: {response.json()}")
    return response.status_code == 200


def test_extract_tracking_ids(pdf_path):
    """Test tracking ID extraction"""
    if not Path(pdf_path).exists():
        print(f"✗ Test PDF not found: {pdf_path}")
        return False
    
    print(f"\n✓ Testing Extract Tracking IDs with: {pdf_path}")
    
    with open(pdf_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(
            f"{SERVICE_URL}/extract-tracking-ids",
            files=files
        )
    
    print(f"  Status: {response.status_code}")
    result = response.json()
    
    print(f"  Success: {result.get('success')}")
    print(f"  Tracking IDs found: {len(result.get('tracking_ids', []))}")
    print(f"  Tracking IDs: {result.get('tracking_ids')}")
    print(f"  Text length: {result.get('text_length')}")
    
    if result.get('error'):
        print(f"  Error: {result.get('error')}")
    
    if result.get('debug'):
        print(f"  Debug: {result.get('debug')}")
    
    return response.status_code == 200


def test_validate_pdf(pdf_path):
    """Test PDF validation"""
    if not Path(pdf_path).exists():
        print(f"✗ Test PDF not found: {pdf_path}")
        return False
    
    print(f"\n✓ Testing PDF Validation with: {pdf_path}")
    
    with open(pdf_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(
            f"{SERVICE_URL}/validate-pdf",
            files=files
        )
    
    print(f"  Status: {response.status_code}")
    result = response.json()
    
    print(f"  Valid: {result.get('valid')}")
    print(f"  File size: {result.get('file_size')} bytes")
    print(f"  Text length: {result.get('text_length')}")
    print(f"  Recommendations: {result.get('recommendations')}")
    
    return response.status_code == 200


def main():
    """Run all tests"""
    print("=" * 50)
    print("Invoice PDF Processor Service - Test Suite")
    print("=" * 50)
    
    # Check if service is running
    try:
        response = requests.get(f"{SERVICE_URL}/health", timeout=2)
    except requests.exceptions.ConnectionError:
        print(f"✗ Cannot connect to service at {SERVICE_URL}")
        print(f"  Make sure the service is running:")
        print(f"  cd services/invoice_pdf_service")
        print(f"  ./run.sh  # or run.bat on Windows")
        return False
    
    # Test health check
    if not test_health():
        print("✗ Health check failed")
        return False
    
    # Test with sample PDF if provided
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
        
        if not test_validate_pdf(pdf_path):
            print("✗ PDF validation failed")
            return False
        
        if not test_extract_tracking_ids(pdf_path):
            print("✗ Tracking ID extraction failed")
            return False
        
        print("\n✓ All tests passed!")
        return True
    else:
        print("\n" + "=" * 50)
        print("Usage:")
        print("  python test_service.py /path/to/invoice.pdf")
        print("=" * 50)
        return True


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
