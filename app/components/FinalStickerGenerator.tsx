"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sticker, RefreshCw, Printer, Trash2, Check, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import QRCode from "qrcode";

interface DesignInfo {
  availableDesigns: string[];
  generatedDesigns: string[];
  stickerCounts: Record<string, number>;
}

export default function FinalStickerGenerator() {
  const router = useRouter();
  const [designInfo, setDesignInfo] = useState<DesignInfo>({
    availableDesigns: [],
    generatedDesigns: [],
    stickerCounts: {},
  });
  const [selectedDesign, setSelectedDesign] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [prices, setPrices] = useState({
    "1pc": 0,
    "2pc": 0,
    "3pc": 0,
  });
  // Department rates for Packing and Store
  const [departmentRates, setDepartmentRates] = useState({
    Packing: 0,
    Store: 0,
  });

  const fetchDesigns = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/final-stickers/designs");
      const data = await response.json();

      if (data.success) {
        setDesignInfo({
          availableDesigns: data.availableDesigns,
          generatedDesigns: data.generatedDesigns,
          stickerCounts: data.stickerCounts,
        });
      } else {
        toast.error(data.message || "Failed to fetch designs");
      }
    } catch (error) {
      toast.error("Failed to fetch designs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  const generateStickers = async () => {
    if (!selectedDesign) {
      toast.error("Please select a design");
      return;
    }

    // Validate that at least one price is set
    if (prices["1pc"] <= 0 && prices["2pc"] <= 0 && prices["3pc"] <= 0) {
      toast.error("Please set at least one selling price");
      return;
    }

    // Validate Packing and Store rates
    if (departmentRates.Packing < 0 || departmentRates.Packing === undefined || departmentRates.Packing === null) {
      toast.error("Please set Packing rate");
      return;
    }
    if (departmentRates.Store < 0 || departmentRates.Store === undefined || departmentRates.Store === null) {
      toast.error("Please set Store rate");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch("/api/final-stickers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ design: selectedDesign, prices, departmentRates }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        // Navigate to print page after successful generation
        window.location.href = `/print-final-stickers?design=${encodeURIComponent(selectedDesign)}`;
      } else {
        toast.error(data.message || "Failed to generate stickers");
      }
    } catch (error) {
      toast.error("Failed to generate stickers");
    } finally {
      setGenerating(false);
    }
  };

  const deleteStickers = async (design: string) => {
    if (!confirm(`Are you sure you want to delete all final stickers for "${design}"?`)) {
      return;
    }

    setDeleting(design);
    try {
      const response = await fetch(`/api/final-stickers?design=${encodeURIComponent(design)}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        fetchDesigns();
      } else {
        toast.error(data.message || "Failed to delete stickers");
      }
    } catch (error) {
      toast.error("Failed to delete stickers");
    } finally {
      setDeleting(null);
    }
  };

  const printStickers = (design: string) => {
    router.push(`/print-final-stickers?design=${encodeURIComponent(design)}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Sticker className="text-purple-600" size={24} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Final Stickers</h2>
          <p className="text-sm text-gray-500">Generate combined suit stickers for Press department</p>
        </div>
        <button
          onClick={fetchDesigns}
          disabled={loading}
          className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Generate New Stickers Section */}
      <div className="border border-gray-200 rounded-lg p-4 mb-6">
        <h3 className="font-medium text-gray-900 mb-3">Generate New Final Stickers</h3>

        {designInfo.availableDesigns.length === 0 ? (
          <div className="text-center py-4 text-gray-500">
            <AlertCircle className="mx-auto mb-2" size={24} />
            <p>No designs available for final sticker generation.</p>
            <p className="text-sm">Generate initial barcodes first or all designs already have final stickers.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <select
              value={selectedDesign}
              onChange={(e) => setSelectedDesign(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={generating}
            >
              <option value="">Select a design</option>
              {designInfo.availableDesigns.map((design) => (
                <option key={design} value={design}>
                  {design}
                </option>
              ))}
            </select>

            {/* Selling Prices */}
            {selectedDesign && (
              <div className="bg-purple-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Set Selling Prices (PKR)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">1pc Suit</label>
                    <input
                      type="number"
                      min="0"
                      value={prices["1pc"] || ""}
                      onChange={(e) => setPrices({ ...prices, "1pc": Number(e.target.value) })}
                      placeholder="Price"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={generating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">2pc Suit</label>
                    <input
                      type="number"
                      min="0"
                      value={prices["2pc"] || ""}
                      onChange={(e) => setPrices({ ...prices, "2pc": Number(e.target.value) })}
                      placeholder="Price"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={generating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">3pc Suit</label>
                    <input
                      type="number"
                      min="0"
                      value={prices["3pc"] || ""}
                      onChange={(e) => setPrices({ ...prices, "3pc": Number(e.target.value) })}
                      placeholder="Price"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={generating}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Department Rates for Packing and Store */}
            {selectedDesign && (
              <div className="bg-green-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Set Department Rates (PKR per scan)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Packing Rate</label>
                    <input
                      type="number"
                      min="0"
                      value={departmentRates.Packing !== undefined && departmentRates.Packing !== null ? departmentRates.Packing : ""}
                      onChange={(e) => setDepartmentRates({ ...departmentRates, Packing: Number(e.target.value) })}
                      placeholder="Rate per scan"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={generating}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Store Rate</label>
                    <input
                      type="number"
                      min="0"
                      value={departmentRates.Store !== undefined && departmentRates.Store !== null ? departmentRates.Store : ""}
                      onChange={(e) => setDepartmentRates({ ...departmentRates, Store: Number(e.target.value) })}
                      placeholder="Rate per scan"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={generating}
                    />
                  </div>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={generateStickers}
              disabled={generating || !selectedDesign}
              className="w-full px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Printer size={18} />
                  Generate & Print Stickers
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Generated Stickers List */}
      <div>
        <h3 className="font-medium text-gray-900 mb-3">Generated Final Stickers</h3>

        {designInfo.generatedDesigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
            <Sticker className="mx-auto mb-2 opacity-50" size={32} />
            <p>No final stickers generated yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {designInfo.generatedDesigns.map((design) => (
              <div
                key={design}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Check className="text-green-600" size={16} />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{design}</p>
                    <p className="text-sm text-gray-500">
                      {designInfo.stickerCounts[design] || 0} stickers generated
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => printStickers(design)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Print Stickers"
                  >
                    <Printer size={18} />
                  </button>
                  <button
                    onClick={() => deleteStickers(design)}
                    disabled={deleting === design}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                    title="Delete Stickers"
                  >
                    {deleting === design ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 size={18} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PrintFinalStickers({ design }: { design: string }) {
  const [stickers, setStickers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStickers = async () => {
      try {
        const response = await fetch(`/api/final-stickers?design=${encodeURIComponent(design)}`);
        const data = await response.json();

        if (data.success) {
          const stickerData = data.stickers.map((sticker: any) => {
            const qr = QRCode.toDataURL(JSON.stringify(sticker));
            return { ...sticker, qr };
          });
          setStickers(await Promise.all(stickerData));
        } else {
          console.error("Failed to fetch stickers", data.message);
        }
      } catch (error) {
        console.error("Error fetching stickers", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStickers();
  }, [design]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-4">
      <button
        onClick={() => window.print()}
        className="bg-green-600 text-white px-4 py-2 rounded-lg mb-4"
      >
        🖨️ Print Stickers
      </button>

      <div className="print:block">
        {stickers.map((sticker, index) => (
          <div
            key={index}
            className="sticker-card border-b-2 border-dashed border-gray-400 pb-4 mb-4"
          >
            <img src={sticker.qr} alt="QR Code" className="w-40 h-40 mx-auto" />
            <div className="mt-2 text-center">
              <p className="text-sm font-bold text-gray-800">{sticker.design}</p>
              <p className="text-sm text-gray-600">{sticker.suitType} | {sticker.size}</p>
              <p className="text-sm font-semibold text-blue-600">Unit #{sticker.unitNumber}</p>
              <p className="text-sm font-bold text-gray-900 bg-gray-100 rounded py-1">{sticker.item}</p>
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
          .sticker-card {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}
