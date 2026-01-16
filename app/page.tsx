"use client";

import { useEffect, useState } from "react";
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
}

interface Unit {
  size: string;
  unitNumber: number;
  items: ProductItem[];
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
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    if (user?.role === "admin") {
      fetchDashboard();
    }
  }, [user]);

  const fetchDashboard = async () => {
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
    }
  };

  const fetchDesignDetails = async (designName: string) => {
    if (expandedDesign === designName) {
      setExpandedDesign(null);
      setDesignDetails(null);
      return;
    }

    setLoadingDetails(true);
    setExpandedDesign(designName);

    try {
      const response = await fetch(`/api/dashboard/${encodeURIComponent(designName)}`);
      const data = await response.json();
      if (data.success) {
        setDesignDetails(data.units);
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

      <div className="ml-64 w-full">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600">Welcome back, {user.name}</p>
        </header>

        <div className="p-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Products by Department</h2>
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-4">
              {DEPARTMENTS.map((dept) => (
                <div key={dept.key} className="text-center">
                  <div
                    className={`w-12 h-12 ${dept.color} rounded-lg flex items-center justify-center mx-auto mb-2`}
                  >
                    <span className="text-white font-bold">
                      {stats?.byDepartment[dept.key as keyof DepartmentCounts] || 0}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{dept.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Designs List */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
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
                    className="pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                      className="p-4 hover:bg-gray-50 cursor-pointer"
                      onClick={() => fetchDesignDetails(design.name)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                            <span className="text-white font-bold text-lg">
                              {design.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{design.name}</h3>
                            <p className="text-sm text-gray-500">
                              {design.totalItems} items • Created{" "}
                              {new Date(design.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6">
                          {/* Size breakdown */}
                          <div className="flex gap-3">
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

                          {/* Department dots */}
                          <div className="flex gap-1">
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
                                        <span className="font-medium">{item.item}</span>
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
