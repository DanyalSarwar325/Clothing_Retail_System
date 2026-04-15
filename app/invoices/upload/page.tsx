"use client";
import React, { useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import {
  Upload,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Filter,
  Check,
  X as XIcon,
  RefreshCw,
} from "lucide-react";
import Link from "next/link"; 

interface TrackingDetail {
  id: string;
  sequence: number;
  line_number: number;
  status: string;
  context: string;
  pattern_type: string;
}

interface ExtractionResult {
  success: boolean;
  trackingIds: string[];
  trackingDetails: TrackingDetail[];
  extractedText: string;
  error?: string;
}

interface UploadResult {
  success: boolean;
  message: string;
  summary?: {
    totalTrackingIds: number;
    deliveredTrackingIds: number;
    successfulUpdates: number;
    failedMatches: number;
  };
  updatedOrders?: any[];
  failedMatches?: any[];
}

export default function InvoiceUploadPage() {
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [extractionResult, setExtractionResult] = useState<ExtractionResult | null>(null);
  const [selectedTrackingIds, setSelectedTrackingIds] = useState<Set<string>>(new Set());
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Pagination for tracking IDs
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleFileChange = (file: File | null) => {
    if (!file) {
      setInvoiceFile(null);
      return;
    }

    if (file.type !== "application/pdf") {
      setError("Please select a PDF file");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError("File size must be less than 50MB");
      return;
    }

    setError(null);
    setInvoiceFile(file);
    setExtractionResult(null);
    setUploadResult(null);
    setSelectedTrackingIds(new Set());
  };

  const handleExtractTracking = useCallback(async () => {
    if (!invoiceFile) return;

    setExtracting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", invoiceFile);

      const fastApiUrl = process.env.NEXT_PUBLIC_FASTAPI_URL || "http://localhost:8000";

      console.log("[Invoice Upload] Extracting tracking IDs...");
      const res = await fetch(`${fastApiUrl}/extract-tracking-ids`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Failed to extract tracking IDs");
      }

      const data = await res.json();
      console.log("[Invoice Upload] Extraction result:", data);

      if (!data.success) {
        throw new Error(data.error || "No tracking IDs found");
      }

      // Transform snake_case to camelCase to match TypeScript interface
      const transformedData: ExtractionResult = {
        success: data.success,
        trackingIds: data.tracking_ids || [],
        trackingDetails: data.tracking_details || [],
        extractedText: data.extracted_text || "",
        error: data.error,
      };

      setExtractionResult(transformedData);

      // Pre-select all "Delivered" items
      const deliveredIds = (data.tracking_details || [])
        .filter((t: TrackingDetail) => t.status === "Delivered")
        .map((t: TrackingDetail) => t.id);

      setSelectedTrackingIds(new Set(deliveredIds));
    } catch (e: any) {
      console.error("[Invoice Upload] Error:", e);
      setError(e.message || "Failed to extract tracking IDs");
    } finally {
      setExtracting(false);
    }
  }, [invoiceFile]);

  const handleSelectTracking = (id: string) => {
    const newSet = new Set(selectedTrackingIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedTrackingIds(newSet);
  };

  const handleSelectAll = () => {
    if (selectedTrackingIds.size === filteredTrackingDetails.length) {
      setSelectedTrackingIds(new Set());
    } else {
      const allIds = new Set(filteredTrackingDetails.map((t) => t.id));
      setSelectedTrackingIds(allIds);
    }
  };

  const handleSubmit = useCallback(async () => {
    if (selectedTrackingIds.size === 0) {
      setError("Please select at least one tracking ID");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      console.log("[Invoice Upload] Submitting selected tracking IDs...");

      const res = await fetch("/api/invoices/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          trackingIds: extractionResult?.trackingIds || [],
          deliveredTrackingIds: Array.from(selectedTrackingIds),
          invoiceFilename: invoiceFile?.name,
          extractedText: extractionResult?.extractedText || "",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to process invoice");
      }

      const data = await res.json();
      console.log("[Invoice Upload] Success:", data);

      setUploadResult(data);
    } catch (e: any) {
      console.error("[Invoice Upload] Error:", e);
      setError(e.message || "Failed to upload invoice");
    } finally {
      setUploading(false);
    }
  }, [invoiceFile, selectedTrackingIds, extractionResult]);

  // Filter tracking details by status
  const filteredTrackingDetails = (extractionResult?.trackingDetails || []).filter((t) => {
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredTrackingDetails.length / itemsPerPage);
  const startIdx = (currentPage - 1) * itemsPerPage;
  const paginatedDetails = filteredTrackingDetails.slice(startIdx, startIdx + itemsPerPage);

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 h-16">
              <Link
                href="/admin/shopify-orders"
                className="text-gray-500 hover:text-gray-700 transition-colors"
                title="Back to orders"
              >
                <ArrowLeft size={20} />
              </Link>
              <div className="flex items-center gap-3">
                <FileText className="text-blue-600" size={24} />
                <h1 className="text-xl font-bold text-gray-900">Invoice Upload & Processing</h1>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {uploadResult ? (
            // Success State
            <div className="bg-white rounded-lg shadow">
              <div className="p-8">
                <div className="flex items-start gap-4 mb-6">
                  <CheckCircle size={32} className="text-green-600 shrink-0" />
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">Invoice Processed Successfully</h2>
                    <p className="text-gray-600 mt-1">{uploadResult.message}</p>
                  </div>
                </div>

                {uploadResult.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Total Tracking IDs</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {uploadResult.summary.totalTrackingIds}
                      </p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Delivered</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {uploadResult.summary.deliveredTrackingIds}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Orders Updated</p>
                      <p className="text-2xl font-bold text-green-600">
                        {uploadResult.summary.successfulUpdates}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4">
                      <p className="text-sm text-gray-600">Failed Matches</p>
                      <p className="text-2xl font-bold text-red-600">
                        {uploadResult.summary.failedMatches}
                      </p>
                    </div>
                  </div>
                )}

                {uploadResult.updatedOrders && uploadResult.updatedOrders.length > 0 && (
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Updated Orders</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {uploadResult.updatedOrders.map((order: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 rounded">
                          <CheckCircle size={16} className="text-green-600" />
                          <span className="text-sm text-gray-700">
                            Order {order.orderNumber} (Tracking: {order.trackingId})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setUploadResult(null);
                      setExtractionResult(null);
                      setInvoiceFile(null);
                      setSelectedTrackingIds(new Set());
                      setCurrentPage(1);
                    }}
                    className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Upload Another Invoice
                  </button>
                  <Link
                    href="/admin/shopify-orders"
                    className="px-6 py-2 bg-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    Back to Orders
                  </Link>
                </div>
              </div>
            </div>
          ) : extractionResult ? (
            // Extraction Result State - Show tracking IDs
            <div className="space-y-6">
              {/* Summary */}
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Invoice: {invoiceFile?.name}</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Total Tracking IDs</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {extractionResult.trackingIds.length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Delivered</p>
                    <p className="text-2xl font-bold text-green-600">
                      {(extractionResult.trackingDetails || []).filter((t) => t.status === "Delivered").length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">In Transit</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {(extractionResult.trackingDetails || []).filter((t) => t.status === "In Transit").length}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Selected</p>
                    <p className="text-2xl font-bold text-purple-600">{selectedTrackingIds.size}</p>
                  </div>
                </div>
              </div>

              {/* Filter & Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
                  <div className="flex items-center gap-2">
                    <Filter size={16} className="text-gray-500" />
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Statuses</option>
                      <option value="Delivered">Delivered</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Pending">Pending</option>
                      <option value="Unknown">Unknown</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {selectedTrackingIds.size === paginatedDetails.length ? "Deselect All" : "Select All"}
                  </button>
                </div>

                {/* Tracking IDs Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">
                          <input
                            type="checkbox"
                            checked={
                              paginatedDetails.length > 0 &&
                              paginatedDetails.every((t) => selectedTrackingIds.has(t.id))
                            }
                            onChange={handleSelectAll}
                            className="rounded"
                          />
                        </th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">#</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">Tracking ID</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">Line #</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-gray-900">Context</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedDetails.map((tracking) => (
                        <tr key={tracking.id} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedTrackingIds.has(tracking.id)}
                              onChange={() => handleSelectTracking(tracking.id)}
                              className="rounded"
                            />
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">{tracking.sequence}</td>
                          <td className="px-4 py-3 font-mono text-blue-600 font-medium">{tracking.id}</td>
                          <td className="px-4 py-3 text-gray-600">{tracking.line_number}</td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                                tracking.status === "Delivered"
                                  ? "bg-green-100 text-green-700"
                                  : tracking.status === "In Transit"
                                  ? "bg-orange-100 text-orange-700"
                                  : tracking.status === "Pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {tracking.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 truncate max-w-xs" title={tracking.context}>
                            {tracking.context}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 rounded text-sm ${
                          page === currentPage
                            ? "bg-blue-600 text-white"
                            : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleSubmit}
                  disabled={uploading || selectedTrackingIds.size === 0}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Mark {selectedTrackingIds.size} as Paid
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setExtractionResult(null);
                    setInvoiceFile(null);
                    setSelectedTrackingIds(new Set());
                    setCurrentPage(1);
                  }}
                  className="px-6 py-3 bg-gray-200 text-gray-900 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            // Initial Upload State
            <div className="bg-white rounded-lg shadow p-8">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Upload Invoice PDF</h2>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-red-900">Error</h3>
                      <p className="text-sm text-red-800">{error}</p>
                    </div>
                  </div>
                )}

                {/* File Upload */}
                <div className="mb-8">
                  <label className="block">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors cursor-pointer">
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                        className="hidden"
                        id="file-input"
                        disabled={extracting}
                      />
                      <div className="flex flex-col items-center gap-3">
                        <Upload size={40} className="text-gray-400" />
                        <span className="text-lg font-medium text-gray-700">
                          Click to upload or drag and drop
                        </span>
                        <span className="text-sm text-gray-500">PDF files (up to 50MB)</span>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Selected File */}
                {invoiceFile && (
                  <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-3">
                    <FileText size={20} className="text-blue-600" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-900">{invoiceFile.name}</p>
                      <p className="text-sm text-blue-700">{(invoiceFile.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    <button
                      onClick={() => handleFileChange(null)}
                      className="text-blue-600 hover:text-blue-700"
                    >
                      <XIcon size={20} />
                    </button>
                  </div>
                )}

                {/* Extract Button */}
                <button
                  onClick={handleExtractTracking}
                  disabled={!invoiceFile || extracting}
                  className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {extracting ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      Extracting Tracking IDs...
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      Extract Tracking IDs
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}
