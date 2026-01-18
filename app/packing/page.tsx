"use client";

import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, Scan, CheckCircle, AlertCircle, History, User, Clock, Box, Package, Trash2, QrCode } from "lucide-react";
import toast from "react-hot-toast";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import QRCode from "qrcode";

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
  barcodeData: string;
}

interface ScannedItem {
  item: string;
  design: string;
  size: string;
  unitNumber: number;
  barcodeData: string;
  scannedAt: Date;
}

interface PacketResult {
  packetId: string;
  design: string;
  size: string;
  unitNumber: number;
  items: string[];
  packetBarcodeData: string;
  packedBy: string;
  packedAt: string;
}

export default function PackingPage() {
  const { user, logout } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barcodeDetails, setBarcodeDetails] = useState<BarcodeDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  
  // Packet creation states
  const [mode, setMode] = useState<"scan" | "packet">("packet");
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [creatingPacket, setCreatingPacket] = useState(false);
  const [packetResult, setPacketResult] = useState<PacketResult | null>(null);
  const [packetQR, setPacketQR] = useState<string>("");
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

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
    scannerRef.current = scanner;

    scanner.render(
      async (decodedText) => {
        scanner.clear();
        setScanning(false);
        if (mode === "packet") {
          await processPacketScan(decodedText);
        } else {
          await processScan(decodedText);
        }
      },
      () => {
        // ignore scan errors
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, [scanning, mode]);

  // Process scan for packet creation
  const processPacketScan = async (barcodeData: string) => {
    setLoading(true);
    setError("");

    try {
      // Parse barcode data
      let parsed;
      try {
        parsed = JSON.parse(barcodeData);
      } catch {
        setError("Invalid barcode format");
        setLoading(false);
        return;
      }

      const { design, size, item, unit } = parsed;

      // Check if already scanned
      const alreadyScanned = scannedItems.find((i) => i.barcodeData === barcodeData);
      if (alreadyScanned) {
        setError(`${item} already scanned`);
        toast.error(`${item} already scanned`);
        setLoading(false);
        return;
      }

      // Check if we already have this item type
      const sameItemType = scannedItems.find((i) => i.item === item);
      if (sameItemType) {
        setError(`${item} already added. Remove it first to replace.`);
        toast.error(`${item} already added`);
        setLoading(false);
        return;
      }

      // Check if matching same unit (if items exist)
      if (scannedItems.length > 0) {
        const firstItem = scannedItems[0];
        if (firstItem.design !== design || firstItem.size !== size || firstItem.unitNumber !== unit) {
          setError(`Item doesn't match! Expected: ${firstItem.design} - ${firstItem.size} - Unit #${firstItem.unitNumber}`);
          toast.error("Item doesn't match the unit");
          setLoading(false);
          return;
        }
      }

      // Add to scanned items
      const newItem: ScannedItem = {
        item,
        design,
        size,
        unitNumber: unit,
        barcodeData,
        scannedAt: new Date(),
      };

      setScannedItems((prev) => [...prev, newItem]);
      toast.success(`${item} scanned successfully`);
      setSuccess(`${item} added - ${3 - scannedItems.length - 1} more to go`);

    } catch (err: any) {
      setError(err.message || "Failed to process barcode");
    } finally {
      setLoading(false);
    }
  };

  // Create packet from 3 scanned items
  const createPacket = async () => {
    if (scannedItems.length !== 3) {
      setError("Please scan all 3 items (Shalwar, Qameez, Dupatta)");
      return;
    }

    setCreatingPacket(true);
    setError("");

    try {
      const response = await fetch("/api/packets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeDataList: scannedItems.map((i) => i.barcodeData),
          packedBy: user?.name || user?.username,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setPacketResult(result.packet);
        // Generate QR code for the packet
        const qr = await QRCode.toDataURL(result.packet.packetBarcodeData);
        setPacketQR(qr);
        toast.success("Packet created successfully!");
        setScanCount((prev) => prev + 1);
        setSuccess("");
      } else {
        setError(result.message || "Failed to create packet");
        toast.error(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create packet");
    } finally {
      setCreatingPacket(false);
    }
  };

  // Remove scanned item
  const removeScannedItem = (barcodeData: string) => {
    setScannedItems((prev) => prev.filter((i) => i.barcodeData !== barcodeData));
  };

  // Reset packet creation
  const resetPacketCreation = () => {
    setScannedItems([]);
    setPacketResult(null);
    setPacketQR("");
    setError("");
    setSuccess("");
  };

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
          department: "Packing",
          scannedBy: user?.name || user?.username,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setBarcodeDetails(result.barcode);
        setSuccess(`Product updated to Packing department by ${user?.name}`);
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
          <div className="w-10 h-10 bg-cyan-500 rounded-lg flex items-center justify-center">
            <Box className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Packing Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Processed Today</p>
            <p className="text-2xl font-bold text-cyan-600">{scanCount}</p>
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
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <User className="text-cyan-600 mt-0.5" size={20} />
            <div>
              <p className="font-medium text-cyan-800">Welcome, {user?.name}</p>
              <p className="text-sm text-cyan-700">
                Scan product barcodes to update their status to <strong>Packing</strong> department.
                Your name and scan time will be recorded automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <DepartmentPaymentSummary department="Packing" />
        </div>

        {/* Payment Display */}
        <div className="mb-6">
          <PaymentDisplay userName={user?.name || ""} department="Packing" scanCount={scanCount} />
        </div>

        {/* Mode Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setMode("packet"); resetPacketCreation(); resetScanner(); }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              mode === "packet"
                ? "bg-cyan-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Package size={18} />
            Create Packet
          </button>
          <button
            onClick={() => { setMode("scan"); resetPacketCreation(); resetScanner(); }}
            className={`flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
              mode === "scan"
                ? "bg-cyan-600 text-white"
                : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            <Scan size={18} />
            Single Scan
          </button>
        </div>

        {/* ========== PACKET CREATION MODE ========== */}
        {mode === "packet" && !packetResult && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="text-purple-600" size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create Packet</h2>
                <p className="text-sm text-gray-500">Scan 3 items from the same unit</p>
              </div>
            </div>

            {/* Scanned Items */}
            <div className="space-y-3 mb-4">
              {["Shalwar", "Qameez", "Dupatta"].map((itemType) => {
                const scannedItem = scannedItems.find((i) => i.item === itemType);
                return (
                  <div
                    key={itemType}
                    className={`p-3 rounded-lg border-2 flex items-center justify-between ${
                      scannedItem
                        ? "border-green-300 bg-green-50"
                        : "border-dashed border-gray-300 bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {scannedItem ? (
                        <CheckCircle className="text-green-600" size={20} />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-gray-400" />
                      )}
                      <div>
                        <p className={`font-medium ${scannedItem ? "text-green-800" : "text-gray-500"}`}>
                          {itemType}
                        </p>
                        {scannedItem && (
                          <p className="text-xs text-green-600">
                            {scannedItem.design} - {getSizeLabel(scannedItem.size)} - Unit #{scannedItem.unitNumber}
                          </p>
                        )}
                      </div>
                    </div>
                    {scannedItem && (
                      <button
                        onClick={() => removeScannedItem(scannedItem.barcodeData)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Unit Info */}
            {scannedItems.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>Unit:</strong> {scannedItems[0].design} - {getSizeLabel(scannedItems[0].size)} - Unit #{scannedItems[0].unitNumber}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {3 - scannedItems.length} more item(s) needed
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                <AlertCircle className="text-red-600" size={16} />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Success */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                <CheckCircle className="text-green-600" size={16} />
                <p className="text-sm text-green-700">{success}</p>
              </div>
            )}

            {/* Scanner */}
            {scanning && (
              <div className="mb-4">
                <div id="reader" className="rounded-lg overflow-hidden"></div>
                <button
                  onClick={() => setScanning(false)}
                  className="mt-3 w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel Scanning
                </button>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-2"></div>
                <p className="text-sm text-gray-600">Processing...</p>
              </div>
            )}

            {/* Actions */}
            {!scanning && !loading && (
              <div className="space-y-3">
                {scannedItems.length < 3 && (
                  <button
                    onClick={startScanning}
                    className="w-full bg-cyan-600 text-white py-3 rounded-lg font-semibold hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Scan size={18} />
                    Scan {scannedItems.length === 0 ? "First" : "Next"} Item ({scannedItems.length}/3)
                  </button>
                )}

                {scannedItems.length === 3 && (
                  <button
                    onClick={createPacket}
                    disabled={creatingPacket}
                    className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {creatingPacket ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Creating Packet...
                      </>
                    ) : (
                      <>
                        <Package size={18} />
                        Create Packet & Generate Barcode
                      </>
                    )}
                  </button>
                )}

                {scannedItems.length > 0 && (
                  <button
                    onClick={resetPacketCreation}
                    className="w-full py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Clear & Start Over
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========== PACKET RESULT ========== */}
        {mode === "packet" && packetResult && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 text-center">
              <CheckCircle className="mx-auto mb-2" size={40} />
              <h2 className="text-xl font-bold">Packet Created!</h2>
              <p className="opacity-90">{packetResult.packetId}</p>
            </div>

            <div className="p-6">
              {/* QR Code */}
              <div className="text-center mb-4">
                <img src={packetQR} alt="Packet QR Code" className="w-48 h-48 mx-auto border-4 border-gray-200 rounded-lg" />
                <p className="text-sm text-gray-500 mt-2">Scan or print this barcode for the packet</p>
              </div>

              {/* Packet Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Design</p>
                    <p className="font-semibold">{packetResult.design}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Size</p>
                    <p className="font-semibold">{getSizeLabel(packetResult.size)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Unit Number</p>
                    <p className="font-semibold">#{packetResult.unitNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Packed By</p>
                    <p className="font-semibold">{packetResult.packedBy}</p>
                  </div>
                </div>
              </div>

              {/* Items Included */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Items in Packet:</p>
                <div className="flex gap-2">
                  {packetResult.items.map((item) => (
                    <span key={item} className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2">
                <button
                  onClick={() => window.print()}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <QrCode size={18} />
                  Print Packet Barcode
                </button>
                <button
                  onClick={resetPacketCreation}
                  className="w-full bg-cyan-600 text-white py-3 rounded-lg font-semibold hover:bg-cyan-700"
                >
                  Create Another Packet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== SINGLE SCAN MODE ========== */}
        {mode === "scan" && (
          <>
            {/* Scanner Section */}
            {!scanning && !barcodeDetails && !loading && (
              <div className="bg-white rounded-xl shadow-sm p-6 text-center">
                <div className="w-20 h-20 bg-cyan-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Scan className="text-cyan-600" size={40} />
                </div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Ready to Scan</h2>
                <p className="text-gray-600 mb-6">
                  Click the button below to start scanning product barcodes
                </p>
                <button
                  onClick={startScanning}
                  className="w-full bg-cyan-600 text-white py-4 rounded-lg font-semibold hover:bg-cyan-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Scan size={20} />
                  Start Scanning
                </button>
              </div>
            )}

            {/* Active Scanner */}
            {scanning && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h2 className="text-lg font-semibold text-center mb-4">📷 Scanning...</h2>
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
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
                <div className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white p-4">
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
                  <div className="bg-cyan-50 p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock size={16} className="text-cyan-600" />
                      <p className="text-sm font-medium text-cyan-800">Scan Recorded</p>
                    </div>
                    <div className="text-sm text-cyan-700">
                      <p><strong>Scanned by:</strong> {user?.name}</p>
                      <p><strong>Time:</strong> {formatDate(barcodeDetails.scannedAt || new Date().toISOString())}</p>
                      <p><strong>Department:</strong> Packing</p>
                    </div>
                  </div>

                  {/* History Toggle */}
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-sm text-cyan-600 hover:text-cyan-700"
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
                    className="w-full bg-cyan-600 text-white py-3 rounded-lg font-semibold hover:bg-cyan-700 transition-colors"
                  >
                    Scan Another Barcode
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
