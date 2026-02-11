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
    <div className="p-8 bg-white min-h-screen">
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
          🖨️ Print Final Stickers (50mm Roll)
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

      {/* Print Styles for 50mm Thermal Paper Roll */}
      <style jsx global>{`
        @media print {
          @page {
            size: 50mm auto;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .sticker-card {
            page-break-after: always;
            page-break-inside: avoid;
            page-break-before: auto;
            padding-top: 0 !important;
            padding-bottom: 3mm !important;
            margin: 0 !important;
            border: none !important;
            min-height: 70mm;
            height: 70mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
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

  return (
    <div className="sticker-card border-b-2 border-dashed border-gray-400 pb-4 mb-4 pt-4 text-center bg-white">
      <div className="bg-purple-600 text-white text-xs font-bold py-1 px-2 rounded mb-2 inline-block">
        FINAL STICKER
      </div>
      <img src={sticker.qr} alt="QR Code" className="w-40 h-40 mx-auto" />
      <div className="mt-2 space-y-1">
        <p className="text-sm font-bold text-gray-800" title={sticker.design}>
          {sticker.design}
        </p>
        <div className={`text-sm font-semibold py-1 px-2 rounded inline-block ${suitTypeColors[sticker.suitType]}`}>
          {sticker.suitType} Suit
        </div>
        <p className="text-sm text-gray-600">{sticker.size}</p>
        <p className="text-sm font-bold text-purple-600 bg-purple-50 rounded py-1">
          Unit #{sticker.unitNumber}
        </p>
        {sticker.sellingPrice > 0 && (
          <p className="text-sm font-bold text-green-700 bg-green-100 rounded py-1">
            PKR {sticker.sellingPrice.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
