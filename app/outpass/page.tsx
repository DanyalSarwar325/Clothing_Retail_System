"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import {
  FileOutput,
  Search,
  RefreshCw,
  Package,
  Clock,
  User,
  ChevronDown,
  ChevronRight,
  ArrowLeftRight,
} from "lucide-react";
import toast from "react-hot-toast";

interface OutpassInfo {
  generatedAt: string;
  generatedBy: string;
  fromDepartment: string;
}

interface DepartmentScan {
  department: string;
  scannedAt: string;
  scannedBy?: string;
}

interface OutpassItem {
  id: string;
  design: string;
  size: string;
  suitType: string;
  item: string;
  unitNumber: number;
  status: string;
  outpassInfo: OutpassInfo;
  departmentHistory: DepartmentScan[];
}

export default function OutpassPage() {
  const { user, loading: authLoading } = useAuth();
  const [items, setItems] = useState<OutpassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchDesign, setSearchDesign] = useState("");
  const [summaryByDesign, setSummaryByDesign] = useState<Record<string, number>>({});
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [active, setActive] = useState("outpass");

  useEffect(() => {
    if (user?.role === "admin") {
      fetchOutpassItems();
    }
  }, [user]);

  const fetchOutpassItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchDesign) params.append("design", searchDesign);

      const response = await fetch(`/api/outpass?${params.toString()}`);
      const data = await response.json();

      if (data.success) {
        setItems(data.items || []);
        setSummaryByDesign(data.summaryByDesign || {});
      } else {
        toast.error(data.message || "Failed to fetch outpass items");
      }
    } catch (error) {
      console.error("Error fetching outpass items:", error);
      toast.error("Failed to fetch outpass items");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Access denied. Admin only.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active={active} setActive={setActive} />

      <main className="flex-1 lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                <FileOutput className="text-white" size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Outpass Items</h1>
                <p className="text-sm text-gray-500">
                  {items.length} items currently on outpass
                </p>
              </div>
            </div>
            <button
              onClick={fetchOutpassItems}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-600 rounded-lg hover:bg-orange-200 transition"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-6">
          {/* Search */}
          <div className="bg-white rounded-xl border p-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by design name..."
                  value={searchDesign}
                  onChange={(e) => setSearchDesign(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchOutpassItems()}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <button
                onClick={fetchOutpassItems}
                className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition"
              >
                Search
              </button>
            </div>
          </div>

          {/* Summary by Design */}
          {Object.keys(summaryByDesign).length > 0 && (
            <div className="bg-white rounded-xl border p-4 mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Package size={16} />
                Summary by Design
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(summaryByDesign)
                  .sort(([, a], [, b]) => b - a)
                  .map(([design, count]) => (
                    <span
                      key={design}
                      className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-sm font-medium"
                    >
                      {design}: {count}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Items List */}
          <div className="bg-white rounded-xl border overflow-hidden">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12">
                <FileOutput className="mx-auto text-gray-300 mb-3" size={48} />
                <p className="text-gray-500">No items currently on outpass</p>
                <p className="text-sm text-gray-400 mt-1">
                  Items will appear here when outpass is generated
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <div key={item.id} className="hover:bg-gray-50">
                    <div
                      className="p-4 cursor-pointer"
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <ArrowLeftRight className="text-orange-600" size={18} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {item.design} - {item.item}
                            </p>
                            <p className="text-sm text-gray-500">
                              {getSizeLabel(item.size)} • {item.suitType} • Unit #{item.unitNumber}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm text-gray-500">From</p>
                            <p className="font-medium text-orange-600">
                              {item.outpassInfo.fromDepartment}
                            </p>
                          </div>
                          <div className="text-right hidden sm:block">
                            <p className="text-sm text-gray-500">By</p>
                            <p className="font-medium text-gray-900">
                              {item.outpassInfo.generatedBy}
                            </p>
                          </div>
                          {expandedItem === item.id ? (
                            <ChevronDown size={20} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={20} className="text-gray-400" />
                          )}
                        </div>
                      </div>

                      {/* Mobile info */}
                      <div className="sm:hidden mt-2 flex gap-4 text-sm">
                        <span className="text-gray-500">
                          From: <span className="text-orange-600 font-medium">{item.outpassInfo.fromDepartment}</span>
                        </span>
                        <span className="text-gray-500">
                          By: <span className="text-gray-900 font-medium">{item.outpassInfo.generatedBy}</span>
                        </span>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedItem === item.id && (
                      <div className="px-4 pb-4">
                        <div className="bg-orange-50 rounded-lg p-4">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            <Clock size={14} />
                            Outpass Details
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-gray-500">Generated At</p>
                              <p className="font-medium">{formatDate(item.outpassInfo.generatedAt)}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Generated By</p>
                              <p className="font-medium">{item.outpassInfo.generatedBy}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">From Department</p>
                              <p className="font-medium text-orange-600">{item.outpassInfo.fromDepartment}</p>
                            </div>
                          </div>

                          {/* Department History */}
                          <div className="mt-4 pt-4 border-t border-orange-200">
                            <h5 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                              Recent History
                            </h5>
                            <div className="space-y-2">
                              {item.departmentHistory.slice(-5).reverse().map((scan, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-sm">
                                  <div className={`w-2 h-2 rounded-full ${scan.department === "Outpass" ? "bg-orange-500" : "bg-gray-400"}`}></div>
                                  <span className={`font-medium ${scan.department === "Outpass" ? "text-orange-600" : "text-gray-700"}`}>
                                    {scan.department}
                                  </span>
                                  {scan.scannedBy && (
                                    <span className="text-gray-500">by {scan.scannedBy}</span>
                                  )}
                                  <span className="text-gray-400 text-xs">
                                    {formatDate(scan.scannedAt)}
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
        </div>
      </main>
    </div>
  );
}
