#!/usr/bin/env python
"""Direct test of PDF extraction"""
import sys
sys.path.insert(0, 'c:\\Users\\DANYAL_SARWAR\\Desktop\\retail\\services\\invoice_pdf_service')

from pdf_processor import PDFProcessor

# Read and process PDF
with open('c:\\Users\\DANYAL_SARWAR\\Desktop\\retail\\public\\CPR-76A2X103799.pdf', 'rb') as f:
    pdf_bytes = f.read()

result = PDFProcessor.process_pdf(pdf_bytes)

print(f'Total Tracking IDs: {len(result["tracking_ids"])}')
print(f'Total Details: {len(result["tracking_details"])}')
print()

if result['tracking_details']:
    print('=== First 10 Tracking Details ===')
    for detail in result['tracking_details'][:10]:
        print(f"ID: {detail['id']:15} | Status: {detail['status']:15} | Line: {detail['line_number']:4}")
        print(f"  Context: {detail['context'][:70]}")
        print()

    print('=== Status Summary ===')
    status_counts = {}
    for detail in result['tracking_details']:
        status = detail['status']
        status_counts[status] = status_counts.get(status, 0) + 1

    for status, count in sorted(status_counts.items()):
        print(f'{status:15}: {count}')
else:
    print("No tracking details found!")
    print(f"Error: {result['error']}")
