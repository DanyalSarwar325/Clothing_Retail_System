"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";
import { ShieldCheck, AlertTriangle, Printer, ArrowLeft } from "lucide-react";

interface FinalStickerData {
  qr: string;
  design: string;
  size: string;
  sizeCode: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  category: "A" | "B";
  categoryLabel: string;
  isDefective: boolean;
  defectSummary?: string;
  unitNumber: number;
  totalStickers: number;
  sellingPrice: number;
  barcodeData: string;
}

function PrintFinalStickersContent() {
  const searchParams = useSearchParams();
  const [stickers, setStickers] = useState<FinalStickerData[]>([]);
  const [filterCategory, setFilterCategory] = useState<"ALL" | "A" | "B">("ALL");
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
              category: sticker.category || "A",
              categoryLabel: sticker.categoryLabel || (sticker.category === "B" ? "Category B - Defective" : "Category A - OK Quality"),
              isDefective: sticker.isDefective || sticker.category === "B",
              defectSummary: sticker.defectSummary,
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
        <div className="text-sm font-semibold text-gray-700 animate-pulse">Loading Final Stickers...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-6 bg-red-50 rounded-2xl border border-red-200">
          <div className="text-red-700 text-sm font-bold mb-4">Error: {error}</div>
          <button
            onClick={() => window.history.back()}
            className="bg-gray-800 text-white px-5 py-2 rounded-xl text-xs font-bold hover:bg-gray-900 transition"
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const categoryACount = stickers.filter((s) => s.category === "A").length;
  const categoryBCount = stickers.filter((s) => s.category === "B").length;

  // Filter stickers based on selected tab (ALL, Category A, or Category B)
  const displayedStickers =
    filterCategory === "ALL"
      ? stickers
      : stickers.filter((s) => s.category === filterCategory);

  return (
    <div className="p-8 print:p-0 bg-white min-h-screen">
      {/* Print Header - Hidden on print */}
      <div className="print:hidden mb-6 max-w-3xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-xl font-black text-gray-900">
              Final Stickers: {design}
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Total <strong>{stickers.length}</strong> suits • Grouped by Category A then Category B
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.history.back()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={() => window.print()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer size={15} /> Print {displayedStickers.length} Stickers (25×50mm)
            </button>
          </div>
        </div>

        {/* Category breakdown stats & print filters */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-xl">
          <span className="text-xs font-bold text-gray-600 mr-1">Filter Print View:</span>
          <button
            onClick={() => setFilterCategory("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              filterCategory === "ALL"
                ? "bg-purple-600 text-white shadow-2xs"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
            }`}
          >
            All Stickers ({stickers.length})
          </button>
          <button
            onClick={() => setFilterCategory("A")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              filterCategory === "A"
                ? "bg-emerald-600 text-white shadow-2xs"
                : "bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50"
            }`}
          >
            <ShieldCheck size={14} />
            Cat A • OK Quality ({categoryACount})
          </button>
          <button
            onClick={() => setFilterCategory("B")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              filterCategory === "B"
                ? "bg-amber-600 text-white shadow-2xs"
                : "bg-white text-amber-800 border border-amber-200 hover:bg-amber-50"
            }`}
          >
            <AlertTriangle size={14} />
            Cat B • Defective ({categoryBCount})
          </button>
        </div>
      </div>

      {/* Stickers printed sequentially for 50mm thermal roll */}
      <div className="print:block max-w-xs mx-auto">
        {displayedStickers.map((sticker, index) => (
          <FinalStickerCard key={index} sticker={sticker} />
        ))}
      </div>

      {/* Print Styles for 25mm x 50mm paper loaded in LANDSCAPE (50mm wide x 25mm tall in printer) */}
      <style jsx global>{`
        @media print {
          @page {
            size: 50mm 25mm;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 5pt !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .sticker-card {
            page-break-inside: avoid;
            page-break-before: auto;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            width: 50mm;
            height: 25mm;
            max-height: 25mm;
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: center;
            gap: 0;
          }
          .sticker-card .sticker-header {
            font-size: 4pt !important;
            padding: 0.2mm 0.5mm !important;
            margin-bottom: 0.2mm !important;
            margin-left: 0 !important;
          }
          .sticker-card .sticker-qr {
            width: 19mm !important;
            height: 19mm !important;
            min-width: 19mm !important;
            margin: 0 !important;
            display: block !important;
          }
          .sticker-card .sticker-info {
            gap: 0 !important;
            text-align: center !important;
            width: auto;
            flex: 1;
            margin-left: 0 !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
          }
          .sticker-card .sticker-info p,
          .sticker-card .sticker-info div {
            font-size: 4.5pt !important;
            padding: 0.1mm 0.3mm !important;
            margin: 0 auto !important;
            line-height: 1.1 !important;
            text-align: center !important;
          }
          .sticker-card .sticker-design {
            font-size: 5pt !important;
            max-width: 26mm;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .sticker-card .sticker-price {
            font-size: 5pt !important;
            font-weight: bold !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function PrintFinalStickersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-sm font-semibold text-gray-600">Loading Final Stickers...</div>
        </div>
      }
    >
      <PrintFinalStickersContent />
    </Suspense>
  );
}

function FinalStickerCard({ sticker }: { sticker: FinalStickerData }) {
  const suitItems: Record<string, string> = {
    "1pc": "Qameez",
    "2pc": "Qameez + Shalwar",
    "3pc": "Qameez + Shalwar + Dupatta",
  };

  const isCatB = sticker.category === "B";

  return (
    <div
      className={`sticker-card border-b-2 border-dashed border-gray-400 pb-3 mb-3 pt-2 bg-white flex flex-row items-center gap-2 px-2 ${
        isCatB ? "bg-amber-50/20" : ""
      }`}
    >
      <img src={sticker.qr} alt="QR Code" className="sticker-qr w-20 h-20" />
      <div className="sticker-info text-center space-y-0.5 flex-1">
        {/* Category Header Badge */}
        {isCatB ? (
          <div className="sticker-header bg-amber-700 text-white text-[6.5px] font-black py-0.5 px-1.5 rounded mb-0.5 inline-block uppercase tracking-wider">
            ⚠️ CAT B • DEFECTIVE
          </div>
        ) : (
          <div className="sticker-header bg-emerald-800 text-white text-[6.5px] font-black py-0.5 px-1.5 rounded mb-0.5 inline-block uppercase tracking-wider">
            ✓ CAT A • OK QUALITY
          </div>
        )}

        <p className="sticker-design text-[7px] font-bold text-gray-800 truncate max-w-[28mm]" title={sticker.design}>
          {sticker.design}
        </p>

        <div className="text-[6.5px] font-bold py-0.5 px-1 rounded inline-block bg-gray-100 text-gray-800">
          {sticker.suitType} | Size: {sticker.sizeCode} | Unit #{sticker.unitNumber}
        </div>

        {suitItems[sticker.suitType] && (
          <p className="text-[5.5px] text-gray-500 font-medium">
            {suitItems[sticker.suitType]}
          </p>
        )}

        {isCatB && sticker.defectSummary && (
          <p className="text-[5.5px] font-semibold text-red-600 truncate max-w-[28mm]" title={sticker.defectSummary}>
            {sticker.defectSummary}
          </p>
        )}

        {sticker.sellingPrice > 0 && (
          <p className="sticker-price text-[7.5px] font-black text-gray-900 bg-gray-100 rounded py-0.5 mt-0.5">
            PKR {sticker.sellingPrice.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
