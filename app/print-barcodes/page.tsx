"use client";

import { useEffect, useState, useMemo } from "react";
import QRCode from "qrcode";
import {
  Printer,
  RefreshCw,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Trash2,
  Calendar,
  Layers,
  Search,
  Tag,
  PackageCheck,
  AlertCircle,
} from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";

interface DepartmentRate {
  department: string;
  ratePerPiece: number;
  item?: string;
}

interface BarcodeFromDB {
  _id: string;
  design: string;
  size: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  item: string;
  unitNumber: number;
  sequenceNumber?: number;
  totalUnitsInBatch?: number;
  barcodeData: string;
  status: string;
  poNumber?: string | null;
  poId?: string | null;
  departmentRates?: DepartmentRate[];
  createdAt: string;
  printed?: boolean;
}

interface BarcodeItemSummary {
  item: string;
  size: string;
  count: number;
  minSeq: number;
  maxSeq: number;
}

interface BarcodeBatchGroup {
  id: string;
  batchNumber: number;
  design: string;
  poNumber: string | null;
  poId: string | null;
  createdAt: string;
  barcodes: BarcodeFromDB[];
  itemSummaries: BarcodeItemSummary[];
  totalQuantity: number;
  selected: boolean;
  expanded: boolean;
}

const SIZE_LABELS: Record<string, string> = { S: "Small", M: "Medium", L: "Large" };

function BarcodePreviewItem({ barcode }: { barcode: BarcodeFromDB }) {
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(barcode.barcodeData)
      .then((url) => {
        if (isMounted) setQr(url);
      })
      .catch(console.error);
    return () => {
      isMounted = false;
    };
  }, [barcode.barcodeData]);

  const seq = barcode.sequenceNumber || barcode.unitNumber;

  return (
    <div className="bg-white rounded-xl p-3 border border-gray-200 text-center shadow-xs hover:border-blue-400 transition">
      {qr ? (
        <img src={qr} alt="QR Code" className="w-20 h-20 mx-auto" />
      ) : (
        <div className="w-20 h-20 mx-auto bg-gray-100 animate-pulse rounded mb-1"></div>
      )}
      <p className="text-xs font-bold text-gray-800 mt-1 truncate">
        {barcode.poNumber ? `${barcode.poNumber} • ` : ""}
        {barcode.design}
      </p>
      <p className="text-[11px] font-semibold text-gray-700">
        {barcode.item} | {barcode.size}
      </p>
      <p className="text-[11px] font-bold text-blue-600">
        {barcode.totalUnitsInBatch ? `${seq}/${barcode.totalUnitsInBatch}` : `#${seq}`}
      </p>
    </div>
  );
}

// Sort barcodes helper
const sortBarcodes = (barcodes: BarcodeFromDB[]) => {
  return [...barcodes].sort((a, b) => {
    const sizeOrder = { S: 1, M: 2, L: 3 };
    const suitOrder = { "1pc": 1, "2pc": 2, "3pc": 3 };
    const itemOrder: Record<string, number> = { Qameez: 1, Shalwar: 2, Dupatta: 3 };
    if (sizeOrder[a.size] !== sizeOrder[b.size]) return sizeOrder[a.size] - sizeOrder[b.size];
    if (suitOrder[a.suitType] !== suitOrder[b.suitType]) return suitOrder[a.suitType] - suitOrder[b.suitType];
    const seqA = a.sequenceNumber || a.unitNumber || 0;
    const seqB = b.sequenceNumber || b.unitNumber || 0;
    if (seqA !== seqB) return seqA - seqB;
    return (itemOrder[a.item] || 0) - (itemOrder[b.item] || 0);
  });
};

// Group raw barcodes array into distinct generation batches
function groupBarcodesIntoBatches(barcodes: BarcodeFromDB[]): BarcodeBatchGroup[] {
  if (!barcodes || barcodes.length === 0) return [];

  // 1. Sort all barcodes chronologically (oldest first) to assign sequential Batch #1, #2, etc.
  const sorted = [...barcodes].sort((a, b) => {
    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeA - timeB;
  });

  // 2. Cluster into batches based on PO + Design and createdAt gap (< 3 minutes apart = same generation session)
  const rawBatches: Array<{
    design: string;
    poNumber: string | null;
    poId: string | null;
    createdAt: string;
    barcodes: BarcodeFromDB[];
  }> = [];

  for (const b of sorted) {
    const bTime = new Date(b.createdAt || 0).getTime();
    const bPo = b.poNumber || null;
    const bDesign = b.design;

    const lastBatch = rawBatches[rawBatches.length - 1];
    if (
      lastBatch &&
      lastBatch.design.toLowerCase() === bDesign.toLowerCase() &&
      lastBatch.poNumber === bPo
    ) {
      const lastBatchTime = new Date(lastBatch.createdAt).getTime();
      // If generated within 25 seconds (same modal submission session), group together
      if (Math.abs(bTime - lastBatchTime) <= 25000) {
        lastBatch.barcodes.push(b);
        continue;
      }
    }

    rawBatches.push({
      design: bDesign,
      poNumber: bPo,
      poId: (b as any).poId || null,
      createdAt: b.createdAt,
      barcodes: [b],
    });
  }

  // 3. Assign sequential Batch # numbers per (PO + Design)
  const poBatchCounters: Record<string, number> = {};
  const batchGroups: BarcodeBatchGroup[] = rawBatches.map((rb, idx) => {
    const key = `${rb.poNumber || "MANUAL"}_${rb.design.toLowerCase()}`;
    poBatchCounters[key] = (poBatchCounters[key] || 0) + 1;
    const batchNum = poBatchCounters[key];

    // Compute item breakdown: e.g. Qameez (S): 10 pcs, seq 1-10
    const summaryMap: Record<string, BarcodeItemSummary> = {};
    for (const b of rb.barcodes) {
      const sumKey = `${b.item}_${b.size}`;
      const seq = b.sequenceNumber || b.unitNumber || 1;
      if (!summaryMap[sumKey]) {
        summaryMap[sumKey] = {
          item: b.item,
          size: b.size,
          count: 1,
          minSeq: seq,
          maxSeq: seq,
        };
      } else {
        summaryMap[sumKey].count += 1;
        summaryMap[sumKey].minSeq = Math.min(summaryMap[sumKey].minSeq, seq);
        summaryMap[sumKey].maxSeq = Math.max(summaryMap[sumKey].maxSeq, seq);
      }
    }

    const sortedBatchBarcodes = sortBarcodes(rb.barcodes);

    return {
      id: `batch_${key}_${idx}_${new Date(rb.createdAt).getTime()}`,
      batchNumber: batchNum,
      design: rb.design,
      poNumber: rb.poNumber,
      poId: rb.poId,
      createdAt: rb.createdAt,
      barcodes: sortedBatchBarcodes,
      itemSummaries: Object.values(summaryMap),
      totalQuantity: rb.barcodes.length,
      selected: false,
      expanded: false,
    };
  });

  // 4. Return sorted by newest batch first so latest generated batch is right at the top
  return batchGroups.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export default function PrintBarcodesPage() {
  const { user, loading: authLoading } = useAuth();
  const [batches, setBatches] = useState<BarcodeBatchGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    batchTitle: string;
    barcodeIds: string[];
  } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [preparingPrint, setPreparingPrint] = useState(false);

  // Fetch all generated barcodes and group them into batches
  const fetchBarcodes = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/barcodes?status=generated&_t=${Date.now()}`, {
        cache: "no-store",
      });
      const result = await response.json();

      if (result.success) {
        const rawBarcodes: BarcodeFromDB[] = result.barcodes || [];
        const grouped = groupBarcodesIntoBatches(rawBarcodes);
        setBatches(grouped);
      } else {
        setError(result.message || "Failed to fetch barcodes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch barcodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarcodes();
  }, []);

  // Filter batches by search term (Design or PO Number)
  const filteredBatches = useMemo(() => {
    if (!search.trim()) return batches;
    const query = search.toLowerCase().trim();
    return batches.filter(
      (b) =>
        b.design.toLowerCase().includes(query) ||
        (b.poNumber && b.poNumber.toLowerCase().includes(query)) ||
        `batch ${b.batchNumber}`.includes(query)
    );
  }, [batches, search]);

  // Toggle batch selection
  const toggleBatchSelection = (batchId: string) => {
    setBatches((prev) =>
      prev.map((batch) =>
        batch.id === batchId ? { ...batch, selected: !batch.selected } : batch
      )
    );
  };

  // Toggle batch expansion
  const toggleBatchExpansion = (batchId: string) => {
    setBatches((prev) =>
      prev.map((batch) =>
        batch.id === batchId ? { ...batch, expanded: !batch.expanded } : batch
      )
    );
  };

  // Select all visible batches
  const selectAll = () => {
    const visibleIds = new Set(filteredBatches.map((b) => b.id));
    setBatches((prev) =>
      prev.map((b) => (visibleIds.has(b.id) ? { ...b, selected: true } : b))
    );
  };

  // Deselect all
  const deselectAll = () => {
    setBatches((prev) => prev.map((b) => ({ ...b, selected: false })));
  };

  // Print a specific single batch without mixing
  const handlePrintSingleBatch = (batch: BarcodeBatchGroup) => {
    setPreparingPrint(true);
    try {
      localStorage.setItem("printBarcodes", JSON.stringify(batch.barcodes));
      window.open("/print-barcodes/preview", "_blank");
    } catch (err: any) {
      console.error(err);
      alert("Failed to prepare barcodes for printing: " + (err.message || err));
    } finally {
      setPreparingPrint(false);
    }
  };

  // Print all selected batches
  const handlePrintSelectedBatches = () => {
    const selectedBarcodes = batches
      .filter((b) => b.selected)
      .flatMap((b) => b.barcodes);

    if (selectedBarcodes.length === 0) {
      alert("Please select at least one batch to print");
      return;
    }

    setPreparingPrint(true);
    try {
      localStorage.setItem("printBarcodes", JSON.stringify(selectedBarcodes));
      window.open("/print-barcodes/preview", "_blank");
    } catch (err: any) {
      console.error(err);
      alert("Failed to prepare barcodes for printing: " + (err.message || err));
    } finally {
      setPreparingPrint(false);
    }
  };

  // Delete a specific batch
  const confirmDeleteBatch = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/barcodes?ids=${encodeURIComponent(deleteConfirm.barcodeIds.join(","))}`,
        {
          method: "DELETE",
        }
      );
      const result = await response.json();

      if (result.success) {
        setBatches((prev) =>
          prev.filter((b) => !b.barcodes.some((bar) => deleteConfirm.barcodeIds.includes(bar._id)))
        );
        setDeleteConfirm(null);
      } else {
        setError(result.message || "Failed to delete barcodes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete barcodes");
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only admins can print barcodes.</p>
        </div>
      </div>
    );
  }

  const selectedBatchesCount = batches.filter((b) => b.selected).length;
  const totalSelectedBarcodesCount = batches
    .filter((b) => b.selected)
    .reduce((sum, b) => sum + b.totalQuantity, 0);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active="print-barcodes" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b px-4 sm:px-8 py-6 pt-16 lg:pt-6 sticky top-0 z-20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Layers className="text-blue-600" size={24} />
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                  Print Barcodes by Batches
                </h1>
              </div>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                Each generation is organized as a distinct batch card so they never get mixed up.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchBarcodes}
                disabled={loading}
                className="flex items-center gap-2 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Search & Actions Bar */}
          <div className="bg-white rounded-2xl shadow-xs border p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by Design, PO Number, or Batch #..."
                className="w-full pl-10 pr-4 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-hidden bg-gray-50/50"
              />
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={selectAll}
                  className="px-2.5 py-1.5 text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 rounded-lg transition"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  onClick={deselectAll}
                  className="px-2.5 py-1.5 text-gray-600 hover:text-gray-800 font-medium hover:bg-gray-100 rounded-lg transition"
                >
                  Deselect All
                </button>
              </div>

              {selectedBatchesCount > 0 && (
                <button
                  onClick={handlePrintSelectedBatches}
                  disabled={preparingPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer size={15} />
                  Print Selected ({selectedBatchesCount} Batches • {totalSelectedBarcodesCount} Barcodes)
                </button>
              )}
            </div>
          </div>

          {/* Batches Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20 bg-white rounded-2xl border">
              <div className="text-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-500 text-sm">Loading barcode batches...</p>
              </div>
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <PackageCheck size={32} />
              </div>
              <h2 className="text-lg font-bold text-gray-800 mb-1">
                {search ? "No Matching Batches Found" : "No Barcodes Available to Print"}
              </h2>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                {search
                  ? `No batch matches "${search}". Try searching for another design or PO number.`
                  : "Generate barcodes from a Purchase Order or the Generate Barcode page to see batches here."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredBatches.map((batch) => (
                <div
                  key={batch.id}
                  className={`bg-white rounded-2xl border transition-all duration-150 overflow-hidden shadow-xs ${
                    batch.selected
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  {/* Card Main Bar */}
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Left: Checkbox + Batch Info */}
                    <div className="flex items-start sm:items-center gap-3.5">
                      <button
                        onClick={() => toggleBatchSelection(batch.id)}
                        className="text-blue-600 mt-0.5 sm:mt-0 hover:scale-105 transition cursor-pointer"
                        title={batch.selected ? "Deselect Batch" : "Select Batch"}
                      >
                        {batch.selected ? <CheckSquare size={22} /> : <Square size={22} />}
                      </button>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Batch #{batch.batchNumber}
                          </span>

                          {batch.poNumber && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200 font-mono">
                              {batch.poNumber}
                            </span>
                          )}

                          <h3 className="text-base font-bold text-gray-900 ml-0.5">
                            {batch.design}
                          </h3>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-gray-400" />
                            {new Date(batch.createdAt).toLocaleString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span>•</span>
                          <span className="font-semibold text-gray-700">
                            {batch.totalQuantity} Barcode{batch.totalQuantity > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: Items Summary Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 md:max-w-md">
                      {batch.itemSummaries.map((it, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-800 flex items-center gap-1.5"
                        >
                          <Tag size={12} className="text-blue-500" />
                          <span>
                            <strong>{it.count}x</strong> {it.item} ({it.size})
                          </span>
                          <span className="text-[11px] text-gray-500 font-mono">
                            [#{it.minSeq}–#{it.maxSeq}]
                          </span>
                        </span>
                      ))}
                    </div>

                    {/* Right: Actions (Dedicated Print Batch Button) */}
                    <div className="flex items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-gray-100">
                      <button
                        onClick={() => handlePrintSingleBatch(batch)}
                        disabled={preparingPrint}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer hover:shadow-sm"
                        title="Print only this batch"
                      >
                        <Printer size={15} />
                        Print Batch ({batch.totalQuantity})
                      </button>

                      <button
                        onClick={() =>
                          setDeleteConfirm({
                            batchTitle: `${batch.design} (Batch #${batch.batchNumber})`,
                            barcodeIds: batch.barcodes.map((b) => b._id),
                          })
                        }
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                        title="Delete this batch only"
                      >
                        <Trash2 size={16} />
                      </button>

                      <button
                        onClick={() => toggleBatchExpansion(batch.id)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                        title={batch.expanded ? "Hide preview" : "View QR stickers"}
                      >
                        {batch.expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded QR Preview for this Batch */}
                  {batch.expanded && (
                    <div className="border-t bg-gray-50/70 p-4 sm:p-5">
                      <div className="flex items-center justify-between mb-3 text-xs text-gray-600">
                        <span className="font-semibold">
                          Previewing Barcodes for Batch #{batch.batchNumber} ({batch.totalQuantity} total):
                        </span>
                        <span>Click &quot;Print Batch&quot; above to print all of them</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {batch.barcodes.slice(0, 18).map((barcode) => (
                          <BarcodePreviewItem key={barcode._id} barcode={barcode} />
                        ))}
                        {batch.barcodes.length > 18 && (
                          <div className="bg-white rounded-xl p-4 flex items-center justify-center border border-dashed text-center">
                            <p className="text-xs text-gray-500">
                              +{batch.barcodes.length - 18} more barcodes in this batch
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Batch Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Batch?</h3>
              <p className="text-sm text-gray-600 mb-3">
                Are you sure you want to delete{" "}
                <strong className="text-gray-900">{deleteConfirm.batchTitle}</strong>?
              </p>
              <div className="p-3 bg-gray-50 border rounded-xl text-xs text-gray-500 mb-5">
                This will delete only the <strong>{deleteConfirm.barcodeIds.length}</strong> barcodes
                belonging to this batch. Other batches of this design will not be affected.
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteBatch}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {deleting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Yes, Delete Batch
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
