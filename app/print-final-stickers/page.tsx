"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";

interface FinalStickerData {
  qr: string;
  design: string;
  size: string;
  sizeCode: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  unitNumber: number;
  totalStickers: number;
  sellingPrice: number;
  barcodeData: string;
}

function PrintFinalStickersContent() {
  const searchParams = useSearchParams();
  const [stickers, setStickers] = useState<FinalStickerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const design = searchParams.get("design");

  useEffect(() => {
    const loadStickers = async () => {
      if (!design) {
        setError("Design parameter is required");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch(`/api/final-stickers?design=${encodeURIComponent(design)}`);
        const data = await response.json();

        if (!data.success) {
          setError(data.message || "Failed to fetch stickers");
          setLoading(false);
          return;
        }

        const sizeLabels: Record<string, string> = { S: "Small", M: "Medium", L: "Large" };

        const totalStickers = data.stickers.length;

        // Generate QR codes for each sticker
        const stickersWithQR: FinalStickerData[] = await Promise.all(
          data.stickers.map(async (sticker: any) => {
            const qr = await QRCode.toDataURL(sticker.barcodeData);
            return {
              qr,
              design: sticker.design as string,
              size: sizeLabels[sticker.size] || sticker.size,
              sizeCode: sticker.size,
              suitType: sticker.suitType,
              unitNumber: sticker.unitNumber,
              totalStickers,
              sellingPrice: sticker.sellingPrice || 0,
              barcodeData: sticker.barcodeData,
            } as FinalStickerData;
          })
        );

        setStickers(stickersWithQR);
      } catch (err: any) {
        setError(err.message || "Failed to load stickers");
      } finally {
        setLoading(false);
      }
    };

    loadStickers();
  }, [design]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading Final Stickers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">Error: {error}</div>
          <button
            onClick={() => window.history.back()}
            className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  // Group stickers by size and suit type
  const groupedStickers = {
    Small: {
      "1pc": stickers.filter((s) => s.size === "Small" && s.suitType === "1pc"),
      "2pc": stickers.filter((s) => s.size === "Small" && s.suitType === "2pc"),
      "3pc": stickers.filter((s) => s.size === "Small" && s.suitType === "3pc"),
    },
    Medium: {
      "1pc": stickers.filter((s) => s.size === "Medium" && s.suitType === "1pc"),
      "2pc": stickers.filter((s) => s.size === "Medium" && s.suitType === "2pc"),
      "3pc": stickers.filter((s) => s.size === "Medium" && s.suitType === "3pc"),
    },
    Large: {
      "1pc": stickers.filter((s) => s.size === "Large" && s.suitType === "1pc"),
      "2pc": stickers.filter((s) => s.size === "Large" && s.suitType === "2pc"),
      "3pc": stickers.filter((s) => s.size === "Large" && s.suitType === "3pc"),
    },
  };

  const sizeColors = {
    Small: "text-blue-600",
    Medium: "text-green-600",
    Large: "text-purple-600",
  };

  return (
    <div className="p-8 print:p-0 bg-white min-h-screen">
      {/* Print Header - Hidden on print */}
      <div className="print:hidden mb-8">
        <h1 className="text-2xl font-bold text-center mb-2">
          Final Stickers for Design: {design}
        </h1>
        <p className="text-center text-gray-600">
          Total: {stickers.length} stickers (Complete Suits)
        </p>
      </div>

      {/* Action Buttons - Hidden on print */}
      <div className="flex gap-4 mb-8 print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
        >
          🖨️ Print Final Stickers (3cm × 5cm)
        </button>
        <button
          onClick={() => window.history.back()}
          className="bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-700"
        >
          ← Go Back
        </button>
      </div>

      {/* Stickers printed sequentially for 50mm thermal roll */}
      <div className="print:block">
        {stickers.map((sticker, index) => (
          <FinalStickerCard key={index} sticker={sticker} />
        ))}
      </div>

      {/* Print Styles for 30mm x 50mm Individual Paper Sheets */}
      <style jsx global>{`
        @media print {
          @page {
            size: 30mm 50mm;
            margin: 1mm;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 6pt !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .sticker-card {
            page-break-after: always;
            page-break-inside: avoid;
            page-break-before: auto;
            padding: 0mm !important;
            margin: 0 !important;
            border: none !important;
            width: 28mm;
            height: 48mm;
            max-height: 48mm;
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0;
          }
          .sticker-card .sticker-header {
            font-size: 5pt !important;
            padding: 0.5mm 1mm !important;
            margin-bottom: 0.5mm !important;
          }
          .sticker-card .sticker-qr {
            width: 18mm !important;
            height: 18mm !important;
          }
          .sticker-card .sticker-info {
            gap: 0 !important;
          }
          .sticker-card .sticker-info p,
          .sticker-card .sticker-info div {
            font-size: 5.5pt !important;
            padding: 0.3mm 1mm !important;
            margin: 0 !important;
            line-height: 1.2 !important;
          }
          .sticker-card .sticker-design {
            font-size: 5.5pt !important;
            max-width: 26mm;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .sticker-card .sticker-price {
            font-size: 6pt !important;
            font-weight: bold !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function PrintFinalStickersPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading Final Stickers...</div>
      </div>
    }>
      <PrintFinalStickersContent />
    </Suspense>
  );
}

function FinalStickerCard({ sticker }: { sticker: FinalStickerData }) {
  const suitTypeColors = {
    "1pc": "bg-blue-100 text-blue-800",
    "2pc": "bg-green-100 text-green-800",
    "3pc": "bg-purple-100 text-purple-800",
  };

  const suitItems: Record<string, string> = {
    "1pc": "Qameez",
    "2pc": "Qameez + Shalwar",
    "3pc": "Qameez + Shalwar + Dupatta",
  };

  return (
    <div className="sticker-card border-b-2 border-dashed border-gray-400 pb-3 mb-3 pt-2 text-center bg-white">
      <div className="sticker-header bg-purple-600 text-white text-[7px] font-bold py-0.5 px-1.5 rounded mb-1 inline-block">
        FINAL STICKER
      </div>
      <img src={sticker.qr} alt="QR Code" className="sticker-qr w-24 h-24 mx-auto" />
      <div className="sticker-info mt-1 space-y-0.5">
        <p className="sticker-design text-[8px] font-bold text-gray-800 truncate max-w-[28mm]" title={sticker.design}>
          {sticker.design}
        </p>
        <div className={`text-[7px] font-semibold py-0.5 px-1 rounded inline-block ${suitTypeColors[sticker.suitType]}`}>
          {sticker.suitType} | {sticker.sizeCode}
        </div>
        <p className="text-[6px] text-gray-500">
          {suitItems[sticker.suitType]}
        </p>
        <p className="text-[7px] font-bold text-purple-600 bg-purple-50 rounded py-0.5">
          {sticker.unitNumber}/{sticker.totalStickers}
        </p>
        {sticker.sellingPrice > 0 && (
          <p className="sticker-price text-[8px] font-bold text-green-700 bg-green-100 rounded py-0.5">
            PKR {sticker.sellingPrice.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
