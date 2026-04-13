#!/usr/bin/env python
"""Quick test of the PDF extraction logic"""

from pdf_processor import PDFProcessor
import re

# Sample text containing tracking numbers like the PostEx invoice
sample_text = """
22101030038062
0.99 kg 13/03/2026GUJRAT

23101030038205
0.46 kg 06/03/2026QUETTA

23101030038709
0.49 kg 12/03/2026Karachi
"""

print("Testing extraction with sample PostEx-format text...")
print("Sample text:")
print(sample_text)
print("\n" + "="*50)

# Test Method 0 pattern directly
table_row_pattern = r'(\d{10,15})\s*\n\s*[\d.]+\s*kg'
matches = re.findall(table_row_pattern, sample_text, re.MULTILINE)
print(f"\nMethod 0 (table_row_pattern) matches: {matches}")

# Test numeric pattern directly  
numeric_pattern = r'(\d{10,15})'
matches = re.findall(numeric_pattern, sample_text)
print(f"Numeric pattern matches: {matches}")

# Test the actual extraction method
tracking_ids, candidates, debug_info = PDFProcessor.extract_tracking_ids(sample_text)
print(f"\nFull extraction results:")
print(f"Tracking IDs found: {tracking_ids}")
print(f"All candidates: {candidates}")
print(f"Debug info: {debug_info}")
