"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { X, FileOutput, CheckCircle, AlertCircle, Scan } from "lucide-react";
import toast from "react-hot-toast";

interface OutpassModalProps {
  isOpen: boolean;
  onClose: () => void;
  department: string;
  userName: string;
}

export default function OutpassModal({ isOpen, onClose, department, userName }: OutpassModalProps) {
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [scannedInfo, setScannedInfo] = useState<{ design: string; item: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      resetState();
      return;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!scanning || !isOpen) return;

    const scanner = new Html5QrcodeScanner(
      "outpass-reader",
      {
        fps: 10,
        qrbox: { width: 200, height: 200 },
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        scanner.clear();
        setScanning(false);
        await processOutpassScan(decodedText);
      },
      () => {
        // ignore scan errors
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scanning, isOpen]);

  const resetState = () => {
    setScanning(false);
    setLoading(false);
    setSuccess(false);
    setError("");
    setScannedInfo(null);
  };

  const processOutpassScan = async (barcodeData: string) => {
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const response = await fetch("/api/outpass", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData,
          department,
          scannedBy: userName,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setScannedInfo({
          design: result.barcode?.design || "Unknown",
          item: result.barcode?.item || "Unknown",
        });
        toast.success("Outpass generated successfully!");
      } else {
        setError(result.message || "Failed to generate outpass");
        toast.error(result.message || "Failed to generate outpass");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate outpass");
      toast.error("Failed to generate outpass");
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    setError("");
    setSuccess(false);
    setScannedInfo(null);
    setScanning(true);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-sm w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <FileOutput className="text-white" size={16} />
            </div>
            <h2 className="font-semibold text-gray-900">Generate Outpass</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 transition"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Success State */}
          {success && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <h3 className="font-semibold text-green-700 mb-1">Outpass Generated!</h3>
              {scannedInfo && (
                <p className="text-sm text-gray-600">
                  {scannedInfo.design} - {scannedInfo.item}
                </p>
              )}
              <div className="mt-4 space-y-2">
                <button
                  onClick={startScanning}
                  className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition"
                >
                  Scan Another
                </button>
                <button
                  onClick={handleClose}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && !success && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="text-red-600" size={32} />
              </div>
              <h3 className="font-semibold text-red-700 mb-1">Failed</h3>
              <p className="text-sm text-red-600 mb-4">{error}</p>
              <div className="space-y-2">
                <button
                  onClick={startScanning}
                  className="w-full bg-orange-600 text-white py-2 rounded-lg font-medium hover:bg-orange-700 transition"
                >
                  Try Again
                </button>
                <button
                  onClick={handleClose}
                  className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-600 mx-auto mb-3"></div>
              <p className="text-sm text-gray-600">Generating outpass...</p>
            </div>
          )}

          {/* Scanner */}
          {scanning && !loading && !success && !error && (
            <div>
              <div id="outpass-reader" className="rounded-lg overflow-hidden mb-3"></div>
              <button
                onClick={() => setScanning(false)}
                className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Initial State */}
          {!scanning && !loading && !success && !error && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Scan className="text-orange-600" size={32} />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">Scan Product</h3>
              <p className="text-sm text-gray-500 mb-4">
                Scan a barcode to generate outpass from {department}
              </p>
              <button
                onClick={startScanning}
                className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700 transition flex items-center gap-2 justify-center"
              >
                <Scan size={18} />
                Start Scanning
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
