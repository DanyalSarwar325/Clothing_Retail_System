"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

interface PieceData {
  _id: string;
  item: string;
  size: string;
  unitNumber: number;
  rate: number;
  isPaid: boolean;
  scannedAt: string;
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

interface WorkerData {
  workerName: string;
  totalPieces: number;
  totalPaid: number;
  totalPending: number;
  paidAmount: number;
  pendingAmount: number;
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
  };
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
  const [payingKey, setPayingKey] = useState<string | null>(null);

  const colors = DEPT_COLORS[selectedDepartment] || DEPT_COLORS.Cutting;

  // Fetch data when department changes
  useEffect(() => {
    fetchWorkerPieces();
  }, [selectedDepartment]);

  const fetchWorkerPieces = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment/worker-pieces?department=${encodeURIComponent(selectedDepartment)}`);
      const data = await res.json();
      if (data.success) {
        setDepartmentData(data.data);
        // Expand all workers by default
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

  // Pay a single piece
  const handlePayPiece = async (pieceId: string) => {
    setPayingKey(pieceId);
    setError(null);
    try {
      const res = await fetch("/api/payment/worker-pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceId,
          department: selectedDepartment,
          paidBy: user?.name || "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        await fetchWorkerPieces();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to process payment");
    } finally {
      setPayingKey(null);
    }
  };

  // Pay multiple pieces at once (by Item or by Design)
  const handlePayBatch = async (pieceIds: string[], key: string) => {
    if (!pieceIds || pieceIds.length === 0) return;
    setPayingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/payment/worker-pieces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pieceIds,
          department: selectedDepartment,
          paidBy: user?.name || "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message);
        await fetchWorkerPieces();
        setTimeout(() => setSuccess(null), 3500);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to process batch payment");
    } finally {
      setPayingKey(null);
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
              Review and disburse piece-rate payments with itemized breakdown per design
            </p>
          </div>
          <button
            onClick={fetchWorkerPieces}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all font-medium text-sm shadow-xs`}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
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
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? `${deptColor.bg} text-white shadow-md`
                      : `bg-white ${deptColor.text} border ${deptColor.border} hover:${deptColor.light}`
                  }`}
                >
                  {dept === "Cutting" && <Scissors size={14} className="inline mr-1.5" />}
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

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
                    {departmentData.totals.totalPieces.toLocaleString()}
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
                    ₨{departmentData.totals.paidAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Total Paid ({departmentData.totals.totalPaid.toLocaleString()} pcs)
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
                    ₨{departmentData.totals.pendingAmount.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    Payment Due ({departmentData.totals.totalPending.toLocaleString()} pcs)
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
                          Total: <strong className="text-gray-900">{worker.totalPieces.toLocaleString()}</strong> pieces
                        </span>
                        <span className="text-emerald-700 font-medium">
                          Paid: ₨{worker.paidAmount.toLocaleString()} ({worker.totalPaid})
                        </span>
                        <span className="text-amber-700 font-bold">
                          Remaining Due: ₨{worker.pendingAmount.toLocaleString()} ({worker.totalPending})
                        </span>
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
                    {worker.designs.map((design) => {
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
                                  Total: {design.totalPieces} pieces | Total Amount: ₨{design.totalAmount.toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold rounded-md">
                                Paid: ₨{design.paidAmount.toLocaleString()} ({design.paidCount})
                              </span>
                              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold rounded-md">
                                Due: ₨{design.pendingAmount.toLocaleString()} ({design.pendingCount})
                              </span>

                              {/* Pay Entire Design Remaining Button */}
                              {design.pendingCount > 0 && design.unpaidPieceIds && (
                                <button
                                  onClick={() => handlePayBatch(design.unpaidPieceIds || [], `design_${designKey}`)}
                                  disabled={payingKey === `design_${designKey}`}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 ${colors.bg} text-white font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-all cursor-pointer`}
                                >
                                  {payingKey === `design_${designKey}` ? (
                                    <>
                                      <RefreshCw size={13} className="animate-spin" />
                                      Paying...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCheck size={14} />
                                      Pay Design Remaining (₨{design.pendingAmount.toLocaleString()})
                                    </>
                                  )}
                                </button>
                              )}
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
                                    <th className="py-2.5 px-4 text-center">Action</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                  {design.items.map((item) => {
                                    const itemKey = `${designKey}_${item.item}`;
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
                                          {item.count} pcs × ₨{item.rate} = <strong className="text-gray-900">₨{item.totalAmount.toLocaleString()}</strong>
                                        </td>
                                        <td className="py-3 px-3 text-right font-semibold text-gray-900">
                                          ₨{item.totalAmount.toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right font-medium text-emerald-600">
                                          ₨{item.paidAmount.toLocaleString()} <span className="text-xs text-gray-400">({item.paidCount})</span>
                                        </td>
                                        <td className="py-3 px-3 text-right font-bold text-amber-600">
                                          ₨{item.pendingAmount.toLocaleString()} <span className="text-xs text-gray-400 font-normal">({item.pendingCount})</span>
                                        </td>
                                        <td className="py-3 px-4 text-center">
                                          {item.pendingCount === 0 ? (
                                            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-semibold px-2 py-0.5 bg-emerald-50 rounded">
                                              <Check size={12} />
                                              Paid
                                            </span>
                                          ) : (
                                            <button
                                              onClick={() => handlePayBatch(item.unpaidPieceIds, `item_${itemKey}`)}
                                              disabled={payingKey === `item_${itemKey}`}
                                              className={`px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-md shadow-2xs hover:opacity-95 disabled:opacity-50 transition-all cursor-pointer`}
                                            >
                                              {payingKey === `item_${itemKey}` ? (
                                                <RefreshCw size={12} className="animate-spin inline" />
                                              ) : (
                                                `Pay ₨${item.pendingAmount.toLocaleString()}`
                                              )}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}

                                  {/* Total Row */}
                                  <tr className="bg-gray-100/80 font-bold border-t-2 border-gray-300">
                                    <td className="py-3 px-4 text-gray-900">Total</td>
                                    <td className="py-3 px-3 text-center text-gray-900">
                                      {design.totalPieces}
                                    </td>
                                    <td className="py-3 px-3 text-right text-gray-400">—</td>
                                    <td className="py-3 px-4 text-center text-xs text-gray-500">
                                      Sum of items above
                                    </td>
                                    <td className="py-3 px-3 text-right text-gray-900">
                                      ₨{design.totalAmount.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-3 text-right text-emerald-700">
                                      ₨{design.paidAmount.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-3 text-right text-amber-700">
                                      ₨{design.pendingAmount.toLocaleString()}
                                    </td>
                                    <td className="py-3 px-4 text-center text-xs text-gray-400">—</td>
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
                                    View individual piece details & single pay ({design.pieces.length} pieces)
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
                                        <th className="px-3 py-2 text-center">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                      {design.pieces.map((piece) => (
                                        <tr key={piece._id} className="hover:bg-gray-50/50">
                                          <td className="px-3 py-2 font-medium text-gray-900">{piece.item}</td>
                                          <td className="px-3 py-2 text-gray-600">{piece.size}</td>
                                          <td className="px-3 py-2 text-gray-600">#{piece.unitNumber}</td>
                                          <td className="px-3 py-2 text-right font-semibold text-gray-900">₨{piece.rate}</td>
                                          <td className="px-3 py-2 text-center">
                                            {piece.isPaid ? (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-medium">
                                                <Check size={10} />
                                                Paid
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full text-[10px] font-medium">
                                                <Clock size={10} />
                                                Unpaid
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-center">
                                            {piece.isPaid ? (
                                              <span className="text-gray-400 text-xs">—</span>
                                            ) : (
                                              <button
                                                onClick={() => handlePayPiece(piece._id)}
                                                disabled={payingKey === piece._id}
                                                className={`px-2.5 py-1 ${colors.bg} text-white rounded text-[11px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1 mx-auto cursor-pointer`}
                                              >
                                                {payingKey === piece._id ? (
                                                  <RefreshCw size={11} className="animate-spin" />
                                                ) : (
                                                  <>
                                                    <DollarSign size={11} />
                                                    Pay ₨{piece.rate}
                                                  </>
                                                )}
                                              </button>
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
      </div>
    </div>
  );
}
