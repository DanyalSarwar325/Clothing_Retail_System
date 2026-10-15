"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";
import {
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Wallet,
  Users,
  ChevronDown,
  ChevronUp,
  DollarSign,
  Clock,
  Search,
  Check,
  Layers,
  Scissors,
  CheckCheck,
  AlertTriangle,
  ShieldCheck,
  Lock,
  XCircle,
  FileText,
  BadgeAlert,
  Send,
  ArrowUpRight,
} from "lucide-react";

interface PieceData {
  _id: string;
  item: string;
  size: string;
  unitNumber: number;
  rate: number;
  isPaid: boolean;
  scannedAt: string;
  isAdjusted?: boolean;
}

interface ItemBreakdown {
  item: string;
  count: number;
  rate: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  pieceIds: string[];
  unpaidPieceIds: string[];
}

interface DesignData {
  design: string;
  totalPieces: number;
  totalAmount: number;
  paidCount: number;
  paidAmount: number;
  pendingCount: number;
  pendingAmount: number;
  items: ItemBreakdown[];
  pieces: PieceData[];
  unpaidPieceIds?: string[];
}

interface DefectItemDetail {
  _id: string;
  design: string;
  item: string;
  size: string;
  unitNumber: number;
  rate: number;
  reason: string;
  notes?: string;
  decidedAt?: string;
}

interface WorkerData {
  workerName: string;
  totalPieces: number;
  totalPaid: number;
  totalPending: number;
  paidAmount: number;
  pendingAmount: number;
  netPendingAmount: number;
  totalAdjusted: number;
  adjustedAmount: number;
  adjustments: DefectItemDetail[];
  totalCancelled: number;
  cancelledAmount: number;
  cancelled: DefectItemDetail[];
  designs: DesignData[];
}

interface DepartmentData {
  department: string;
  fallbackRate: number;
  workers: WorkerData[];
  totals: {
    totalWorkers: number;
    totalPieces: number;
    totalPaid: number;
    totalPending: number;
    paidAmount: number;
    pendingAmount: number;
    totalAdjusted?: number;
    adjustedAmount?: number;
    totalCancelled?: number;
    cancelledAmount?: number;
    netPendingAmount?: number;
  };
}

interface DefectDecisionDept {
  department: string;
  workerName: string;
  rate: number;
  previouslyPaid: boolean;
  isCutting: boolean;
  isCompanion: boolean;
  decision: "approved" | "cancelled" | "adjusted" | "pending";
}

interface DefectiveItem {
  _id: string;
  design: string;
  size: string;
  item: string;
  unitNumber: number;
  barcodeData: string;
  status: string;
  defectiveInfo?: {
    markedAt: string;
    markedBy: string;
    reason: string;
    notes?: string;
    isCompanionDefect?: boolean;
    companionReason?: string;
  };
  isCompanionDefect: boolean;
  reviewStatus: "pending" | "reviewed";
  reviewedAt?: string;
  reviewedBy?: string;
  adminNotes?: string;
  departments: DefectDecisionDept[];
}

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Overlock",
  "Clipping",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string; light: string; badge: string }> = {
  Cutting: { bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-200", light: "bg-rose-50", badge: "bg-rose-100 text-rose-800" },
  Sewing: { bg: "bg-blue-600", text: "text-blue-600", border: "border-blue-200", light: "bg-blue-50", badge: "bg-blue-100 text-blue-800" },
  Quality: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-200", light: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-800" },
  Overlock: { bg: "bg-violet-600", text: "text-violet-600", border: "border-violet-200", light: "bg-violet-50", badge: "bg-violet-100 text-violet-800" },
  Clipping: { bg: "bg-teal-600", text: "text-teal-600", border: "border-teal-200", light: "bg-teal-50", badge: "bg-teal-100 text-teal-800" },
  Handmade: { bg: "bg-purple-600", text: "text-purple-600", border: "border-purple-200", light: "bg-purple-50", badge: "bg-purple-100 text-purple-800" },
  "Adda Work": { bg: "bg-amber-600", text: "text-amber-600", border: "border-amber-200", light: "bg-amber-50", badge: "bg-amber-100 text-amber-800" },
  Patching: { bg: "bg-cyan-600", text: "text-cyan-600", border: "border-cyan-200", light: "bg-cyan-50", badge: "bg-cyan-100 text-cyan-800" },
  Press: { bg: "bg-orange-600", text: "text-orange-600", border: "border-orange-200", light: "bg-orange-50", badge: "bg-orange-100 text-orange-800" },
  Packing: { bg: "bg-sky-600", text: "text-sky-600", border: "border-sky-200", light: "bg-sky-50", badge: "bg-sky-100 text-sky-800" },
  Store: { bg: "bg-indigo-600", text: "text-indigo-600", border: "border-indigo-200", light: "bg-indigo-50", badge: "bg-indigo-100 text-indigo-800" },
};

const ITEM_BADGES: Record<string, string> = {
  Qameez: "bg-blue-100 text-blue-800 border-blue-200",
  Shalwar: "bg-amber-100 text-amber-800 border-amber-200",
  Dupatta: "bg-purple-100 text-purple-800 border-purple-200",
  "Final Sticker": "bg-emerald-100 text-emerald-800 border-emerald-200",
  Other: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function PaymentsPage() {
  const { user, logout } = useAuth();
  const [active] = useState("payments");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedDepartment, setSelectedDepartment] = useState<string>("Cutting");
  const [departmentData, setDepartmentData] = useState<DepartmentData | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedWorkers, setExpandedWorkers] = useState<Set<string>>(new Set());
  const [expandedPiecesDesigns, setExpandedPiecesDesigns] = useState<Set<string>>(new Set());

  // Quality Sub-tab state
  const [qualitySubTab, setQualitySubTab] = useState<"payments" | "defects">("payments");
  const [defectiveItems, setDefectiveItems] = useState<DefectiveItem[]>([]);
  const [defectCounts, setDefectCounts] = useState<{ total: number; pending: number; reviewed: number }>({
    total: 0,
    pending: 0,
    reviewed: 0,
  });
  const [loadingDefects, setLoadingDefects] = useState(false);
  const [defectFilter, setDefectFilter] = useState<"all" | "pending" | "reviewed">("pending");
  const [decisionChecks, setDecisionChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [adminNotesMap, setAdminNotesMap] = useState<Record<string, string>>({});
  const [savingDefectId, setSavingDefectId] = useState<string | null>(null);

  const colors = DEPT_COLORS[selectedDepartment] || DEPT_COLORS.Cutting;

  // Fetch worker pieces when department changes
  useEffect(() => {
    fetchWorkerPieces();
    if (selectedDepartment === "Quality") {
      fetchDefectiveItems();
    }
  }, [selectedDepartment]);

  const fetchWorkerPieces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment/worker-pieces?department=${encodeURIComponent(selectedDepartment)}`);
      const data = await res.json();
      if (data.success) {
        setDepartmentData(data.data);
        const allWorkers = new Set<string>(data.data.workers.map((w: WorkerData) => w.workerName));
        setExpandedWorkers(allWorkers);
      } else {
        setError(data.message || "Failed to fetch data");
      }
    } catch (err) {
      setError("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  };

  // Fetch defective items for quality decision review
  const fetchDefectiveItems = useCallback(async () => {
    setLoadingDefects(true);
    try {
      const res = await fetch("/api/payment/defect-decisions");
      const data = await res.json();
      if (data.success) {
        setDefectiveItems(data.data.items || []);
        setDefectCounts(data.data.counts || { total: 0, pending: 0, reviewed: 0 });

        // Initialize checkboxes for each defective item
        const initialChecks: Record<string, Record<string, boolean>> = {};
        const initialNotes: Record<string, string> = {};

        (data.data.items || []).forEach((item: DefectiveItem) => {
          initialChecks[item._id] = {};
          initialNotes[item._id] = item.adminNotes || "";

          item.departments.forEach((dept) => {
            // If already decided, use that decision; otherwise Cutting/Companion default to true, others default to true for convenience
            if (dept.decision === "cancelled" || dept.decision === "adjusted") {
              initialChecks[item._id][dept.department] = false;
            } else {
              initialChecks[item._id][dept.department] = true;
            }
          });
        });

        setDecisionChecks(initialChecks);
        setAdminNotesMap(initialNotes);
      }
    } catch (err) {
      console.error("Failed to fetch defective items", err);
    } finally {
      setLoadingDefects(false);
    }
  }, []);



  // Submit Defect Decision for an item
  const handleSaveDefectDecision = async (item: DefectiveItem) => {
    setSavingDefectId(item._id);
    setError(null);

    try {
      const itemChecks = decisionChecks[item._id] || {};
      const decisionsPayload = item.departments.map((dept) => ({
        department: dept.department,
        workerName: dept.workerName,
        approved: dept.isCutting || dept.isCompanion ? true : !!itemChecks[dept.department],
      }));

      const res = await fetch("/api/payment/defect-decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcodeId: item._id,
          decisions: decisionsPayload,
          adminNotes: adminNotesMap[item._id] || "",
          reviewedBy: user?.name || "Admin",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Decision saved for ${item.design} #${item.unitNumber}! Adjustments & cancellations updated.`);
        await fetchDefectiveItems();
        await fetchWorkerPieces();
        setTimeout(() => setSuccess(null), 4000);
      } else {
        setError(data.message || "Failed to save decision");
      }
    } catch (err) {
      setError("Failed to submit decision");
    } finally {
      setSavingDefectId(null);
    }
  };

  const toggleWorkerExpand = (workerName: string) => {
    const newExpanded = new Set(expandedWorkers);
    if (newExpanded.has(workerName)) {
      newExpanded.delete(workerName);
    } else {
      newExpanded.add(workerName);
    }
    setExpandedWorkers(newExpanded);
  };

  const togglePiecesExpand = (designKey: string) => {
    const newExpanded = new Set(expandedPiecesDesigns);
    if (newExpanded.has(designKey)) {
      newExpanded.delete(designKey);
    } else {
      newExpanded.add(designKey);
    }
    setExpandedPiecesDesigns(newExpanded);
  };

  // Filter workers by search query
  const filteredWorkers = departmentData?.workers.filter((worker) =>
    worker.workerName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // Filter defective items by status tab
  const filteredDefectItems = defectiveItems.filter((item) => {
    if (defectFilter === "pending") return item.reviewStatus === "pending";
    if (defectFilter === "reviewed") return item.reviewStatus === "reviewed";
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar user={user} activeItem={active} onLogout={logout} />

      <div className="lg:ml-64 p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">Department Payments</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${colors.badge}`}>
                {selectedDepartment}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">
              Review production piece counts, Paid vs Due statuses, defect adjustments, and cancellations. Payments are issued via the Accounting Dashboard.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/accounting/wages"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all font-medium text-sm shadow-xs"
            >
              <Wallet size={16} />
              <span>Accounting Wages</span>
              <ArrowUpRight size={14} />
            </Link>
            <button
              onClick={() => {
                fetchWorkerPieces();
                if (selectedDepartment === "Quality") fetchDefectiveItems();
              }}
              disabled={loading || loadingDefects}
              className={`inline-flex items-center gap-2 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all font-medium text-sm shadow-xs cursor-pointer`}
            >
              <RefreshCw size={16} className={loading || loadingDefects ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Informational banner: Payments via Accounting Dashboard */}
        <div className="mb-6 p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-900">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
              <Wallet size={16} />
            </div>
            <div>
              <span className="font-bold text-blue-950">Read-Only Production Payment Status: </span>
              <span className="text-blue-800">
                Direct worker payouts from this screen are disabled. All wage vouchers, advance deductions, and cash/bank disbursements are recorded in the Accounting Dashboard.
              </span>
            </div>
          </div>
          <Link
            href="/accounting/wages"
            className="inline-flex items-center gap-1 font-bold text-blue-700 hover:text-blue-900 hover:underline shrink-0 text-xs"
          >
            Open Accounting Wages <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700 text-sm">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700 text-sm">
            <CheckCircle size={18} className="shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Department Tabs */}
        <div className="mb-6 overflow-x-auto pb-1">
          <div className="flex gap-2 min-w-max">
            {DEPARTMENTS.map((dept) => {
              const deptColor = DEPT_COLORS[dept];
              const isSelected = selectedDepartment === dept;
              const isQuality = dept === "Quality";

              return (
                <button
                  key={dept}
                  onClick={() => {
                    setSelectedDepartment(dept);
                    if (isQuality) setQualitySubTab("payments");
                  }}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? `${deptColor.bg} text-white shadow-md`
                      : `bg-white ${deptColor.text} border ${deptColor.border} hover:${deptColor.light}`
                  }`}
                >
                  {dept === "Cutting" && <Scissors size={14} />}
                  <span>{dept}</span>
                  {isQuality && defectCounts.pending > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[11px] font-bold bg-amber-500 text-white">
                      {defectCounts.pending}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Quality Sub-view Switcher (Only visible when Quality department is selected) */}
        {selectedDepartment === "Quality" && (
          <div className="mb-6 bg-white p-1.5 rounded-xl border border-gray-200 shadow-2xs flex max-w-md">
            <button
              onClick={() => setQualitySubTab("payments")}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                qualitySubTab === "payments"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              Quality Staff Payments
            </button>
            <button
              onClick={() => {
                setQualitySubTab("defects");
                fetchDefectiveItems();
              }}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                qualitySubTab === "defects"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <span>Defective Items Review</span>
              {defectCounts.pending > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                    qualitySubTab === "defects" ? "bg-white text-rose-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {defectCounts.pending} Pending
                </span>
              )}
            </button>
          </div>
        )}

        {/* VIEW 1: DEFECTIVE ITEMS REVIEW (Under Quality tab) */}
        {selectedDepartment === "Quality" && qualitySubTab === "defects" ? (
          <div className="space-y-6">
            {/* Filter bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
              <div className="flex items-center gap-2">
                <BadgeAlert className="text-rose-600" size={20} />
                <h2 className="font-bold text-gray-900 text-base">Defective Items & Deduction Decisions</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDefectFilter("pending")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    defectFilter === "pending"
                      ? "bg-amber-500 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Pending Decisions ({defectCounts.pending})
                </button>
                <button
                  onClick={() => setDefectFilter("reviewed")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    defectFilter === "reviewed"
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  Reviewed & Settled ({defectCounts.reviewed})
                </button>
                <button
                  onClick={() => setDefectFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                    defectFilter === "all"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  All ({defectCounts.total})
                </button>
              </div>
            </div>

            {loadingDefects ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white rounded-xl p-6 border shadow-2xs animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredDefectItems.length === 0 ? (
              <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
                <CheckCircle size={48} className="mx-auto mb-3 text-emerald-400" />
                <h3 className="text-lg font-bold text-gray-800">No defective items found</h3>
                <p className="text-gray-400 text-sm mt-1">
                  {defectFilter === "pending"
                    ? "Great job! All defective items have been reviewed."
                    : "No defective items match the selected filter."}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredDefectItems.map((item) => {
                  const isReviewed = item.reviewStatus === "reviewed";
                  const isCompanion = item.isCompanionDefect;
                  const itemChecks = decisionChecks[item._id] || {};

                  return (
                    <div
                      key={item._id}
                      className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden"
                    >
                      {/* Card Header */}
                      <div className="p-4 bg-gray-50 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                              isCompanion ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            #{item.unitNumber}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-gray-900 text-base">{item.design}</h3>
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold border ${
                                  ITEM_BADGES[item.item] || ITEM_BADGES.Other
                                }`}
                              >
                                {item.item} ({item.size})
                              </span>
                              {isCompanion && (
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <ShieldCheck size={12} />
                                  Suit Companion Scrap
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Marked on {new Date(item.defectiveInfo?.markedAt || "").toLocaleDateString()} by{" "}
                              <strong className="text-gray-700">{item.defectiveInfo?.markedBy || "Quality Staff"}</strong>
                            </p>
                          </div>
                        </div>

                        <div>
                          {isReviewed ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold">
                              <CheckCircle size={14} />
                              Reviewed & Settled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-bold animate-pulse">
                              <AlertTriangle size={14} />
                              Pending Admin Decision
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Defect Notes Box */}
                      <div className="p-4 bg-amber-50/50 border-b border-amber-200/60">
                        <div className="flex items-start gap-2.5">
                          <FileText size={16} className="text-amber-700 mt-0.5 shrink-0" />
                          <div className="text-xs">
                            <span className="font-bold text-amber-900">
                              Defect Reason: {item.defectiveInfo?.reason || "Quality Issue"}
                            </span>
                            <div className="mt-1 text-gray-800 italic bg-white p-2.5 rounded-lg border border-amber-200">
                              "{item.defectiveInfo?.notes || "No remarks provided by inspector."}"
                            </div>
                            {isCompanion && (
                              <p className="text-blue-800 text-[11px] font-medium mt-1.5">
                                ℹ️ Note: This piece was physically OK. It was scrapped as a companion to complete a broken suit set. All previous department workers receive full payment without deduction.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Scanned Departments Decision Checklist */}
                      <div className="p-4 sm:p-6">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
                          Departments Scanned Before Quality — Payment Approvals & Deductions
                        </h4>

                        <div className="space-y-3">
                          {item.departments.map((dept) => {
                            const isCutting = dept.isCutting;
                            const isChecked = isCutting || isCompanion ? true : !!itemChecks[dept.department];

                            return (
                              <div
                                key={dept.department}
                                className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                                  isChecked
                                    ? "bg-white border-gray-200 shadow-2xs"
                                    : "bg-red-50/60 border-red-200"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {isCutting ? (
                                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                      <Lock size={15} />
                                    </div>
                                  ) : isCompanion ? (
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                      <ShieldCheck size={16} />
                                    </div>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      id={`${item._id}_${dept.department}`}
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const newChecks = { ...decisionChecks };
                                        if (!newChecks[item._id]) newChecks[item._id] = {};
                                        newChecks[item._id][dept.department] = e.target.checked;
                                        setDecisionChecks(newChecks);
                                      }}
                                      className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                  )}

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-gray-900 text-sm">{dept.department}</span>
                                      <span className="text-gray-500 text-xs">— {dept.workerName}</span>
                                      <span className="font-semibold text-gray-900 text-xs bg-gray-100 px-2 py-0.5 rounded">
                                        Rate: ₨{dept.rate}
                                      </span>
                                    </div>

                                    {/* Status details & dynamic explanation */}
                                    <div className="text-xs mt-1">
                                      {isCutting ? (
                                        <span className="text-emerald-700 font-semibold">
                                          ✓ Cutting Master (Protected: Received in good condition — Always Paid)
                                        </span>
                                      ) : isCompanion ? (
                                        <span className="text-blue-700 font-semibold">
                                          ✓ Companion Piece (Physically OK — Always Paid)
                                        </span>
                                      ) : isChecked ? (
                                        <span className="text-emerald-600 font-medium">
                                          ✓ Approved for payment (₨{dept.rate})
                                        </span>
                                      ) : dept.previouslyPaid ? (
                                        <span className="text-red-700 font-bold flex items-center gap-1">
                                          <AlertTriangle size={12} />
                                          ⚠️ Was already paid: Will make future adjustment of -₨{dept.rate} on {dept.workerName}'s next payout
                                        </span>
                                      ) : (
                                        <span className="text-gray-600 font-medium flex items-center gap-1">
                                          <XCircle size={12} className="text-gray-400" />
                                          Payment will be cancelled (no payment will be made)
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Paid status tag */}
                                <div className="text-xs">
                                  {dept.previouslyPaid ? (
                                    <span className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded font-semibold text-[11px]">
                                      Paid Previously
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded font-medium text-[11px]">
                                      Unpaid (Pending)
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Admin Notes & Submit */}
                        {!isCompanion && (
                          <div className="mt-5 pt-4 border-t flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Admin decision notes / explanation (optional)..."
                                value={adminNotesMap[item._id] || ""}
                                onChange={(e) => {
                                  setAdminNotesMap({
                                    ...adminNotesMap,
                                    [item._id]: e.target.value,
                                  });
                                }}
                                className="w-full px-3 py-2 text-xs border rounded-lg bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                              />
                            </div>

                            <button
                              onClick={() => handleSaveDefectDecision(item)}
                              disabled={savingDefectId === item._id}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {savingDefectId === item._id ? (
                                <>
                                  <RefreshCw size={13} className="animate-spin" />
                                  Saving...
                                </>
                              ) : (
                                <>
                                  <Send size={13} />
                                  Submit Decision & Apply Adjustments
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* VIEW 2: STANDARD WORKER PAYMENTS TABLE (With Cancelled & Adjusted Badges for Each Department) */
          <>
            {/* Summary Cards */}
            {departmentData && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-lg ${colors.light}`}>
                      <Users size={20} className={colors.text} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {departmentData.totals.totalWorkers}
                      </p>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        {selectedDepartment === "Cutting" ? "Cutting Master" : "Workers"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-50">
                      <Wallet size={20} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">
                        {(departmentData.totals.totalPieces ?? 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        Total Pieces
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-emerald-50">
                      <DollarSign size={20} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-emerald-600">
                        ₨{(departmentData.totals.paidAmount ?? 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        Total Paid ({(departmentData.totals.totalPaid ?? 0).toLocaleString()} pcs)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-xs border border-gray-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-amber-50">
                      <Clock size={20} className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-amber-600">
                        ₨{(departmentData.totals.netPendingAmount ?? departmentData.totals.pendingAmount ?? 0).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                        Net Payable ({(departmentData.totals.totalPending ?? 0).toLocaleString()} pcs)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search */}
            <div className="mb-6">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder={`Search in ${selectedDepartment}...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Workers List */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-xl p-6 shadow-xs border animate-pulse">
                    <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="h-4 bg-gray-100 rounded w-1/2"></div>
                  </div>
                ))}
              </div>
            ) : filteredWorkers.length === 0 ? (
              <div className="bg-white rounded-xl p-12 shadow-xs border text-center">
                <Users size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-700">No records found</h3>
                <p className="text-gray-400 text-sm mt-1">
                  No pieces recorded for {selectedDepartment} department yet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredWorkers.map((worker) => (
                  <div key={worker.workerName} className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
                    {/* Worker Header Card */}
                    <div
                      className={`p-4 ${colors.light} cursor-pointer flex items-center justify-between border-b border-gray-200 hover:opacity-95 transition-all`}
                      onClick={() => toggleWorkerExpand(worker.workerName)}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl ${colors.bg} flex items-center justify-center text-white font-bold text-lg shadow-xs`}
                        >
                          {worker.workerName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-bold text-gray-900">{worker.workerName}</h3>
                            <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${colors.badge}`}>
                              {selectedDepartment}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mt-1">
                            <span className="text-gray-600 font-medium">
                              Total: <strong className="text-gray-900">{(worker.totalPieces ?? 0).toLocaleString()}</strong> pieces
                            </span>
                            <span className="text-emerald-700 font-medium">
                              Paid: ₨{(worker.paidAmount ?? 0).toLocaleString()} ({worker.totalPaid ?? 0})
                            </span>
                            <span className="text-amber-700 font-bold">
                              Gross Due: ₨{(worker.pendingAmount ?? 0).toLocaleString()} ({worker.totalPending ?? 0})
                            </span>

                            {/* Adjustment Badge on Worker Header */}
                            {(worker.adjustedAmount ?? 0) > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                Adjustments / Deductions: -₨{(worker.adjustedAmount ?? 0).toLocaleString()}
                              </span>
                            )}

                            {/* Cancelled Badge on Worker Header */}
                            {(worker.cancelledAmount ?? 0) > 0 && (
                              <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
                                Cancelled: {worker.totalCancelled ?? 0} pcs (-₨{(worker.cancelledAmount ?? 0).toLocaleString()})
                              </span>
                            )}

                            {/* Net Payable */}
                            {(worker.adjustedAmount ?? 0) > 0 && (
                              <span className="text-emerald-700 font-extrabold text-sm underline">
                                Net Payable: ₨{(worker.netPendingAmount ?? 0).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {expandedWorkers.has(worker.workerName) ? (
                          <ChevronUp size={22} className="text-gray-500" />
                        ) : (
                          <ChevronDown size={22} className="text-gray-500" />
                        )}
                      </div>
                    </div>

                    {/* Worker Details - Designs List */}
                    {expandedWorkers.has(worker.workerName) && (
                      <div className="p-4 sm:p-6 space-y-6">
                        {/* 1. Future Adjustments / Deductions Banner (if any) */}
                        {worker.adjustments && worker.adjustments.length > 0 && (
                          <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle size={16} className="text-rose-700" />
                              <h5 className="font-bold text-rose-900 text-xs uppercase tracking-wider">
                                Future Payment Adjustments / Deductions (-₨{(worker.adjustedAmount ?? 0).toLocaleString()})
                              </h5>
                            </div>
                            <p className="text-xs text-rose-700 mb-3">
                              The following items were previously paid, but subsequently marked defective and deducted by Admin. This amount is subtracted from future payouts:
                            </p>
                            <div className="space-y-2">
                              {worker.adjustments.map((adj, i) => (
                                <div
                                  key={i}
                                  className="p-2.5 bg-white rounded-lg border border-rose-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                >
                                  <div>
                                    <strong className="text-gray-900">{adj.design}</strong> — {adj.item} ({adj.size}) Unit #{adj.unitNumber}
                                    <span className="text-gray-500 ml-2">Reason: {adj.reason}</span>
                                    {adj.notes && <span className="text-gray-400 italic ml-1">("{adj.notes}")</span>}
                                  </div>
                                  <div className="font-bold text-rose-700 whitespace-nowrap">
                                    Deduction: -₨{adj.rate}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 2. Cancelled Pieces Banner (if any) */}
                        {worker.cancelled && worker.cancelled.length > 0 && (
                          <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl">
                            <div className="flex items-center gap-2 mb-2">
                              <XCircle size={16} className="text-gray-600" />
                              <h5 className="font-bold text-gray-700 text-xs uppercase tracking-wider">
                                Cancelled Defective Pieces ({worker.totalCancelled ?? 0} pcs — ₨{(worker.cancelledAmount ?? 0).toLocaleString()})
                              </h5>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                              These pieces were marked defective before payment was made. Payment for these items was cancelled by Admin decision:
                            </p>
                            <div className="space-y-2">
                              {worker.cancelled.map((can, i) => (
                                <div
                                  key={i}
                                  className="p-2.5 bg-white rounded-lg border border-gray-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-gray-600"
                                >
                                  <div>
                                    <strong className="text-gray-900">{can.design}</strong> — {can.item} ({can.size}) Unit #{can.unitNumber}
                                    <span className="text-gray-500 ml-2">Reason: {can.reason}</span>
                                    {can.notes && <span className="text-gray-400 italic ml-1">("{can.notes}")</span>}
                                  </div>
                                  <div className="font-semibold text-gray-500 whitespace-nowrap">
                                    Cancelled: ₨{can.rate} (Unpaid)
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 3. Designs and Item Breakdown Tables */}
                        {(worker.designs || []).map((design) => {
                          const designKey = `${worker.workerName}_${design.design}`;
                          const isPiecesExpanded = expandedPiecesDesigns.has(designKey);

                          return (
                            <div
                              key={design.design}
                              className="border border-gray-200 rounded-xl bg-white shadow-xs overflow-hidden"
                            >
                              {/* Design Header Bar */}
                              <div className="p-4 bg-gray-50/80 border-b flex flex-col md:flex-row md:items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
                                    <Layers size={16} />
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-gray-900 text-base">{design.design}</h4>
                                    <p className="text-xs text-gray-500">
                                      Total: {design.totalPieces ?? 0} pieces | Total Amount: ₨{(design.totalAmount ?? 0).toLocaleString()}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold rounded-md flex items-center gap-1">
                                    <Check size={13} />
                                    Paid: ₨{(design.paidAmount ?? 0).toLocaleString()} ({design.paidCount ?? 0})
                                  </span>
                                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-md flex items-center gap-1">
                                    <Clock size={13} />
                                    Due: ₨{(design.pendingAmount ?? 0).toLocaleString()} ({design.pendingCount ?? 0})
                                  </span>
                                </div>
                              </div>

                              {/* Item Breakdown Table (Qameez, Shalwar, Dupatta) */}
                              <div className="p-4">
                                <h5 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                                  Pieces Breakdown & Rate Multiplication
                                </h5>

                                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="bg-gray-100/70 border-b text-xs font-semibold text-gray-600">
                                        <th className="py-2.5 px-4 text-left">Item Type</th>
                                        <th className="py-2.5 px-3 text-center">Pieces Scanned</th>
                                        <th className="py-2.5 px-3 text-right">Rate / Piece</th>
                                        <th className="py-2.5 px-4 text-center">Multiplication Formula</th>
                                        <th className="py-2.5 px-3 text-right">Total Amount</th>
                                        <th className="py-2.5 px-3 text-right">Paid</th>
                                        <th className="py-2.5 px-3 text-right">Remaining Due</th>
                                        <th className="py-2.5 px-4 text-center">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                      {(design.items || (design as any).itemsBreakdown || []).map((item) => {
                                        const badgeClass = ITEM_BADGES[item.item] || ITEM_BADGES.Other;

                                        return (
                                          <tr key={item.item} className="hover:bg-gray-50/50">
                                            <td className="py-3 px-4 font-semibold text-gray-900">
                                              <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-medium border ${badgeClass}`}>
                                                {item.item}
                                              </span>
                                            </td>
                                            <td className="py-3 px-3 text-center font-bold text-gray-800">
                                              {item.count}
                                            </td>
                                            <td className="py-3 px-3 text-right font-medium text-gray-600">
                                              ₨{item.rate}
                                            </td>
                                            <td className="py-3 px-4 text-center font-mono text-xs text-gray-600 bg-gray-50/50">
                                              {item.count} pcs × ₨{item.rate} = <strong className="text-gray-900">₨{(item.totalAmount ?? 0).toLocaleString()}</strong>
                                            </td>
                                            <td className="py-3 px-3 text-right font-semibold text-gray-900">
                                              ₨{(item.totalAmount ?? 0).toLocaleString()}
                                            </td>
                                            <td className="py-3 px-3 text-right font-medium text-emerald-600">
                                              ₨{(item.paidAmount ?? 0).toLocaleString()} <span className="text-xs text-gray-400">({item.paidCount ?? 0})</span>
                                            </td>
                                            <td className="py-3 px-3 text-right font-bold text-amber-600">
                                              ₨{(item.pendingAmount ?? 0).toLocaleString()} <span className="text-xs text-gray-400 font-normal">({item.pendingCount ?? 0})</span>
                                            </td>
                                            <td className="py-3 px-4 text-center">
                                              {(item.pendingCount ?? 0) === 0 ? (
                                                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-md">
                                                  <Check size={12} />
                                                  Paid
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-xs text-amber-700 font-bold px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-md">
                                                  <Clock size={12} />
                                                  Due ({item.pendingCount ?? 0})
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        );
                                      })}

                                      {/* Total Row */}
                                      <tr className="bg-gray-100/80 font-bold border-t-2 border-gray-300">
                                        <td className="py-3 px-4 text-gray-900">Total</td>
                                        <td className="py-3 px-3 text-center text-gray-900">
                                          {design.totalPieces ?? 0}
                                        </td>
                                        <td className="py-3 px-3 text-right text-gray-400">—</td>
                                        <td className="py-3 px-4 text-center text-xs text-gray-500">
                                          Sum of items above
                                        </td>
                                        <td className="py-3 px-3 text-right text-gray-900">
                                          ₨{(design.totalAmount ?? 0).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right text-emerald-700">
                                          ₨{(design.paidAmount ?? 0).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right text-amber-700">
                                          ₨{(design.pendingAmount ?? 0).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-4 text-center text-xs">
                                          {(design.pendingCount ?? 0) === 0 ? (
                                            <span className="text-emerald-700 font-semibold">All Paid</span>
                                          ) : (
                                            <span className="text-amber-700 font-bold">Due</span>
                                          )}
                                        </td>
                                      </tr>
                                    </tbody>
                                  </table>
                                </div>

                                {/* Collapsible Individual Piece List */}
                                <div className="mt-4 pt-3 border-t">
                                  <button
                                    onClick={() => togglePiecesExpand(designKey)}
                                    className="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1.5 cursor-pointer"
                                  >
                                    {isPiecesExpanded ? (
                                      <>
                                        <ChevronUp size={14} />
                                        Hide individual piece list ({design.pieces.length} pieces)
                                      </>
                                    ) : (
                                      <>
                                        <ChevronDown size={14} />
                                        View individual piece details ({design.pieces.length} pieces)
                                      </>
                                    )}
                                  </button>

                                  {isPiecesExpanded && (
                                    <div className="mt-3 overflow-x-auto border border-gray-200 rounded-lg">
                                      <table className="w-full text-xs">
                                        <thead>
                                          <tr className="bg-gray-50 border-b font-medium text-gray-500">
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-left">Size</th>
                                            <th className="px-3 py-2 text-left">Unit #</th>
                                            <th className="px-3 py-2 text-right">Rate</th>
                                            <th className="px-3 py-2 text-center">Status</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {(design.pieces || []).map((piece) => (
                                            <tr key={piece._id} className="hover:bg-gray-50/50">
                                              <td className="px-3 py-2 font-medium text-gray-900">{piece.item}</td>
                                              <td className="px-3 py-2 text-gray-600">{piece.size}</td>
                                              <td className="px-3 py-2 text-gray-600">#{piece.unitNumber}</td>
                                              <td className="px-3 py-2 text-right font-semibold text-gray-900">₨{piece.rate}</td>
                                              <td className="px-3 py-2 text-center">
                                                {piece.isPaid ? (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-semibold">
                                                    <Check size={10} />
                                                    Paid
                                                  </span>
                                                ) : (
                                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-bold">
                                                    <Clock size={10} />
                                                    Due
                                                  </span>
                                                )}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
