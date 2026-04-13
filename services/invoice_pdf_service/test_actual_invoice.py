#!/usr/bin/env python
"""Test extraction with the actual invoice text from the user's response"""

from pdf_processor import PDFProcessor

# Get a sample of the actual extracted text from the response
# Just testing with the first few tracking entries
actual_text = """
Orders
Tracking
NumberOrigin City SR.Shipping
ChargesUpfront
AmountCOD
AmountReserve
AmountNet
AmountStatusUpfront
ChargesDestination City GSTWH Inc.
Tax (2%)WH Sales
Tax  (2%)
22101030038062
0.99 kg 13/03/2026GUJRAT
Return 178.25 14,498.0004/04/2026 (D/R)0.00 0.00 (206.77) 1LAHORE CANTT
0.00 28.52 0.00 0.00
23101030038205
0.46 kg 06/03/2026QUETTA
Return 178.25 5,499.0004/04/2026 (D/R)0.00 0.00 (206.77) 2LAHORE CANTT
0.00 28.52 0.00 0.00
23101030038709
0.49 kg 12/03/2026Karachi
Return 178.25 6,999.0005/04/2026 (D/R)0.00 0.00 (206.77) 3LAHORE CANTT
0.00 28.52 0.00 0.00
"""

print("Testing with ACTUAL invoice text from your PDF...")
print(f"Text length: {len(actual_text)} characters")
print("\n" + "="*50)

# Test extraction
tracking_ids, candidates, debug_info = PDFProcessor.extract_tracking_ids(actual_text)

print(f"\nExtraction Results:")
print(f"✓ Tracking IDs found: {len(tracking_ids)}")
print(f"  IDs: {sorted(list(tracking_ids))}")
print(f"\n✓ All candidates: {len(candidates)}")
print(f"\n✓ Debug info:")
for key, value in debug_info.items():
    print(f"    {key}: {value}")

if len(tracking_ids) == 0:
    print("\n❌ NO TRACKING IDS FOUND - There may be an issue with extraction")
else:
    print(f"\n✅ SUCCESS - Found {len(tracking_ids)} tracking IDs!")
