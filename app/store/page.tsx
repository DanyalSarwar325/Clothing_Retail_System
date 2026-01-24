"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, Scan, CheckCircle, AlertCircle, History, User, Clock, Box, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import toast from "react-hot-toast";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";

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

interface FinalStickerDetails {
  _id: string;
  design: string;
  size: string;
  suitType: string;
  unitNumber: number;
  sellingPrice: number;
  status: string;
  currentDepartment: string;
}

type ScanMode = "check-in" | "check-out";

export default function StorePage() {
  const { user, logout } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barcodeDetails, setBarcodeDetails] = useState<BarcodeDetails | null>(null);
  const [finalStickerDetails, setFinalStickerDetails] = useState<FinalStickerDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [scanMode, setScanMode] = useState<ScanMode>("check-in");

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
    setFinalStickerDetails(null);

    try {
      // Check if it's a final sticker
      let parsedData;
      try {
        parsedData = JSON.parse(barcodeData);
      } catch {
        parsedData = null;
      }

      if (parsedData && parsedData.type === "final") {
        // Handle final sticker scan
        const endpoint = scanMode === "check-in" 
          ? "/api/store/check-in" 
          : "/api/store/check-out";

        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData,
            scannedBy: user?.name || user?.username,
            dispatchedBy: user?.name || user?.username,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setFinalStickerDetails(result.sticker);
          setSuccess(result.message);
          setScanCount((prev) => prev + 1);
          toast.success(result.message);
        } else {
          setError(result.message || "Failed to process final sticker");
          toast.error(result.message);
        }
      } else {
        // Store only accepts final stickers, not individual barcodes
        setError("Store only accepts final stickers. Please scan a final sticker barcode.");
        toast.error("Store only accepts final stickers. Individual item barcodes are not allowed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to process barcode");
    } finally {
      setLoading(false);
    }
  };

  const startScanning = (mode: ScanMode) => {
    setScanMode(mode);
    setError("");
    setSuccess("");
    setBarcodeDetails(null);
    setFinalStickerDetails(null);
    setScanning(true);
  };

  const resetScanner = () => {
    setBarcodeDetails(null);
    setFinalStickerDetails(null);
    setError("");
    setSuccess("");
    setScanning(false);
    setShowHistory(false);
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
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Box className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Store Check-In</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Checked In Today</p>
            <p className="text-2xl font-bold text-blue-600">{scanCount}</p>
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
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <User className="text-blue-600 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-blue-800">Welcome, {user?.name}</p>
              <p className="text-sm text-blue-700">
                Scan product barcodes to check items into <strong>Store</strong>. Your name and check-in time will be recorded automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Displays */}
        <div className="space-y-4 mb-6">
          <DepartmentPaymentSummary department="Store" refreshKey={scanCount} />
          <PaymentDisplay userName={user?.name || user?.username || ""} department="Store" scanCount={scanCount} />
          <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Store" scanCount={scanCount} />
        </div>

        {/* Scanner Section */}
        {!scanning && !barcodeDetails && !finalStickerDetails && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scan className="text-blue-600" size={40} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Store Inventory Management</h2>
            <p className="text-gray-600 mb-6">
              Scan individual items or final stickers to manage store inventory
            </p>
            
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => startScanning("check-in")}
                className="bg-green-600 text-white py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowDownToLine size={20} />
                Check In
              </button>
              <button
                onClick={() => startScanning("check-out")}
                className="bg-orange-600 text-white py-4 rounded-lg font-semibold hover:bg-orange-700 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowUpFromLine size={20} />
                Check Out
              </button>
            </div>
            
            <p className="text-xs text-gray-500">
              <strong>Check In:</strong> Add items to store inventory &nbsp;|&nbsp; 
              <strong>Check Out:</strong> Dispatch items for delivery
            </p>
          </div>
        )}

        {/* Active Scanner */}
        {scanning && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className={`text-center mb-4 p-3 rounded-lg ${scanMode === "check-in" ? "bg-green-100" : "bg-orange-100"}`}>
              <h2 className="text-lg font-semibold flex items-center justify-center gap-2">
                {scanMode === "check-in" ? (
                  <>
                    <ArrowDownToLine className="text-green-600" size={20} />
                    <span className="text-green-800">Scanning for Check In</span>
                  </>
                ) : (
                  <>
                    <ArrowUpFromLine className="text-orange-600" size={20} />
                    <span className="text-orange-800">Scanning for Check Out (Dispatch)</span>
                  </>
                )}
              </h2>
            </div>
            <div id="reader" className="rounded-lg overflow-hidden"></div>
            <button
              onClick={() => setScanning(false)}
              className="mt-4 w-full py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
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
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4">
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
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={16} className="text-blue-600" />
                  <p className="text-sm font-medium text-blue-800">Check-In Recorded</p>
                </div>
                <div className="text-sm text-blue-700">
                  <p><strong>Checked in by:</strong> {user?.name}</p>
                  <p><strong>Time:</strong> {formatDate(barcodeDetails.scannedAt || new Date().toISOString())}</p>
                  <p><strong>Department:</strong> Store</p>
                </div>
              </div>

              {/* History Toggle */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
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
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Check In Another
              </button>
            </div>
          </div>
        )}

        {/* Final Sticker Details */}
        {finalStickerDetails && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`text-white p-4 ${scanMode === "check-in" ? "bg-gradient-to-r from-green-500 to-green-600" : "bg-gradient-to-r from-orange-500 to-orange-600"}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold">{finalStickerDetails.design}</h3>
                  <p className="opacity-90">Suit #{finalStickerDetails.unitNumber}</p>
                </div>
                <span className="bg-white/20 px-3 py-1 rounded-full text-sm">
                  {scanMode === "check-in" ? "Checked In" : "Dispatched"}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Suit Type</p>
                  <p className="font-semibold">{finalStickerDetails.suitType}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Size</p>
                  <p className="font-semibold">{getSizeLabel(finalStickerDetails.size)}</p>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-xs text-gray-500">Selling Price</p>
                  <p className="font-semibold text-green-600">Rs. {finalStickerDetails.sellingPrice?.toLocaleString()}</p>
                </div>
              </div>

              {/* Status Info */}
              <div className={`p-3 rounded-lg ${scanMode === "check-in" ? "bg-green-50" : "bg-orange-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {scanMode === "check-in" ? (
                    <ArrowDownToLine size={16} className="text-green-600" />
                  ) : (
                    <ArrowUpFromLine size={16} className="text-orange-600" />
                  )}
                  <p className={`text-sm font-medium ${scanMode === "check-in" ? "text-green-800" : "text-orange-800"}`}>
                    {scanMode === "check-in" ? "Checked Into Store" : "Dispatched for Delivery"}
                  </p>
                </div>
                <div className={`text-sm ${scanMode === "check-in" ? "text-green-700" : "text-orange-700"}`}>
                  <p><strong>{scanMode === "check-in" ? "Checked in" : "Dispatched"} by:</strong> {user?.name}</p>
                  <p><strong>Time:</strong> {formatDate(new Date().toISOString())}</p>
                  <p><strong>Status:</strong> {finalStickerDetails.status}</p>
                </div>
              </div>

              {scanMode === "check-out" && (
                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    <strong>💰 Payment Pending:</strong> Rs. {finalStickerDetails.sellingPrice?.toLocaleString()}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">
                    Use Revenue page to mark payment as received
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t">
              <button
                onClick={resetScanner}
                className={`w-full text-white py-3 rounded-lg font-semibold transition-colors ${scanMode === "check-in" ? "bg-green-600 hover:bg-green-700" : "bg-orange-600 hover:bg-orange-700"}`}
              >
                Scan Another
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
