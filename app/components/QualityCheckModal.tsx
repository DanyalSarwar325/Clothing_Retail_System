"use client";

import { useState } from "react";
import { ShieldCheck, X, Save } from "lucide-react";
import toast from "react-hot-toast";

const QUALITY_STATUS = ["Ok", "Wasted"] as const;
const DEPARTMENTS = ["Sewing", "Cutting"] as const;

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
}

export default function QualityCheckModal({
  isOpen,
  onClose,
  barcodeId,
  barcodeInfo,
  checkedBy,
  onSuccess,
}: QualityCheckModalProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [qualityStatus, setQualityStatus] = useState<string>("");
  const [department, setDepartment] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!qualityStatus) {
      toast.error("Please select a quality status");
      return;
    }

    if (qualityStatus === "Wasted" && !department) {
      toast.error("Please select a department");
      return;
    }

    if (qualityStatus === "Wasted" && !notes.trim()) {
      toast.error("Please provide notes for wasted items");
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
          status: qualityStatus === "Ok" ? "quality_ok" : "wasted",
          department: qualityStatus === "Wasted" ? department : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          qualityStatus === "Ok" 
            ? "Product marked as Quality OK ✓" 
            : "Product marked as Wasted"
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
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-emerald-500 text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} />
            <h2 className="text-lg font-semibold">Quality Check</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 hover:bg-white/20 rounded-full transition"
            disabled={loading}
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

          {/* Quality Status Field */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quality <span className="text-red-500">*</span>
            </label>
            <select
              value={qualityStatus}
              onChange={(e) => setQualityStatus(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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

          {/* Department Field - Only visible when Wasted is selected */}
          {qualityStatus === "Wasted" && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
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
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes {qualityStatus === "Wasted" && <span className="text-red-500">*</span>}
              {qualityStatus !== "Wasted" && <span className="text-gray-400">(Optional)</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes about the quality check..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
              disabled={loading}
            />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={loading || !qualityStatus || (qualityStatus === "Wasted" && !department)}
              className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save Quality Check
                </>
              )}
            </button>

            {/* Cancel Button */}
            <button
              onClick={handleClose}
              className="w-full py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
