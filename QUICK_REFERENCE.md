# Quick Reference: Cutting Department Payment System

## Problem Solved
Previously, Cutting department got paid for all generated barcodes. Now they only get paid for items actually scanned by Sewing department.

## Key Changes

| Aspect | Before | After |
|--------|--------|-------|
| **Barcode Status** | `available` | `generated` (when created), `scanned` (when sewing scans) |
| **Cutting Payment Count** | All cutting department scans | Only scans with status = `"scanned"` |
| **When Paid** | When barcodes are generated | When barcodes are scanned by sewing |
| **Unused Barcodes** | Count toward payment | NOT counted (hidden status remains `generated`) |

## Workflow Summary

```
Cutting generates → Status: "generated" → Not counted ✗
                        ↓
             Sewing scans barcode → Status: "scanned" → Now counted ✓
                        ↓
        Payment calculated on scanned count only
```

## API Endpoints Affected (Cutting Department Only)

| Endpoint | Impact |
|----------|--------|
| `/api/payment/pending` | Filters by `status = "scanned"` |
| `/api/payment/pending/by-design` | Filters by `status = "scanned"` |
| `/api/payment/department` | Filters by `status = "scanned"` |
| `/api/barcodes/scan` | Updates status: `generated` → `scanned` when Sewing scans |

## Other Departments
✅ **Quality, Sewing, Handmade, Adda Work, Patching, Press, Packing, Store**
- Continue working normally
- No status filtering applied
- Payment based on all scans

## Implementation Status
✅ Complete and ready to use!

## Files Changed
- `app/libs/models/barcode.ts` - Schema update
- `app/print-barcodes/page.tsx` - Default status to "generated"
- `app/api/barcodes/scan/route.tsx` - Status change logic
- `app/api/payment/pending/route.ts` - Filter by scanned
- `app/api/payment/pending/by-design/route.ts` - Filter by scanned
- `app/api/payment/department/route.ts` - Filter by scanned

## Example Numbers
```
Scenario: Cutting generates 10 barcodes for "Designer Suit"
Rate: ₨100 per unit

Before Implementation:
└─ Cutting gets paid: 10 × ₨100 = ₨1,000 (even if only 7 are used)

After Implementation:
├─ If Sewing scans 7: Cutting gets ₨700 ✓
├─ If Sewing scans 5: Cutting gets ₨500 ✓
└─ If Sewing scans 10: Cutting gets ₨1,000 ✓
```

## Testing
Just generate barcodes and scan them in sewing to test the payment calculation updates automatically!
