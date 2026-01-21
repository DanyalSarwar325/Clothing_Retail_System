"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import toast from "react-hot-toast";

const DEFECT_REASONS = [
  "Wrong cutting",
  "Fabric damaged",
  "Stitching error",
  "Machine damage",
  "Color defect",
  "Size error",
  "Quality issue",
  "Other"
] as const;

interface DefectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  barcodeId: string;
  barcodeInfo: {
    design: string;
    item: string;
    size: string;
    unitNumber: number;
  };
  department: string;
  markedBy: string;
  onSuccess: () => void;
}

export default function DefectiveModal({
  isOpen,
  onClose,
  barcodeId,
  barcodeInfo,
  department,
  markedBy,
  onSuccess,
}: DefectiveModalProps) {
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleMarkDefective = async () => {
    if (!reason) {
      toast.error("Please select a reason");
      return;
    }

    if (reason === "Other" && !notes.trim()) {
      toast.error("Please provide details for 'Other' reason");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/barcodes/defective", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeId,
          department,
          markedBy,
          reason,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success("Item marked as defective");
        onSuccess();
        onClose();
      } else {
        toast.error(result.message || "Failed to mark as defective");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-red-500 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle size={24} />
            <h2 className="text-lg font-semibold">Mark as Defective</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Item Info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-500 mb-1">Item Details</p>
            <p className="font-semibold text-gray-900">
              {barcodeInfo.design} - {barcodeInfo.item}
            </p>
            <p className="text-sm text-gray-600">
              Size: {barcodeInfo.size} | Unit #{barcodeInfo.unitNumber}
            </p>
          </div>

          {/* Reason Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reason for Defect <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="">Select a reason</option>
              {DEFECT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Notes (shown for all, required for "Other") */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes {reason === "Other" && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={reason === "Other" ? "Please describe the issue..." : "Optional details..."}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-sm text-yellow-800">
              <strong>Warning:</strong> This action cannot be undone. The item will be removed from production tracking.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleMarkDefective}
              disabled={loading || !reason}
              className="flex-1 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <AlertTriangle size={18} />
                  Mark Defective
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
