"use client";

import { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  X,
  User,
  AlertTriangle,
  CheckCircle2,
  Scan,
  Check,
  Layers,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

const DEFECT_REASONS = [
  "Wrong cutting",
  "Fabric damaged",
  "Stitching error",
  "Machine damage",
  "Color defect",
  "Size error",
  "Quality issue",
  "Other",
] as const;

const DEPARTMENTS = [
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store"
] as const;

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface CompanionNeedItem {
  item: string;
  completed: boolean;
  scannedBarcodeId?: string;
  scannedUnitNumber?: number;
}

interface QualityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcodeId: string;
  barcodeInfo: {
    design: string;
    item: string;
    size: string;
    suitType?: string;
    unitNumber: number;
    barcodeData?: string;
    status?: string;
  };
  checkedBy: string;
  onSuccess: () => void;
  departmentHistory?: DepartmentScan[];
}

export default function QualityCheckModal({
  isOpen,
  onClose,
  barcodeId,
  barcodeInfo,
  checkedBy,
  onSuccess,
  departmentHistory = [],
}: QualityCheckModalProps) {
  const [modalStage, setModalStage] = useState<"inspect" | "companion_scrap">("inspect");

  const isAlreadyOk = barcodeInfo.status === "quality_ok";
  const [detectedSuitType, setDetectedSuitType] = useState<string>(barcodeInfo.suitType || "2pc");

  // Inspection form states
  const [decision, setDecision] = useState<"ok" | "defective" | "">(
    isAlreadyOk ? "defective" : ""
  );
  const [defectReason, setDefectReason] = useState<string>("Fabric damaged");
  const [defectDepartment, setDefectDepartment] = useState<string>("");
  const [lastScannedBy, setLastScannedBy] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Companion scrap states
  const [companionNeeds, setCompanionNeeds] = useState<CompanionNeedItem[]>([]);
  const [companionScanInput, setCompanionScanInput] = useState("");
  const [companionScanLoading, setCompanionScanLoading] = useState(false);
  const [companionScanError, setCompanionScanError] = useState("");
  const companionInputRef = useRef<HTMLInputElement>(null);

  // Get last scan info before Quality
  const getLastScanInfo = () => {
    if (departmentHistory && departmentHistory.length > 0) {
      const lastNonQualityScan = [...departmentHistory]
        .reverse()
        .find((scan) => scan.department !== "Quality");

      if (lastNonQualityScan) {
        return {
          department: lastNonQualityScan.department,
          scannedBy: lastNonQualityScan.scannedBy || "Unknown",
        };
      }
    }
    return null;
  };

  // Auto-detect previous department when defective is selected
  useEffect(() => {
    if (decision === "defective") {
      const lastScan = getLastScanInfo();
      if (lastScan) {
        setDefectDepartment(lastScan.department);
        setLastScannedBy(lastScan.scannedBy);
      } else {
        setDefectDepartment("Sewing");
      }
    }
  }, [decision, departmentHistory]);

  // Focus companion scanner input when entering companion_scrap stage
  useEffect(() => {
    if (modalStage === "companion_scrap" && companionInputRef.current) {
      companionInputRef.current.focus();
    }
  }, [modalStage]);

  if (!isOpen) return null;

  const resetForm = () => {
    setModalStage("inspect");
    setDecision("");
    setDefectReason("Fabric damaged");
    setDefectDepartment("");
    setLastScannedBy("");
    setNotes("");
    setCompanionNeeds([]);
    setCompanionScanInput("");
    setCompanionScanError("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Submit Quick Quality OK
  const handleQualityOk = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/barcodes/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeId,
          checkedBy,
          status: "quality_ok",
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Quality OK ✓ — ${barcodeInfo.item} (${barcodeInfo.size}) approved`);
        onSuccess();
        handleClose();
      } else {
        toast.error(result.message || "Failed to mark as Quality OK");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Submit Primary Defect
  const handleMarkDefective = async () => {
    if (!defectReason) {
      toast.error("Please select a defect reason");
      return;
    }

    if (!notes.trim()) {
      toast.error("Please enter remarks explaining why the item was marked defective");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/barcodes/defective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeId,
          department: "Quality",
          markedBy: checkedBy,
          reason: defectReason,
          notes: notes.trim(),
          isCompanionDefect: false,
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (result.companionInfo?.suitType) {
          setDetectedSuitType(result.companionInfo.suitType);
        }
        const companionItemsNeeded: string[] = result.companionInfo?.companionItemsNeeded || [];

        if (companionItemsNeeded.length > 0) {
          // Switch to Companion Scraping Stage
          toast.success(`Primary defect recorded! Now scan matching companion piece for ${result.companionInfo?.suitType || "2pc"} suit.`, {
            duration: 5000,
          });
          setCompanionNeeds(
            companionItemsNeeded.map((it) => ({
              item: it,
              completed: false,
            }))
          );
          setModalStage("companion_scrap");
        } else {
          // 1pc suit or no companion pieces needed
          toast.success("Item marked as defective");
          onSuccess();
          handleClose();
        }
      } else {
        toast.error(result.message || "Failed to mark barcode as defective");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Process Companion Piece Scan
  const handleProcessCompanionScan = async (scannedBarcodeData: string) => {
    if (!scannedBarcodeData.trim()) return;
    setCompanionScanLoading(true);
    setCompanionScanError("");

    try {
      // Step 1: Look up the scanned barcode
      const scanRes = await fetch("/api/barcodes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeData: scannedBarcodeData.trim() }),
      });
      const scanData = await scanRes.json();

      if (!scanData.success || !scanData.barcode) {
        setCompanionScanError(scanData.message || "Scanned barcode not found in system");
        return;
      }

      const scannedItem = scanData.barcode;

      // Cannot scan the same barcode that is already defective primary
      if (scannedItem.id === barcodeId) {
        setCompanionScanError("This is the original defective item. Please scan another piece of the suit.");
        return;
      }

      // Already scrapped in this session?
      if (companionNeeds.some((n) => n.scannedBarcodeId === scannedItem.id)) {
        setCompanionScanError("This barcode has already been scanned for this suit set.");
        return;
      }

      // Check design match
      if (scannedItem.design !== barcodeInfo.design) {
        setCompanionScanError(
          `Design mismatch! Expected '${barcodeInfo.design}', but scanned '${scannedItem.design}'.`
        );
        return;
      }

      // Check size match
      if (scannedItem.size !== barcodeInfo.size) {
        setCompanionScanError(
          `Size mismatch! Whole suit must be Size ${barcodeInfo.size}, but scanned Size ${scannedItem.size}.`
        );
        return;
      }

      // Check if scanned item is one of the pending companion items
      const pendingItemNeed = companionNeeds.find(
        (need) => !need.completed && need.item.toLowerCase() === scannedItem.item.toLowerCase()
      );

      if (!pendingItemNeed) {
        const remainingNeeded = companionNeeds
          .filter((n) => !n.completed)
          .map((n) => n.item)
          .join(" or ");
        setCompanionScanError(
          `Wrong item type! Scanned '${scannedItem.item}', but still need: ${remainingNeeded || "None"}.`
        );
        return;
      }

      // Step 2: Mark this companion piece as defective with reference link
      const companionDefectRes = await fetch("/api/barcodes/defective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeId: scannedItem.id,
          department: "Quality",
          markedBy: checkedBy,
          reason: "Companion Suit Scrap",
          notes: `Scrapped as companion piece to complete broken suit set. Primary defect: ${barcodeInfo.item} (Unit #${barcodeInfo.unitNumber}, ${notes.trim()})`,
          isCompanionDefect: true,
          defectiveReferenceBarcode: barcodeId,
          companionReason: `Suit defect reference: ${barcodeInfo.item} (${barcodeInfo.size}) was defective due to: ${defectReason}`,
        }),
      });

      const companionDefectData = await companionDefectRes.json();

      if (!companionDefectData.success) {
        setCompanionScanError(
          companionDefectData.message || "Failed to mark companion piece as defective"
        );
        return;
      }

      // Step 3: Update checklist
      setCompanionNeeds((prev) =>
        prev.map((need) =>
          need.item.toLowerCase() === scannedItem.item.toLowerCase() && !need.completed
            ? {
              ...need,
              completed: true,
              scannedBarcodeId: scannedItem.id,
              scannedUnitNumber: scannedItem.unitNumber,
            }
            : need
        )
      );

      toast.success(
        `✓ Scrapped companion ${scannedItem.item} (${scannedItem.size}) Unit #${scannedItem.unitNumber}`
      );
      setCompanionScanInput("");
      setCompanionScanError("");
    } catch (err: any) {
      setCompanionScanError(err.message || "Error processing companion scan");
    } finally {
      setCompanionScanLoading(false);
      setTimeout(() => {
        companionInputRef.current?.focus();
      }, 100);
    }
  };

  const allCompanionsCompleted = companionNeeds.length > 0 && companionNeeds.every((c) => c.completed);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between text-white shrink-0 ${modalStage === "companion_scrap"
          ? "bg-gradient-to-r from-amber-600 to-red-600"
          : decision === "defective"
            ? "bg-gradient-to-r from-red-600 to-rose-600"
            : "bg-gradient-to-r from-emerald-600 to-teal-700"
          }`}>
          <div className="flex items-center gap-2.5">
            {modalStage === "companion_scrap" ? (
              <Layers size={22} className="animate-pulse" />
            ) : (
              <ShieldCheck size={22} />
            )}
            <div>
              <h2 className="text-base font-bold leading-tight">
                {modalStage === "companion_scrap"
                  ? `Scrap Companion Piece (${detectedSuitType.toUpperCase()} Suit)`
                  : "Quality Inspection"}
              </h2>
              <p className="text-xs text-white/80">
                {modalStage === "companion_scrap"
                  ? `Match ${barcodeInfo.design} (Size ${barcodeInfo.size}) — Any Unit #`
                  : `Inspector: ${checkedBy}`}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition text-white/90"
            disabled={loading || companionScanLoading}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ========================================================================= */}
          {/* STAGE 1: INSPECTION DECISION & FORM                                      */}
          {/* ========================================================================= */}
          {modalStage === "inspect" && (
            <>
              {/* Product Badge Card */}
              <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-4 mb-5">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {barcodeInfo.suitType || "3pc"} Suit
                    </span>
                    <h3 className="text-lg font-bold text-gray-900 mt-1">
                      {barcodeInfo.design}
                    </h3>
                  </div>
                  <span className="text-xs font-mono font-bold bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full">
                    Unit #{barcodeInfo.unitNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-gray-200/60 text-xs">
                  <div>
                    <span className="text-gray-500">Item:</span>{" "}
                    <span className="font-semibold text-gray-800">{barcodeInfo.item}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Size:</span>{" "}
                    <span className="font-semibold text-gray-800">
                      {barcodeInfo.size === "S" ? "Small (S)" : barcodeInfo.size === "M" ? "Medium (M)" : barcodeInfo.size === "L" ? "Large (L)" : barcodeInfo.size}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Decision Buttons */}
              <div className="mb-5">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-600 mb-2">
                  Quality Verdict <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDecision("ok")}
                    className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold text-sm transition-all ${decision === "ok"
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm ring-2 ring-emerald-500/20"
                      : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/50 text-gray-700"
                      }`}
                  >
                    <CheckCircle2 size={18} className={decision === "ok" ? "text-emerald-600" : "text-gray-400"} />
                    Quality OK
                  </button>

                  <button
                    type="button"
                    onClick={() => setDecision("defective")}
                    className={`py-3 px-4 rounded-xl border-2 flex items-center justify-center gap-2 font-semibold text-sm transition-all ${decision === "defective"
                      ? "border-red-600 bg-red-50 text-red-800 shadow-sm ring-2 ring-red-500/20"
                      : "border-gray-200 hover:border-red-300 hover:bg-red-50/50 text-gray-700"
                      }`}
                  >
                    <AlertTriangle size={18} className={decision === "defective" ? "text-red-600" : "text-gray-400"} />
                    Mark Defective
                  </button>
                </div>
              </div>

              {/* Form Section: If Quality OK is selected */}
              {decision === "ok" && (
                <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 mb-5 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-medium text-sm">
                    <CheckCircle2 size={16} className="text-emerald-600" />
                    <span>Product looks good and ready for next department</span>
                  </div>
                  <p className="text-xs text-emerald-700">
                    Clicking <strong>Approve Quality</strong> will mark this piece as <strong>Quality OK</strong> and advance it to the next department.
                  </p>
                </div>
              )}

              {/* Form Section: If Defective is selected */}
              {decision === "defective" && (
                <div className="space-y-4 mb-5 border-t border-gray-100 pt-4">
                  {/* Previous Scanned Department Warning */}
                  {lastScannedBy && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center gap-2 text-xs text-amber-800">
                      <User size={14} className="text-amber-600 flex-shrink-0" />
                      <span>
                        Last scanned in: <strong>{defectDepartment}</strong> by <strong>{lastScannedBy}</strong>
                      </span>
                    </div>
                  )}

                  {/* Defect Reason Dropdown */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Defect Reason Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={defectReason}
                      onChange={(e) => setDefectReason(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                      disabled={loading}
                    >
                      {DEFECT_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Responsible Department */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Department Responsible
                    </label>
                    <select
                      value={defectDepartment}
                      onChange={(e) => setDefectDepartment(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-white"
                      disabled={loading}
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Mandatory Remarks Textarea */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-xs font-semibold text-gray-700">
                        Defect Remarks / Reason <span className="text-red-500 font-bold">* Required</span>
                      </label>
                      <span className="text-[11px] text-gray-400">Quality staff notes</span>
                    </div>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Please specify why this piece was marked defective (e.g. Cut in fabric at shoulder seam, stain on back, wrong stitching)..."
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
                      disabled={loading}
                    />
                  </div>

                  {/* Companion Scraping notice */}
                  {detectedSuitType !== "1pc" && (
                    <div className="bg-red-50 border border-red-200/80 rounded-lg p-3 text-xs text-red-800">
                      <p className="font-semibold flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={14} className="text-red-600" />
                        {detectedSuitType.toUpperCase()} Suit Breakdown Rule
                      </p>
                      <p className="text-red-700 leading-relaxed">
                        Because this <strong>{barcodeInfo.size} {barcodeInfo.item}</strong> is defective, the whole {detectedSuitType} suit is damaged. You will be prompted to scan its companion piece of size <strong>{barcodeInfo.size}</strong> (matching design and size, regardless of unit number) to retire the complete suit set.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 mt-4 pb-1">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                  disabled={loading}
                >
                  Cancel
                </button>

                {decision === "ok" && (
                  <button
                    type="button"
                    onClick={handleQualityOk}
                    disabled={loading}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Check size={16} />
                        Approve Quality
                      </>
                    )}
                  </button>
                )}

                {decision === "defective" && (
                  <button
                    type="button"
                    onClick={handleMarkDefective}
                    disabled={loading || !notes.trim()}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <AlertTriangle size={16} />
                        Submit Defect & Continue
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* STAGE 2: COMPANION PIECES SCRAPPING WORKFLOW                              */}
          {/* ========================================================================= */}
          {modalStage === "companion_scrap" && (
            <div className="space-y-4">
              {/* Alert explanation */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900">
                <div className="flex items-center gap-2 font-bold mb-1 text-amber-800 text-sm">
                  <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
                  <span>{detectedSuitType.toUpperCase()} Suit Broken — Scan Companion Piece</span>
                </div>
                <p className="leading-relaxed">
                  Primary defect: <strong>{barcodeInfo.design}</strong> — <strong>{barcodeInfo.size} {barcodeInfo.item}</strong> (Unit #{barcodeInfo.unitNumber}).
                  Since this is a {detectedSuitType} suit, scan any companion piece of size <strong>{barcodeInfo.size}</strong> (same design and size, regardless of unit number) to complete the suit retirement.
                </p>
              </div>

              {/* Companion pieces checklist */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Required {detectedSuitType.toUpperCase()} Companion Pieces (Size {barcodeInfo.size} — Any Unit #)
                </label>
                <div className="space-y-2">
                  {companionNeeds.map((need, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${need.completed
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-gray-50 border-dashed border-gray-300 text-gray-800"
                        }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${need.completed
                            ? "bg-emerald-600 text-white"
                            : "bg-gray-200 text-gray-600"
                            }`}
                        >
                          {need.completed ? <Check size={14} /> : idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">
                            {barcodeInfo.design} — {need.item}
                          </p>
                          <p className="text-xs text-gray-500">
                            Required: Size <strong>{barcodeInfo.size}</strong> (Any Unit # of {barcodeInfo.design})
                          </p>
                        </div>
                      </div>

                      {need.completed ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
                            <CheckCircle2 size={12} />
                            Scrapped (Unit #{need.scannedUnitNumber})
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full animate-pulse">
                          Awaiting Scan
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Companion Scanner Input */}
              {!allCompanionsCompleted && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Scan size={16} className="text-emerald-600 animate-pulse" />
                    <label className="text-xs font-bold text-gray-700">
                      Scan Companion Piece Barcode
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      ref={companionInputRef}
                      type="text"
                      value={companionScanInput}
                      onChange={(e) => setCompanionScanInput(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === "Enter" && companionScanInput.trim()) {
                          e.preventDefault();
                          const val = companionScanInput.trim();
                          setCompanionScanInput("");
                          await handleProcessCompanionScan(val);
                        }
                      }}
                      placeholder="Scan or enter barcode data here..."
                      className="w-full border-2 border-emerald-500 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono"
                      disabled={companionScanLoading}
                      autoFocus
                    />
                  </div>

                  {companionScanLoading && (
                    <div className="flex items-center gap-2 text-xs text-emerald-600 mt-2 font-medium">
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-emerald-600 border-t-transparent" />
                      Validating & retiring companion piece...
                    </div>
                  )}

                  {companionScanError && (
                    <div className="flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2 mt-2">
                      <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{companionScanError}</span>
                    </div>
                  )}
                </div>
              )}

              {/* All Done Celebration */}
              {allCompanionsCompleted && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-4 text-center">
                  <div className="w-10 h-10 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 shadow-sm">
                    <Check size={22} />
                  </div>
                  <h4 className="font-bold text-emerald-900 text-sm">
                    Complete Suit Set Retired Successfully
                  </h4>
                  <p className="text-xs text-emerald-700 mt-1">
                    All companion piece(s) have been marked defective with reference to primary defect.
                  </p>
                </div>
              )}

              {/* Bottom Actions for Companion Stage */}
              <div className="flex gap-2 pt-3 sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-100 mt-4 pb-1">
                <button
                  type="button"
                  onClick={() => {
                    onSuccess();
                    handleClose();
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${allCompanionsCompleted
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                >
                  {allCompanionsCompleted ? (
                    <>
                      <Check size={16} />
                      Finish & Continue Scanning
                    </>
                  ) : (
                    "Skip Remaining / Finish Later"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
