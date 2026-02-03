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
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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

  return (
    <div className="p-8 bg-white min-h-screen">
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg">
          ❌ Error: {error}
        </div>
      )}

      <button
        onClick={() => window.print()}
        className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 mb-4"
      >
        🖨️ Print Barcodes
      </button>

      <div className="print:block">
        {barcodes.map((barcode, index) => (
          <div key={index} className="barcode-card border-b-2 border-dashed border-gray-400 pb-4 mb-4">
            <img src={barcode.qr} alt="QR Code" className="w-40 h-40 mx-auto" />
            <div className="mt-2 text-center">
              <p className="text-sm font-bold text-gray-800">{barcode.design}</p>
              <p className="text-sm text-gray-600">
                {barcode.suitType} | {barcode.size}
              </p>
              <p className="text-sm font-semibold text-blue-600">
                Unit #{barcode.unitNumber}
              </p>
              <p className="text-sm font-bold text-gray-900 bg-gray-100 rounded py-1">
                {barcode.item}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: 50mm auto;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .barcode-card {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
