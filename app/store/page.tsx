"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";
import {
  Store as StoreIcon,
  Scan,
  CheckCircle,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  RotateCcw,
  RefreshCw,
  Search,
  Package,
  DollarSign,
  Camera,
  CameraOff,
  Clock,
  User,
  X,
  Truck,
  Check,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { playScanSuccessSound, playScanErrorSound } from "@/app/libs/audio";

interface FinalStickerItem {
  _id: string;
  design: string;
  size: string;
  suitType: string;
  unitNumber: number;
  category?: "A" | "B";
  categoryLabel?: string;
  isDefective?: boolean;
  defectSummary?: string;
  sellingPrice: number;
  status: string;
  currentDepartment: string;
  barcodeData: string;
  dispatchInfo?: {
    dispatchedAt: string;
    dispatchedBy: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    checkoutType?: "WholeSale" | "Retail" | "Cmd";
    remarks?: string;
  };
  returnInfo?: {
    returnedAt: string;
    returnedBy: string;
    remarks?: string;
    previousStatus?: string;
  };
  paymentInfo?: {
    isPaid: boolean;
    amountReceived: number;
    paidAt?: string;
    receivedBy?: string;
    notes?: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface InventorySummary {
  totalInStore: number;
  totalDispatched: number;
  totalDelivered: number;
  totalReturned: number;
  inventoryValue: number;
  dispatchedValue: number;
  totalRevenue: number;
}

type StoreMode = "check-in" | "check-out" | "return";

export default function StorePage() {
  const { user } = useAuth();

  // Mode and view states
  const [activeMode, setActiveMode] = useState<StoreMode>("check-in");
  const [activeTab, setActiveTab] = useState<"in_store" | "dispatched" | "returned" | "all">("in_store");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // FIFO Queue & hardware scanner wedge refs
  interface StoreScanTask {
    barcode: string;
    mode: StoreMode;
    checkoutType: "WholeSale" | "Retail" | "Cmd";
    checkoutRemarks: string;
    returnRemarks: string;
  }
  const scanQueueRef = useRef<StoreScanTask[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const globalBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Camera QR Scanner states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const html5QrCodeRef = useRef<any>(null);

  // Checkout Form State
  const [checkoutType, setCheckoutType] = useState<"WholeSale" | "Retail" | "Cmd">("Retail");
  const [checkoutRemarks, setCheckoutRemarks] = useState("");

  // Return Form State
  const [returnRemarks, setReturnRemarks] = useState("");
  const [itemToReturn, setItemToReturn] = useState<FinalStickerItem | null>(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Data states
  const [summary, setSummary] = useState<InventorySummary>({
    totalInStore: 0,
    totalDispatched: 0,
    totalDelivered: 0,
    totalReturned: 0,
    inventoryValue: 0,
    dispatchedValue: 0,
    totalRevenue: 0,
  });
  const [items, setItems] = useState<FinalStickerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastScannedResult, setLastScannedResult] = useState<{
    type: "success" | "error";
    message: string;
    item?: FinalStickerItem;
  } | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus barcode input continuously unless typing in another field or modal is open
  useEffect(() => {
    if (showReturnModal || isCameraActive) return;

    const focusInput = () => {
      if (barcodeInputRef.current && document.activeElement !== barcodeInputRef.current) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
          return;
        }
        barcodeInputRef.current.focus();
      }
    };

    focusInput();
    const interval = setInterval(focusInput, 1500);
    const handleDocClick = () => {
      setTimeout(focusInput, 50);
    };

    document.addEventListener("click", handleDocClick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", handleDocClick);
    };
  }, [showReturnModal, isCameraActive]);

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (activeTab !== "all") {
        params.set("status", activeTab);
      }
      if (searchTerm.trim()) {
        params.set("search", searchTerm.trim());
      }

      const res = await fetch(`/api/store/inventory?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setItems(data.items || []);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load store inventory");
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // FIFO Queue processor - handles rapid-fire barcode gun scans without dropping any scan
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (scanQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setProcessing(true);

    const task = scanQueueRef.current.shift()!;
    setQueueLength(scanQueueRef.current.length);

    const {
      barcode: rawBarcode,
      mode,
      checkoutType: taskCheckoutType,
      checkoutRemarks: taskCheckoutRemarks,
      returnRemarks: taskReturnRemarks,
    } = task;

    const staffName = user?.name || user?.username || "Store Staff";

    try {
      if (mode === "check-in") {
        // CHECK-IN API CALL
        const res = await fetch("/api/store/check-in", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData: rawBarcode,
            scannedBy: staffName,
          }),
        });
        const data = await res.json();
        if (data.success) {
          playScanSuccessSound();
          toast.success(data.message);
          setLastScannedResult({
            type: "success",
            message: data.message,
            item: data.sticker,
          });
          await fetchInventory();
        } else {
          playScanErrorSound();
          toast.error(data.message || "Failed to check in item");
          setLastScannedResult({
            type: "error",
            message: data.message || "Failed to check in item",
          });
        }
      } else if (mode === "check-out") {
        // CHECK-OUT API CALL
        const res = await fetch("/api/store/check-out", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData: rawBarcode,
            dispatchedBy: staffName,
            checkoutType: taskCheckoutType,
            remarks: taskCheckoutRemarks,
          }),
        });
        const data = await res.json();
        if (data.success) {
          playScanSuccessSound();
          toast.success(data.message);
          setLastScannedResult({
            type: "success",
            message: data.message,
            item: data.sticker,
          });
          await fetchInventory();
        } else {
          playScanErrorSound();
          toast.error(data.message || "Failed to checkout item");
          setLastScannedResult({
            type: "error",
            message: data.message || "Failed to checkout item",
          });
        }
      } else if (mode === "return") {
        // RETURN API CALL
        const res = await fetch("/api/store/return", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData: rawBarcode,
            returnedBy: staffName,
            remarks: taskReturnRemarks,
          }),
        });
        const data = await res.json();
        if (data.success) {
          playScanSuccessSound();
          toast.success(data.message);
          setLastScannedResult({
            type: "success",
            message: data.message,
            item: data.sticker,
          });
          await fetchInventory();
        } else {
          playScanErrorSound();
          toast.error(data.message || "Failed to process return");
          setLastScannedResult({
            type: "error",
            message: data.message || "Failed to process return",
          });
        }
      }
    } catch (err: any) {
      playScanErrorSound();
      toast.error(err.message || "An unexpected error occurred");
      setLastScannedResult({
        type: "error",
        message: err.message || "An unexpected error occurred",
      });
    } finally {
      isProcessingRef.current = false;
      setProcessing(false);
      setQueueLength(scanQueueRef.current.length);

      if (scanQueueRef.current.length > 0) {
        setTimeout(processQueue, 20);
      } else {
        setTimeout(() => barcodeInputRef.current?.focus(), 50);
      }
    }
  }, [user, fetchInventory]);

  // Enqueue barcode into FIFO queue
  const enqueueBarcode = useCallback(
    (codeToProcess: string) => {
      const rawBarcode = codeToProcess.trim();
      if (!rawBarcode) {
        toast.error("Please enter or scan a barcode");
        return;
      }

      scanQueueRef.current.push({
        barcode: rawBarcode,
        mode: activeMode,
        checkoutType,
        checkoutRemarks,
        returnRemarks,
      });
      setQueueLength(scanQueueRef.current.length);
      processQueue();
    },
    [activeMode, checkoutType, checkoutRemarks, returnRemarks, processQueue]
  );

  // Global keydown listener to capture fast barcode gun wedge input
  useEffect(() => {
    if (showReturnModal || isCameraActive) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // If typing in another input (such as search box, remarks textarea, dropdown), ignore
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        if (target !== barcodeInputRef.current) return;
      }

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 400) {
        globalBufferRef.current = "";
      }
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const barcodeFromBuffer = globalBufferRef.current.trim();
        const barcodeFromInput = barcodeInput.trim();
        const finalBarcode = barcodeFromInput || barcodeFromBuffer;

        if (finalBarcode) {
          e.preventDefault();
          globalBufferRef.current = "";
          setBarcodeInput("");
          enqueueBarcode(finalBarcode);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        globalBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [showReturnModal, isCameraActive, barcodeInput, enqueueBarcode]);

  // Handle barcode submission based on current mode
  const handleProcessBarcode = (codeToProcess: string) => {
    const rawBarcode = codeToProcess.trim();
    if (!rawBarcode) {
      toast.error("Please enter or scan a barcode");
      return;
    }
    setBarcodeInput("");
    globalBufferRef.current = "";
    enqueueBarcode(rawBarcode);
  };

  // Start Camera QR Scanner
  const startCameraScanner = async () => {
    setCameraError("");
    setIsCameraActive(true);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      setTimeout(async () => {
        try {
          if (!document.getElementById("qr-reader-container")) return;

          const html5QrCode = new Html5Qrcode("qr-reader-container");
          html5QrCodeRef.current = html5QrCode;

          await html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 220, height: 220 },
            },
            async (decodedText: string) => {
              toast.success("QR Code detected");
              handleProcessBarcode(decodedText);
            },
            () => {}
          );
        } catch (err: any) {
          console.error("Camera startup error:", err);
          setCameraError(err.message || "Could not access camera. Please allow camera permissions.");
          setIsCameraActive(false);
        }
      }, 300);
    } catch (err: any) {
      console.error("Failed to load html5-qrcode:", err);
      setCameraError("Camera scanner could not be loaded.");
      setIsCameraActive(false);
    }
  };

  // Stop Camera QR Scanner
  const stopCameraScanner = async () => {
    try {
      if (html5QrCodeRef.current) {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
        html5QrCodeRef.current = null;
      }
    } catch (err) {
      console.error("Error stopping camera scanner:", err);
    } finally {
      setIsCameraActive(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Handle return from list button
  const handleConfirmItemReturn = async () => {
    if (!itemToReturn) return;

    setProcessing(true);
    try {
      const res = await fetch("/api/store/return", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickerId: itemToReturn._id,
          returnedBy: user?.name || user?.username || "Store Staff",
          remarks: returnRemarks,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        setShowReturnModal(false);
        setItemToReturn(null);
        setReturnRemarks("");
        fetchInventory();
      } else {
        toast.error(data.message || "Failed to return item");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process return");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      {/* Fixed Admin Sidebar */}
      <Sidebar active="store" setActive={() => {}} />

      {/* Main Content Area */}
      <div className="w-full lg:ml-64 p-4 sm:p-6 lg:p-8 pt-20 lg:pt-8 min-w-0 flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-xs shrink-0">
              <StoreIcon size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">Store Department</h1>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                Check In & Out via QR Scan • WholeSale, Retail & Cmd Options • Product Returns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={fetchInventory}
              disabled={loading}
              className="px-3.5 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-blue-600" : "text-gray-500"} />
              Refresh
            </button>
          </div>
        </div>

        {/* Metric Cards - Necessary Semantic Colors on Numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">In Store Inventory</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{summary.totalInStore}</p>
            <p className="text-xs text-gray-500 mt-1">
              Value: Rs. {summary.inventoryValue.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Checked Out / Dispatched</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{summary.totalDispatched}</p>
            <p className="text-xs text-gray-500 mt-1">
              Receivables: Rs. {summary.dispatchedValue.toLocaleString()}
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">Rs. {summary.totalRevenue.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {summary.totalDelivered} suits paid & delivered
            </p>
          </div>

          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Returns Processed</p>
            <p className="text-2xl font-bold text-purple-600 mt-1">{summary.totalReturned}</p>
            <p className="text-xs text-gray-500 mt-1">Restocked to inventory</p>
          </div>
        </div>

        {/* Operation & QR Scanning Panel */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs mb-6">
          {/* Mode Switcher Buttons - Clear Semantic Indicator on Active Tab */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-gray-100">
            <div className="inline-flex p-1 bg-gray-100 rounded-lg gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveMode("check-in");
                  setLastScannedResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeMode === "check-in"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <ArrowDownToLine size={14} />
                1. Check In
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode("check-out");
                  setLastScannedResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeMode === "check-out"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <ArrowUpFromLine size={14} />
                2. Check Out
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode("return");
                  setLastScannedResult(null);
                }}
                className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  activeMode === "return"
                    ? "bg-rose-600 text-white shadow-xs"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <RotateCcw size={14} />
                3. Return
              </button>
            </div>

            <div className="flex items-center gap-2">
              {queueLength > 0 && (
                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-black animate-pulse shadow-xs">
                  <Sparkles size={14} />
                  Queue: {queueLength}
                </span>
              )}

              {/* Camera QR Scanner Toggle */}
              <button
                type="button"
                onClick={isCameraActive ? stopCameraScanner : startCameraScanner}
                className={`px-3 py-1.5 border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  isCameraActive
                    ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
              {isCameraActive ? (
                <>
                  <CameraOff size={14} />
                  Stop Camera
                </>
              ) : (
                <>
                  <Camera size={14} className="text-gray-600" />
                  Camera QR Scan
                </>
              )}
            </button>
          </div>
        </div>

          {/* Camera Viewfinder Box */}
          {isCameraActive && (
            <div className="mb-5 p-4 bg-gray-950 rounded-xl text-center text-white max-w-sm mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-300 flex items-center gap-1.5 font-medium">
                  <QrCode size={14} className="text-blue-400" />
                  Align final sticker QR in box
                </span>
                <button
                  type="button"
                  onClick={stopCameraScanner}
                  className="text-gray-400 hover:text-white text-xs font-medium"
                >
                  Close
                </button>
              </div>
              <div id="qr-reader-container" className="w-full overflow-hidden rounded-lg bg-black"></div>
            </div>
          )}

          {cameraError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0 text-red-600" />
              <span>{cameraError}</span>
            </div>
          )}

          {/* Form & Input */}
          <div className="space-y-4 max-w-2xl">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1 flex items-center justify-between">
                <span>
                  {activeMode === "check-in" && "Scan Final Sticker QR to Check In"}
                  {activeMode === "check-out" && "Scan Final Sticker QR to Check Out"}
                  {activeMode === "return" && "Scan Final Sticker QR to Return"}
                </span>
                <span className="text-[11px] font-normal text-gray-400">
                  Ready for handheld scanner or manual code
                </span>
              </label>

              <div className="relative">
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && barcodeInput.trim()) {
                      e.preventDefault();
                      handleProcessBarcode(barcodeInput);
                    }
                  }}
                  placeholder="Scan QR code with scanner gun or enter barcode data..."
                  className="w-full bg-white border border-gray-300 rounded-lg px-3.5 py-2.5 pl-9 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  autoFocus
                />
                <Scan size={16} className="absolute left-3 top-3 text-gray-400" />
              </div>
            </div>

            {/* Check Out Fields */}
            {activeMode === "check-out" && (
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Checkout Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={checkoutType}
                      onChange={(e) => setCheckoutType(e.target.value as "WholeSale" | "Retail" | "Cmd")}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="WholeSale">1. WholeSale</option>
                      <option value="Retail">2. Retail</option>
                      <option value="Cmd">3. Cmd</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Remarks / Notes
                    </label>
                    <textarea
                      value={checkoutRemarks}
                      onChange={(e) => setCheckoutRemarks(e.target.value)}
                      placeholder="Customer name, invoice #, buyer details, or notes..."
                      rows={2}
                      className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Return Fields */}
            {activeMode === "return" && (
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Return Remarks / Reason
                </label>
                <textarea
                  value={returnRemarks}
                  onChange={(e) => setReturnRemarks(e.target.value)}
                  placeholder="Reason for return..."
                  rows={2}
                  className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-[11px] text-gray-500">
                  Item will be restocked to store inventory (+1) and revenue reversed.
                </p>
              </div>
            )}

            {/* Semantic Action Submit Button */}
            <button
              type="button"
              onClick={() => handleProcessBarcode(barcodeInput)}
              disabled={!barcodeInput.trim() && queueLength === 0}
              className={`w-full py-2.5 rounded-lg text-xs font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs ${
                activeMode === "check-in"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : activeMode === "check-out"
                  ? "bg-blue-600 hover:bg-blue-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {queueLength > 0 ? (
                <>
                  <Sparkles size={14} className="animate-spin" />
                  Processing Queue ({queueLength} remaining)...
                </>
              ) : processing ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  Processing QR Scan...
                </>
              ) : (
                <>
                  {activeMode === "check-in" && <ArrowDownToLine size={15} />}
                  {activeMode === "check-out" && <ArrowUpFromLine size={15} />}
                  {activeMode === "return" && <RotateCcw size={15} />}
                  {activeMode === "check-in" && "Check In to Store"}
                  {activeMode === "check-out" && `Complete Check Out (${checkoutType})`}
                  {activeMode === "return" && "Process Return to Inventory"}
                </>
              )}
            </button>

            {/* Status Feedback */}
            {lastScannedResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
                  lastScannedResult.type === "success"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                    : "bg-red-50 border-red-200 text-red-800"
                }`}
              >
                {lastScannedResult.type === "success" ? (
                  <CheckCircle size={15} className="text-emerald-600 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-red-600 mt-0.5 shrink-0" />
                )}
                <div>
                  <p className="font-semibold">{lastScannedResult.message}</p>
                  {lastScannedResult.item && (
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {lastScannedResult.item.design} • {lastScannedResult.item.suitType} • Size:{" "}
                      {lastScannedResult.item.size} • Unit #{lastScannedResult.item.unitNumber} • Price: Rs.{" "}
                      {lastScannedResult.item.sellingPrice?.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Inventory Records Table Section */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
          {/* Filter Bar */}
          <div className="p-3.5 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3 bg-gray-50/70">
            <div className="inline-flex p-0.5 bg-gray-200/70 rounded-lg gap-0.5 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab("in_store")}
                className={`px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap cursor-pointer ${
                  activeTab === "in_store"
                    ? "bg-white text-blue-700 shadow-2xs font-bold"
                    : "text-gray-600 hover:text-gray-900 font-medium"
                }`}
              >
                In Store ({summary.totalInStore})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("dispatched")}
                className={`px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap cursor-pointer ${
                  activeTab === "dispatched"
                    ? "bg-white text-amber-700 shadow-2xs font-bold"
                    : "text-gray-600 hover:text-gray-900 font-medium"
                }`}
              >
                Dispatched ({summary.totalDispatched})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("returned")}
                className={`px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap cursor-pointer ${
                  activeTab === "returned"
                    ? "bg-white text-purple-700 shadow-2xs font-bold"
                    : "text-gray-600 hover:text-gray-900 font-medium"
                }`}
              >
                Returned ({summary.totalReturned})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-md text-xs transition whitespace-nowrap cursor-pointer ${
                  activeTab === "all"
                    ? "bg-white text-gray-900 shadow-2xs font-bold"
                    : "text-gray-600 hover:text-gray-900 font-medium"
                }`}
              >
                All Items
              </button>
            </div>

            <div className="relative w-full sm:w-60">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filter by design, remarks..."
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 pl-8 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">Design & Unit</th>
                  <th className="py-2.5 px-4">Size & Suit</th>
                  <th className="py-2.5 px-4">Quality Category</th>
                  <th className="py-2.5 px-4">Price</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Details</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                      Loading store records...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isCatB = item.category === "B" || item.isDefective;
                    const isDispatched = item.status === "dispatched";
                    const isDelivered = item.status === "delivered";

                    return (
                      <tr key={item._id} className="hover:bg-gray-50/80 transition">
                        <td className="py-2.5 px-4">
                          <span className="font-semibold text-gray-900 block">{item.design}</span>
                          <span className="text-[11px] font-mono text-gray-500">Unit #{item.unitNumber}</span>
                        </td>

                        <td className="py-2.5 px-4 text-gray-700">
                          {item.suitType} <span className="text-gray-400">({item.size})</span>
                        </td>

                        {/* Necessary Semantic Quality Badges */}
                        <td className="py-2.5 px-4">
                          {isCatB ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle size={12} className="text-amber-600" />
                              Cat B (Defect)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck size={12} className="text-emerald-600" />
                              Cat A (OK)
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 font-semibold text-gray-900">
                          Rs. {item.sellingPrice?.toLocaleString()}
                        </td>

                        {/* Necessary Status Badges */}
                        <td className="py-2.5 px-4">
                          {item.status === "in_store" && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              In Store
                            </span>
                          )}
                          {item.status === "dispatched" && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                              Dispatched
                            </span>
                          )}
                          {item.status === "delivered" && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Delivered
                            </span>
                          )}
                          {item.status === "packed" && (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Packed
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-4 max-w-xs text-gray-600">
                          {item.dispatchInfo?.checkoutType && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-gray-900 text-[11px]">
                                {item.dispatchInfo.checkoutType}
                              </span>
                              {item.dispatchInfo.remarks && (
                                <span className="text-gray-500 text-[11px] truncate" title={item.dispatchInfo.remarks}>
                                  — {item.dispatchInfo.remarks}
                                </span>
                              )}
                            </div>
                          )}
                          {item.returnInfo?.returnedAt && (
                            <div className="text-[11px] text-purple-700 font-medium">
                              Returned: {new Date(item.returnInfo.returnedAt).toLocaleDateString()}
                              {item.returnInfo.remarks && ` (${item.returnInfo.remarks})`}
                            </div>
                          )}
                          {!item.dispatchInfo?.checkoutType && !item.returnInfo?.returnedAt && (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>

                        {/* Action Buttons with Subtle Semantic Accents */}
                        <td className="py-2.5 px-4 text-right">
                          {(isDispatched || isDelivered) && (
                            <button
                              type="button"
                              onClick={() => {
                                setItemToReturn(item);
                                setShowReturnModal(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition cursor-pointer"
                            >
                              Return
                            </button>
                          )}
                          {item.status === "in_store" && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMode("check-out");
                                setBarcodeInput(item.barcodeData);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition cursor-pointer"
                            >
                              Checkout
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Return Modal */}
      {showReturnModal && itemToReturn && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-lg border border-gray-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 mb-3">
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
                <RotateCcw size={16} className="text-rose-600" />
                Return Item to Inventory
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setItemToReturn(null);
                }}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs mb-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Design:</span>
                <span className="font-semibold text-gray-900">{itemToReturn.design} (Unit #{itemToReturn.unitNumber})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Price:</span>
                <span className="font-semibold text-gray-900">Rs. {itemToReturn.sellingPrice?.toLocaleString()}</span>
              </div>
              {itemToReturn.dispatchInfo?.checkoutType && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Checkout Type:</span>
                  <span className="font-semibold text-blue-700">{itemToReturn.dispatchInfo.checkoutType}</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Return Remarks
              </label>
              <textarea
                value={returnRemarks}
                onChange={(e) => setReturnRemarks(e.target.value)}
                placeholder="Reason for return..."
                rows={2}
                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowReturnModal(false);
                  setItemToReturn(null);
                }}
                disabled={processing}
                className="px-3.5 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmItemReturn}
                disabled={processing}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {processing ? "Processing..." : "Confirm Return"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
