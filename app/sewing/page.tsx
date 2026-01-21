"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, Scan, CheckCircle, AlertCircle, History, User, Clock, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import DefectiveModal from "@/app/components/DefectiveModal";

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface BarcodeDetails {
  id: string;
  design: string;
  size: string;
  item: string;
  unitNumber: number;
  status: string;
  currentDepartment: string;
  departmentHistory: DepartmentScan[];
  createdAt: string;
  scannedAt?: string;
}

export default function SewingPage() {
  const { user, logout } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barcodeDetails, setBarcodeDetails] = useState<BarcodeDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [showDefectiveModal, setShowDefectiveModal] = useState(false);
  const [isDefectiveScanMode, setIsDefectiveScanMode] = useState(false);

  useEffect(() => {
    if (!scanning) return;

    const scanner = new Html5QrcodeScanner(
      "reader",
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
      },
      false
    );

    scanner.render(
      async (decodedText) => {
        scanner.clear();
        setScanning(false);
        await processScan(decodedText);
      },
      () => {
        // ignore scan errors
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scanning]);

  const processScan = async (barcodeData: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    setBarcodeDetails(null);

    try {
      if (isDefectiveScanMode) {
        const response = await fetch(`/api/barcodes/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ barcodeData }),
        });

        const result = await response.json();

        if (result.success) {
          setBarcodeDetails(result.barcode);
          setShowDefectiveModal(true);
        } else {
          setError(result.message || "Barcode not found");
        }
      } else {
        const response = await fetch("/api/barcodes/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData,
            department: "Sewing",
            scannedBy: user?.name || user?.username,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setBarcodeDetails(result.barcode);
          setSuccess(`Product updated to Sewing department by ${user?.name}`);
          setScanCount((prev) => prev + 1);
        } else {
          if (result.alreadyScanned) {
            toast.error(result.message);
          }
          setError(result.message || "Barcode not found");
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to process barcode");
    } finally {
      setLoading(false);
    }
  };

  const startScanning = () => {
    setError("");
    setSuccess("");
    setBarcodeDetails(null);
    setIsDefectiveScanMode(false);
    setScanning(true);
  };

  const startDefectiveScan = () => {
    setError("");
    setSuccess("");
    setBarcodeDetails(null);
    setIsDefectiveScanMode(true);
    setScanning(true);
  };

  const resetScanner = () => {
    setBarcodeDetails(null);
    setError("");
    setSuccess("");
    setScanning(false);
    setShowHistory(false);
    setIsDefectiveScanMode(false);
    setShowDefectiveModal(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const getSizeLabel = (size: string) => {
    switch (size) {
      case "S": return "Small";
      case "M": return "Medium";
      case "L": return "Large";
      default: return size;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl">🧵</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sewing Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Scanned Today</p>
            <p className="text-2xl font-bold text-orange-600">{scanCount}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto p-6">
        {/* Info Card */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <User className="text-orange-600 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-orange-800">Welcome, {user?.name}</p>
              <p className="text-sm text-orange-700">
                Scan product barcodes to update their status to <strong>Sewing</strong> department.
                Your name and scan time will be recorded automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <DepartmentPaymentSummary department="Sewing" />
        </div>

        {/* Payment Display */}
        <div className="mb-6">
          <PaymentDisplay userName={user?.name || ""} department="Sewing" scanCount={scanCount} />
        </div>

        {/* Payment by Design */}
        <div className="mb-6">
          <PaymentByDesignDisplay userName={user?.name || ""} department="Sewing" />
        </div>

        {/* Scanner Section */}
        {!scanning && !barcodeDetails && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scan className="text-orange-600" size={40} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to Scan</h2>
            <p className="text-gray-600 mb-6">
              Click the button below to start scanning product barcodes
            </p>
            <div className="space-y-3">
              <button
                onClick={startScanning}
                className="w-full bg-orange-600 text-white py-4 rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <Scan size={20} />
                Start Scanning
              </button>
              <button
                onClick={startDefectiveScan}
                className="w-full bg-yellow-500 text-white py-4 rounded-lg font-semibold hover:bg-yellow-600 transition flex items-center justify-center gap-2"
              >
                <AlertTriangle size={20} />
                Scan Defective Item
              </button>
            </div>
          </div>
        )}

        {/* Active Scanner */}
        {scanning && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="text-center mb-4">
              <h2 className="text-lg font-semibold">
                {isDefectiveScanMode ? "📷 Scanning Defective Item..." : "📷 Scanning..."}
              </h2>
              {isDefectiveScanMode && (
                <p className="text-sm text-yellow-600">Scan the damaged/defective product</p>
              )}
            </div>
            <div id="reader" className="rounded-lg overflow-hidden"></div>
            <button
              onClick={resetScanner}
              className="mt-4 w-full py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing barcode...</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <AlertCircle className="text-red-600" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4 flex items-center gap-3">
            <CheckCircle className="text-green-600" size={20} />
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Barcode Details */}
        {barcodeDetails && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{barcodeDetails.design}</h3>
                  <p className="opacity-90">Unit #{barcodeDetails.unitNumber}</p>
                </div>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  {barcodeDetails.currentDepartment}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Item</p>
                  <p className="font-semibold">{barcodeDetails.item}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Size</p>
                  <p className="font-semibold">{getSizeLabel(barcodeDetails.size)}</p>
                </div>
              </div>

              {/* Scan Info */}
              <div className="bg-orange-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-orange-600" />
                  <p className="text-sm font-medium text-orange-800">Scan Recorded</p>
                </div>
                <div className="text-sm text-orange-700">
                  <p><strong>Scanned by:</strong> {user?.name}</p>
                  <p><strong>Time:</strong> {formatDate(barcodeDetails.scannedAt || new Date().toISOString())}</p>
                  <p><strong>Department:</strong> Sewing</p>
                </div>
              </div>

              {/* History Toggle */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700"
              >
                <History size={16} />
                {showHistory ? "Hide" : "Show"} Scan History ({barcodeDetails.departmentHistory?.length || 0})
              </button>

              {/* History */}
              {showHistory && barcodeDetails.departmentHistory && (
                <div className="border rounded-lg divide-y">
                  {barcodeDetails.departmentHistory.map((scan, index) => (
                    <div key={index} className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{scan.department}</p>
                        <p className="text-xs text-gray-500">
                          {scan.scannedBy ? `by ${scan.scannedBy}` : "Unknown user"}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">{formatDate(scan.scannedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t">
              <button
                onClick={resetScanner}
                className="w-full bg-orange-600 text-white py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
              >
                Scan Another Barcode
              </button>
            </div>
          </div>
        )}

        {/* Defective Modal */}
        {barcodeDetails && (
          <DefectiveModal
            isOpen={showDefectiveModal}
            onClose={() => {
              setShowDefectiveModal(false);
              resetScanner();
            }}
            barcodeId={barcodeDetails.id}
            barcodeInfo={{
              design: barcodeDetails.design,
              item: barcodeDetails.item,
              size: barcodeDetails.size,
              unitNumber: barcodeDetails.unitNumber,
            }}
            department="Sewing"
            markedBy={user?.name || user?.username || "Unknown"}
            onSuccess={resetScanner}
          />
        )}
      </div>
    </div>
  );
}
