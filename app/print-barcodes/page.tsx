"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";

// Items based on suit type
const SUIT_ITEMS: Record<string, string[]> = {
  "1pc": ["Qameez"],
  "2pc": ["Qameez", "Shalwar"],
  "3pc": ["Qameez", "Shalwar", "Dupatta"],
};

interface DepartmentRate {
  department: string;
  ratePerPiece: number;
  item?: string; // Optional: for item-based rates (Cutting, Sewing, Press)
}

interface BarcodeData {
  qr: string;
  design: string;
  size: string;
  sizeCode: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  item: string;
  unitNumber: number;
  barcodeData: string;
  departmentRates: DepartmentRate[];
}

export default function PrintBarcodesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-100 flex items-center justify-center"><p>Loading...</p></div>}>
      <PrintBarcodesContent />
    </Suspense>
  );
}

function PrintBarcodesContent() {
  const searchParams = useSearchParams();
  const [barcodes, setBarcodes] = useState<BarcodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const hasGeneratedRef = useRef(false);

  useEffect(() => {
    const generateAndSaveBarcodes = async () => {
      // Prevent duplicate generation using ref
      if (hasGeneratedRef.current) return;
      hasGeneratedRef.current = true;
      
      const design = searchParams.get("design") || "";
      
      // Get rates
      const ratesParam = searchParams.get("rates");
      const departmentRates: DepartmentRate[] = ratesParam 
        ? JSON.parse(ratesParam) 
        : [];

      // Get quantities for each size and suit type
      const quantities = {
        S: {
          "1pc": parseInt(searchParams.get("s1pc") || "0"),
          "2pc": parseInt(searchParams.get("s2pc") || "0"),
          "3pc": parseInt(searchParams.get("s3pc") || "0"),
        },
        M: {
          "1pc": parseInt(searchParams.get("m1pc") || "0"),
          "2pc": parseInt(searchParams.get("m2pc") || "0"),
          "3pc": parseInt(searchParams.get("m3pc") || "0"),
        },
        L: {
          "1pc": parseInt(searchParams.get("l1pc") || "0"),
          "2pc": parseInt(searchParams.get("l2pc") || "0"),
          "3pc": parseInt(searchParams.get("l3pc") || "0"),
        },
      };

      // Fallback for old format (backward compatibility)
      const oldS = parseInt(searchParams.get("s") || "0");
      const oldM = parseInt(searchParams.get("m") || "0");
      const oldL = parseInt(searchParams.get("l") || "0");
      
      if (oldS > 0 || oldM > 0 || oldL > 0) {
        quantities.S["3pc"] = oldS;
        quantities.M["3pc"] = oldM;
        quantities.L["3pc"] = oldL;
      }

      const codes: BarcodeData[] = [];
      const sizes = ["S", "M", "L"] as const;
      const suitTypes = ["1pc", "2pc", "3pc"] as const;
      const sizeLabels = { S: "Small", M: "Medium", L: "Large" };

      // Generate barcodes for each size and suit type
      for (const size of sizes) {
        for (const suitType of suitTypes) {
          const qty = quantities[size][suitType];
          if (qty === 0) continue;

          const items = SUIT_ITEMS[suitType];
          
          for (let unit = 1; unit <= qty; unit++) {
            for (const item of items) {
              const payload = { design, size, suitType, item, unit };
              const barcodeDataStr = JSON.stringify(payload);
              const qr = await QRCode.toDataURL(barcodeDataStr);
              codes.push({
                qr,
                design,
                size: sizeLabels[size],
                sizeCode: size,
                suitType,
                item,
                unitNumber: unit,
                barcodeData: barcodeDataStr,
                departmentRates,
              });
            }
          }
        }
      }

      setBarcodes(codes);
      setLoading(false);

      // Save barcodes to database
      if (codes.length > 0) {
        setSaving(true);
        try {
          const barcodesToSave = codes.map((code) => ({
            design: code.design,
            size: code.sizeCode,
            suitType: code.suitType,
            item: code.item,
            unitNumber: code.unitNumber,
            barcodeData: code.barcodeData,
            status: "generated",
            currentDepartment: "Admin",
            departmentHistory: [{
              department: "Admin",
              scannedAt: new Date().toISOString(),
              scannedBy: "Admin",
            }],
            departmentRates: code.departmentRates,
          }));

          const response = await fetch("/api/barcodes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ barcodes: barcodesToSave }),
          });

          const result = await response.json();

          if (result.success) {
            setSaved(true);
          } else {
            setError(result.message || "Failed to save barcodes");
          }
        } catch (err: any) {
          setError(err.message || "Failed to save barcodes to database");
        } finally {
          setSaving(false);
        }
      }
    };

    generateAndSaveBarcodes();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Generating Barcodes...</div>
      </div>
    );
  }

  // Group barcodes by size and suit type
  const groupedBarcodes = {
    Small: {
      "1pc": barcodes.filter((b) => b.size === "Small" && b.suitType === "1pc"),
      "2pc": barcodes.filter((b) => b.size === "Small" && b.suitType === "2pc"),
      "3pc": barcodes.filter((b) => b.size === "Small" && b.suitType === "3pc"),
    },
    Medium: {
      "1pc": barcodes.filter((b) => b.size === "Medium" && b.suitType === "1pc"),
      "2pc": barcodes.filter((b) => b.size === "Medium" && b.suitType === "2pc"),
      "3pc": barcodes.filter((b) => b.size === "Medium" && b.suitType === "3pc"),
    },
    Large: {
      "1pc": barcodes.filter((b) => b.size === "Large" && b.suitType === "1pc"),
      "2pc": barcodes.filter((b) => b.size === "Large" && b.suitType === "2pc"),
      "3pc": barcodes.filter((b) => b.size === "Large" && b.suitType === "3pc"),
    },
  };

  const sizeColors = {
    Small: "text-blue-600",
    Medium: "text-green-600",
    Large: "text-purple-600",
  };

  return (
    <div className="p-8 bg-white min-h-screen">
      {/* Status Banner */}
      {saving && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-800 rounded-lg print:hidden">
          ⏳ Saving barcodes to database...
        </div>
      )}
      {saved && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-800 rounded-lg print:hidden">
          ✅ {barcodes.length} barcodes saved to database successfully!
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg print:hidden">
          ❌ Error: {error}
        </div>
      )}

      {/* Print Header */}
      <div className="print:block mb-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          Barcodes for Design: {searchParams.get("design")}
        </h1>
        <p className="text-center text-gray-600">
          Total: {barcodes.length} barcodes
        </p>
      </div>

      {/* Action Buttons - Hidden on print */}
      <div className="flex gap-4 mb-8 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
        >
          🖨️ Print Barcodes
        </button>
        <button
          onClick={() => window.history.back()}
          className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
        >
          ← Go Back
        </button>
      </div>

      {/* Barcodes grouped by Size and Suit Type */}
      {(["Small", "Medium", "Large"] as const).map((size) => {
        const sizeGroup = groupedBarcodes[size];
        const totalForSize = sizeGroup["1pc"].length + sizeGroup["2pc"].length + sizeGroup["3pc"].length;
        
        if (totalForSize === 0) return null;

        return (
          <div key={size} className="mb-8">
            <h2 className={`text-xl font-bold mb-4 ${sizeColors[size]} border-b pb-2`}>
              {size} Size - {totalForSize} barcodes
            </h2>

            {(["1pc", "2pc", "3pc"] as const).map((suitType) => {
              const suitsOfType = sizeGroup[suitType];
              if (suitsOfType.length === 0) return null;

              const itemsPerSuit = suitType === "1pc" ? 1 : suitType === "2pc" ? 2 : 3;
              const unitCount = suitsOfType.length / itemsPerSuit;

              return (
                <div key={`${size}-${suitType}`} className="mb-6">
                  <h3 className="text-md font-semibold text-gray-700 mb-3 ml-2">
                    {suitType} Suits ({unitCount} units × {itemsPerSuit} items = {suitsOfType.length} barcodes)
                  </h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                    {suitsOfType.map((barcode, i) => (
                      <BarcodeCard key={`${size}-${suitType}-${i}`} barcode={barcode} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .barcode-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

function BarcodeCard({ barcode }: { barcode: BarcodeData }) {
  return (
    <div className="barcode-card border-2 border-gray-300 rounded-lg p-3 text-center bg-white shadow-sm">
      <img src={barcode.qr} alt="QR Code" className="w-24 h-24 mx-auto" />
      <div className="mt-2 space-y-1">
        <p className="text-xs font-bold text-gray-800 truncate" title={barcode.design}>
          {barcode.design}
        </p>
        <p className="text-xs text-gray-600">
          {barcode.suitType} | {barcode.size}
        </p>
        <p className="text-xs font-semibold text-blue-600">
          Unit #{barcode.unitNumber}
        </p>
        <p className="text-sm font-bold text-gray-900 bg-gray-100 rounded py-1">
          {barcode.item}
        </p>
      </div>
    </div>
  );
}
