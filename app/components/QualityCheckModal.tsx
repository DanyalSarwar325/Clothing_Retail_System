"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, X, Save, User } from "lucide-react";
import toast from "react-hot-toast";

const QUALITY_STATUS = ["Ok", "Damaged"] as const;
const DEPARTMENTS = ["Cutting", "Sewing", "Quality", "Handmade", "Adda Work", "Patching", "Press", "Packing", "Store"] as const;

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface QualityCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcodeId: string;
  barcodeInfo: {
    design: string;
    item: string;
    size: string;
    unitNumber: number;
  };
  checkedBy: string;
  onSuccess: () => void;
  departmentHistory?: DepartmentScan[]; // To get last scanned person
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
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [qualityStatus, setQualityStatus] = useState<string>("");
  const [department, setDepartment] = useState<string>("");
  const [lastScannedBy, setLastScannedBy] = useState<string>("");

  // Get last scan info (before Quality department)
  const getLastScanInfo = () => {
    if (departmentHistory && departmentHistory.length > 0) {
      // Get the last scan that is not from Quality department
      const lastNonQualityScan = [...departmentHistory]
        .reverse()
        .find(scan => scan.department !== "Quality");
      
      if (lastNonQualityScan) {
        return {
          department: lastNonQualityScan.department,
          scannedBy: lastNonQualityScan.scannedBy || "Unknown"
        };
      }
    }
    return null;
  };

  // Auto-fill department and last scanned person when Damaged is selected
  useEffect(() => {
    if (qualityStatus === "Damaged") {
      const lastScan = getLastScanInfo();
      if (lastScan) {
        setDepartment(lastScan.department);
        setLastScannedBy(lastScan.scannedBy);
      }
    } else {
      setDepartment("");
      setLastScannedBy("");
    }
  }, [qualityStatus, departmentHistory]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!qualityStatus) {
      toast.error("Please select a quality status");
      return;
    }

    if (qualityStatus === "Damaged" && !department) {
      toast.error("Please select a department");
      return;
    }

    if (qualityStatus === "Damaged" && !notes.trim()) {
      toast.error("Please provide notes for damaged items");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/barcodes/quality-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeId,
          checkedBy,
          status: qualityStatus === "Ok" ? "quality_ok" : "damaged",
          department: qualityStatus === "Damaged" ? department : undefined,
          responsiblePerson: qualityStatus === "Damaged" ? lastScannedBy : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          qualityStatus === "Ok" 
            ? "Product marked as Quality OK ✓" 
            : "Product marked as Damaged"
        );
        onSuccess();
        onClose();
      } else {
        toast.error(result.message || "Failed to update quality status");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQualityStatus("");
    setDepartment("");
    setLastScannedBy("");
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden relative">
        {/* Close Button - Top Right */}
        <button
          onClick={handleClose}
          className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 hover:bg-gray-100 rounded-full transition shadow-sm"
          disabled={loading}
        >
          <X size={18} className="text-gray-600" />
        </button>

        {/* Header */}
        <div className="bg-emerald-500 text-white px-4 py-3 flex items-center gap-2">
          <ShieldCheck size={20} />
          <h2 className="text-base font-semibold">Quality Check</h2>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Item Info */}
          <div className="bg-gray-50 rounded-lg p-3 mb-4">
            <p className="font-semibold text-gray-900 text-sm">
              {barcodeInfo.design} - {barcodeInfo.item}
            </p>
            <p className="text-xs text-gray-600">
              Size: {barcodeInfo.size} | Unit #{barcodeInfo.unitNumber}
            </p>
          </div>

          {/* Quality Status Field */}
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quality <span className="text-red-500">*</span>
            </label>
            <select
              value={qualityStatus}
              onChange={(e) => setQualityStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              disabled={loading}
            >
              <option value="">Select quality status</option>
              {QUALITY_STATUS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          {/* Department Field - Only visible when Damaged is selected */}
          {qualityStatus === "Damaged" && (
            <div className="mb-3 space-y-3">
              {/* Last Scanned By - Auto-filled */}
              {lastScannedBy && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="flex items-center gap-1.5">
                    <User size={14} className="text-amber-600" />
                    <p className="text-xs font-medium text-amber-800">Damaged By: <span className="font-semibold">{lastScannedBy}</span></p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-amber-50"
                  disabled={loading}
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes {qualityStatus === "Damaged" && <span className="text-red-500">*</span>}
              {qualityStatus !== "Damaged" && <span className="text-gray-400 text-xs">(Optional)</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading || !qualityStatus || (qualityStatus === "Damaged" && !department)}
              className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
