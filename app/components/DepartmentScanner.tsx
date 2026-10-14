"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { 
  Scan, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  History, 
  Layers, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Send, 
  X,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";
import { playScanSuccessSound, playScanErrorSound } from "@/app/libs/audio";

export interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

export interface BarcodeDetails {
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

export interface RecentScanItem {
  id: string;
  barcodeData: string;
  design?: string;
  item?: string;
  size?: string;
  unitNumber?: number;
  time: string;
  status: "success" | "error";
  message: string;
}

export interface DepartmentScannerProps {
  department: string;
  userName?: string;
  colorTheme?: "orange" | "red" | "purple" | "amber" | "teal" | "blue" | "emerald";
  allowFinalStickers?: boolean;
  scanCount: number;
  setScanCount: React.Dispatch<React.SetStateAction<number>>;
  onScanSuccess?: (barcode: any) => void;
  isModalOpen?: boolean;
}

const THEMES = {
  orange: {
    accent: "bg-orange-600",
    accentHover: "hover:bg-orange-700",
    text: "text-orange-600",
    bgLight: "bg-orange-50",
    border: "border-orange-200",
    ring: "focus:ring-orange-500",
    badge: "bg-orange-100 text-orange-800",
    headerGrad: "from-orange-500 to-orange-600",
    pulse: "bg-orange-500",
  },
  red: {
    accent: "bg-red-600",
    accentHover: "hover:bg-red-700",
    text: "text-red-600",
    bgLight: "bg-red-50",
    border: "border-red-200",
    ring: "focus:ring-red-500",
    badge: "bg-red-100 text-red-800",
    headerGrad: "from-red-500 to-red-600",
    pulse: "bg-red-500",
  },
  purple: {
    accent: "bg-purple-600",
    accentHover: "hover:bg-purple-700",
    text: "text-purple-600",
    bgLight: "bg-purple-50",
    border: "border-purple-200",
    ring: "focus:ring-purple-500",
    badge: "bg-purple-100 text-purple-800",
    headerGrad: "from-purple-500 to-purple-600",
    pulse: "bg-purple-500",
  },
  amber: {
    accent: "bg-amber-600",
    accentHover: "hover:bg-amber-700",
    text: "text-amber-600",
    bgLight: "bg-amber-50",
    border: "border-amber-200",
    ring: "focus:ring-amber-500",
    badge: "bg-amber-100 text-amber-800",
    headerGrad: "from-amber-500 to-amber-600",
    pulse: "bg-amber-500",
  },
  teal: {
    accent: "bg-teal-600",
    accentHover: "hover:bg-teal-700",
    text: "text-teal-600",
    bgLight: "bg-teal-50",
    border: "border-teal-200",
    ring: "focus:ring-teal-500",
    badge: "bg-teal-100 text-teal-800",
    headerGrad: "from-teal-500 to-teal-600",
    pulse: "bg-teal-500",
  },
  blue: {
    accent: "bg-blue-600",
    accentHover: "hover:bg-blue-700",
    text: "text-blue-600",
    bgLight: "bg-blue-50",
    border: "border-blue-200",
    ring: "focus:ring-blue-500",
    badge: "bg-blue-100 text-blue-800",
    headerGrad: "from-blue-500 to-blue-600",
    pulse: "bg-blue-500",
  },
  emerald: {
    accent: "bg-emerald-600",
    accentHover: "hover:bg-emerald-700",
    text: "text-emerald-600",
    bgLight: "bg-emerald-50",
    border: "border-emerald-200",
    ring: "focus:ring-emerald-500",
    badge: "bg-emerald-100 text-emerald-800",
    headerGrad: "from-emerald-500 to-emerald-600",
    pulse: "bg-emerald-500",
  },
};

export default function DepartmentScanner({
  department,
  userName = "Staff",
  colorTheme = "orange",
  allowFinalStickers = false,
  scanCount,
  setScanCount,
  onScanSuccess,
  isModalOpen = false,
}: DepartmentScannerProps) {
  const theme = THEMES[colorTheme] || THEMES.orange;

  const [inputVal, setInputVal] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastBarcode, setLastBarcode] = useState<BarcodeDetails | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScanItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const inputRef = useRef<HTMLInputElement>(null);
  const scanQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const globalBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Auto-focus input on mount and on clicks unless a modal is open
  useEffect(() => {
    if (isModalOpen) return;

    const focusInput = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        // If the user is currently focused on an input/textarea elsewhere, leave it alone
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
          return;
        }
        inputRef.current.focus();
      }
    };

    focusInput();
    const interval = setInterval(focusInput, 1500);
    const handleDocumentClick = () => setTimeout(focusInput, 50);

    document.addEventListener("click", handleDocumentClick);
    return () => {
      clearInterval(interval);
      document.removeEventListener("click", handleDocumentClick);
    };
  }, [isModalOpen]);

  // FIFO Queue processing
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (scanQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);

    const barcodeData = scanQueueRef.current.shift()!;
    setQueueLength(scanQueueRef.current.length);

    try {
      let isSuccess = false;
      let resultBarcode: BarcodeDetails | null = null;
      let errorMessage = "";
      let alreadyScanned = false;

      // 1. Send to standard barcode scan
      const response = await fetch("/api/barcodes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData,
          department,
          scannedBy: userName,
        }),
      });

      const result = await response.json();

      if (result.success && result.barcode) {
        isSuccess = true;
        resultBarcode = result.barcode;
      } else if (allowFinalStickers) {
        // 2. Final sticker fallback (e.g. Packing department)
        const finalResponse = await fetch("/api/final-stickers/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData,
            department,
            scannedBy: userName,
          }),
        });
        const finalResult = await finalResponse.json();
        if (finalResult.success && finalResult.sticker) {
          isSuccess = true;
          const sticker = finalResult.sticker;
          resultBarcode = {
            id: sticker._id,
            design: sticker.design,
            size: sticker.size,
            item: `Complete Suit (${sticker.suitType || "Pack"})`,
            unitNumber: sticker.unitNumber,
            status: sticker.status,
            currentDepartment: sticker.currentDepartment,
            departmentHistory: sticker.departmentHistory || [],
            createdAt: sticker.createdAt,
            scannedAt: new Date().toISOString(),
          };
        } else {
          errorMessage = finalResult.message || result.message || "Barcode not found";
          alreadyScanned = finalResult.alreadyScanned || result.alreadyScanned;
        }
      } else {
        errorMessage = result.message || "Barcode not found";
        alreadyScanned = result.alreadyScanned;
      }

      const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      if (isSuccess && resultBarcode) {
        if (soundEnabled) playScanSuccessSound();
        setScanCount((prev) => prev + 1);
        setLastBarcode(resultBarcode);
        onScanSuccess?.(resultBarcode);

        setRecentScans((prev) => [
          {
            id: `${barcodeData}-${Date.now()}-${Math.random()}`,
            barcodeData,
            design: resultBarcode?.design,
            item: resultBarcode?.item,
            size: resultBarcode?.size,
            unitNumber: resultBarcode?.unitNumber,
            time: timestamp,
            status: "success",
            message: `Updated to ${department}`,
          },
          ...prev.slice(0, 19),
        ]);
      } else {
        if (soundEnabled) playScanErrorSound();

        const cleanMsg = alreadyScanned 
          ? `Already scanned in ${department}` 
          : (errorMessage || "Barcode not found");

        toast.error(cleanMsg, { duration: 3000 });

        setRecentScans((prev) => [
          {
            id: `${barcodeData}-${Date.now()}-${Math.random()}`,
            barcodeData,
            time: timestamp,
            status: "error",
            message: cleanMsg,
          },
          ...prev.slice(0, 19),
        ]);
      }
    } catch (err: any) {
      if (soundEnabled) playScanErrorSound();
      toast.error(err.message || "Network error while processing scan");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setQueueLength(scanQueueRef.current.length);

      // Continue processing any pending items in the FIFO queue
      if (scanQueueRef.current.length > 0) {
        setTimeout(processQueue, 20);
      }
    }
  }, [department, userName, allowFinalStickers, soundEnabled, onScanSuccess, setScanCount]);

  // Enqueue a barcode
  const enqueueBarcode = useCallback((raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;

    scanQueueRef.current.push(cleaned);
    setQueueLength(scanQueueRef.current.length);
    processQueue();
  }, [processQueue]);

  // Global keydown listener to capture fast barcode gun wedge input
  useEffect(() => {
    if (isModalOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // If typing in another input/textarea outside our scanner, ignore
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        if (target !== inputRef.current) return;
      }

      const now = Date.now();
      // If interval > 400ms, reset buffer (likely human typed or idle)
      if (now - lastKeyTimeRef.current > 400) {
        globalBufferRef.current = "";
      }
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const barcodeFromBuffer = globalBufferRef.current.trim();
        const barcodeFromInput = inputVal.trim();
        const finalBarcode = barcodeFromInput || barcodeFromBuffer;

        if (finalBarcode) {
          e.preventDefault();
          globalBufferRef.current = "";
          setInputVal("");
          enqueueBarcode(finalBarcode);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        globalBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isModalOpen, inputVal, enqueueBarcode]);

  // Manual submit handler
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim()) {
      enqueueBarcode(inputVal.trim());
      setInputVal("");
      globalBufferRef.current = "";
    }
  };

  const getSizeLabel = (size?: string) => {
    if (!size) return "-";
    switch (size) {
      case "S": return "Small";
      case "M": return "Medium";
      case "L": return "Large";
      default: return size;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  return (
    <div className="space-y-6">
      {/* Scanner Control & Status Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Status Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold tracking-wide text-white">
                  Continuous Barcode Scanner Active
                </h2>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Always-On
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                Scan multiple items rapidly without clicking. Queue processes automatically in background.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                soundEnabled 
                  ? "bg-gray-700/80 hover:bg-gray-700 text-gray-200" 
                  : "bg-red-950/60 text-red-300 border border-red-800/40"
              }`}
              title={soundEnabled ? "Audio feedback enabled" : "Audio feedback muted"}
            >
              {soundEnabled ? <Volume2 size={15} className="text-emerald-400" /> : <VolumeX size={15} />}
              <span>{soundEnabled ? "Sound ON" : "Muted"}</span>
            </button>

            {/* Queue Counter Badge */}
            {queueLength > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black animate-pulse">
                <Sparkles size={14} />
                <span>Queue: {queueLength}</span>
              </span>
            )}
          </div>
        </div>

        {/* Scanner Barcode Input Form */}
        <div className="p-6">
          <form onSubmit={handleManualSubmit} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Scan size={22} className={theme.text} />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Scanner is listening... (Point gun & scan or type barcode here)"
                className={`w-full pl-12 pr-28 py-3.5 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 font-mono text-base focus:bg-white focus:outline-none focus:ring-2 ${theme.ring} focus:border-transparent transition shadow-inner`}
                autoComplete="off"
                disabled={isModalOpen}
              />
              <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                {inputVal && (
                  <button
                    type="button"
                    onClick={() => {
                      setInputVal("");
                      globalBufferRef.current = "";
                      inputRef.current?.focus();
                    }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200 transition"
                  >
                    <X size={16} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!inputVal.trim() || isModalOpen}
                  className={`px-4 py-2 ${theme.accent} ${theme.accentHover} disabled:opacity-40 disabled:hover:${theme.accent} text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition shadow-sm`}
                >
                  <Send size={14} />
                  <span>Enter</span>
                </button>
              </div>
            </div>

            {/* Quick Helper Tips */}
            <div className="flex flex-wrap items-center justify-between text-xs text-gray-500 pt-1">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Ready for consecutive rapid scanning. Each scan plays an instant audio confirmation.</span>
              </div>
              <span className="font-mono text-gray-400">Department: {department}</span>
            </div>
          </form>
        </div>
      </div>

      {/* Last Scanned Garment Card */}
      {lastBarcode && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
          {/* Card Banner */}
          <div className={`bg-gradient-to-r ${theme.headerGrad} text-white p-5`}>
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 uppercase tracking-wide">
                    Last Scanned
                  </span>
                  <span className="text-xs text-white/80 font-mono">
                    Unit #{lastBarcode.unitNumber}
                  </span>
                </div>
                <h3 className="text-2xl font-bold tracking-tight">{lastBarcode.design}</h3>
              </div>
              <div className="text-right">
                <span className="inline-block bg-white text-gray-900 font-bold px-3 py-1 rounded-full text-xs shadow-sm">
                  {lastBarcode.currentDepartment}
                </span>
                <p className="text-xs text-white/80 mt-1 font-mono">
                  {formatDate(lastBarcode.scannedAt || new Date().toISOString())}
                </p>
              </div>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Item</p>
                <p className="text-sm font-bold text-gray-900 truncate mt-0.5">{lastBarcode.item}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-500 font-medium">Size</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{getSizeLabel(lastBarcode.size)}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 col-span-2 sm:col-span-1">
                <p className="text-xs text-gray-500 font-medium">Operator</p>
                <p className="text-sm font-bold text-gray-900 truncate mt-0.5">{userName}</p>
              </div>
            </div>

            {/* Scan History Collapsible */}
            {lastBarcode.departmentHistory && lastBarcode.departmentHistory.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className={`flex items-center justify-between w-full py-2 text-xs font-semibold ${theme.text} hover:opacity-80 transition`}
                >
                  <span className="flex items-center gap-1.5">
                    <History size={15} />
                    Scan Timeline ({lastBarcode.departmentHistory.length} department events)
                  </span>
                  {showHistory ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>

                {showHistory && (
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {lastBarcode.departmentHistory.map((scan, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${scan.department === department ? "bg-emerald-500" : "bg-gray-400"}`}></span>
                          <div>
                            <p className="font-semibold text-gray-800">{scan.department}</p>
                            <p className="text-[11px] text-gray-500">
                              {scan.scannedBy ? `by ${scan.scannedBy}` : "System"}
                            </p>
                          </div>
                        </div>
                        <span className="text-gray-400 font-mono text-[11px]">{formatDate(scan.scannedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Recent Scans Stream */}
      {recentScans.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers size={18} className={theme.text} />
              <h3 className="font-bold text-gray-900 text-sm">
                Recent Scans Live Activity
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                {recentScans.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRecentScans([])}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium transition"
            >
              Clear Log
            </button>
          </div>

          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {recentScans.map((item) => (
              <div 
                key={item.id} 
                className={`px-6 py-3 flex items-center justify-between transition ${
                  item.status === "success" ? "hover:bg-gray-50/80" : "bg-red-50/30 hover:bg-red-50/50"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.status === "success" ? (
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={18} />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                      <AlertCircle size={18} />
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {item.design ? `${item.design} - ${item.item} (${item.size})` : item.barcodeData}
                      </p>
                      {item.unitNumber ? (
                        <span className="px-1.5 py-0.5 text-[11px] font-mono bg-gray-100 text-gray-700 rounded">
                          #{item.unitNumber}
                        </span>
                      ) : null}
                    </div>
                    <p className={`text-xs truncate ${item.status === "success" ? "text-gray-500" : "text-red-600 font-medium"}`}>
                      {item.message}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-4">
                  <span className="text-xs font-mono text-gray-400">{item.time}</span>
                  <div className="text-[11px]">
                    <span className={item.status === "success" ? "text-emerald-600 font-medium" : "text-red-600 font-medium"}>
                      {item.status === "success" ? "Recorded" : "Failed"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
