"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import {
  LogOut,
  Scan,
  CheckCircle,
  AlertCircle,
  History,
  User,
  Clock,
  ShieldCheck,
  AlertTriangle,
  FileOutput,
  X,
  Layers,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import toast from "react-hot-toast";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import QualityCheckModal from "@/app/components/QualityCheckModal";
import OutpassModal from "@/app/components/OutpassModal";
import { playScanSuccessSound, playScanErrorSound } from "@/app/libs/audio";

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface BarcodeDetails {
  id: string;
  design: string;
  size: string;
  suitType?: string;
  barcodeData?: string;
  item: string;
  unitNumber: number;
  status: string;
  currentDepartment: string;
  departmentHistory: DepartmentScan[];
  createdAt: string;
  scannedAt?: string;
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
  qualityCheckInfo?: {
    checkedAt: string;
    checkedBy: string;
    status: string;
    department?: string;
    responsiblePerson?: string;
    notes?: string;
  };
  createdAt: string;
}

interface InspectedItem {
  id: string;
  design: string;
  item: string;
  size: string;
  suitType?: string;
  unitNumber: number;
  status: "quality_ok" | "defective" | "damaged";
  time: string;
  inspector: string;
  reason?: string;
  notes?: string;
  departmentHistory?: DepartmentScan[];
}

export default function QualityPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"scan" | "defective_log">("scan");
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [barcodeDetails, setBarcodeDetails] = useState<BarcodeDetails | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [showQualityCheckModal, setShowQualityCheckModal] = useState(false);
  const [showOutpassModal, setShowOutpassModal] = useState(false);
  const [scannerInput, setScannerInput] = useState("");
  const scannerInputRef = useRef<HTMLInputElement>(null);

  // Inspected items feed states
  const [lastInspected, setLastInspected] = useState<InspectedItem | null>(null);
  const [recentInspections, setRecentInspections] = useState<InspectedItem[]>([]);
  const [showLastHistory, setShowLastHistory] = useState(false);

  // Defective log states
  const [defectiveLogs, setDefectiveLogs] = useState<DefectiveLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logSearch, setLogSearch] = useState("");
  const [logFilter, setLogFilter] = useState<"all" | "primary" | "companion">("all");

  useEffect(() => {
    if (scanning && scannerInputRef.current) {
      scannerInputRef.current.focus();
    }
  }, [scanning]);

  // Load defective logs on mount and when tab switched
  useEffect(() => {
    fetchDefectiveLogs();
  }, []);

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

  const processScan = async (barcodeData: string) => {
    setLoading(true);
    setError("");
    setSuccess("");
    setBarcodeDetails(null);

    try {
      // Find barcode data and open inspection modal
      const response = await fetch(`/api/barcodes/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodeData: barcodeData.trim() }),
      });

      const result = await response.json();

      if (result.success && result.barcode) {
        playScanSuccessSound();
        setBarcodeDetails(result.barcode);
        setShowQualityCheckModal(true);
      } else {
        playScanErrorSound();
        setError(result.message || "Barcode not found in database");
        setScanning(true);
      }
    } catch (err: any) {
      playScanErrorSound();
      setError(err.message || "Failed to process barcode");
      setScanning(true);
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
    setShowQualityCheckModal(false);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
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

  // Filter defective logs
  const filteredLogs = defectiveLogs.filter((log) => {
    const matchesSearch =
      log.design.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.item.toLowerCase().includes(logSearch.toLowerCase()) ||
      (log.defectiveInfo?.reason && log.defectiveInfo.reason.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.defectiveInfo?.notes && log.defectiveInfo.notes.toLowerCase().includes(logSearch.toLowerCase())) ||
      (log.qualityCheckInfo?.notes && log.qualityCheckInfo.notes.toLowerCase().includes(logSearch.toLowerCase()));

    if (!matchesSearch) return false;

    const isCompanion = !!log.defectiveInfo?.isCompanionDefect;
    if (logFilter === "primary") return !isCompanion;
    if (logFilter === "companion") return isCompanion;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm">
            <ShieldCheck className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Quality Control Department</h1>
            <p className="text-xs text-gray-500">Inspector: {user?.name || user?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-gray-500 font-medium">Verified Today</p>
            <p className="text-2xl font-bold text-emerald-600 leading-tight">{scanCount}</p>
          </div>
          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg transition font-medium text-sm"
          >
            <FileOutput size={16} />
            Outpass
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3.5 py-2 text-red-600 hover:bg-red-50 rounded-lg transition font-medium text-sm"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto p-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-4 pt-3">
          <button
            onClick={() => setActiveTab("scan")}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "scan"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            <Scan size={18} />
            Quality Inspection Scanner
          </button>
          <button
            onClick={() => {
              setActiveTab("defective_log");
              fetchDefectiveLogs();
            }}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === "defective_log"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
          >
            <Layers size={18} />
            Defective & Scrapped Suits Log ({defectiveLogs.length})
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: SCANNER & INSPECTION                                              */}
        {/* ========================================================================= */}
        {activeTab === "scan" && (
          <div className="space-y-6">
            {/* Info Notice */}
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="text-emerald-600 mt-0.5 flex-shrink-0" size={20} />
                <div>
                  <p className="font-semibold text-emerald-900 text-sm">Quality Inspection Active</p>
                  <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
                    Scan items to inspect quality. Items that pass can be marked <strong>Quality OK</strong> to advance.
                    If an item is marked <strong>Defective</strong>, you must enter mandatory defect remarks, and you will be guided to scan the matching companion pieces (same size) to retire the broken suit set.
                  </p>
                </div>
              </div>
            </div>

            {/* Summaries & Rates */}
            <div className="space-y-4">
              <DepartmentPaymentSummary department="Quality" refreshKey={scanCount} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PaymentDisplay userName={user?.name || user?.username || ""} department="Quality" scanCount={scanCount} />
                <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Quality" scanCount={scanCount} />
              </div>
            </div>

            {/* Scanner Trigger Card */}
            {!scanning && !barcodeDetails && !loading && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200/80 p-8 text-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                  <Scan size={38} />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">Ready for Quality Inspection</h2>
                <p className="text-sm text-gray-600 max-w-md mx-auto mb-6">
                  Click the button below or start barcode scanning directly. You can re-scan pieces freely without duplicate restrictions.
                </p>
                <button
                  onClick={startScanning}
                  className="w-full max-w-sm mx-auto bg-emerald-600 text-white py-3.5 px-6 rounded-xl font-bold hover:bg-emerald-700 transition shadow-md flex items-center justify-center gap-2"
                >
                  <ShieldCheck size={20} />
                  Start Scanning Products
                </button>
              </div>
            )}

            {/* Active Scanner Input Screen */}
            {scanning && (
              <div className="bg-white rounded-2xl shadow-md border-2 border-emerald-500 p-6 relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Barcode Scanner Listening...</span>
                  </div>
                  <button
                    onClick={resetScanner}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex flex-col items-center py-4">
                  <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-3">
                    <Scan className="text-emerald-600 animate-pulse" size={32} />
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Scan any product sticker barcode with your physical scanner
                  </p>
                  <p className="text-xs text-gray-400 mb-4">
                    Or type barcode manually and press <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">Enter</kbd>
                  </p>

                  <input
                    ref={scannerInputRef}
                    type="text"
                    value={scannerInput}
                    onChange={(e) => setScannerInput(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === "Enter" && scannerInput.trim()) {
                        e.preventDefault();
                        const val = scannerInput.trim();
                        setScannerInput("");
                        setScanning(false);
                        await processScan(val);
                      }
                    }}
                    placeholder="Scanner active — point scanner at barcode..."
                    className="w-full max-w-md px-4 py-3 border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-4 focus:ring-emerald-500/20 text-center font-mono text-sm shadow-sm"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {loading && (
              <div className="bg-white rounded-xl shadow-sm p-8 text-center border">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-600 border-t-transparent mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-600">Retrieving barcode info...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                <p className="text-sm text-green-700 font-medium">{success}</p>
              </div>
            )}

            {/* Last Inspected Item Card */}
            {lastInspected && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-fadeIn">
                <div className={`p-5 text-white ${
                  lastInspected.status === "quality_ok"
                    ? "bg-gradient-to-r from-emerald-600 to-teal-700"
                    : "bg-gradient-to-r from-red-600 to-rose-700"
                }`}>
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-white/20 uppercase tracking-wide">
                          Last Inspected Piece
                        </span>
                        <span className="text-xs text-white/80 font-mono">
                          Unit #{lastInspected.unitNumber}
                        </span>
                      </div>
                      <h3 className="text-2xl font-bold tracking-tight">{lastInspected.design}</h3>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center gap-1.5 font-bold px-3 py-1 rounded-full text-xs shadow-sm ${
                        lastInspected.status === "quality_ok"
                          ? "bg-white text-emerald-800"
                          : "bg-white text-red-800"
                      }`}>
                        {lastInspected.status === "quality_ok" ? (
                          <>
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            <span>Quality OK ✓</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={13} className="text-red-600" />
                            <span>Defective</span>
                          </>
                        )}
                      </span>
                      <p className="text-xs text-white/80 mt-1 font-mono">
                        {lastInspected.time}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium">Item</p>
                      <p className="text-sm font-bold text-gray-900 truncate mt-0.5">{lastInspected.item}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium">Size</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{getSizeLabel(lastInspected.size)}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium">Suit Type</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{lastInspected.suitType || "3pc"}</p>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 font-medium">Inspector</p>
                      <p className="text-sm font-bold text-gray-900 truncate mt-0.5">{lastInspected.inspector}</p>
                    </div>
                  </div>

                  {/* Defect Details if Defective */}
                  {lastInspected.status !== "quality_ok" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 text-xs text-red-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-red-800">
                        <AlertTriangle size={14} className="text-red-600" />
                        Defect Reason: {lastInspected.reason || "Quality Issue"}
                      </p>
                      {lastInspected.notes && (
                        <p className="text-red-700 italic bg-white/70 p-2 rounded border border-red-100">
                          "{lastInspected.notes}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Department History Timeline */}
                  {lastInspected.departmentHistory && lastInspected.departmentHistory.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={() => setShowLastHistory(!showLastHistory)}
                        className="flex items-center justify-between w-full py-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
                      >
                        <span className="flex items-center gap-1.5">
                          <History size={14} />
                          Department Scan History ({lastInspected.departmentHistory.length} events)
                        </span>
                        {showLastHistory ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {showLastHistory && (
                        <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                          {lastInspected.departmentHistory.map((scan, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${scan.department === "Quality" ? "bg-emerald-500" : "bg-gray-400"}`} />
                                <div>
                                  <p className="font-semibold text-gray-800">{scan.department}</p>
                                  <p className="text-[11px] text-gray-500">{scan.scannedBy ? `by ${scan.scannedBy}` : "System"}</p>
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

            {/* Recent Quality Inspections Activity Stream */}
            {recentInspections.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Layers size={18} className="text-emerald-600" />
                    <h3 className="font-bold text-gray-900 text-sm">
                      Recent Quality Inspections (Today's Stream)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
                      {recentInspections.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecentInspections([])}
                    className="text-xs text-gray-400 hover:text-gray-600 font-medium transition"
                  >
                    Clear Feed
                  </button>
                </div>

                <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                  {recentInspections.map((item) => (
                    <div
                      key={item.id}
                      className={`px-6 py-3 flex items-center justify-between transition ${
                        item.status === "quality_ok" ? "hover:bg-gray-50/80" : "bg-red-50/30 hover:bg-red-50/50"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {item.status === "quality_ok" ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <CheckCircle2 size={18} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                            <AlertTriangle size={18} />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {item.design} — {item.item} ({item.size})
                            </p>
                            <span className="px-1.5 py-0.5 text-[11px] font-mono bg-gray-100 text-gray-700 rounded">
                              #{item.unitNumber}
                            </span>
                          </div>
                          <p className={`text-xs truncate ${
                            item.status === "quality_ok" ? "text-gray-500" : "text-red-600 font-medium"
                          }`}>
                            {item.status === "quality_ok"
                              ? "Quality Approved ✓"
                              : `Defective: ${item.reason || "Quality Issue"}${item.notes ? ` — "${item.notes}"` : ""}`}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-4">
                        <span className="text-xs font-mono text-gray-400">{item.time}</span>
                        <div className="text-[11px]">
                          <span className={`font-semibold ${
                            item.status === "quality_ok" ? "text-emerald-700" : "text-red-600"
                          }`}>
                            {item.status === "quality_ok" ? "Quality OK" : "Defective"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: DEFECTIVE & BROKEN SUITS LOG                                      */}
        {/* ========================================================================= */}
        {activeTab === "defective_log" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header & Controls */}
            <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row gap-3 items-center justify-between bg-gray-50/50">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900 text-base">Defective & Scrapped Items</h3>
                <span className="text-xs bg-gray-200 text-gray-700 font-bold px-2 py-0.5 rounded-full">
                  {filteredLogs.length}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                {/* Search */}
                <div className="relative flex-1 md:w-60">
                  <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search design, remarks..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>

                {/* Filter */}
                <select
                  value={logFilter}
                  onChange={(e: any) => setLogFilter(e.target.value)}
                  className="text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="all">All Defects</option>
                  <option value="primary">Primary Defects</option>
                  <option value="companion">Companion Scraps</option>
                </select>

                {/* Refresh */}
                <button
                  onClick={fetchDefectiveLogs}
                  disabled={logsLoading}
                  className="p-1.5 border rounded-lg hover:bg-gray-100 text-gray-600 transition"
                  title="Refresh defective logs"
                >
                  <RefreshCw size={14} className={logsLoading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {/* Table */}
            {logsLoading ? (
              <div className="p-12 text-center text-sm text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-600 border-t-transparent mx-auto mb-2" />
                Loading defective logs...
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-12 text-center text-sm text-gray-400">
                No defective items recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider font-semibold border-b">
                    <tr>
                      <th className="py-3 px-4">Design & Piece</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Defect Reason</th>
                      <th className="py-3 px-4">Remarks (Quality Notes)</th>
                      <th className="py-3 px-4">Inspector & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredLogs.map((log) => {
                      const isCompanion = !!log.defectiveInfo?.isCompanionDefect;
                      const inspector = log.defectiveInfo?.markedBy || log.qualityCheckInfo?.checkedBy || "Unknown";
                      const defectReasonText = log.defectiveInfo?.reason || "Quality Issue";
                      const remarksText = log.defectiveInfo?.notes || log.qualityCheckInfo?.notes || "—";
                      const markedTime = log.defectiveInfo?.markedAt || log.qualityCheckInfo?.checkedAt || log.createdAt;

                      return (
                        <tr key={log.id} className="hover:bg-gray-50/70 transition">
                          <td className="py-3 px-4">
                            <p className="font-bold text-gray-900">{log.design}</p>
                            <p className="text-gray-500 text-[11px]">
                              {log.item} • Size {getSizeLabel(log.size)} • Unit #{log.unitNumber}
                            </p>
                          </td>
                          <td className="py-3 px-4">
                            {isCompanion ? (
                              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] bg-purple-50 text-purple-700 border border-purple-200">
                                Companion Scrap
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-full text-[11px] bg-red-50 text-red-700 border border-red-200">
                                Primary Defect
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-800">{defectReasonText}</span>
                            {log.defectiveInfo?.companionReason && (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {log.defectiveInfo.companionReason}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-xs">
                            <p className="text-gray-800 italic bg-gray-50 p-1.5 rounded border border-gray-100 text-[11px] leading-relaxed">
                              "{remarksText}"
                            </p>
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            <p className="font-medium text-gray-900">{inspector}</p>
                            <p className="text-[10px] text-gray-400">{formatDate(markedTime)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Quality Check Modal */}
        {barcodeDetails && (
          <QualityCheckModal
            isOpen={showQualityCheckModal}
            onClose={() => {
              setShowQualityCheckModal(false);
              setBarcodeDetails(null);
            }}
            barcodeId={barcodeDetails.id}
            barcodeInfo={{
              design: barcodeDetails.design,
              item: barcodeDetails.item,
              size: barcodeDetails.size,
              suitType: barcodeDetails.suitType || "3pc",
              unitNumber: barcodeDetails.unitNumber,
              barcodeData: barcodeDetails.barcodeData,
            }}
            checkedBy={user?.name || user?.username || "Quality Inspector"}
            departmentHistory={barcodeDetails.departmentHistory}
            onSuccess={(resultStatus?: "quality_ok" | "defective", defectReason?: string, defectNotes?: string) => {
              playScanSuccessSound();
              setScanCount((prev) => prev + 1);
              fetchDefectiveLogs();

              const finalStatus = resultStatus || "quality_ok";
              const timestamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

              const inspected: InspectedItem = {
                id: `${barcodeDetails.id}-${Date.now()}`,
                design: barcodeDetails.design,
                item: barcodeDetails.item,
                size: barcodeDetails.size,
                suitType: barcodeDetails.suitType || "3pc",
                unitNumber: barcodeDetails.unitNumber,
                status: finalStatus,
                time: timestamp,
                inspector: user?.name || user?.username || "Quality Inspector",
                reason: defectReason,
                notes: defectNotes,
                departmentHistory: barcodeDetails.departmentHistory,
              };

              setLastInspected(inspected);
              setRecentInspections((prev) => [inspected, ...prev.slice(0, 19)]);

              setShowQualityCheckModal(false);
              setBarcodeDetails(null);
              // Automatically re-arm scanner so the inspector can scan the next piece immediately
              setScanning(true);
            }}
          />
        )}

        {/* Outpass Modal */}
        <OutpassModal
          isOpen={showOutpassModal}
          onClose={() => setShowOutpassModal(false)}
          department="Quality"
          userName={user?.name || user?.username || ""}
        />
      </div>
    </div>
  );
}
