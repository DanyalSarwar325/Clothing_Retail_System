"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import {
  Package,
  Layers,
  Scissors,
  Search,
  ChevronDown,
  ChevronUp,
  Clock,
  User,
  RefreshCw,
} from "lucide-react";

interface DepartmentCounts {
  cutting: number;
  sewing: number;
  quality: number;
  handmade: number;
  addaWork: number;
  patching: number;
  press: number;
  packing: number;
  store: number;
}

interface Design {
  name: string;
  totalItems: number;
  sizes: {
    small: number;
    medium: number;
    large: number;
  };
  byDepartment: DepartmentCounts;
  createdAt: string;
}

interface Stats {
  totalDesigns: number;
  totalItems: number;
  byDepartment: DepartmentCounts;
}

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface ProductItem {
  id: string;
  item: string;
  currentDepartment: string;
  status: string;
  departmentHistory: DepartmentScan[];
  createdAt: string;
  scannedAt?: string;
  sequenceNumber?: number;
  totalUnitsInBatch?: number;
}

interface Unit {
  size: string;
  unitNumber: number;
  items: ProductItem[];
}

interface FinalStickerCard {
  id: string;
  size: string;
  unitNumber: number;
  suitType: string;
  sellingPrice: number;
  currentDepartment: string;
  status: string;
  departmentHistory: DepartmentScan[];
  createdAt: string;
}

const DEPARTMENTS = [
  { key: "cutting", label: "Cutting", color: "bg-red-500" },
  { key: "sewing", label: "Sewing", color: "bg-orange-500" },
  { key: "quality", label: "Quality", color: "bg-yellow-500" },
  { key: "handmade", label: "Handmade", color: "bg-green-500" },
  { key: "addaWork", label: "Adda Work", color: "bg-teal-500" },
  { key: "patching", label: "patching", color: "bg-blue-500" },
  { key: "press", label: "Press", color: "bg-indigo-500" },
  { key: "packing", label: "Packing", color: "bg-purple-500" },
  { key: "store", label: "Store", color: "bg-pink-500" },
];

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedDesign, setExpandedDesign] = useState<string | null>(null);
  const [designDetails, setDesignDetails] = useState<Unit[] | null>(null);
  const [finalStickers, setFinalStickers] = useState<FinalStickerCard[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch("/api/dashboard");
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
        setDesigns(data.designs);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchDashboard();
    }
  }, [user, fetchDashboard]);

  // Auto-refresh when user comes back to the tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && user?.role === "admin") {
        fetchDashboard(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, fetchDashboard]);

  const handleRefresh = () => {
    fetchDashboard(true);
  };

  const fetchDesignDetails = async (designName: string) => {
    if (expandedDesign === designName) {
      setExpandedDesign(null);
      setDesignDetails(null);
      setFinalStickers(null);
      return;
    }

    setLoadingDetails(true);
    setExpandedDesign(designName);

    try {
      const response = await fetch(`/api/dashboard/${encodeURIComponent(designName)}`);
      const data = await response.json();
      if (data.success) {
        setDesignDetails(data.units);
        setFinalStickers(data.finalStickers || []);
      }
    } catch (error) {
      console.error("Failed to fetch design details:", error);
    } finally {
      setLoadingDetails(false);
    }
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

  const getDepartmentColor = (department: string) => {
    const dept = DEPARTMENTS.find(
      (d) => d.label.toLowerCase() === department.toLowerCase() ||
             d.key.toLowerCase() === department.toLowerCase().replace(" ", "")
    );
    return dept?.color || "bg-gray-500";
  };

  const filteredDesigns = designs.filter((d) =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active="" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b px-4 sm:px-8 py-6 pt-16 lg:pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 text-sm sm:text-base">Welcome back, {user.name}</p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
            <StatCard
              icon={<Layers className="text-blue-600" size={24} />}
              title="Total Designs"
              value={stats?.totalDesigns || 0}
              bg="bg-blue-50"
            />
            <StatCard
              icon={<Package className="text-green-600" size={24} />}
              title="Total Products"
              value={stats?.totalItems || 0}
              bg="bg-green-50"
            />
            <StatCard
              icon={<Scissors className="text-orange-600" size={24} />}
              title="In Production"
              value={
                (stats?.byDepartment.cutting || 0) +
                (stats?.byDepartment.sewing || 0) +
                (stats?.byDepartment.quality || 0)
              }
              bg="bg-orange-50"
            />
            <StatCard
              icon={<Package className="text-purple-600" size={24} />}
              title="In Store"
              value={stats?.byDepartment.store || 0}
              bg="bg-purple-50"
            />
          </div>

          {/* Department Overview */}
          <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8">
            <h2 className="text-lg font-semibold mb-4">Products by Department</h2>
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 sm:gap-4">
              {DEPARTMENTS.map((dept) => (
                <div key={dept.key} className="text-center">
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 ${dept.color} rounded-lg flex items-center justify-center mx-auto mb-2`}
                  >
                    <span className="text-white font-bold text-sm sm:text-base">
                      {stats?.byDepartment[dept.key as keyof DepartmentCounts] || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 truncate">{dept.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Designs List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 sm:p-6 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-lg font-semibold">All Designs</h2>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={18}
                  />
                  <input
                    type="text"
                    placeholder="Search designs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full sm:w-auto pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="divide-y">
              {filteredDesigns.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No designs found
                </div>
              ) : (
                filteredDesigns.map((design) => (
                  <div key={design.name}>
                    {/* Design Row */}
                    <div
                      className="p-3 sm:p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => fetchDesignDetails(design.name)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-base sm:text-lg">
                              {design.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 truncate">{design.name}</h3>
                            <p className="text-xs sm:text-sm text-gray-500">
                              {design.totalItems} items
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-6 flex-shrink-0">
                          {/* Size breakdown - hidden on small screens */}
                          <div className="hidden md:flex gap-3">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              S: {design.sizes.small}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              M: {design.sizes.medium}
                            </span>
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs">
                              L: {design.sizes.large}
                            </span>
                          </div>

                          {/* Department dots - limit on mobile */}
                          <div className="hidden sm:flex gap-1">
                            {DEPARTMENTS.map((dept) => {
                              const count =
                                design.byDepartment[dept.key as keyof DepartmentCounts];
                              if (count === 0) return null;
                              return (
                                <div
                                  key={dept.key}
                                  className={`w-6 h-6 ${dept.color} rounded-full flex items-center justify-center`}
                                  title={`${dept.label}: ${count}`}
                                >
                                  <span className="text-white text-xs font-bold">
                                    {count}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {expandedDesign === design.name ? (
                            <ChevronUp className="text-gray-400" size={20} />
                          ) : (
                            <ChevronDown className="text-gray-400" size={20} />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedDesign === design.name && (
                      <div className="bg-gray-50 p-4 border-t">
                        {loadingDetails ? (
                          <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Final Stickers Section */}
                            {finalStickers && finalStickers.length > 0 && (
                              <div className="bg-white rounded-lg p-4 shadow-sm border-2 border-purple-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-semibold">
                                    Final Stickers ({finalStickers.length})
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                  {finalStickers.map((sticker) => (
                                    <div
                                      key={sticker.id}
                                      className="border-2 border-purple-100 rounded-lg p-3 bg-purple-50"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-purple-900">
                                          {sticker.suitType.toUpperCase()} - {sticker.size}
                                        </span>
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs text-white ${getDepartmentColor(
                                            sticker.currentDepartment
                                          )}`}
                                        >
                                          {sticker.currentDepartment}
                                        </span>
                                      </div>
                                      <div className="text-xs text-gray-600 mb-2">
                                        <span className="font-medium">Unit #{sticker.unitNumber}</span>
                                        <span className="mx-2">•</span>
                                        <span className="text-green-600 font-semibold">Rs. {sticker.sellingPrice}</span>
                                      </div>

                                      {/* Department History */}
                                      {sticker.departmentHistory.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-purple-200">
                                          <p className="text-xs text-gray-500 mb-1">
                                            Scan History:
                                          </p>
                                          <div className="space-y-1">
                                            {sticker.departmentHistory.map((scan, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-center gap-2 text-xs text-gray-600"
                                              >
                                                <Clock size={12} />
                                                <span>{scan.department}</span>
                                                {scan.scannedBy && (
                                                  <>
                                                    <User size={12} />
                                                    <span>{scan.scannedBy}</span>
                                                  </>
                                                )}
                                                <span className="text-gray-400">
                                                  {formatDate(scan.scannedAt)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Individual Barcodes */}
                            {designDetails?.map((unit) => (
                              <div
                                key={`${unit.size}-${unit.unitNumber}`}
                                className="bg-white rounded-lg p-4 shadow-sm"
                              >
                                <div className="flex items-center gap-2 mb-3">
                                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                                    {getSizeLabel(unit.size)}
                                  </span>
                                  <span className="text-gray-600">
                                    Unit #{unit.unitNumber}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  {unit.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="border rounded-lg p-3"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium">{item.item}</span>
                                          {item.sequenceNumber && item.totalUnitsInBatch && (
                                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-semibold">
                                              {item.sequenceNumber}/{item.totalUnitsInBatch}
                                            </span>
                                          )}
                                        </div>
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs text-white ${getDepartmentColor(
                                            item.currentDepartment
                                          )}`}
                                        >
                                          {item.currentDepartment}
                                        </span>
                                      </div>

                                      {/* Department History */}
                                      {item.departmentHistory.length > 0 && (
                                        <div className="mt-2 pt-2 border-t">
                                          <p className="text-xs text-gray-500 mb-1">
                                            Scan History:
                                          </p>
                                          <div className="space-y-1">
                                            {item.departmentHistory.map((scan, idx) => (
                                              <div
                                                key={idx}
                                                className="flex items-center gap-2 text-xs text-gray-600"
                                              >
                                                <Clock size={12} />
                                                <span>{scan.department}</span>
                                                {scan.scannedBy && (
                                                  <>
                                                    <User size={12} />
                                                    <span>{scan.scannedBy}</span>
                                                  </>
                                                )}
                                                <span className="text-gray-400">
                                                  {formatDate(scan.scannedAt)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value, bg }: any) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div
        className={`w-12 h-12 ${bg} rounded-lg flex items-center justify-center mb-4`}
      >
        {icon}
      </div>
      <p className="text-gray-600 text-sm">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
