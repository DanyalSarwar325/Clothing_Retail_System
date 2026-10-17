"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sticker,
  RefreshCw,
  Printer,
  Trash2,
  Check,
  AlertCircle,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

interface DesignStats {
  design: string;
  suitType: "2pc" | "3pc";
  totalPieces: number;
  totalSuits: number;
  totalCategoryA: number;
  totalCategoryB: number;
  sizeBreakdown: Record<
    string,
    {
      totalPieces: number;
      totalSuits: number;
      categoryA: number;
      categoryB: number;
      defectivePieces: number;
    }
  >;
}

interface DesignInfo {
  availableDesigns: string[];
  generatedDesigns: string[];
  stickerCounts: Record<string, { total: number; catA: number; catB: number }>;
}

export default function FinalStickerGenerator() {
  const router = useRouter();
  const [designInfo, setDesignInfo] = useState<DesignInfo>({
    availableDesigns: [],
    generatedDesigns: [],
    stickerCounts: {},
  });
  const [selectedDesign, setSelectedDesign] = useState("");
  const [designStats, setDesignStats] = useState<DesignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [sellingPrice, setSellingPrice] = useState(0);

  // Manual sticker counts per size
  const [manualCounts, setManualCounts] = useState<Record<string, { catA: number; catB: number }>>({
    S: { catA: 0, catB: 0 },
    M: { catA: 0, catB: 0 },
    L: { catA: 0, catB: 0 },
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
          availableDesigns: data.availableDesigns || [],
          generatedDesigns: data.generatedDesigns || [],
          stickerCounts: data.stickerCounts || {},
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

  // Fetch detailed stats when selectedDesign changes
  useEffect(() => {
    if (!selectedDesign) {
      setDesignStats(null);
      setManualCounts({
        S: { catA: 0, catB: 0 },
        M: { catA: 0, catB: 0 },
        L: { catA: 0, catB: 0 },
      });
      return;
    }

    const fetchStats = async () => {
      setLoadingStats(true);
      try {
        const res = await fetch(`/api/final-stickers/designs?design=${encodeURIComponent(selectedDesign)}`);
        const data = await res.json();
        if (data.success && data.stats) {
          setDesignStats(data.stats);
          if (data.stats.sizeBreakdown) {
            setManualCounts({
              S: {
                catA: data.stats.sizeBreakdown.S?.categoryA ?? 0,
                catB: data.stats.sizeBreakdown.S?.categoryB ?? 0,
              },
              M: {
                catA: data.stats.sizeBreakdown.M?.categoryA ?? 0,
                catB: data.stats.sizeBreakdown.M?.categoryB ?? 0,
              },
              L: {
                catA: data.stats.sizeBreakdown.L?.categoryA ?? 0,
                catB: data.stats.sizeBreakdown.L?.categoryB ?? 0,
              },
            });
          }
          if (data.stats.packingRate > 0) {
            setDepartmentRates((prev) => ({
              ...prev,
              Packing: data.stats.packingRate,
            }));
          }
        } else {
          setDesignStats(null);
          toast.error(data.message || "Could not calculate design preview");
        }
      } catch (err) {
        setDesignStats(null);
      } finally {
        setLoadingStats(false);
      }
    };

    fetchStats();
  }, [selectedDesign]);

  const dynamicTotalCatA =
    (manualCounts.S?.catA || 0) + (manualCounts.M?.catA || 0) + (manualCounts.L?.catA || 0);
  const dynamicTotalCatB =
    (manualCounts.S?.catB || 0) + (manualCounts.M?.catB || 0) + (manualCounts.L?.catB || 0);
  const dynamicTotalSuits = dynamicTotalCatA + dynamicTotalCatB;

  const resetToAutoCalculated = () => {
    if (!designStats || !designStats.sizeBreakdown) return;
    setManualCounts({
      S: {
        catA: designStats.sizeBreakdown.S?.categoryA ?? 0,
        catB: designStats.sizeBreakdown.S?.categoryB ?? 0,
      },
      M: {
        catA: designStats.sizeBreakdown.M?.categoryA ?? 0,
        catB: designStats.sizeBreakdown.M?.categoryB ?? 0,
      },
      L: {
        catA: designStats.sizeBreakdown.L?.categoryA ?? 0,
        catB: designStats.sizeBreakdown.L?.categoryB ?? 0,
      },
    });
    toast.success("Restored system auto-calculated quantities");
  };

  const handleManualCountChange = (size: string, category: "catA" | "catB", val: number) => {
    const safeVal = isNaN(val) || val < 0 ? 0 : val;
    setManualCounts((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        [category]: safeVal,
      },
    }));
  };

  const generateStickers = async () => {
    if (!selectedDesign) {
      toast.error("Please select a design");
      return;
    }

    if (dynamicTotalSuits <= 0) {
      toast.error("Please specify at least 1 suit sticker to generate");
      return;
    }

    // Validate selling price
    if (sellingPrice <= 0) {
      toast.error("Please set the selling price");
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
        body: JSON.stringify({
          design: selectedDesign,
          sellingPrice,
          departmentRates,
          manualCounts,
        }),
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
    <div className="bg-white rounded-2xl shadow-xs border border-gray-100 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600">
          <Sticker size={22} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Final Stickers & Polybag Packaging</h2>
          <p className="text-xs text-gray-500">
            Auto-detects 2pc/3pc, separates Category A (OK) & Category B (Defective), and groups print
          </p>
        </div>
        <button
          onClick={fetchDesigns}
          disabled={loading}
          className="ml-auto p-2 hover:bg-gray-100 rounded-lg transition cursor-pointer"
          title="Refresh"
        >
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Generate New Stickers Section */}
      <div className="border border-gray-200 rounded-xl p-5 mb-6 bg-gray-50/50">
        <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
          <Sparkles size={16} className="text-purple-600" />
          Generate New Final Stickers
        </h3>

        {designInfo.availableDesigns.length === 0 ? (
          <div className="text-center py-6 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
            <AlertCircle className="mx-auto mb-2 text-gray-400" size={28} />
            <p className="font-medium text-gray-700">No designs pending final sticker generation.</p>
            <p className="text-xs text-gray-400 mt-1">
              Either all designs have stickers generated, or initial piece barcodes haven't been created yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Select Design for Final Sticker Packaging
              </label>
              <select
                value={selectedDesign}
                onChange={(e) => setSelectedDesign(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                disabled={generating}
              >
                <option value="">-- Choose an available design --</option>
                {designInfo.availableDesigns.map((design) => (
                  <option key={design} value={design}>
                    {design}
                  </option>
                ))}
              </select>
            </div>

            {/* Loading Stats Spinner */}
            {loadingStats && (
              <div className="p-6 bg-white rounded-xl border border-gray-200 text-center text-xs text-gray-500 flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-purple-600" />
                Analyzing barcodes & defect records for {selectedDesign}...
              </div>
            )}

            {/* Intelligent Design Breakdown Preview */}
            {selectedDesign && designStats && !loadingStats && (
              <div className="bg-white rounded-xl border border-purple-200 p-4 shadow-2xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">
                      Automated Production Detection: {designStats.design}
                    </h4>
                    <p className="text-xs text-gray-500">
                      Analyzed {designStats.totalPieces} scanned pieces across sizes
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                      <Layers size={13} />
                      {designStats.suitType === "3pc"
                        ? "3pc Suit (Qameez + Shalwar + Dupatta)"
                        : "2pc Suit (Qameez + Shalwar)"}
                    </span>
                  </div>
                </div>

                {/* Category A & B Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                    <div className="flex items-center justify-between text-emerald-800 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldCheck size={16} className="text-emerald-600" />
                        Category A (OK Quality)
                      </span>
                    </div>
                    <div className="text-2xl font-black text-emerald-900">
                      {dynamicTotalCatA}{" "}
                      <span className="text-xs font-normal text-emerald-700">stickers</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 mt-1">
                      100% flawless suits ready for premium retail
                    </p>
                  </div>

                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                    <div className="flex items-center justify-between text-amber-800 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <AlertTriangle size={16} className="text-amber-600" />
                        Category B (Defective)
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-900">
                      {dynamicTotalCatB}{" "}
                      <span className="text-xs font-normal text-amber-700">stickers</span>
                    </div>
                    <p className="text-[11px] text-amber-700 mt-1">
                      Contains piece(s) marked defective at Quality
                    </p>
                  </div>

                  <div className="p-3.5 bg-purple-50/80 border border-purple-200 rounded-xl">
                    <div className="flex items-center justify-between text-purple-800 mb-1">
                      <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <Sticker size={16} className="text-purple-600" />
                        Total Final Stickers
                      </span>
                    </div>
                    <div className="text-2xl font-black text-purple-900">
                      {dynamicTotalSuits}{" "}
                      <span className="text-xs font-normal text-purple-700">polybags</span>
                    </div>
                    <p className="text-[11px] text-purple-700 mt-1">
                      Cat A prints first, followed by Cat B
                    </p>
                  </div>
                </div>

                {/* Size breakdown with Manual Inputs */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-xs font-bold text-gray-800">
                        Manual Sticker Quantities Per Size
                      </h5>
                      <p className="text-[11px] text-gray-500">
                        Enter how many suits you want to sticker. Pre-filled with auto-detected counts based on scanned pieces.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={resetToAutoCalculated}
                      className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={12} />
                      Reset to Auto-Detected
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 uppercase font-semibold">
                          <th className="py-2 px-3">Size</th>
                          <th className="py-2 px-3">Cut / Scanned Pieces (Reference)</th>
                          <th className="py-2 px-3 text-emerald-800">Category A (OK Suits)</th>
                          <th className="py-2 px-3 text-amber-800">Category B (Defective Suits)</th>
                          <th className="py-2 px-3 text-right">Size Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {["S", "M", "L"].map((sz) => {
                          const sData = designStats.sizeBreakdown[sz] || {
                            totalPieces: 0,
                            totalSuits: 0,
                            categoryA: 0,
                            categoryB: 0,
                            defectivePieces: 0,
                          };
                          const sizeCatA = manualCounts[sz]?.catA ?? 0;
                          const sizeCatB = manualCounts[sz]?.catB ?? 0;
                          const sizeTotal = sizeCatA + sizeCatB;

                          return (
                            <tr key={sz} className="hover:bg-gray-50/80">
                              <td className="py-2.5 px-3 font-bold text-gray-900">
                                <span className="inline-block px-2 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-black">
                                  Size {sz}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-gray-600">
                                <span>{sData.totalPieces} pcs</span>
                                {sData.defectivePieces > 0 && (
                                  <span className="ml-1.5 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-medium">
                                    {sData.defectivePieces} defective pcs
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={sizeCatA}
                                    onChange={(e) =>
                                      handleManualCountChange(sz, "catA", parseInt(e.target.value) || 0)
                                    }
                                    disabled={generating}
                                    className="w-20 px-2.5 py-1.5 border border-emerald-300 rounded-lg font-bold text-emerald-900 bg-emerald-50/50 focus:ring-2 focus:ring-emerald-500 text-center text-xs"
                                  />
                                  <span className="text-[11px] text-gray-500">suits</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number"
                                    min="0"
                                    value={sizeCatB}
                                    onChange={(e) =>
                                      handleManualCountChange(sz, "catB", parseInt(e.target.value) || 0)
                                    }
                                    disabled={generating}
                                    className="w-20 px-2.5 py-1.5 border border-amber-300 rounded-lg font-bold text-amber-900 bg-amber-50/50 focus:ring-2 focus:ring-amber-500 text-center text-xs"
                                  />
                                  <span className="text-[11px] text-gray-500">suits</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right font-black text-gray-900">
                                {sizeTotal} suits
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pricing & Department Rates */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Selling Price (PKR) - Applies to Both A & B
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={sellingPrice || ""}
                      onChange={(e) => setSellingPrice(Number(e.target.value))}
                      placeholder="e.g. 5000"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={generating}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Packing Rate (PKR / suit)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={departmentRates.Packing !== undefined ? departmentRates.Packing : ""}
                      onChange={(e) =>
                        setDepartmentRates({ ...departmentRates, Packing: Number(e.target.value) })
                      }
                      placeholder="Packing rate"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={generating}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Store Rate (PKR / suit)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={departmentRates.Store !== undefined ? departmentRates.Store : ""}
                      onChange={(e) =>
                        setDepartmentRates({ ...departmentRates, Store: Number(e.target.value) })
                      }
                      placeholder="Store rate"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={generating}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={generateStickers}
                  disabled={generating || !selectedDesign || dynamicTotalSuits <= 0}
                  className="w-full mt-3 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold text-xs hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  {generating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating Final Stickers...
                    </>
                  ) : (
                    <>
                      <Printer size={16} />
                      Generate & Print {dynamicTotalSuits} Final Stickers ({dynamicTotalCatA} Cat A +{" "}
                      {dynamicTotalCatB} Cat B)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Generated Stickers List */}
      <div>
        <h3 className="font-bold text-gray-900 mb-3 text-sm flex items-center gap-2">
          <Sticker size={16} className="text-gray-600" />
          Active Generated Final Stickers
        </h3>

        {designInfo.generatedDesigns.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-xl">
            <Sticker className="mx-auto mb-2 opacity-40" size={32} />
            <p className="text-xs font-medium">No final stickers generated yet.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {designInfo.generatedDesigns.map((design) => {
              const counts = designInfo.stickerCounts[design] || { total: 0, catA: 0, catB: 0 };
              return (
                <div
                  key={design}
                  className="flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100/80 border border-gray-200/70 rounded-xl transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700">
                      <Check size={16} />
                    </div>
                    <div>
                      <p className="font-bold text-gray-900 text-xs">{design}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] font-medium text-gray-500">
                          Total: <strong>{counts.total}</strong> suits
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          Cat A: {counts.catA}
                        </span>
                        <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          Cat B: {counts.catB}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => printStickers(design)}
                      className="px-3 py-1.5 text-xs font-semibold bg-white text-purple-700 border border-purple-200 hover:bg-purple-50 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      title="Print Stickers"
                    >
                      <Printer size={14} />
                      Print
                    </button>
                    <button
                      onClick={() => deleteStickers(design)}
                      disabled={deleting === design}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition disabled:opacity-50 cursor-pointer"
                      title="Delete Stickers"
                    >
                      {deleting === design ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 size={16} />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
