# System Architecture Diagram

## Payment Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CUTTING DEPARTMENT PAYMENT SYSTEM                    │
└─────────────────────────────────────────────────────────────────────────┘

                          ┌──────────────────────┐
                          │  BARCODE GENERATION  │
                          │   (Cutting Dept)     │
                          └──────────────┬───────┘
                                         │
                    ┌────────────────────▼──────────────────────┐
                    │  10 Barcodes Created                      │
                    │  design: "Wedding Suit"                   │
                    │  status: "generated"    ← NEW DEFAULT      │
                    │  currentDepartment: "Cutting"             │
                    └────────────────────┬──────────────────────┘
                                         │
                         ┌───────────────▼────────────────┐
                         │  Dashboard Check #1            │
                         │  Payment = ₨0                  │
                         │  (Nothing scanned yet)         │
                         └───────────────┬────────────────┘
                                         │
                    ┌────────────────────▼──────────────────────┐
                    │  PRODUCTS SENT TO SEWING                  │
                    │  Barcodes pasted on items                 │
                    │  8 out of 10 are used ✓                  │
                    │  2 unused, never pasted ✗                │
                    └────────────────────┬──────────────────────┘
                                         │
                         ┌───────────────▼────────────────┐
                         │  SEWING DEPARTMENT SCANNING    │
                         │  Scans 8 barcodes             │
                         └───────────────┬────────────────┘
                                         │
            ┌────────────────────────────▼────────────────────────────────┐
            │  FOR EACH SCANNED BARCODE                                   │
            ├─────────────────────────────────────────────────────────────┤
            │  OLD:  status stays "available"                             │
            │  NEW:  if status == "generated" → change to "scanned" ✓    │
            │                                                             │
            │  departmentHistory.push({                                   │
            │    department: "Sewing",                                    │
            │    scannedAt: Date.now(),                                  │
            │    scannedBy: "Fatima"                                     │
            │  })                                                         │
            └────────────────────┬──────────────────────────────────────┘
                                 │
                ┌────────────────▼──────────────────┐
                │  Barcode Status Update            │
                │  "generated" → "scanned" ✓       │
                │  Triggers Payment Recalc          │
                └────────────────┬───────────────────┘
                                 │
        ┌────────────────────────▼─────────────────────────────┐
        │  PAYMENT CALCULATION UPDATED                         │
        │  (/api/payment/pending - FOR CUTTING ONLY)          │
        │                                                      │
        │  Old Query:                                          │
        │  countDocuments({                                    │
        │    "departmentHistory.department": "Cutting"        │
        │  })                                                  │
        │                                                      │
        │  New Query: ← FILTERS BY STATUS                     │
        │  countDocuments({                                    │
        │    status: "scanned",        ← NEW FILTER           │
        │    "departmentHistory.department": "Cutting"        │
        │  })                                                  │
        └────────────────────┬─────────────────────────────────┘
                             │
                ┌────────────▼──────────────┐
                │  Dashboard Check #2       │
                │  Payment = 8 × Rate       │
                │  = 8 × ₨100 = ₨800 ✓    │
                │  (Only scanned items)     │
                └────────────────────────────┘

                UNUSED BARCODES (2)
                └─ status: "generated"
                └─ NOT counted in payment
                └─ Can be reprinted or discarded
```

---

## Data Flow Diagram

```
                            ┌─────────────────┐
                            │   Database      │
                            │   (Barcodes)    │
                            └────────┬────────┘
                                     │
                    ┌────────────────▼────────────────┐
                    │  Barcode Document               │
                    ├─────────────────────────────────┤
                    │ _id: ObjectId                   │
                    │ design: "Wedding Suit"          │
                    │ size: "S" / "M" / "L"           │
                    │ item: "Shalwar" / "Qameez"...   │
                    │ unitNumber: 1                   │
                    │ barcodeData: JSON string        │
                    │ status: "generated"  ← KEY      │
                    │ currentDepartment: "Cutting"    │
                    │ departmentHistory: [{           │
                    │   department: "Sewing",         │
                    │   scannedAt: Date,              │
                    │   scannedBy: "Fatima"           │
                    │ }]                              │
                    │ createdAt: Date                 │
                    │ scannedAt: Date                 │
                    └────────────────┬────────────────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
                ▼                    ▼                    ▼
        ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
        │ /api/payment/    │ │ /api/payment/    │ │ /api/payment/    │
        │ pending          │ │ pending/         │ │ department       │
        │                  │ │ by-design        │ │                  │
        │ Counts:          │ │                  │ │ Aggregates:      │
        │ status="scanned" │ │ Groups by        │ │ Total for Dept   │
        │ + by user        │ │ design +         │ │ + by user        │
        │                  │ │ counts scanned   │ │ + by status      │
        └──────────┬───────┘ └────────┬─────────┘ └────────┬─────────┘
                   │                  │                    │
                   └──────────────────┬────────────────────┘
                                      │
                ┌─────────────────────▼──────────────────────┐
                │  Calculate Payment                         │
                ├──────────────────────────────────────────────┤
                │  payment = scanCount × ratePerUnit          │
                │         = 8 × 100                           │
                │         = ₨800                              │
                │                                             │
                │  (Only "scanned" barcodes counted!)        │
                └─────────────────────┬──────────────────────┘
                                      │
                    ┌─────────────────▼──────────────┐
                    │  Dashboard Display             │
                    │  ┌──────────────────────────┐  │
                    │  │ Payment Pending         │  │
                    │  │ ₨800                    │  │
                    │  │ Total Scans: 8          │  │
                    │  │ Rate: ₨100/unit         │  │
                    │  └──────────────────────────┘  │
                    │  ┌──────────────────────────┐  │
                    │  │ Payment by Design        │  │
                    │  │ Wedding Suit: ₨800      │  │
                    │  │ Scans: 8                │  │
                    │  └──────────────────────────┘  │
                    └────────────────────────────────┘
```

---

## Status Transition Diagram

```
                        ┌─────────────────────┐
                        │  Barcode Created    │
                        │  (Cutting Prints)   │
                        └──────────┬──────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  status: "generated"         │
                    │  (Not paid yet)              │
                    │                              │
                    │  ✗ NOT counted in payment    │
                    │  ✗ Hidden from payment view  │
                    │  ✓ Can be scanned later      │
                    │  ✓ Can be reprinted          │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Sewing Scans Barcode       │
                    │  (Department: "Sewing")     │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  status: "scanned"           │
                    │  (Now eligible for payment)  │
                    │                              │
                    │  ✓ COUNTED in payment        │
                    │  ✓ Visible in payment view   │
                    │  ✓ Contributes to total      │
                    │  ✗ Cannot be re-scanned      │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │  Available for Next Steps    │
                    │  - Quality check             │
                    │  - Further processing        │
                    │  - Sale                      │
                    └────────────────────────────┘

        OTHER DEPARTMENTS' SCAN BEHAVIOR:
        ────────────────────────────────────

        Quality / Handmade / etc. scan:
        └─ Any status barcode can be scanned
        └─ Status doesn't change (for other depts)
        └─ Only Sewing changes "generated" to "scanned"
```

---

## API Endpoint Comparison

```
BEFORE IMPLEMENTATION:
═══════════════════════

Cutting generates 10 barcodes:
    Payment = countDocuments({
        "departmentHistory.department": "Cutting"
    })
    Count: 10 ← COUNTS ALL

Result: ₨1,000 (even if only 8 are used)


AFTER IMPLEMENTATION:
═════════════════════

Cutting generates 10 barcodes:
    Payment = countDocuments({
        status: "scanned",  ← NEW FILTER
        "departmentHistory.department": "Cutting"
    })
    Count: 0 (nothing scanned yet)

Result: ₨0 ✓ Correct!

After Sewing scans 8:
    Payment = countDocuments({
        status: "scanned",
        "departmentHistory.department": "Cutting"
    })
    Count: 8 ← ONLY SCANNED

Result: ₨800 ✓ Correct!
```

---

## System Behavior Matrix

```
┌─────────────────┬────────────┬────────────┬─────────────────┐
│ Scenario        │ Before     │ After      │ Status in DB    │
├─────────────────┼────────────┼────────────┼─────────────────┤
│ Generate 10     │ Pay: 1000  │ Pay: 0     │ generated × 10  │
│ barcodes        │            │            │                 │
├─────────────────┼────────────┼────────────┼─────────────────┤
│ Sewing scans 8  │ Pay: 1000  │ Pay: 800   │ scanned × 8     │
│                 │ (Wrong!)   │ (Correct!) │ generated × 2   │
├─────────────────┼────────────┼────────────┼─────────────────┤
│ Sewing scans    │ Pay: 1000  │ Pay: 1000  │ scanned × 10    │
│ remaining 2     │ (Same)     │ (Updated!) │                 │
├─────────────────┼────────────┼────────────┼─────────────────┤
│ Quality scans   │ Pay: 1000  │ Pay: 1000  │ (Quality can    │
│ all 10          │ (Works)    │ (Works)    │  scan any       │
│                 │            │            │  status)        │
└─────────────────┴────────────┴────────────┴─────────────────┘
```

---

## Payment Calculation Logic

```
For CUTTING Department Only:
═══════════════════════════════════════════════════════════════

QUERY FILTER:
┌────────────────────────────────────────────────────────────┐
│ db.barcodes.find({                                         │
│   status: "scanned",  ← Counts only confirmed items        │
│   departmentHistory: {                                      │
│     $elemMatch: {                                           │
│       department: "Cutting",  ← Scanned in cutting dept    │
│       scannedBy: "John"  ← By specific user                │
│     }                                                       │
│   }                                                         │
│ })                                                         │
└────────────────────────────────────────────────────────────┘

PAYMENT CALCULATION:
┌────────────────────────────────────────────────────────────┐
│ Step 1: Count scanned barcodes
│         scanCount = 8
│
│ Step 2: Get rate from database
│         ratePerUnit = 100
│
│ Step 3: Calculate payment
│         payment = scanCount × ratePerUnit
│                 = 8 × 100
│                 = 800
│
│ Step 4: Display in dashboard
│         pendingPayment = ₨800
│         totalScans = 8
└────────────────────────────────────────────────────────────┘

For OTHER Departments:
═════════════════════════════════════════════════════════════

QUERY FILTER (No change):
┌────────────────────────────────────────────────────────────┐
│ db.barcodes.find({                                         │
│   departmentHistory: {                                      │
│     $elemMatch: {                                           │
│       department: "Quality",  ← Any department             │
│       scannedBy: "Ahmed"  ← By specific user               │
│     }                                                       │
│   }                                                         │
│ })                                                         │
│ [No status filter - all statuses counted]                  │
└────────────────────────────────────────────────────────────┘
```

This ensures Cutting is paid fairly while other departments work normally!
