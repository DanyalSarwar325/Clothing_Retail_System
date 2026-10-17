"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  LogOut,
  Scan,
  CheckCircle2,
  AlertCircle,
  History,
  ShieldCheck,
  AlertTriangle,
  FileOutput,
  X,
  Layers,
  RefreshCw,
  Search,
  Filter,
  ArrowRightLeft,
  Tag,
  Clock,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import OutpassModal from "@/app/components/OutpassModal";
import { playScanSuccessSound, playScanErrorSound } from "@/app/libs/audio";

type QualityScanMode = "normal" | "defective" | "convert";

interface InspectedItem {
  id: string;
  design: string;
  item: string;
  size: string;
  unitNumber: number;
  mode: QualityScanMode;
  status: string;
  time: string;
  stitcherName?: string;
  inspector: string;
  reason?: string;
  notes?: string;
}

interface DefectiveLogEntry {
  id: string;
  design: string;
  size: string;
  suitType?: string;
  item: string;
  unitNumber: number;
  status: string;
  defectiveInfo?: {
    markedAt: string;
    markedBy: string;
    department: string;
    reason: string;
    notes?: string;
    isCompanionDefect?: boolean;
    defectiveReferenceBarcode?: string;
    companionReason?: string;
  };
  createdAt: string;
}

export default function QualityPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"scan" | "defective_log">("scan");

  // The 3-way Mode Selector
  const [scanMode, setScanMode] = useState<QualityScanMode>("normal");
  const [defectReason, setDefectReason] = useState<string>("Stitching error");

  // Scanner state
  const [scannerInput, setScannerInput] = useState("");
  const [queueLength, setQueueLength] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [okCount, setOkCount] = useState(0);
  const [defectiveCount, setDefectiveCount] = useState(0);
  const [convertedCount, setConvertedCount] = useState(0);

  // Live session inspected items feed
  const [recentInspections, setRecentInspections] = useState<InspectedItem[]>([]);
  const [lastItem, setLastItem] = useState<InspectedItem | null>(null);

  // Defective logs tab
  const [defectiveLogs, setDefectiveLogs] = useState<DefectiveLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "primary" | "companion">("all");

  const [showOutpassModal, setShowOutpassModal] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // FIFO Queue & hardware scanner wedge refs
  const scanQueueRef = useRef<Array<{ barcode: string; mode: QualityScanMode; defectReason: string }>>([]);
  const isProcessingRef = useRef<boolean>(false);
  const globalBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);

  // Auto-focus barcode input continuously whenever on the scan tab
  useEffect(() => {
    if (activeTab === "scan" && !showOutpassModal) {
      const focus = () => {
        if (scannerInputRef.current && document.activeElement !== scannerInputRef.current) {
          const active = document.activeElement;
          if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
            return;
          }
          scannerInputRef.current.focus();
        }
      };
      focus();
      const interval = setInterval(focus, 1200);
      const handleDocClick = () => setTimeout(focus, 50);
      document.addEventListener("click", handleDocClick);
      return () => {
        clearInterval(interval);
        document.removeEventListener("click", handleDocClick);
      };
    }
  }, [activeTab, showOutpassModal]);

  // Load defective logs on mount or tab change
  useEffect(() => {
    if (activeTab === "defective_log") {
      fetchDefectiveLogs();
    }
  }, [activeTab]);

  const fetchDefectiveLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/barcodes/defective");
      const data = await res.json();
      if (data.success && Array.isArray(data.barcodes)) {
        setDefectiveLogs(data.barcodes);
      }
    } catch (err) {
      console.error("Failed to fetch defective logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  // FIFO Queue processor - handles rapid-fire barcode gun scans without dropping any scan
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (scanQueueRef.current.length === 0) return;

    isProcessingRef.current = true;
    setIsProcessing(true);

    const task = scanQueueRef.current.shift()!;
    setQueueLength(scanQueueRef.current.length);

    const { barcode: trimmedData, mode, defectReason: currentDefectReason } = task;
    const inspector = user?.name || user?.username || "Quality Inspector";

    try {
      if (mode === "normal") {
        // =========================================================================
        // MODE 1: NORMAL (Every item marked Quality OK)
        // =========================================================================
        const res = await fetch("/api/barcodes/quality-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData: trimmedData,
            checkedBy: inspector,
            status: "quality_ok",
            notes: "Approved Quality OK",
          }),
        });

        const data = await res.json();
        if (data.success && data.barcode) {
          playScanSuccessSound();
          const b = data.barcode;
          const stitcher =
            b.departmentHistory?.find((h: any) => h.department === "Sewing")?.scannedBy || "Sewing Staff";

          const inspected: InspectedItem = {
            id: b.id,
            design: b.design,
            item: b.item,
            size: b.size,
            unitNumber: b.unitNumber,
            mode: "normal",
            status: "quality_ok",
            time: new Date().toLocaleTimeString(),
            stitcherName: stitcher,
            inspector,
          };

          setLastItem(inspected);
          setRecentInspections((prev) => [inspected, ...prev.slice(0, 29)]);
          setScanCount((c) => c + 1);
          setOkCount((c) => c + 1);
          toast.success(`✓ OK: ${b.design} — ${b.item} (${b.size}) #${b.unitNumber}`);
        } else {
          playScanErrorSound();
          toast.error(data.message || "Barcode not found");
        }
      } else if (mode === "defective") {
        // =========================================================================
        // MODE 2: DEFECTIVE (Genuinely Damaged - No companion prompts)
        // =========================================================================
        const res = await fetch("/api/barcodes/defective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData: trimmedData,
            department: "Quality",
            markedBy: inspector,
            isCompanionDefect: false,
            reason: currentDefectReason || "Quality Defect",
            notes: `Marked defective during quality inspection (${currentDefectReason})`,
          }),
        });

        const data = await res.json();
        if (data.success && data.barcode) {
          playScanErrorSound();
          const b = data.barcode;
          const stitcher =
            b.departmentHistory?.find((h: any) => h.department === "Sewing")?.scannedBy || "Sewing Staff";

          const inspected: InspectedItem = {
            id: b.id,
            design: b.design,
            item: b.item,
            size: b.size,
            unitNumber: b.unitNumber,
            mode: "defective",
            status: "defective",
            time: new Date().toLocaleTimeString(),
            stitcherName: stitcher,
            inspector,
            reason: currentDefectReason,
          };

          setLastItem(inspected);
          setRecentInspections((prev) => [inspected, ...prev.slice(0, 29)]);
          setScanCount((c) => c + 1);
          setDefectiveCount((c) => c + 1);
          toast.error(`⚠️ DEFECTIVE: ${b.design} — ${b.item} (${b.size}) #${b.unitNumber} (Stitcher: ${stitcher})`);
        } else {
          playScanErrorSound();
          toast.error(data.message || "Failed to mark defective");
        }
      } else if (mode === "convert") {
        // =========================================================================
        // MODE 3: CONVERT OK TO DEFECTIVE (Companion Scrap - Stitcher is PAID)
        // =========================================================================
        const res = await fetch("/api/barcodes/defective", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            barcodeData: trimmedData,
            department: "Quality",
            markedBy: inspector,
            isCompanionDefect: true,
            convertedFromOk: true,
            reason: "Converted from OK (Companion Piece)",
            notes: `Converted from OK by ${inspector} to complete broken suit set`,
          }),
        });

        const data = await res.json();
        if (data.success && data.barcode) {
          playScanErrorSound();
          const b = data.barcode;
          const stitcher =
            b.departmentHistory?.find((h: any) => h.department === "Sewing")?.scannedBy || "Sewing Staff";

          const inspected: InspectedItem = {
            id: b.id,
            design: b.design,
            item: b.item,
            size: b.size,
            unitNumber: b.unitNumber,
            mode: "convert",
            status: "defective_companion",
            time: new Date().toLocaleTimeString(),
            stitcherName: stitcher,
            inspector,
            notes: "Converted from OK • Stitcher Paid",
          };

          setLastItem(inspected);
          setRecentInspections((prev) => [inspected, ...prev.slice(0, 29)]);
          setScanCount((c) => c + 1);
          setConvertedCount((c) => c + 1);
          toast.success(
            `🔄 CONVERTED TO DEFECTIVE: ${b.design} — ${b.item} (${b.size}) #${b.unitNumber}. (Stitcher ${stitcher} will be paid automatically).`,
            { duration: 5000 }
          );
        } else {
          playScanErrorSound();
          toast.error(data.message || "Failed to convert item");
        }
      }
    } catch (err: any) {
      playScanErrorSound();
      toast.error(err.message || "Error processing scan");
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
      setQueueLength(scanQueueRef.current.length);

      // Process next item in FIFO queue immediately
      if (scanQueueRef.current.length > 0) {
        setTimeout(processQueue, 20);
      } else {
        setTimeout(() => scannerInputRef.current?.focus(), 20);
      }
    }
  }, [user]);

  // Enqueue barcode into FIFO queue
  const enqueueBarcode = useCallback(
    (raw: string, mode: QualityScanMode, reason: string) => {
      const cleaned = raw.trim();
      if (!cleaned) return;

      scanQueueRef.current.push({ barcode: cleaned, mode, defectReason: reason });
      setQueueLength(scanQueueRef.current.length);
      processQueue();
    },
    [processQueue]
  );

  // Global hardware scanner listener
  useEffect(() => {
    if (activeTab !== "scan" || showOutpassModal) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        if (target !== scannerInputRef.current) return;
      }

      const now = Date.now();
      if (now - lastKeyTimeRef.current > 400) {
        globalBufferRef.current = "";
      }
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const barcodeFromBuffer = globalBufferRef.current.trim();
        const barcodeFromInput = scannerInput.trim();
        const finalBarcode = barcodeFromInput || barcodeFromBuffer;

        if (finalBarcode) {
          e.preventDefault();
          globalBufferRef.current = "";
          setScannerInput("");
          enqueueBarcode(finalBarcode, scanMode, defectReason);
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        globalBufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [activeTab, showOutpassModal, scanMode, defectReason, scannerInput, enqueueBarcode]);

  // Filter logs in tab 2
  const filteredLogs = defectiveLogs.filter((log) => {
    const matchesSearch =
      log.design.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.item.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.defectiveInfo?.reason && log.defectiveInfo.reason.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.defectiveInfo?.notes && log.defectiveInfo.notes.toLowerCase().includes(logSearch.toLowerCase()));

    if (!matchesSearch) return false;
    const isCompanion = !!log.defectiveInfo?.isCompanionDefect;
    if (logFilter === "primary") return !isCompanion;
    if (logFilter === "companion") return isCompanion;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-4 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-xs text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Quality Department</h1>
            <p className="text-xs text-gray-500 font-medium">
              Inspector: <strong className="text-gray-800">{user?.name || user?.username}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-gray-500 uppercase tracking-wider block">Inspected Today</span>
              <strong className="text-xl font-black text-gray-900 leading-none">{scanCount}</strong>
            </div>
            <div className="h-7 w-px bg-gray-200" />
            <div className="text-right">
              <span className="text-[11px] text-emerald-600 font-semibold block">OK: {okCount}</span>
              <span className="text-[11px] text-red-600 font-semibold block">Def: {defectiveCount} | Conv: {convertedCount}</span>
            </div>
          </div>

          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-xl text-xs font-semibold transition border border-orange-200 cursor-pointer"
          >
            <FileOutput size={15} />
            Outpass
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-xl text-xs font-semibold transition border border-red-200 cursor-pointer"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 bg-white rounded-t-2xl px-4 pt-3">
          <button
            onClick={() => setActiveTab("scan")}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === "scan"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
          >
            <Scan size={17} />
            Quality Scanner (3 Modes)
          </button>
          <button
            onClick={() => {
              setActiveTab("defective_log");
              fetchDefectiveLogs();
            }}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${activeTab === "defective_log"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
          >
            <Layers size={17} />
            Defective & Converted Suits Log ({defectiveLogs.length})
          </button>
        </div>

        {/* TAB 1: SCANNER & 3 MODES */}
        {activeTab === "scan" && (
          <div className="space-y-6">
            {/* Payment Summaries */}
            <div className="space-y-4">
              <DepartmentPaymentSummary department="Quality" refreshKey={scanCount} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PaymentDisplay userName={user?.name || user?.username || ""} department="Quality" scanCount={scanCount} />
                <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Quality" scanCount={scanCount} />
              </div>
            </div>

            {/* ========================================================================= */}
            {/* THE 3-WAY MODE SELECTOR                                                   */}
            {/* ========================================================================= */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">
                  Select Quality Inspection Mode
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Mode 1: Normal OK */}
                  <button
                    onClick={() => {
                      setScanMode("normal");
                      scannerInputRef.current?.focus();
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${scanMode === "normal"
                        ? "border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/20 shadow-xs"
                        : "border-gray-200 bg-gray-50/60 hover:bg-gray-100/70"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-emerald-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" />
                        1. Normal (Mark OK)
                      </span>
                      {scanMode === "normal" && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-700/90 leading-relaxed">
                      Every scanned item is instantly approved as <strong>Quality OK</strong>. Continuous scanning.
                    </p>
                  </button>

                  {/* Mode 2: Defective */}
                  <button
                    onClick={() => {
                      setScanMode("defective");
                      scannerInputRef.current?.focus();
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${scanMode === "defective"
                        ? "border-red-600 bg-red-50/80 ring-2 ring-red-500/20 shadow-xs"
                        : "border-gray-200 bg-gray-50/60 hover:bg-gray-100/70"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-red-800 flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block" />
                        2. Defective
                      </span>
                      {scanMode === "defective" && (
                        <span className="px-2 py-0.5 rounded-full bg-red-600 text-white text-[10px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-red-700/90 leading-relaxed">
                      Genuinely damaged piece. Sent to Admin Defect Review. Stitcher payment depends on Admin decision.
                    </p>
                  </button>

                  {/* Mode 3: Convert OK to Defective */}
                  <button
                    onClick={() => {
                      setScanMode("convert");
                      scannerInputRef.current?.focus();
                    }}
                    className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${scanMode === "convert"
                        ? "border-purple-600 bg-purple-50/80 ring-2 ring-purple-500/20 shadow-xs"
                        : "border-gray-200 bg-gray-50/60 hover:bg-gray-100/70"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-purple-900 flex items-center gap-1.5">
                        <ArrowRightLeft size={14} className="text-purple-600" />
                        3. Convert OK to Defective
                      </span>
                      {scanMode === "convert" && (
                        <span className="px-2 py-0.5 rounded-full bg-purple-600 text-white text-[10px] font-bold">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-purple-800/90 leading-relaxed">
                      Scans OK companion piece to complete a damaged suit. <strong>Stitcher is PAID automatically!</strong>
                    </p>
                  </button>
                </div>
              </div>

              {/* Optional Defect Reason selector when in Defective mode */}
              {scanMode === "defective" && (
                <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-red-900 font-semibold">
                    <AlertTriangle size={15} className="text-red-600" />
                    <span>Select Defect Category (applied automatically on scan):</span>
                  </div>
                  <select
                    value={defectReason}
                    onChange={(e) => setDefectReason(e.target.value)}
                    className="border border-red-300 rounded-lg px-3 py-1.5 bg-white text-xs font-bold text-red-900 focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Stitching error">Stitching error</option>
                    <option value="Fabric damaged">Fabric damaged</option>
                    <option value="Wrong cutting">Wrong cutting</option>
                    <option value="Machine damage">Machine damage</option>
                    <option value="Color defect">Color defect</option>
                    <option value="Size error">Size error</option>
                    <option value="Quality issue">Quality issue</option>
                  </select>
                </div>
              )}

              {/* Active Mode Banner */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold ${scanMode === "normal"
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : scanMode === "defective"
                      ? "bg-red-50 border-red-300 text-red-900"
                      : "bg-purple-50 border-purple-300 text-purple-900"
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full animate-ping bg-current" />
                  <span>
                    Current Scanner Action:{" "}
                    <strong>
                      {scanMode === "normal"
                        ? "Mark as Quality OK ✓"
                        : scanMode === "defective"
                          ? `Mark as Defective (${defectReason}) ⚠️`
                          : "Convert OK to Defective Companion (Stitcher Paid Automatically) 🔄"}
                    </strong>
                  </span>
                </div>
                <span className="opacity-70 font-mono text-[11px]">Aim barcode gun and scan</span>
              </div>

              {/* Gun Scanner Active Input */}
              <div className="space-y-2">
                <div className="relative">
                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = scannerInput.trim();
                        if (val) {
                          setScannerInput("");
                          enqueueBarcode(val, scanMode, defectReason);
                        }
                      }
                    }}
                    placeholder={`Point barcode gun here to scan in ${scanMode === "normal" ? "NORMAL" : scanMode === "defective" ? "DEFECTIVE" : "CONVERT"
                      } mode...`}
                    className={`w-full px-4 py-3.5 border-2 rounded-xl text-center font-mono text-sm font-bold shadow-xs focus:outline-hidden ${scanMode === "normal"
                        ? "border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 text-emerald-900"
                        : scanMode === "defective"
                          ? "border-red-500 focus:ring-4 focus:ring-red-500/20 text-red-900"
                          : "border-purple-500 focus:ring-4 focus:ring-purple-500/20 text-purple-950"
                      }`}
                    autoComplete="off"
                    autoFocus
                  />
                  {isProcessing && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-gray-500 font-medium">
                      <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      {queueLength > 0 ? `Queued (${queueLength})...` : "Processing..."}
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-gray-400 text-center">
                  Scanner input is continuously active. Pressing Enter or triggering your barcode gun instantly submits.
                </p>
              </div>
            </div>

            {/* Live Feed: Last Inspected Item Banner */}
            {lastItem && (
              <div
                className={`p-4 rounded-2xl border shadow-xs animate-in fade-in duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${lastItem.mode === "normal"
                    ? "bg-emerald-50/80 border-emerald-200 text-emerald-950"
                    : lastItem.mode === "defective"
                      ? "bg-red-50/80 border-red-200 text-red-950"
                      : "bg-purple-50/80 border-purple-200 text-purple-950"
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${lastItem.mode === "normal"
                        ? "bg-emerald-600"
                        : lastItem.mode === "defective"
                          ? "bg-red-600"
                          : "bg-purple-600"
                      }`}
                  >
                    #{lastItem.unitNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-base">{lastItem.design}</h4>
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white/80 border border-gray-300">
                        {lastItem.item} ({lastItem.size})
                      </span>
                    </div>
                    <p className="text-xs opacity-80 mt-0.5">
                      Stitcher: <strong>{lastItem.stitcherName || "Tailor"}</strong> • Inspected at {lastItem.time}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold inline-block ${lastItem.mode === "normal"
                        ? "bg-emerald-200 text-emerald-900"
                        : lastItem.mode === "defective"
                          ? "bg-red-200 text-red-950"
                          : "bg-purple-200 text-purple-950"
                      }`}
                  >
                    {lastItem.mode === "normal"
                      ? "✓ Quality OK"
                      : lastItem.mode === "defective"
                        ? `⚠️ Defective (${lastItem.reason})`
                        : "🔄 Converted OK (Stitcher Paid)"}
                  </span>
                </div>
              </div>
            )}

            {/* Recent Scans Session Feed */}
            {recentInspections.length > 0 && (
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                <div className="p-4 border-b bg-gray-50/80 flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                    <History size={15} /> Recent Scans in This Session ({recentInspections.length})
                  </h4>
                  <button
                    onClick={() => setRecentInspections([])}
                    className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    Clear Feed
                  </button>
                </div>

                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {recentInspections.map((item, idx) => (
                    <div key={idx} className="p-3 sm:px-4 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${item.mode === "normal"
                              ? "bg-emerald-500"
                              : item.mode === "defective"
                                ? "bg-red-500"
                                : "bg-purple-500"
                            }`}
                        />
                        <span className="font-bold text-gray-900 truncate">{item.design}</span>
                        <span className="text-gray-500">
                          {item.item} ({item.size}) #{item.unitNumber}
                        </span>
                        <span className="text-gray-400 font-mono text-[11px] truncate">
                          [Stitcher: {item.stitcherName || "Unknown"}]
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${item.mode === "normal"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.mode === "defective"
                                ? "bg-red-100 text-red-800"
                                : "bg-purple-100 text-purple-900"
                            }`}
                        >
                          {item.mode === "normal"
                            ? "OK"
                            : item.mode === "defective"
                              ? "Defective"
                              : "Converted (Paid)"}
                        </span>
                        <span className="text-gray-400 text-[11px]">{item.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DEFECTIVE LOGS */}
        {activeTab === "defective_log" && (
          <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Defective & Converted Pieces Record</h3>
                <p className="text-xs text-gray-500">
                  Comprehensive audit trail of primary defects and converted companion pieces.
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setLogFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${logFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  All ({defectiveLogs.length})
                </button>
                <button
                  onClick={() => setLogFilter("primary")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${logFilter === "primary" ? "bg-red-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Genuine Defects
                </button>
                <button
                  onClick={() => setLogFilter("companion")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${logFilter === "companion" ? "bg-purple-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                >
                  Converted Companions
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative max-w-md">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                placeholder="Search defective pieces by design, item, reason..."
                className="w-full pl-9 pr-4 py-2 border rounded-xl text-xs bg-gray-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
              />
            </div>

            {logsLoading ? (
              <div className="py-12 text-center text-xs text-gray-400 animate-pulse">Loading defective logs...</div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-gray-400">No defective pieces found matching criteria.</div>
            ) : (
              <div className="space-y-3">
                {filteredLogs.map((log) => {
                  const isCompanion = !!log.defectiveInfo?.isCompanionDefect;
                  return (
                    <div
                      key={log.id}
                      className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isCompanion ? "bg-purple-50/50 border-purple-200" : "bg-red-50/50 border-red-200"
                        }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-gray-900 text-sm">{log.design}</strong>
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-white border border-gray-300">
                            {log.item} ({log.size}) #{log.unitNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${isCompanion
                                ? "bg-purple-100 text-purple-900"
                                : "bg-red-100 text-red-900"
                              }`}
                          >
                            {isCompanion ? "Converted from OK (Paid)" : "Genuine Defect"}
                          </span>
                        </div>
                        <p className="text-gray-600 mt-1">
                          Reason: <strong>{log.defectiveInfo?.reason || "Defect"}</strong>
                          {log.defectiveInfo?.notes && (
                            <span className="italic ml-1 text-gray-500">
                              (&quot;{log.defectiveInfo.notes}&quot;)
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="text-right text-[11px] text-gray-500 shrink-0">
                        <p>Marked by: {log.defectiveInfo?.markedBy || "Inspector"}</p>
                        <p>{log.defectiveInfo?.markedAt ? new Date(log.defectiveInfo.markedAt).toLocaleDateString() : ""}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => setShowOutpassModal(false)}
        department="Quality"
        userName={user?.name || user?.username || ""}
      />
    </div>
  );
}
