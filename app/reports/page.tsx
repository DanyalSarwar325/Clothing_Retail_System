"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import {
  Users,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  Package,
  DollarSign,
  TrendingUp,
  X,
  BarChart3,
  Wallet,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  Trash2,
} from "lucide-react";

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

const DEPT_COLORS: Record<string, { bg: string; text: string; light: string }> = {
  Cutting: { bg: "bg-red-500", text: "text-red-600", light: "bg-red-50" },
  Sewing: { bg: "bg-blue-500", text: "text-blue-600", light: "bg-blue-50" },
  Quality: { bg: "bg-green-500", text: "text-green-600", light: "bg-green-50" },
  Handmade: { bg: "bg-purple-500", text: "text-purple-600", light: "bg-purple-50" },
  "Adda Work": { bg: "bg-pink-500", text: "text-pink-600", light: "bg-pink-50" },
  Patching: { bg: "bg-orange-500", text: "text-orange-600", light: "bg-orange-50" },
  Press: { bg: "bg-cyan-500", text: "text-cyan-600", light: "bg-cyan-50" },
  Packing: { bg: "bg-amber-500", text: "text-amber-600", light: "bg-amber-50" },
  Store: { bg: "bg-indigo-500", text: "text-indigo-600", light: "bg-indigo-50" },
};

interface PiecesByDesign {
  design: string;
  count: number;
}

interface ScansByDesign {
  design: string;
  count: number;
}

interface WorkerReport {
  name: string;
  department: string;
  currentPieces: number;
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  totalEarned: number;
  totalPaid: number;
  pendingPayment: number;
  piecesByDesign: PiecesByDesign[];
  scansByDesign: ScansByDesign[];
}

interface DefectiveWorkerReport {
  name: string;
  department: string;
  totalDefective: number;
  byDesign: Record<string, number>;
  byReason: Record<string, number>;
  recentDefects: {
    design: string;
    item: string;
    size: string;
    suitType: string;
    unitNumber: number;
    reason: string;
    markedAt: string;
    markedBy: string;
    responsiblePerson: string;
    responsibleDepartment: string;
  }[];
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<WorkerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");

  // Defective report states
  const [defectiveReports, setDefectiveReports] = useState<DefectiveWorkerReport[]>([]);
  const [defectiveLoading, setDefectiveLoading] = useState(true);
  const [showDefectiveSection, setShowDefectiveSection] = useState(false);
  const [expandedDefectiveWorker, setExpandedDefectiveWorker] = useState<string | null>(null);

  // Filter states
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterName, setFilterName] = useState("");
  const [filterDesign, setFilterDesign] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filter options
  const [designs, setDesigns] = useState<string[]>([]);

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchReports();
      fetchDefectiveReports();
    }
  }, [user]);

  const fetchDefectiveReports = async () => {
    setDefectiveLoading(true);
    try {
      const response = await fetch("/api/barcodes/defective?groupByWorker=true");
      const data = await response.json();
      if (data.success) {
        setDefectiveReports(data.workerReport || []);
      }
    } catch (error) {
      console.error("Failed to fetch defective reports:", error);
    } finally {
      setDefectiveLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      const response = await fetch("/api/reports/filters");
      const data = await response.json();
      if (data.success) {
        setDesigns(data.data.designs);
      }
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
    }
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterDepartment) params.set("department", filterDepartment);
      if (filterName) params.set("name", filterName);
      if (filterDesign) params.set("design", filterDesign);
      if (filterDateFrom) params.set("dateFrom", filterDateFrom);
      if (filterDateTo) params.set("dateTo", filterDateTo);

      const response = await fetch(`/api/reports/workers?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        setReports(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch reports:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    fetchReports();
    setShowFilters(false);
  };

  const clearFilters = () => {
    setFilterDepartment("");
    setFilterName("");
    setFilterDesign("");
    setFilterDateFrom("");
    setFilterDateTo("");
    setTimeout(() => fetchReports(), 0);
  };

  const toggleWorkerDetails = (workerName: string) => {
    setExpandedWorker(expandedWorker === workerName ? null : workerName);
  };

  const formatCurrency = (amount: number) => {
    return `Rs. ${amount.toLocaleString()}`;
  };

  const hasActiveFilters = filterDepartment || filterName || filterDesign || filterDateFrom || filterDateTo;

  // Filter by active tab (department)
  const filteredReports = activeTab === "all" 
    ? reports 
    : reports.filter(r => r.department === activeTab);

  // Group reports by department
  const reportsByDepartment = DEPARTMENTS.reduce((acc, dept) => {
    const deptReports = filteredReports.filter((r) => r.department === dept);
    if (deptReports.length > 0) {
      acc[dept] = deptReports;
    }
    return acc;
  }, {} as Record<string, WorkerReport[]>);

  // Calculate summary stats
  const totalWorkers = reports.length;
  const totalCurrentPieces = reports.reduce((sum, r) => sum + r.currentPieces, 0);
  const totalPending = reports.reduce((sum, r) => sum + r.pendingPayment, 0);
  const totalScansToday = reports.reduce((sum, r) => sum + r.scansToday, 0);
  const totalEarned = reports.reduce((sum, r) => sum + r.totalEarned, 0);

  // Department counts for tabs
  const deptCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = reports.filter(r => r.department === dept).length;
    return acc;
  }, {} as Record<string, number>);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-3 border-blue-600 border-t-transparent"></div>
          <p className="text-sm text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <X size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">Only admins can view reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active="reports" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="px-4 lg:px-6 py-4 pt-14 lg:pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg lg:text-xl font-bold text-gray-900 flex items-center gap-2">
                  <BarChart3 size={22} className="text-blue-600" />
                  Reports & Analytics
                </h1>
                <p className="text-xs lg:text-sm text-gray-500 mt-0.5">
                  Worker performance & payment tracking
                </p>
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  showFilters || hasActiveFilters
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Filter size={16} />
                <span className="hidden sm:inline">Filters</span>
                {hasActiveFilters && (
                  <span className="w-5 h-5 bg-white text-blue-600 rounded-full text-xs flex items-center justify-center font-bold">
                    !
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="px-3 sm:px-4 lg:px-6 pb-3 sm:pb-4 border-t bg-gray-50">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 pt-3 sm:pt-4">
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">Department</label>
                  <select
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                    className="w-full border rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All</option>
                    {DEPARTMENTS.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">Worker</label>
                  <div className="relative">
                    <Search size={12} className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      placeholder="Search..."
                      className="w-full border rounded-md sm:rounded-lg pl-6 sm:pl-8 pr-2 sm:pr-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">Design</label>
                  <select
                    value={filterDesign}
                    onChange={(e) => setFilterDesign(e.target.value)}
                    className="w-full border rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">All</option>
                    {designs.map((design) => (
                      <option key={design} value={design}>{design}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">From</label>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    className="w-full border rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-medium text-gray-600 mb-1">To</label>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    className="w-full border rounded-md sm:rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-2 sm:mt-3">
                <button
                  onClick={applyFilters}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 transition"
                >
                  Apply
                </button>
                <button
                  onClick={clearFilters}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border text-gray-600 rounded-md sm:rounded-lg text-xs sm:text-sm font-medium hover:bg-gray-50 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </header>

        <div className="p-3 sm:p-4 lg:p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border hover:shadow-md transition">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-blue-100 rounded-md sm:rounded-lg flex items-center justify-center">
                  <Users className="text-blue-600" size={14} />
                </div>
                <span className="text-[10px] sm:text-xs text-green-600 font-medium hidden sm:flex items-center gap-0.5">
                  <ArrowUpRight size={10} /> Active
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalWorkers}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Workers</p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border hover:shadow-md transition">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-amber-100 rounded-md sm:rounded-lg flex items-center justify-center">
                  <Package className="text-amber-600" size={14} />
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalCurrentPieces}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Pieces</p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border hover:shadow-md transition">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-green-100 rounded-md sm:rounded-lg flex items-center justify-center">
                  <TrendingUp className="text-green-600" size={14} />
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{totalScansToday}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Today</p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border hover:shadow-md transition hidden sm:block">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-purple-100 rounded-md sm:rounded-lg flex items-center justify-center">
                  <Wallet className="text-purple-600" size={14} />
                </div>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(totalEarned)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Earned</p>
            </div>

            <div className="bg-white rounded-lg sm:rounded-xl p-3 sm:p-4 border hover:shadow-md transition col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-orange-100 rounded-md sm:rounded-lg flex items-center justify-center">
                  <Clock className="text-orange-600" size={14} />
                </div>
                <span className="text-[10px] sm:text-xs text-orange-600 font-medium flex items-center gap-0.5">
                  <ArrowDownRight size={10} /> Due
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-bold text-orange-600">{formatCurrency(totalPending)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500">Pending</p>
            </div>
          </div>

          {/* Defective/Waste Report Section */}
          <div className="bg-white rounded-lg sm:rounded-xl border mb-4 sm:mb-6 overflow-hidden">
            <button
              onClick={() => setShowDefectiveSection(!showDefectiveSection)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertTriangle className="text-red-600" size={18} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm sm:text-base font-semibold text-gray-900">Defective/Waste Report</h3>
                  <p className="text-xs text-gray-500">
                    {defectiveReports.reduce((sum, r) => sum + r.totalDefective, 0)} total defective pieces by {defectiveReports.length} workers
                  </p>
                </div>
              </div>
              {showDefectiveSection ? (
                <ChevronDown size={20} className="text-gray-400" />
              ) : (
                <ChevronRight size={20} className="text-gray-400" />
              )}
            </button>

            {showDefectiveSection && (
              <div className="border-t">
                {defectiveLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-red-600 border-t-transparent"></div>
                  </div>
                ) : defectiveReports.length === 0 ? (
                  <div className="text-center py-8">
                    <Trash2 className="mx-auto text-gray-300 mb-2" size={32} />
                    <p className="text-sm text-gray-500">No defective items reported</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {defectiveReports.map((worker) => (
                      <div key={`${worker.name}-${worker.department}`} className="hover:bg-gray-50">
                        <div
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => setExpandedDefectiveWorker(
                            expandedDefectiveWorker === `${worker.name}-${worker.department}` 
                              ? null 
                              : `${worker.name}-${worker.department}`
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-9 h-9 ${DEPT_COLORS[worker.department]?.bg || "bg-gray-500"} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
                                {worker.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{worker.name}</p>
                                <p className="text-xs text-gray-500">{worker.department}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-sm font-semibold">
                                {worker.totalDefective} damaged
                              </span>
                              {expandedDefectiveWorker === `${worker.name}-${worker.department}` ? (
                                <ChevronDown size={16} className="text-gray-400" />
                              ) : (
                                <ChevronRight size={16} className="text-gray-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedDefectiveWorker === `${worker.name}-${worker.department}` && (
                          <div className="px-4 py-3 bg-red-50 border-t">
                            {/* Recent Defects - Piece Details */}
                            <div className="mb-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Package size={12} />
                                Damaged Pieces Detail
                              </h4>
                              <div className="bg-white rounded-lg border overflow-hidden">
                                <div className="max-h-64 overflow-y-auto">
                                  <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Piece Info</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Damaged By</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Department</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reason</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {worker.recentDefects.map((defect, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50">
                                          <td className="px-3 py-2">
                                            <p className="font-medium text-gray-900">{defect.design}</p>
                                            <p className="text-xs text-gray-500">
                                              {defect.item} • {defect.size} • Unit #{defect.unitNumber}
                                            </p>
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className="font-medium text-red-700">{defect.responsiblePerson || defect.markedBy}</span>
                                          </td>
                                          <td className="px-3 py-2">
                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${DEPT_COLORS[defect.responsibleDepartment]?.light || "bg-gray-100"} ${DEPT_COLORS[defect.responsibleDepartment]?.text || "text-gray-600"}`}>
                                              {defect.responsibleDepartment}
                                            </span>
                                          </td>
                                          <td className="px-3 py-2 text-gray-600 text-xs">{defect.reason}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {/* By Design */}
                              <div className="bg-white rounded-lg p-3 border">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <Package size={12} />
                                  Damaged by Design
                                </h4>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {Object.entries(worker.byDesign)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([design, count]) => (
                                      <div key={design} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 truncate mr-2">{design}</span>
                                        <span className="text-sm font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                          {count}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>

                              {/* By Reason */}
                              <div className="bg-white rounded-lg p-3 border">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <AlertTriangle size={12} />
                                  Damage Reasons
                                </h4>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {Object.entries(worker.byReason)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([reason, count]) => (
                                      <div key={reason} className="flex justify-between items-center">
                                        <span className="text-sm text-gray-600 truncate mr-2">{reason}</span>
                                        <span className="text-sm font-medium bg-gray-100 px-2 py-0.5 rounded">
                                          {count}
                                        </span>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Department Tabs */}
          <div className="bg-white rounded-lg sm:rounded-xl border mb-3 sm:mb-4 overflow-hidden">
            <div className="flex overflow-x-auto scrollbar-hide -mb-px">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                  activeTab === "all"
                    ? "border-blue-600 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                All ({reports.length})
              </button>
              {DEPARTMENTS.filter(dept => deptCounts[dept] > 0).map((dept) => (
                <button
                  key={dept}
                  onClick={() => setActiveTab(dept)}
                  className={`px-3 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 transition flex-shrink-0 ${
                    activeTab === dept
                      ? `border-blue-600 ${DEPT_COLORS[dept]?.text || "text-blue-600"} ${DEPT_COLORS[dept]?.light || "bg-blue-50"}`
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className="hidden sm:inline">{dept}</span>
                  <span className="sm:hidden">{dept.split(" ")[0]}</span>
                  <span className="ml-1">({deptCounts[dept]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Workers List */}
          {loading ? (
            <div className="flex justify-center py-12 sm:py-16">
              <div className="flex flex-col items-center gap-2 sm:gap-3">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-3 border-blue-600 border-t-transparent"></div>
                <p className="text-xs sm:text-sm text-gray-500">Loading...</p>
              </div>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="bg-white rounded-lg sm:rounded-xl border p-8 sm:p-12 text-center">
              <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <Users size={24} className="text-gray-400" />
              </div>
              <h3 className="text-sm sm:font-medium text-gray-900 mb-1">No workers found</h3>
              <p className="text-xs sm:text-sm text-gray-500">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg sm:rounded-xl border overflow-hidden">
              {/* Table Header */}
              <div className="hidden lg:grid lg:grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wider">
                <div className="col-span-3">Worker</div>
                <div className="col-span-2 text-center">Pieces Held</div>
                <div className="col-span-1 text-center">Today</div>
                <div className="col-span-1 text-center">Week</div>
                <div className="col-span-1 text-center">Total</div>
                <div className="col-span-2 text-center">Pending</div>
                <div className="col-span-2 text-center">Earned</div>
              </div>

              {/* Workers */}
              <div className="divide-y">
                {Object.entries(reportsByDepartment).map(([department, deptReports]) => (
                  <div key={department}>
                    {/* Department Header (only show if viewing all) */}
                    {activeTab === "all" && (
                      <div className={`px-4 py-2 ${DEPT_COLORS[department]?.light || "bg-gray-50"} border-b`}>
                        <span className={`text-xs font-semibold uppercase tracking-wider ${DEPT_COLORS[department]?.text || "text-gray-600"}`}>
                          {department} ({deptReports.length})
                        </span>
                      </div>
                    )}

                    {deptReports.map((worker) => (
                      <div key={worker.name} className="hover:bg-gray-50 transition">
                        {/* Worker Row */}
                        <div
                          className="px-4 py-3 cursor-pointer"
                          onClick={() => toggleWorkerDetails(worker.name)}
                        >
                          {/* Desktop View */}
                          <div className="hidden lg:grid lg:grid-cols-12 gap-4 items-center">
                            <div className="col-span-3 flex items-center gap-3">
                              <div className={`w-9 h-9 ${DEPT_COLORS[worker.department]?.bg || "bg-blue-500"} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
                                {worker.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{worker.name}</p>
                                <p className="text-xs text-gray-500">{worker.department}</p>
                              </div>
                              {expandedWorker === worker.name ? (
                                <ChevronDown size={16} className="text-gray-400 ml-auto" />
                              ) : (
                                <ChevronRight size={16} className="text-gray-400 ml-auto" />
                              )}
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="inline-flex items-center px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                                {worker.currentPieces} pcs
                              </span>
                            </div>
                            <div className="col-span-1 text-center text-sm font-medium text-gray-900">{worker.scansToday}</div>
                            <div className="col-span-1 text-center text-sm font-medium text-gray-900">{worker.scansThisWeek}</div>
                            <div className="col-span-1 text-center text-sm font-medium text-gray-900">{worker.totalScans}</div>
                            <div className="col-span-2 text-center">
                              <span className="text-sm font-semibold text-orange-600">{formatCurrency(worker.pendingPayment)}</span>
                            </div>
                            <div className="col-span-2 text-center">
                              <span className="text-sm font-medium text-gray-900">{formatCurrency(worker.totalEarned)}</span>
                            </div>
                          </div>

                          {/* Mobile View */}
                          <div className="lg:hidden">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className={`w-9 h-9 sm:w-10 sm:h-10 ${DEPT_COLORS[worker.department]?.bg || "bg-blue-500"} rounded-full flex items-center justify-center text-white text-sm font-semibold`}>
                                  {worker.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm sm:font-medium text-gray-900">{worker.name}</p>
                                  <p className="text-[10px] sm:text-xs text-gray-500">{worker.currentPieces} pcs • {worker.department}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-xs sm:text-sm font-semibold text-orange-600">{formatCurrency(worker.pendingPayment)}</p>
                                <p className="text-[10px] sm:text-xs text-gray-500">pending</p>
                              </div>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mt-2 sm:mt-3">
                              <div className="text-center bg-gray-100 rounded-md py-1.5 sm:py-2">
                                <p className="text-xs sm:text-sm font-bold text-gray-900">{worker.scansToday}</p>
                                <p className="text-[9px] sm:text-[10px] text-gray-500">Today</p>
                              </div>
                              <div className="text-center bg-gray-100 rounded-md py-1.5 sm:py-2">
                                <p className="text-xs sm:text-sm font-bold text-gray-900">{worker.scansThisWeek}</p>
                                <p className="text-[9px] sm:text-[10px] text-gray-500">Week</p>
                              </div>
                              <div className="text-center bg-gray-100 rounded-md py-1.5 sm:py-2">
                                <p className="text-xs sm:text-sm font-bold text-gray-900">{worker.totalScans}</p>
                                <p className="text-[9px] sm:text-[10px] text-gray-500">Total</p>
                              </div>
                              <div className="text-center bg-green-100 rounded-md py-1.5 sm:py-2">
                                <p className="text-xs sm:text-sm font-bold text-green-700">Rs.{(worker.totalEarned/1000).toFixed(0)}k</p>
                                <p className="text-[9px] sm:text-[10px] text-gray-500">Earned</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedWorker === worker.name && (
                          <div className="px-3 sm:px-4 py-3 sm:py-4 bg-gray-50 border-t">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                              {/* Payment Card */}
                              <div className="bg-white rounded-lg p-3 sm:p-4 border">
                                <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5">
                                  <DollarSign size={12} />
                                  Payment
                                </h4>
                                <div className="space-y-1.5 sm:space-y-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-gray-600">Earned</span>
                                    <span className="text-xs sm:text-sm font-semibold text-gray-900">{formatCurrency(worker.totalEarned)}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs sm:text-sm text-gray-600">Paid</span>
                                    <span className="text-xs sm:text-sm font-semibold text-green-600">{formatCurrency(worker.totalPaid)}</span>
                                  </div>
                                  <div className="flex justify-between items-center pt-1.5 sm:pt-2 border-t">
                                    <span className="text-xs sm:text-sm font-medium text-gray-700">Pending</span>
                                    <span className="text-sm sm:text-base font-bold text-orange-600">{formatCurrency(worker.pendingPayment)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Pieces by Design */}
                              <div className="bg-white rounded-lg p-3 sm:p-4 border">
                                <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5">
                                  <Package size={12} />
                                  Pieces Held
                                </h4>
                                {worker.piecesByDesign.length === 0 ? (
                                  <p className="text-xs sm:text-sm text-gray-400">No pieces held</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-24 sm:max-h-32 overflow-y-auto">
                                    {worker.piecesByDesign.map((item) => (
                                      <div key={item.design} className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate mr-2">{item.design}</span>
                                        <span className="text-xs sm:text-sm font-medium bg-gray-100 px-1.5 sm:px-2 py-0.5 rounded">{item.count}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Scans by Design (This Week) */}
                              <div className="bg-white rounded-lg p-3 sm:p-4 border">
                                <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5">
                                  <BarChart3 size={12} />
                                  Scans This Week
                                </h4>
                                {(!worker.scansByDesign || worker.scansByDesign.length === 0) ? (
                                  <p className="text-xs sm:text-sm text-gray-400">No scans recorded</p>
                                ) : (
                                  <div className="space-y-1.5 max-h-24 sm:max-h-32 overflow-y-auto">
                                    {worker.scansByDesign.map((item) => (
                                      <div key={item.design} className="flex justify-between items-center">
                                        <span className="text-xs sm:text-sm text-gray-600 truncate mr-2">{item.design}</span>
                                        <span className="text-xs sm:text-sm font-medium bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded">{item.count}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Productivity */}
                              <div className="bg-white rounded-lg p-3 sm:p-4 border sm:col-span-2 lg:col-span-1">
                                <h4 className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5">
                                  <TrendingUp size={12} />
                                  Productivity
                                </h4>
                                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                                  <div className="text-center bg-blue-50 rounded-md sm:rounded-lg p-1.5 sm:p-2">
                                    <p className="text-base sm:text-lg font-bold text-blue-600">{worker.scansToday}</p>
                                    <p className="text-[9px] sm:text-[10px] text-gray-500">Today</p>
                                  </div>
                                  <div className="text-center bg-green-50 rounded-md sm:rounded-lg p-1.5 sm:p-2">
                                    <p className="text-base sm:text-lg font-bold text-green-600">{worker.scansThisWeek}</p>
                                    <p className="text-[9px] sm:text-[10px] text-gray-500">Week</p>
                                  </div>
                                  <div className="text-center bg-purple-50 rounded-md sm:rounded-lg p-1.5 sm:p-2">
                                    <p className="text-base sm:text-lg font-bold text-purple-600">
                                      {worker.scansThisWeek > 0 ? (worker.scansThisWeek / 7).toFixed(1) : 0}
                                    </p>
                                    <p className="text-[9px] sm:text-[10px] text-gray-500">Avg</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
