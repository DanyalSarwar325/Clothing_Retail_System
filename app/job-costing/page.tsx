"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";
import {
  LogOut,
  RefreshCw,
  Calculator,
  ChevronDown,
  ChevronUp,
  Package,
} from "lucide-react";

interface ItemBreakdown {
  item: string;
  count: number;
  rate: number;
  cost: number;
}

interface DepartmentCost {
  department: string;
  scans: number;
  rate: number | null; // null for item-based departments
  cost: number;
  itemBreakdown?: ItemBreakdown[]; // Only for Cutting, Sewing, Press
  itemRates?: Record<string, number>; // All item rates admin entered (Qameez/Shalwar/Dupatta)
}

interface RawMaterialItem {
  item: string;
  price: number;
}

interface DesignCost {
  design: string;
  totalScans: number;
  laborCost: number;
  rawMaterialCost: number;
  rawMaterialItems: RawMaterialItem[];
  totalCost: number;
  departments: DepartmentCost[];
}

interface JobCostingData {
  designs: DesignCost[];
  summary: {
    totalDesigns: number;
    grandTotalScans: number;
    grandTotalLaborCost: number;
    grandTotalRawMaterialCost: number;
    grandTotalCost: number;
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

export default function JobCostingPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<JobCostingData | null>(null);
  const [expandedDesign, setExpandedDesign] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/job-costing", { cache: "no-store" });
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to fetch job costing", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const toggleDesign = (design: string) => {
    setExpandedDesign(expandedDesign === design ? null : design);
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active="job-costing" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        <header className="bg-white border-b px-4 sm:px-8 py-4 pt-16 lg:pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center text-white">
              <Calculator size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Job Costing</h1>
              <p className="text-xs sm:text-sm text-gray-500">Cost breakdown per design across all departments</p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8 space-y-6">
          {/* Summary Cards */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5">
                <p className="text-sm text-gray-500">Total Designs</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">{data.summary.totalDesigns}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5">
                <p className="text-sm text-gray-500">Total Scans</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{data.summary.grandTotalScans.toLocaleString()}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5">
                <p className="text-sm text-gray-500">Labor Cost</p>
                <p className="text-2xl sm:text-3xl font-bold text-orange-600">₨{data.summary.grandTotalLaborCost?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5">
                <p className="text-sm text-gray-500">Raw Material Cost</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">₨{data.summary.grandTotalRawMaterialCost?.toLocaleString() || 0}</p>
              </div>
              <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-5 col-span-2 sm:col-span-1">
                <p className="text-sm text-gray-500">Total Cost</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">₨{data.summary.grandTotalCost?.toLocaleString() || 0}</p>
              </div>
            </div>
          )}

          {/* Design Cost Table */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-3 sm:p-4 border-b">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Cost per Design</h2>
              <p className="text-xs sm:text-sm text-gray-500">Click on a design to see department-wise breakdown</p>
            </div>

            {loading ? (
              <div className="p-8">
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="animate-pulse h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ) : data && data.designs.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No designs found. Start scanning products to see job costing.
              </div>
            ) : (
              <div className="divide-y">
                {data?.designs.map((design) => (
                  <div key={design.design}>
                    {/* Design Row */}
                    <button
                      onClick={() => toggleDesign(design.design)}
                      className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-4">
                        {expandedDesign === design.design ? (
                          <ChevronUp size={18} className="text-gray-400" />
                        ) : (
                          <ChevronDown size={18} className="text-gray-400" />
                        )}
                        <div className="text-left">
                          <p className="font-semibold text-gray-900">{design.design}</p>
                          <p className="text-xs text-gray-500">{design.totalScans} total scans</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold text-orange-600">₨{design.laborCost?.toLocaleString() || 0}</p>
                          <p className="text-xs text-gray-500">Labor</p>
                        </div>
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold text-green-600">₨{design.rawMaterialCost?.toLocaleString() || 0}</p>
                          <p className="text-xs text-gray-500">Raw Material</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-purple-700">₨{design.totalCost?.toLocaleString() || 0}</p>
                          <p className="text-xs text-gray-500">Total Cost</p>
                        </div>
                      </div>
                    </button>

                    {/* Department Breakdown */}
                    {expandedDesign === design.design && (
                      <div className="bg-gray-50 px-4 py-3 border-t">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead>
                              <tr className="text-left text-gray-600">
                                <th className="py-2 pr-4 font-medium">Department</th>
                                <th className="py-2 pr-4 font-medium text-right">Scans</th>
                                <th className="py-2 pr-4 font-medium text-right">Rate</th>
                                <th className="py-2 font-medium text-right">Cost</th>
                              </tr>
                            </thead>
                            <tbody>
                              {design.departments.map((dept) => (
                                <>
                                  {/* Main department row */}
                                  <tr
                                    key={dept.department}
                                    className={dept.scans > 0 ? "bg-white" : "opacity-50"}
                                  >
                                    <td className="py-2 pr-4 text-gray-900 font-medium">{dept.department}</td>
                                    <td className="py-2 pr-4 text-right text-gray-700">{dept.scans}</td>
                                    <td className="py-2 pr-4 text-right text-gray-700">
                                      {dept.rate !== null ? (
                                        `₨${dept.rate}/unit`
                                      ) : dept.itemRates && Object.keys(dept.itemRates).length > 0 ? (
                                        <span className="text-xs text-gray-500 italic">Per item ↓</span>
                                      ) : (
                                        <span className="text-xs text-gray-500 italic">Item-based</span>
                                      )}
                                    </td>
                                    <td className="py-2 text-right font-medium text-purple-700">
                                      ₨{dept.cost.toFixed(2)}
                                    </td>
                                  </tr>
                                  {/* Item breakdown rows for item-based departments - show scanned items */}
                                  {dept.itemBreakdown && dept.itemBreakdown.length > 0 && dept.itemBreakdown.map((item, idx) => (
                                    <tr key={`${dept.department}-${item.item}-${idx}`} className="bg-gray-100 text-xs">
                                      <td className="py-1 pl-6 pr-4 text-gray-600">↳ {item.item}</td>
                                      <td className="py-1 pr-4 text-right text-gray-600">{item.count}</td>
                                      <td className="py-1 pr-4 text-right text-gray-600">₨{item.rate}/pc</td>
                                      <td className="py-1 text-right text-gray-600">₨{item.cost.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                  {/* Show all item rates even if no scans yet (for item-based depts) */}
                                  {dept.itemRates && Object.keys(dept.itemRates).length > 0 && (!dept.itemBreakdown || dept.itemBreakdown.length === 0) && (
                                    Object.entries(dept.itemRates).map(([item, rate], idx) => (
                                      <tr key={`${dept.department}-rate-${item}-${idx}`} className="bg-blue-50 text-xs">
                                        <td className="py-1 pl-6 pr-4 text-blue-600">↳ {item}</td>
                                        <td className="py-1 pr-4 text-right text-gray-400">0</td>
                                        <td className="py-1 pr-4 text-right text-blue-600">₨{rate}/pc</td>
                                        <td className="py-1 text-right text-gray-400">₨0.00</td>
                                      </tr>
                                    ))
                                  )}
                                </>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="border-t font-semibold">
                                <td className="py-2 pr-4 text-gray-900">Labor Cost Subtotal</td>
                                <td className="py-2 pr-4 text-right text-gray-900">{design.totalScans}</td>
                                <td className="py-2 pr-4 text-right text-gray-500">-</td>
                                <td className="py-2 text-right text-orange-600">
                                  ₨{design.laborCost?.toLocaleString() || 0}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>

                        {/* Raw Materials Section */}
                        <div className="mt-4 pt-4 border-t">
                          <div className="flex items-center gap-2 mb-3">
                            <Package size={16} className="text-green-600" />
                            <h4 className="font-medium text-gray-900">Raw Materials</h4>
                          </div>
                          {design.rawMaterialItems && design.rawMaterialItems.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-gray-600">
                                    <th className="py-2 pr-4 font-medium">Item</th>
                                    <th className="py-2 font-medium text-right">Price</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {design.rawMaterialItems.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="py-2 pr-4 text-gray-900">{item.item}</td>
                                      <td className="py-2 text-right font-medium text-green-700">
                                        ₨{item.price?.toLocaleString() || 0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t font-semibold">
                                    <td className="py-2 pr-4 text-gray-900">Raw Material Subtotal</td>
                                    <td className="py-2 text-right text-green-600">
                                      ₨{design.rawMaterialCost?.toLocaleString() || 0}
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 italic">
                              No raw materials added. Go to Raw Materials page to add.
                            </p>
                          )}
                        </div>

                        {/* Grand Total */}
                        <div className="mt-4 pt-4 border-t flex justify-between items-center">
                          <span className="font-bold text-gray-900">Grand Total</span>
                          <span className="text-xl font-bold text-purple-700">
                            ₨{design.totalCost?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
