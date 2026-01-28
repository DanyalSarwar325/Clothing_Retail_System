"use client";

import { useEffect, useState, useRef } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, Scan, CheckCircle, AlertCircle, History, User, Clock, Scissors, FileOutput, X } from "lucide-react";
import toast from "react-hot-toast";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import OutpassModal from "@/app/components/OutpassModal";

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface BarcodeDetails {
  id: string;
  design: string;
  size: string;
  suitType: string;
  item: string;
  unitNumber: number;
  status: string;
  currentDepartment: string;
  departmentHistory: DepartmentScan[];
  createdAt: string;
  scannedAt?: string;
}

export default function CuttingPage() {
  const [active, setActive] = useState("scan");
  const { user, logout } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barcodeDetails, setBarcodeDetails] = useState<BarcodeDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [showOutpassModal, setShowOutpassModal] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const scannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scanning && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [scanning]);

  const processScan = async (barcodeData: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    setBarcodeDetails(null);

    try {
      const response = await fetch("/api/barcodes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData,
          department: "Cutting",
          scannedBy: user?.name || user?.username,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBarcodeDetails(result.barcode);
        setSuccess(`Product scanned in Cutting department by ${user?.name}`);
        setScanCount((prev) => prev + 1);
      } else {
        if (result.alreadyScanned) {
          toast.error(result.message);
        }
        setError(result.message || "Barcode not found");
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
    setScanning(true);
  };

  const resetScanner = () => {
    setBarcodeDetails(null);
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
          <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center">
            <Scissors className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cutting Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Scanned Today</p>
            <p className="text-2xl font-bold text-red-600">{scanCount}</p>
          </div>
          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg transition"
          >
            <FileOutput size={18} />
            Outpass
          </button>
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <User className="text-red-600 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-red-800">Welcome, {user?.name}</p>
              <p className="text-sm text-red-700">
                Scan product barcodes to confirm they are in the <strong>Cutting</strong> department.
                Your name and scan time will be recorded automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <DepartmentPaymentSummary department="Cutting" refreshKey={scanCount} />
        </div>

        {/* Payment Display */}
        <div className="mb-6">
          <PaymentDisplay userName={user?.name || user?.username || ""} department="Cutting" scanCount={scanCount} />
        </div>

        {/* Payment by Design */}
        <div className="mb-6">
          <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Cutting" scanCount={scanCount} />
        </div>

        {/* Scanner Section */}
        {!scanning && !barcodeDetails && !loading && (error === "") && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scan className="text-red-600" size={40} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to Scan</h2>
            <p className="text-gray-600 mb-6">
              Scan a barcode to update product location to Cutting department
            </p>
            <button
              onClick={startScanning}
              className="w-full bg-red-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center gap-2 justify-center"
            >
              <Scan size={20} />
              Start Scanning
            </button>
          </div>
        )}

        {/* Barcode Scanner Input - Waiting for Scan */}
        {scanning && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Waiting for Scan...</h2>
              <button
                onClick={resetScanner}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center">
              <div className="animate-pulse mb-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                  <Scan className="text-red-600" size={32} />
                </div>
              </div>
              <p className="text-gray-600 mb-4">Point your barcode scanner at the product barcode</p>
              <input
                ref={scannerInputRef}
                type="text"
                value={scannerInput}
                onChange={(e) => setScannerInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && scannerInput.trim()) {
                    e.preventDefault();
                    const value = scannerInput.trim();
                    setScannerInput("");
                    setScanning(false);
                    await processScan(value);
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-center opacity-0 absolute"
                autoComplete="off"
                autoFocus
              />
              <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-600 rounded-full animate-[scan_1.5s_ease-in-out_infinite]" style={{width: '30%'}}></div>
              </div>
              <p className="text-xs text-gray-400 mt-3">Scanner input is active and ready</p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-6 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Processing barcode...</p>
          </div>
        )}

        {/* Error Message */}
        {error && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <span className="font-medium">{error}</span>
            </div>
            <button
              onClick={resetScanner}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-200 transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Success - Barcode Details */}
        {barcodeDetails && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Success Header */}
            <div className="bg-green-500 text-white p-4 flex items-center gap-3">
              <CheckCircle size={24} />
              <div>
                <p className="font-semibold">Scan Successful!</p>
                <p className="text-sm opacity-90">{success}</p>
              </div>
            </div>

            {/* Product Info */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <p className="text-sm text-gray-500">Design</p>
                  <p className="font-semibold text-gray-900">{barcodeDetails.design}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Size</p>
                  <p className="font-semibold text-gray-900">{getSizeLabel(barcodeDetails.size)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Suit Type</p>
                  <p className="font-semibold text-gray-900">{barcodeDetails.suitType || "3pc"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Item</p>
                  <p className="font-semibold text-gray-900">{barcodeDetails.item}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Unit #</p>
                  <p className="font-semibold text-gray-900">{barcodeDetails.unitNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Current Department</p>
                  <p className="font-semibold text-red-600">{barcodeDetails.currentDepartment}</p>
                </div>
              </div>

              {/* History Toggle */}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
              >
                <History size={18} />
                <span className="text-sm">
                  {showHistory ? "Hide" : "Show"} Scan History ({barcodeDetails.departmentHistory.length})
                </span>
              </button>

              {/* History List */}
              {showHistory && barcodeDetails.departmentHistory.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="space-y-3">
                    {barcodeDetails.departmentHistory.map((scan, idx) => (
                      <div key={idx} className="flex items-center gap-3 text-sm">
                        <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                        <span className="font-medium">{scan.department}</span>
                        {scan.scannedBy && (
                          <span className="text-gray-500">by {scan.scannedBy}</span>
                        )}
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock size={12} />
                          {formatDate(scan.scannedAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Scan Another Button */}
                <button
                  onClick={resetScanner}
                  className="w-full bg-red-600 text-white py-3 rounded-lg font-semibold hover:bg-red-700 transition flex items-center justify-center gap-2"
                >
                  <Scan size={20} />
                  Scan Another
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => setShowOutpassModal(false)}
        department="Cutting"
        userName={user?.name || user?.username || ""}
      />
    </div>
  );
}
