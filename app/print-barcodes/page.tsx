"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";

const ITEMS = ["Shalwar", "Qameez", "Dupatta"] as const;

interface BarcodeData {
  qr: string;
  design: string;
  size: string;
  sizeCode: "S" | "M" | "L";
  item: string;
  unitNumber: number;
  barcodeData: string;
}

export default function PrintBarcodesPage() {
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
      const s = parseInt(searchParams.get("s") || "0");
      const m = parseInt(searchParams.get("m") || "0");
      const l = parseInt(searchParams.get("l") || "0");

      const codes: BarcodeData[] = [];

      // Generate barcodes for Small size
      for (let unit = 1; unit <= s; unit++) {
        for (const item of ITEMS) {
          const payload = { design, size: "S", item, unit };
          const barcodeDataStr = JSON.stringify(payload);
          const qr = await QRCode.toDataURL(barcodeDataStr);
          codes.push({ qr, design, size: "Small", sizeCode: "S", item, unitNumber: unit, barcodeData: barcodeDataStr });
        }
      }

      // Generate barcodes for Medium size
      for (let unit = 1; unit <= m; unit++) {
        for (const item of ITEMS) {
          const payload = { design, size: "M", item, unit };
          const barcodeDataStr = JSON.stringify(payload);
          const qr = await QRCode.toDataURL(barcodeDataStr);
          codes.push({ qr, design, size: "Medium", sizeCode: "M", item, unitNumber: unit, barcodeData: barcodeDataStr });
        }
      }

      // Generate barcodes for Large size
      for (let unit = 1; unit <= l; unit++) {
        for (const item of ITEMS) {
          const payload = { design, size: "L", item, unit };
          const barcodeDataStr = JSON.stringify(payload);
          const qr = await QRCode.toDataURL(barcodeDataStr);
          codes.push({ qr, design, size: "Large", sizeCode: "L", item, unitNumber: unit, barcodeData: barcodeDataStr });
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
            item: code.item,
            unitNumber: code.unitNumber,
            barcodeData: code.barcodeData,
            status: "generated", // Generated status - will become 'scanned' when sewing scans it
            currentDepartment: "Cutting", // Initial department
            departmentHistory: [{
              department: "Cutting",
              scannedAt: new Date().toISOString(),
            }],
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

  // Group barcodes by size
  const smallBarcodes = barcodes.filter((b) => b.size === "Small");
  const mediumBarcodes = barcodes.filter((b) => b.size === "Medium");
  const largeBarcodes = barcodes.filter((b) => b.size === "Large");

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

      {/* Print Header - Hidden on screen, visible on print */}
      <div className="print:block mb-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          Barcodes for Design: {searchParams.get("design")}
        </h1>
        <p className="text-center text-gray-600">
          Total: {barcodes.length} barcodes (Small: {smallBarcodes.length / 3}, Medium: {mediumBarcodes.length / 3}, Large: {largeBarcodes.length / 3} units)
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

      {/* Small Size Barcodes */}
      {smallBarcodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-blue-600 border-b pb-2">
            Small Size ({smallBarcodes.length / 3} units × 3 items = {smallBarcodes.length} barcodes)
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {smallBarcodes.map((barcode, i) => (
              <BarcodeCard key={`s-${i}`} barcode={barcode} />
            ))}
          </div>
        </div>
      )}

      {/* Medium Size Barcodes */}
      {mediumBarcodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-green-600 border-b pb-2">
            Medium Size ({mediumBarcodes.length / 3} units × 3 items = {mediumBarcodes.length} barcodes)
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {mediumBarcodes.map((barcode, i) => (
              <BarcodeCard key={`m-${i}`} barcode={barcode} />
            ))}
          </div>
        </div>
      )}

      {/* Large Size Barcodes */}
      {largeBarcodes.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 text-purple-600 border-b pb-2">
            Large Size ({largeBarcodes.length / 3} units × 3 items = {largeBarcodes.length} barcodes)
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {largeBarcodes.map((barcode, i) => (
              <BarcodeCard key={`l-${i}`} barcode={barcode} />
            ))}
          </div>
        </div>
      )}

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
        <p className="text-xs font-semibold text-blue-600">
          {barcode.size} - #{barcode.unitNumber}
        </p>
        <p className="text-sm font-bold text-gray-900 bg-gray-100 rounded py-1">
          {barcode.item}
        </p>
      </div>
    </div>
  );
}
