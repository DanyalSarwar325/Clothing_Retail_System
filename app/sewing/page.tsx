"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  LogOut,
  User,
  FileOutput,
  Scan,
  Volume2,
  VolumeX,
  Wallet,
  CheckCircle2,
  Clock,
  Layers,
  Check,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import OutpassModal from "@/app/components/OutpassModal";
import { playScanSuccessSound, playScanErrorSound } from "@/app/libs/audio";

interface ScannedItem {
  id: string;
  barcodeId: string;
  barcodeData: string;
  poNumber?: string;
  design: string;
  item: string;
  size: string;
  suitType: string;
  unitNumber: number;
  scannedAt: string;
  amount: number;
  isPaid: boolean;
  paidAt: string | null;
  paidBy: string | null;
  status: string;
  defectDecision?: "approved" | "cancelled" | "adjusted" | null;
  defectReason?: string | null;
  defectNotes?: string | null;
  isSettled?: boolean;
  isWithheld?: boolean;
}

interface DefectAdjustment {
  id: string;
  design: string;
  item: string;
  size: string;
  unitNumber: number;
  rate: number;
  reason: string;
  notes: string;
  decidedAt: string;
}

interface CancelledPiece {
  id: string;
  barcodeId: string;
  design: string;
  item: string;
  size: string;
  unitNumber: number;
  rate: number;
  reason: string;
  notes: string;
}

interface DesignSummary {
  design: string;
  count: number;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  percentage: number;
}

interface WorkerSummary {
  totalDue: number;
  paid: number;
  pending: number;
  totalAdjustments?: number;
  netPending?: number;
  totalCancelled?: number;
  cancelledAmount?: number;
  totalScans: number;
  scannedToday: number;
}

export default function SewingPage() {
  const { user, logout } = useAuth();

  // State
  const [items, setItems] = useState<ScannedItem[]>([]);
  const [adjustments, setAdjustments] = useState<DefectAdjustment[]>([]);
  const [cancelledPieces, setCancelledPieces] = useState<CancelledPiece[]>([]);
  const [summary, setSummary] = useState<WorkerSummary>({
    totalDue: 0,
    paid: 0,
    pending: 0,
    totalAdjustments: 0,
    netPending: 0,
    totalCancelled: 0,
    cancelledAmount: 0,
    totalScans: 0,
    scannedToday: 0,
  });
  const [byDesign, setByDesign] = useState<DesignSummary[]>([]);
  const [availableWorkers, setAvailableWorkers] = useState<string[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<string>("");
  const [selectedDesign, setSelectedDesign] = useState<string>("all");

  const [loading, setLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showOutpassModal, setShowOutpassModal] = useState(false);

  // Scanner state & FIFO Queue
  const [barcodeInput, setBarcodeInput] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastScanMessage, setLastScanMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const scanQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const globalBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Determine current active worker name
  const currentWorker = selectedWorker || user?.name || user?.username || "Sewing Staff";

  // Auto-focus scanner input continuously unless modal is open
  useEffect(() => {
    if (showOutpassModal) return;

    const focusInput = () => {
      if (inputRef.current && document.activeElement !== inputRef.current) {
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
          return;
        }
        inputRef.current.focus();
      }
    };

    focusInput();
    const interval = setInterval(focusInput, 1500);
    const handleWindowClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        !["INPUT", "BUTTON", "SELECT", "A", "TEXTAREA"].includes(target.tagName)
      ) {
        setTimeout(focusInput, 50);
      }
    };

    window.addEventListener("click", handleWindowClick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("click", handleWindowClick);
    };
  }, [showOutpassModal, items]);

  // Fetch worker scanned items & earnings
  const fetchScannedData = useCallback(async (workerName: string) => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/sewing/scanned-items?userName=${encodeURIComponent(workerName)}`
      );
      const data = await res.json();
      if (data.success && data.data) {
        setItems(data.data.items || []);
        setAdjustments(data.data.adjustments || []);
        setCancelledPieces(data.data.cancelledPieces || []);
        setSummary(
          data.data.summary || {
            totalDue: 0,
            paid: 0,
            pending: 0,
            totalAdjustments: 0,
            netPending: 0,
            totalCancelled: 0,
            cancelledAmount: 0,
            totalScans: 0,
            scannedToday: 0,
          }
        );
        setByDesign(data.data.byDesign || []);
        if (data.data.availableWorkers?.length > 0) {
          setAvailableWorkers(data.data.availableWorkers);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sewing scanned items:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    const worker = user?.name || user?.username || "";
    if (worker) {
      setSelectedWorker(worker);
      fetchScannedData(worker);
    }
  }, [user, fetchScannedData]);

  // Format date like "Today, 11:20 AM" or "Yesterday, 04:44 PM"
  const formatScannedDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const scanDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

      const timeStr = date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      if (scanDay.getTime() === today.getTime()) {
        return `Today, ${timeStr}`;
      } else if (scanDay.getTime() === yesterday.getTime()) {
        return `Yesterday, ${timeStr}`;
      } else {
        const dateStr = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "short",
        });
        return `${dateStr}, ${timeStr}`;
      }
    } catch {
      return dateString;
    }
  };

  // Extract clean PO number instead of raw JSON
  const getDisplayBarcode = (item: ScannedItem): string => {
    if (item.poNumber) return item.poNumber;
    if (!item.barcodeData) return "-";
    const trimmed = item.barcodeData.trim();
    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.po || parsed.poNumber || "PO";
      } catch {
        return item.barcodeData;
      }
    }
    return item.barcodeData;
  };

  // FIFO Queue processor - handles rapid-fire barcode gun scans without dropping any scan
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (scanQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);

    const rawBarcode = scanQueueRef.current.shift()!;
    setQueueLength(scanQueueRef.current.length);

    try {
      const response = await fetch("/api/barcodes/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeData: rawBarcode,
          department: "Sewing",
          scannedBy: currentWorker,
        }),
      });

      const result = await response.json();

      if (result.success && result.barcode) {
        if (soundEnabled) playScanSuccessSound();
        const b = result.barcode;
        let displayPo = b.poNumber || "";
        if (!displayPo && b.barcodeData && b.barcodeData.trim().startsWith("{")) {
          try {
            const parsed = JSON.parse(b.barcodeData);
            displayPo = parsed.po || parsed.poNumber || "";
          } catch {}
        }
        const msg = `Scanned ${b.design || ""} ${b.item || ""} (${displayPo || b.barcodeData || rawBarcode})`;
        setLastScanMessage({ type: "success", text: msg });
        toast.success(msg, { id: "sewing-scan-success" });
        await fetchScannedData(currentWorker);
      } else {
        if (soundEnabled) playScanErrorSound();
        const errMsg = result.alreadyScanned
          ? `Already scanned in Sewing (${rawBarcode})`
          : (result.message || "Failed to scan barcode");
        setLastScanMessage({ type: "error", text: errMsg });
        toast.error(errMsg, { id: "sewing-scan-error" });
      }
    } catch {
      if (soundEnabled) playScanErrorSound();
      const errMsg = "Network or server error while scanning";
      setLastScanMessage({ type: "error", text: errMsg });
      toast.error(errMsg);
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setQueueLength(scanQueueRef.current.length);

      if (scanQueueRef.current.length > 0) {
        setTimeout(processQueue, 20);
      } else {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }, [currentWorker, soundEnabled, fetchScannedData]);

  // Enqueue barcode into FIFO queue
  const enqueueBarcode = useCallback((raw: string) => {
    const cleaned = raw.trim();
    if (!cleaned) return;

    scanQueueRef.current.push(cleaned);
    setQueueLength(scanQueueRef.current.length);
    processQueue();
  }, [processQueue]);

  // Global keydown listener to capture fast barcode gun wedge input
  useEffect(() => {
    if (showOutpassModal) return;

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
  }, [showOutpassModal, barcodeInput, enqueueBarcode]);

  // Handle manual submit
  const handleScan = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (barcodeInput.trim()) {
      enqueueBarcode(barcodeInput.trim());
      setBarcodeInput("");
      globalBufferRef.current = "";
    }
  };

  // Filtered items based on active pill
  const filteredItems = items.filter((item) => {
    if (selectedDesign === "all") return true;
    return (item.design || "").toLowerCase() === selectedDesign.toLowerCase();
  });

  const filteredTotal = filteredItems.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="min-h-screen bg-[#f6f5f1] text-gray-900 font-sans pb-16">
      {/* ================= TOP HEADER BAR ================= */}
      <header className="bg-white border-b border-gray-200/80 px-8 py-5 sticky top-0 z-20 shadow-xs">
        <div className="max-w-[1550px] mx-auto flex items-center justify-between">
          {/* Left: Department Logo & Worker Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#c0481c] rounded-2xl flex items-center justify-center text-white shadow-sm shrink-0">
              <span className="text-2xl">🧵</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight tracking-tight">
                Sewing Department
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                <User size={15} className="text-gray-400" />
                {user?.role === "admin" && availableWorkers.length > 1 ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-400">Worker:</span>
                    <select
                      value={selectedWorker}
                      onChange={(e) => {
                        const newWorker = e.target.value;
                        setSelectedWorker(newWorker);
                        fetchScannedData(newWorker);
                      }}
                      className="bg-gray-50 border border-gray-200 text-gray-900 font-bold rounded-lg px-2.5 py-1 text-sm focus:ring-2 focus:ring-[#c0481c] outline-none"
                    >
                      {availableWorkers.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className="font-semibold text-gray-800 text-sm">
                    {currentWorker}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: Scanned Today count, Outpass, Logout */}
          <div className="flex items-center gap-5">
            <div className="text-right pr-3">
              <span className="text-sm text-gray-500 font-medium mr-2">Scanned Today</span>
              <span className="text-3xl font-black text-[#c0481c] leading-tight">
                {summary.scannedToday}
              </span>
            </div>

            <button
              onClick={() => setShowOutpassModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#fbebe6] hover:bg-[#f7dfd7] text-[#c0481c] font-bold text-sm rounded-xl transition shadow-xs active:scale-95"
            >
              <FileOutput size={17} />
              Outpass
            </button>

            <button
              onClick={logout}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-bold text-sm rounded-xl transition shadow-xs active:scale-95"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT LAYOUT ================= */}
      <main className="max-w-[1550px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ================= LEFT COLUMN: Scanned Items Table (66% Width) ================= */}
          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white rounded-3xl border border-stone-200/70 shadow-sm p-8">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                    My Scanned Items
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Filter by design to see what you have scanned, pending earnings, and approved deductions.
                  </p>
                </div>
                <span className="text-sm font-medium text-gray-400">
                  {selectedDesign === "all" ? "All designs" : selectedDesign}
                </span>
              </div>

              {/* Defect Adjustments & Notifications Banner */}
              {(adjustments.length > 0 || cancelledPieces.length > 0) && (
                <div className="space-y-3 mb-6">
                  {adjustments.length > 0 && (
                    <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-xs text-rose-950 shadow-2xs">
                      <div className="flex items-start gap-2.5">
                        <div className="p-1.5 bg-rose-100 text-rose-700 rounded-lg shrink-0 mt-0.5">
                          <AlertCircle size={18} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-rose-900 text-sm">
                              Wage Adjustment Notice:
                            </span>
                            <span className="px-2 py-0.5 bg-rose-200/70 text-rose-800 rounded font-bold text-[11px]">
                              -Rs {summary.totalAdjustments || adjustments.reduce((s, a) => s + a.rate, 0)} to be deducted
                            </span>
                          </div>
                          <p className="text-rose-800 mt-1">
                            An adjustment has been made for defective piece(s) that were previously paid. This amount will be deducted from your next wage payout.
                          </p>
                          <div className="mt-2.5 flex flex-wrap gap-2">
                            {adjustments.map((adj) => (
                              <div
                                key={adj.id}
                                className="px-2.5 py-1.5 bg-white border border-rose-200 rounded-lg text-rose-900 shadow-2xs"
                              >
                                <span className="font-bold">{adj.design}</span> • {adj.item} #{adj.unitNumber}
                                <span className="text-rose-600 font-extrabold ml-1.5">-Rs {adj.rate}</span>
                                {adj.reason && (
                                  <span className="text-gray-500 block text-[10px] mt-0.5">
                                    Reason: {adj.reason}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {cancelledPieces.length > 0 && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-xs text-amber-950 shadow-2xs">
                      <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg shrink-0 mt-0.5">
                        <AlertCircle size={18} />
                      </div>
                      <div>
                        <span className="font-bold text-amber-900 text-sm">
                          Payment Withheld Notice ({cancelledPieces.length} Defective Piece{cancelledPieces.length > 1 ? "s" : ""}):
                        </span>
                        <p className="text-amber-800 mt-0.5">
                          Admin reviewed quality defect scans and rejected payment for the following piece(s). You will not be paid for these items:
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {cancelledPieces.map((c, i) => (
                            <div
                              key={i}
                              className="px-2.5 py-1 bg-white border border-amber-200 rounded-lg text-amber-900 text-[11px] shadow-2xs"
                            >
                              <span className="font-bold">{c.design}</span> • {c.item} #{c.unitNumber}
                              <span className="text-rose-600 font-bold ml-1">(Rs 0)</span>
                              <span className="text-gray-500 block text-[10px]">Reason: {c.reason}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Design Filter Pills */}
              <div className="flex flex-wrap items-center gap-2.5 pt-2 pb-5">
                <button
                  type="button"
                  onClick={() => setSelectedDesign("all")}
                  className={`text-sm px-4 py-2 rounded-full font-bold transition flex items-center gap-2 shadow-xs cursor-pointer ${
                    selectedDesign === "all"
                      ? "bg-[#c0481c] text-white"
                      : "bg-white border border-gray-200 text-gray-800 hover:border-gray-300"
                  }`}
                >
                  All
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      selectedDesign === "all"
                        ? "bg-[#a03812] text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {items.length}
                  </span>
                </button>

                {byDesign.map((d) => {
                  const isActive = selectedDesign.toLowerCase() === d.design.toLowerCase();
                  return (
                    <button
                      key={d.design}
                      type="button"
                      onClick={() => setSelectedDesign(isActive ? "all" : d.design)}
                      className={`text-sm px-4 py-2 rounded-full font-bold transition flex items-center gap-2 shadow-xs cursor-pointer ${
                        isActive
                          ? "bg-[#c0481c] text-white"
                          : "bg-white border border-gray-200 text-gray-800 hover:border-gray-300"
                      }`}
                    >
                      {d.design}
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? "bg-[#a03812] text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {d.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Scanned Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-400 text-xs font-bold uppercase tracking-wider">
                      <th className="py-4 px-4 w-12 text-center">#</th>
                      <th className="py-4 px-4">BARCODE</th>
                      <th className="py-4 px-4">DESIGN</th>
                      <th className="py-4 px-4">ITEM</th>
                      <th className="py-4 px-4">SCANNED</th>
                      <th className="py-4 px-4 text-right">AMOUNT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-gray-400">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="w-8 h-8 border-3 border-[#c0481c] border-t-transparent rounded-full animate-spin" />
                            <p className="text-sm font-medium">Loading scanned items...</p>
                          </div>
                        </td>
                      </tr>
                    ) : filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-16 text-center text-gray-400">
                          <p className="font-bold text-base text-gray-700">No scanned items found</p>
                          <p className="text-sm text-gray-400 mt-1.5">
                            {selectedDesign !== "all"
                              ? `No garments scanned under "${selectedDesign}".`
                              : "Point your barcode scanner and scan garments to record pieces."}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item, idx) => (
                        <tr
                          key={item.id}
                          className="hover:bg-stone-50/70 transition-colors"
                        >
                          <td className="py-4 px-4 text-center font-medium text-gray-400 text-sm">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-4 font-mono font-bold text-gray-900 text-sm tracking-tight">
                            {getDisplayBarcode(item)}
                          </td>
                          <td className="py-4 px-4 font-bold text-gray-900 text-base">
                            {item.design}
                          </td>
                          <td className="py-4 px-4 text-gray-800 font-medium text-sm">
                            {item.item}
                            {item.size ? (
                              <span className="text-xs text-gray-400 ml-1.5 font-normal">
                                ({item.size})
                              </span>
                            ) : null}
                          </td>
                          <td className="py-4 px-4 text-gray-600 text-sm whitespace-nowrap">
                            {formatScannedDate(item.scannedAt)}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <div className="font-bold text-gray-900 text-base">
                              {item.isWithheld ? (
                                <>
                                  <span className="text-gray-400 line-through text-xs mr-1.5 font-normal">
                                    Rs {item.amount.toFixed(2)}
                                  </span>
                                  <span className="text-rose-600 font-extrabold">Rs 0.00</span>
                                </>
                              ) : (
                                <span>Rs {item.amount.toFixed(2)}</span>
                              )}
                            </div>
                            <div className="text-[11px] font-semibold mt-0.5">
                              {item.isWithheld ? (
                                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold">
                                  <AlertCircle size={11} /> Defective (Unpaid)
                                </span>
                              ) : item.defectDecision === "adjusted" ? (
                                <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1 font-bold">
                                  ⚠️ Adjusted (-Rs {item.amount.toFixed(0)})
                                </span>
                              ) : item.isPaid ? (
                                <span className="text-emerald-600 inline-flex items-center gap-1">
                                  <Check size={12} strokeWidth={3} /> Paid
                                </span>
                              ) : (
                                <span className="text-amber-600 inline-flex items-center gap-1">
                                  <Clock size={12} /> Pending
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table Footer */}
              {!loading && filteredItems.length > 0 && (
                <div className="flex items-center justify-between pt-5 mt-3 border-t border-gray-100 text-sm text-gray-500 font-medium">
                  <span>{filteredItems.length} scans shown</span>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 font-medium text-sm">Total</span>
                    <span className="text-2xl font-black text-gray-900">
                      Rs {filteredTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: Stats, Scanner, By Design (34% Width) ================= */}
          <div className="lg:col-span-4 space-y-6">
            {/* 1. 2x2 Stats Cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Total Due */}
              <div className="bg-white rounded-3xl border border-stone-200/70 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 text-gray-500 text-sm font-semibold">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Wallet size={16} />
                  </div>
                  Total Due
                </div>
                <p className="text-2xl font-black text-gray-900 mt-3 tracking-tight">
                  Rs {summary.totalDue.toFixed(2)}
                </p>
              </div>

              {/* Paid */}
              <div className="bg-white rounded-3xl border border-stone-200/70 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 text-gray-500 text-sm font-semibold">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <CheckCircle2 size={16} />
                  </div>
                  Paid
                </div>
                <p className="text-2xl font-black text-emerald-600 mt-3 tracking-tight">
                  Rs {summary.paid.toFixed(2)}
                </p>
              </div>

              {/* Pending */}
              <div className="bg-white rounded-3xl border border-stone-200/70 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 text-gray-500 text-sm font-semibold">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                    <Clock size={16} />
                  </div>
                  Net Due Payout
                </div>
                <p className="text-2xl font-black text-[#c0481c] mt-3 tracking-tight">
                  Rs {(summary.netPending ?? summary.pending).toFixed(2)}
                </p>
                {summary.totalAdjustments && summary.totalAdjustments > 0 ? (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1">
                    (After -Rs {summary.totalAdjustments.toFixed(0)} defect deduction)
                  </p>
                ) : null}
              </div>

              {/* My Scans */}
              <div className="bg-white rounded-3xl border border-stone-200/70 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 text-gray-500 text-sm font-semibold">
                  <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#c0481c] flex items-center justify-center shrink-0">
                    <Layers size={16} />
                  </div>
                  My Scans
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-2xl font-black text-gray-900 tracking-tight">
                    {summary.totalScans}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Per-item rates</span>
                </div>
              </div>
            </div>

            {/* 2. Barcode Scanner Active (Always-On Dark Card) */}
            <div className="bg-[#111827] text-white rounded-3xl p-6 shadow-md border border-gray-800">
              {/* Header with Green Pulse & Queue Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="font-bold text-base tracking-tight text-white">
                    Barcode Scanner Active
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="bg-[#052e16] text-[#4ade80] border border-[#166534] text-xs font-bold px-3 py-1 rounded-full">
                    Always-On
                  </span>
                  {queueLength > 0 && (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-black animate-pulse">
                      <Sparkles size={13} />
                      Queue: {queueLength}
                    </span>
                  )}
                </div>
              </div>

              <p className="text-sm text-gray-300 mt-2.5 leading-relaxed font-normal">
                Scan garments one after another. Each scan is queued and confirmed with a sound.
              </p>

              {/* Sound Toggle Button */}
              <button
                type="button"
                onClick={() => setSoundEnabled((prev) => !prev)}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 transition mt-4 border border-gray-700/80 cursor-pointer"
              >
                {soundEnabled ? (
                  <>
                    <Volume2 size={15} className="text-emerald-400" />
                    Sound ON
                  </>
                ) : (
                  <>
                    <VolumeX size={15} className="text-gray-400" />
                    Sound OFF
                  </>
                )}
              </button>

              {/* Scanner Form */}
              <form onSubmit={handleScan} className="mt-5">
                <div className="bg-white rounded-2xl p-2 border-2 border-[#c0481c] flex items-center gap-3 shadow-inner">
                  <Scan size={22} className="text-[#c0481c] ml-2 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    placeholder="Scan or type barcode"
                    autoComplete="off"
                    className="w-full text-base font-bold text-gray-900 placeholder-gray-400 bg-transparent outline-none px-1"
                  />
                  <button
                    type="submit"
                    disabled={!barcodeInput.trim() && queueLength === 0}
                    className="bg-[#c0481c] hover:bg-[#a03812] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition shrink-0 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 cursor-pointer"
                  >
                    {queueLength > 0 ? `Queue (${queueLength})` : isProcessing ? "Scanning..." : "Enter"}
                  </button>
                </div>
              </form>

              {/* Scan Feedback Banner */}
              {lastScanMessage && (
                <div
                  className={`mt-3 p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    lastScanMessage.type === "success"
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800"
                      : "bg-red-950/80 text-red-300 border border-red-800"
                  }`}
                >
                  {lastScanMessage.type === "success" ? (
                    <CheckCircle2 size={15} className="shrink-0" />
                  ) : (
                    <AlertCircle size={15} className="shrink-0" />
                  )}
                  <span className="truncate">{lastScanMessage.text}</span>
                </div>
              )}

              {/* Status Info Footer */}
              <div className="flex items-center justify-between text-xs text-gray-400 mt-4 pt-3 border-t border-gray-800 font-medium">
                <span>Ready for rapid scanning</span>
                <span className="text-gray-400">Department: Sewing</span>
              </div>
            </div>

            {/* 3. Earnings by Design Card */}
            <div className="bg-white rounded-3xl border border-stone-200/70 shadow-sm p-6">
              <h3 className="text-xl font-bold text-gray-900 tracking-tight">
                Earnings by Design
              </h3>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Per-item rates: Qameez, Shalawar, Dupatta. Tap a design to filter the table.
              </p>

              <div className="space-y-3 mt-5">
                {byDesign.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    No design earnings recorded yet.
                  </p>
                ) : (
                  byDesign.map((d) => {
                    const isSelected =
                      selectedDesign.toLowerCase() === d.design.toLowerCase();
                    return (
                      <div
                        key={d.design}
                        onClick={() => setSelectedDesign(isSelected ? "all" : d.design)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#c0481c] bg-[#fffaf8] shadow-sm"
                            : "border-gray-100 hover:border-gray-200 bg-gray-50/50 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-gray-900 text-base block">
                              {d.design}
                            </span>
                            <span className="text-xs text-gray-400 font-medium mt-0.5 block">
                              Scans: {d.count}
                            </span>
                          </div>
                          <span className="font-bold text-gray-900 text-base">
                            Rs {d.totalAmount.toFixed(2)}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-gray-200/80 h-2 rounded-full overflow-hidden mt-3">
                          <div
                            className="bg-[#c0481c] h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.min(100, Math.max(8, d.percentage))}%`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => {
          setShowOutpassModal(false);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        department="Sewing"
        userName={currentWorker}
      />
    </div>
  );
}
