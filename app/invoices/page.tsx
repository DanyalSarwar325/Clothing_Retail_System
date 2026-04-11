"use client";
import React, { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { RefreshCw, Package, Eye, Trash2, FileText, Download, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface InvoiceLog {
  _id: string;
  fileName: string;
  fileSize: number;
  trackingIdsFound: number;
  trackingIds: string[];
  processedResults: {
    trackingId: string;
    status: string;
    orderStatus?: string;
  }[];
  processingSummary: {
    totalTracking: number;
    markedPaid: number;
    skipped: number;
    notFound: number;
    errors: number;
  };
  parsingStatus: string;
  parsingMethod: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

interface UploadResult {
  trackingId: string;
  status: string;
  orderStatus?: string;
}

export default function InvoicesPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<any>(null);
  const [success, setSuccess] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ summary: any; results: UploadResult[] } | null>(null);

  const [history, setHistory] = useState<InvoiceLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [selectedLog, setSelectedLog] = useState<InvoiceLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Fetch history on mount
  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/invoices/history');
      if (!res.ok) return;
      const data = await res.json();
      setHistory(data.invoices || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
        setError('Please upload a PDF file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setErrorDetails(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF file');
      return;
    }

    setUploading(true);
    setError(null);
    setErrorDetails(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/invoices/process-pdf', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorDetails(data.details || data.suggestions || null);
        throw new Error(data.error || 'Failed to process invoice');
      }

      setUploadResult({
        summary: data.summary,
        results: data.processedOrders,
      });
      setSuccess(true);
      setFile(null);

      // Refresh history after successful upload
      setTimeout(() => {
        fetchHistory();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Error processing PDF');
      setSuccess(false);
    } finally {
      setUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    if (status.includes('MARKED')) return 'bg-green-100 text-green-800';
    if (status.includes('SKIPPED')) return 'bg-yellow-100 text-yellow-800';
    if (status.includes('NOT FOUND')) return 'bg-blue-100 text-blue-800';
    return 'bg-red-100 text-red-800';
  };

  const getParsingStatusIcon = (status: string) => {
    if (status === 'success') return <CheckCircle size={18} className="text-green-600" />;
    if (status === 'partial') return <AlertCircle size={18} className="text-yellow-600" />;
    return <AlertCircle size={18} className="text-red-600" />;
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <FileText className="text-indigo-600" size={24} />
                <h1 className="text-xl font-bold text-gray-900">Invoice Management</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Upload Section - Left Side */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-lg shadow p-6 space-y-6 sticky top-8">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Upload Invoice</h2>
                  <p className="text-sm text-gray-600">Upload PostEx PDF to process tracking IDs</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-indigo-400 transition-colors">
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      id="pdf-input"
                    />
                    <label htmlFor="pdf-input" className="cursor-pointer block">
                      {file ? (
                        <div>
                          <p className="font-medium text-green-600">{file.name}</p>
                          <p className="text-xs text-gray-500 mt-1">({(file.size / 1024).toFixed(2)} KB)</p>
                          <p className="text-xs text-gray-500 mt-2">Click to change</p>
                        </div>
                      ) : (
                        <div>
                          <Package size={24} className="mx-auto text-gray-400 mb-2" />
                          <p className="font-medium text-gray-900">Click to upload</p>
                          <p className="text-xs text-gray-500 mt-1">PDF files only</p>
                        </div>
                      )}
                    </label>
                  </div>

                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-red-700">Error: {error}</p>
                      </div>
                      {errorDetails?.suggestions && (
                        <div className="bg-white p-3 rounded border border-red-100">
                          <p className="text-xs font-semibold text-gray-700 mb-2">💡 Suggestions:</p>
                          <ul className="space-y-1">
                            {errorDetails.suggestions.map((s: string, i: number) => (
                              <li key={i} className="text-xs text-gray-600">• {s}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {success && uploadResult && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="text-green-600" size={20} />
                        <p className="text-sm font-semibold text-green-700">Successfully Processed!</p>
                      </div>
                      <div className="bg-white p-3 rounded space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total Tracking IDs:</span>
                          <span className="font-semibold">{uploadResult.summary.totalTracking}</span>
                        </div>
                        <div className="flex justify-between text-green-700">
                          <span>✓ Marked Paid:</span>
                          <span className="font-semibold">{uploadResult.summary.markedPaid}</span>
                        </div>
                        <div className="flex justify-between text-yellow-700">
                          <span>⊘ Skipped:</span>
                          <span className="font-semibold">{uploadResult.summary.skipped}</span>
                        </div>
                        <div className="flex justify-between text-blue-700">
                          <span>? Not Found:</span>
                          <span className="font-semibold">{uploadResult.summary.notFound}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!file || uploading}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw size={16} className="animate-spin" />
                        Processing...
                      </div>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </form>

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => fetchHistory()}
                    className="w-full px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    Refresh History
                  </button>
                </div>
              </div>
            </div>

            {/* History Section - Right Side */}
            <div className="lg:col-span-2">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">Upload History</h2>
                  <span className="text-sm text-gray-500">{history.length} uploads</span>
                </div>

                {loadingHistory ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-gray-500 flex flex-col items-center gap-2">
                      <RefreshCw size={24} className="animate-spin" />
                      <p>Loading history...</p>
                    </div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
                    <FileText size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No invoices uploaded yet</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((log) => (
                      <div key={log._id} className="bg-white rounded-lg shadow p-4 space-y-3 hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {getParsingStatusIcon(log.parsingStatus)}
                              <h3 className="font-semibold text-gray-900">{log.fileName}</h3>
                            </div>
                            <p className="text-xs text-gray-500">
                              {new Date(log.createdAt).toLocaleString()} • {(log.fileSize / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setSelectedLog(log);
                              setShowDetails(true);
                            }}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="View details"
                          >
                            <Eye size={18} />
                          </button>
                        </div>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-4 gap-2 bg-gray-50 p-3 rounded-lg">
                          <div className="text-center">
                            <p className="text-xs text-gray-600">Found</p>
                            <p className="font-semibold text-gray-900">{log.processingSummary.totalTracking}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-green-600">Paid</p>
                            <p className="font-semibold text-green-700">{log.processingSummary.markedPaid}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-yellow-600">Skipped</p>
                            <p className="font-semibold text-yellow-700">{log.processingSummary.skipped}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs text-blue-600">Not Found</p>
                            <p className="font-semibold text-blue-700">{log.processingSummary.notFound}</p>
                          </div>
                        </div>

                        {log.parsingStatus === 'error' && log.errorMessage && (
                          <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
                            {log.errorMessage}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {showDetails && selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">{selectedLog.fileName}</h2>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-500 text-3xl"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-auto max-h-[calc(90vh-100px)] space-y-6">
              {/* Summary */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Processing Summary</h3>
                <div className="grid grid-cols-5 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-gray-600">Total Found</p>
                    <p className="text-2xl font-bold text-gray-900">{selectedLog.processingSummary.totalTracking}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-green-600">Marked Paid</p>
                    <p className="text-2xl font-bold text-green-700">{selectedLog.processingSummary.markedPaid}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-yellow-600">Skipped</p>
                    <p className="text-2xl font-bold text-yellow-700">{selectedLog.processingSummary.skipped}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-blue-600">Not Found</p>
                    <p className="text-2xl font-bold text-blue-700">{selectedLog.processingSummary.notFound}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <p className="text-sm text-red-600">Errors</p>
                    <p className="text-2xl font-bold text-red-700">{selectedLog.processingSummary.errors}</p>
                  </div>
                </div>
              </div>

              {/* File Info */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">File Information</h3>
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg text-sm">
                  <div>
                    <p className="text-gray-600">File Name</p>
                    <p className="font-mono text-gray-900">{selectedLog.fileName}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">File Size</p>
                    <p className="text-gray-900">{(selectedLog.fileSize / 1024).toFixed(2)} KB</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Upload Date</p>
                    <p className="text-gray-900">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-gray-600">Parsing Method</p>
                    <p className="text-gray-900">{selectedLog.parsingMethod}</p>
                  </div>
                </div>
              </div>

              {/* Tracking IDs Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Detailed Results</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedLog.processedResults.map((result, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-3 rounded text-sm">
                      <div>
                        <p className="font-mono font-medium text-gray-900">{result.trackingId}</p>
                        {result.orderStatus && (
                          <p className="text-xs text-gray-500">Status: {result.orderStatus}</p>
                        )}
                      </div>
                      <span className={`px-3 py-1 rounded text-xs font-medium ${getStatusColor(result.status)}`}>
                        {result.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}
