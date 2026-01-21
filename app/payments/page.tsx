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

interface DesignData {
  design: string;
  pieces: PieceData[];
  paidCount: number;
  pendingCount: number;
  paidAmount: number;
  pendingAmount: number;
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
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

const DEPT_COLORS: Record<string, { bg: string; text: string; border: string; light: string }> = {
  Cutting: { bg: "bg-rose-600", text: "text-rose-600", border: "border-rose-200", light: "bg-rose-50" },
  Sewing: { bg: "bg-blue-600", text: "text-blue-600", border: "border-blue-200", light: "bg-blue-50" },
  Quality: { bg: "bg-emerald-600", text: "text-emerald-600", border: "border-emerald-200", light: "bg-emerald-50" },
  Handmade: { bg: "bg-purple-600", text: "text-purple-600", border: "border-purple-200", light: "bg-purple-50" },
  "Adda Work": { bg: "bg-amber-600", text: "text-amber-600", border: "border-amber-200", light: "bg-amber-50" },
  Patching: { bg: "bg-cyan-600", text: "text-cyan-600", border: "border-cyan-200", light: "bg-cyan-50" },
  Press: { bg: "bg-orange-600", text: "text-orange-600", border: "border-orange-200", light: "bg-orange-50" },
  Packing: { bg: "bg-teal-600", text: "text-teal-600", border: "border-teal-200", light: "bg-teal-50" },
  Store: { bg: "bg-indigo-600", text: "text-indigo-600", border: "border-indigo-200", light: "bg-indigo-50" },
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
  const [payingPiece, setPayingPiece] = useState<string | null>(null);

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
        const allWorkers = new Set(data.data.workers.map((w: WorkerData) => w.workerName));
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

  const handlePayPiece = async (pieceId: string) => {
    setPayingPiece(pieceId);
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
        // Refresh data
        await fetchWorkerPieces();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError("Failed to process payment");
    } finally {
      setPayingPiece(null);
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

  // Filter workers by search query
  const filteredWorkers = departmentData?.workers.filter((worker) =>
    worker.workerName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        user={user}
        activeItem={active}
        onLogout={logout}
      />

      <div className="lg:ml-64 p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Worker Payments</h1>
            <p className="text-gray-500">Pay workers piece by piece</p>
          </div>
          <button
            onClick={fetchWorkerPieces}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 ${colors.bg} text-white rounded-lg hover:opacity-90 disabled:opacity-50`}
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
            <AlertCircle size={20} />
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
            <CheckCircle size={20} />
            {success}
          </div>
        )}

        {/* Department Tabs */}
        <div className="mb-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max pb-2">
            {DEPARTMENTS.map((dept) => {
              const deptColor = DEPT_COLORS[dept];
              const isSelected = selectedDepartment === dept;
              return (
                <button
                  key={dept}
                  onClick={() => setSelectedDepartment(dept)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                    isSelected
                      ? `${deptColor.bg} text-white shadow-lg`
                      : `bg-white ${deptColor.text} border ${deptColor.border} hover:${deptColor.light}`
                  }`}
                >
                  {dept}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Cards */}
        {departmentData && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${colors.light}`}>
                  <Users size={20} className={colors.text} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {departmentData.totals.totalWorkers}
                  </p>
                  <p className="text-sm text-gray-500">Workers</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <Wallet size={20} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {departmentData.totals.totalPieces}
                  </p>
                  <p className="text-sm text-gray-500">Total Pieces</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-50">
                  <DollarSign size={20} className="text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-600">
                    ₨{departmentData.totals.paidAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Paid ({departmentData.totals.totalPaid})</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-sm border">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <Clock size={20} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    ₨{departmentData.totals.pendingAmount.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">Pending ({departmentData.totals.totalPending})</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search worker..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Workers List */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm border animate-pulse">
                <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredWorkers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 shadow-sm border text-center">
            <Users size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-600">No workers found</h3>
            <p className="text-gray-400 mt-1">No scanned pieces in {selectedDepartment} department</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredWorkers.map((worker) => (
              <div key={worker.workerName} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* Worker Header */}
                <div
                  className={`p-4 ${colors.light} cursor-pointer flex items-center justify-between`}
                  onClick={() => toggleWorkerExpand(worker.workerName)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full ${colors.bg} flex items-center justify-center text-white font-bold text-lg`}>
                      {worker.workerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{worker.workerName}</h3>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-gray-600">{worker.totalPieces} pieces</span>
                        <span className="text-emerald-600 font-medium">
                          Paid: ₨{worker.paidAmount.toLocaleString()} ({worker.totalPaid})
                        </span>
                        <span className="text-amber-600 font-medium">
                          Pending: ₨{worker.pendingAmount.toLocaleString()} ({worker.totalPending})
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {expandedWorkers.has(worker.workerName) ? (
                      <ChevronUp size={24} className="text-gray-500" />
                    ) : (
                      <ChevronDown size={24} className="text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Worker Details - Designs Table */}
                {expandedWorkers.has(worker.workerName) && (
                  <div className="p-4">
                    {worker.designs.map((design) => (
                      <div key={design.design} className="mb-6 last:mb-0">
                        {/* Design Header */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b">
                          <h4 className="font-semibold text-gray-800 text-lg">{design.design}</h4>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded">
                              Paid: ₨{design.paidAmount} ({design.paidCount})
                            </span>
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded">
                              Pending: ₨{design.pendingAmount} ({design.pendingCount})
                            </span>
                          </div>
                        </div>

                        {/* Pieces Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50">
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Item</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Size</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">Unit #</th>
                                <th className="px-4 py-2 text-right font-medium text-gray-600">Rate</th>
                                <th className="px-4 py-2 text-center font-medium text-gray-600">Status</th>
                                <th className="px-4 py-2 text-center font-medium text-gray-600">Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {design.pieces.map((piece) => (
                                <tr key={piece._id} className="border-b hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">{piece.item}</td>
                                  <td className="px-4 py-3 text-gray-600">{piece.size}</td>
                                  <td className="px-4 py-3 text-gray-600">#{piece.unitNumber}</td>
                                  <td className="px-4 py-3 text-right font-semibold text-gray-900">₨{piece.rate}</td>
                                  <td className="px-4 py-3 text-center">
                                    {piece.isPaid ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                                        <Check size={12} />
                                        Paid
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-medium">
                                        <Clock size={12} />
                                        Unpaid
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {piece.isPaid ? (
                                      <span className="text-gray-400 text-sm">—</span>
                                    ) : (
                                      <button
                                        onClick={() => handlePayPiece(piece._id)}
                                        disabled={payingPiece === piece._id}
                                        className={`px-3 py-1.5 ${colors.bg} text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1 mx-auto`}
                                      >
                                        {payingPiece === piece._id ? (
                                          <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            Paying...
                                          </>
                                        ) : (
                                          <>
                                            <DollarSign size={14} />
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
                      </div>
                    ))}
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
