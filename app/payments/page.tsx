"use client";

import { useEffect, useState, FormEvent } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";
import {
  LogOut,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  CircleDollarSign,
  Wallet,
  Eye,
  X,
} from "lucide-react";

interface DepartmentSummary {
  department: string;
  ratePerUnit: number;
  totalScans: number;
  totalPaid: number;
  totalDue: number;
  pending: number;
}

interface DesignBreakdown {
  design: string;
  scanCount: number;
  amount: number;
}

interface BreakdownData {
  department: string;
  ratePerUnit: number;
  totalScans: number;
  totalAmount: number;
  designs: DesignBreakdown[];
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

export default function PaymentsPage() {
  const { user, logout } = useAuth();
  const [active] = useState("payments");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [form, setForm] = useState({ department: "Cutting", amount: "", note: "" });
  const [breakdown, setBreakdown] = useState<BreakdownData | null>(null);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  const fetchBreakdown = async (department: string) => {
    setLoadingBreakdown(true);
    try {
      const response = await fetch(
        `/api/payment/department/breakdown?department=${encodeURIComponent(department)}`,
        { cache: "no-store" }
      );
      const result = await response.json();
      if (result.success) {
        setBreakdown(result.data);
      }
    } catch (err) {
      console.error("Failed to fetch breakdown", err);
    } finally {
      setLoadingBreakdown(false);
    }
  };

  const closeBreakdown = () => {
    setBreakdown(null);
  };

  const fetchDepartments = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payment/department", {
        cache: "no-store",
      });
      const result = await response.json();

      if (result.success) {
        setDepartments(result.data);
      } else {
        setError(result.message || "Failed to load payments");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const amountValue = Number(form.amount);

    if (Number.isNaN(amountValue) || amountValue <= 0) {
      setError("Amount must be a positive number greater than 0");
      setSaving(false);
      return;
    }

    try {
      const response = await fetch("/api/payment/department", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: form.department,
          amount: amountValue,
          note: form.note,
          createdBy: user?.name,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to record payment");
      }

      setSuccess("Payment recorded successfully");
      setForm((prev) => ({ ...prev, amount: "", note: "" }));
      await fetchDepartments();
    } catch (err: any) {
      setError(err.message || "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active={active} setActive={() => {}} />

      <div className="ml-64 w-full">
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
              <Wallet size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Payments</h1>
              <p className="text-sm text-gray-500">Record payouts and track per-department balances</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </header>

        <div className="p-8 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Record Payment</h2>
                <p className="text-sm text-gray-600">Add payments to reduce pending balances for each department.</p>
              </div>
              <button
                onClick={fetchDepartments}
                className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
                disabled={loading}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {error && (
              <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {success && (
              <div className="mb-3 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle size={16} />
                {success}
              </div>
            )}

            <form className="grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Department</label>
                <select
                  className="border rounded-lg px-3 py-2 bg-white"
                  value={form.department}
                  onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                  required
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col">
                <label className="text-sm text-gray-600 mb-1">Amount (₨)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="border rounded-lg px-3 py-2"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>

              <div className="flex flex-col md:col-span-1">
                <label className="text-sm text-gray-600 mb-1">Note (optional)</label>
                <input
                  type="text"
                  className="border rounded-lg px-3 py-2"
                  placeholder="Reference or comments"
                  value={form.note}
                  onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
                />
              </div>

              <div className="md:col-span-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full md:w-auto bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving..." : "Record Payment"}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-sm border p-6">
            <div className="flex items-center gap-2 mb-4">
              <CircleDollarSign className="text-blue-600" size={18} />
              <h2 className="text-lg font-semibold text-gray-900">Department Balances</h2>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              <strong>Total Earned</strong> = Scans × Rate | <strong>Pending</strong> = Total Earned - Paid
            </p>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600 border-b">
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Scans</th>
                    <th className="py-2 pr-4">Rate/Unit</th>
                    <th className="py-2 pr-4">Total Earned</th>
                    <th className="py-2 pr-4">Paid</th>
                    <th className="py-2 pr-4">Pending</th>
                    <th className="py-2 pr-4">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td className="py-4" colSpan={7}>
                        <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept) => (
                      <tr key={dept.department} className="border-b last:border-0">
                        <td className="py-3 pr-4 font-medium text-gray-900">
                          {dept.department}
                        </td>
                        <td className="py-3 pr-4 text-gray-700">
                          {dept.totalScans.toLocaleString()}
                        </td>
                        <td className="py-3 pr-4 text-gray-700">₨{dept.ratePerUnit}</td>
                        <td className="py-3 pr-4 text-blue-700 font-medium">
                          ₨{dept.totalDue.toFixed(2)}
                        </td>
                        <td className="py-3 pr-4 text-emerald-700 font-medium">₨{dept.totalPaid.toFixed(2)}</td>
                        <td className="py-3 pr-4 text-amber-700 font-bold">₨{dept.pending.toFixed(2)}</td>
                        <td className="py-3 pr-4">
                          <button
                            onClick={() => fetchBreakdown(dept.department)}
                            className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            <Eye size={14} />
                            See Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Modal */}
      {(breakdown || loadingBreakdown) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                {loadingBreakdown ? "Loading..." : `${breakdown?.department} - Scan Breakdown`}
              </h3>
              <button
                onClick={closeBreakdown}
                className="p-1 hover:bg-gray-100 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {loadingBreakdown ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="animate-pulse h-10 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : breakdown ? (
                <>
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-blue-600">Total Scans</p>
                      <p className="text-lg font-bold text-blue-800">{breakdown.totalScans}</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-emerald-600">Rate/Unit</p>
                      <p className="text-lg font-bold text-emerald-800">₨{breakdown.ratePerUnit}</p>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-lg text-center">
                      <p className="text-xs text-amber-600">Total Amount</p>
                      <p className="text-lg font-bold text-amber-800">₨{breakdown.totalAmount.toFixed(2)}</p>
                    </div>
                  </div>

                  <h4 className="text-sm font-medium text-gray-700 mb-2">Breakdown by Design</h4>
                  
                  {breakdown.designs.length === 0 ? (
                    <p className="text-gray-500 text-sm">No scans recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {breakdown.designs.map((item) => (
                        <div
                          key={item.design}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900">{item.design}</p>
                            <p className="text-xs text-gray-500">{item.scanCount} scans</p>
                          </div>
                          <p className="font-semibold text-blue-700">₨{item.amount.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="p-4 border-t">
              <button
                onClick={closeBreakdown}
                className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}