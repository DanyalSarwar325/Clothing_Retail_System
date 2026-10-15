"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar,
  Plus,
  RefreshCw,
  CheckCircle2,
  Lock,
  Clock,
  PlusCircle,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

interface FinancialYear {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closing" | "closed";
  isCurrent: boolean;
}

export default function FinancialYearsPage() {
  const [years, setYears] = useState<FinancialYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [startYear, setStartYear] = useState(new Date().getFullYear() + 1);
  const [submitting, setSubmitting] = useState(false);

  const loadYears = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/accounting/financial-years");
      const data = await res.json();
      if (data.success) {
        setYears(data.data || []);
      }
    } catch {
      toast.error("Failed to load financial years");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadYears();
  }, [loadYears]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/accounting/financial-years", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startYear }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Financial Year created");
        setShowModal(false);
        loadYears();
      } else {
        toast.error(data.error || "Failed to create year");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial Years
          </h1>
          <p className="text-sm text-slate-500">
            Accounting cycles from 1 July to 30 June (Pakistan standard fiscal year)
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Add Next Financial Year</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Financial Year</th>
                <th className="px-5 py-3.5">Start Date</th>
                <th className="px-5 py-3.5">End Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-center">Active Period</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading financial periods...
                  </td>
                </tr>
              ) : (
                years.map((y) => (
                  <tr key={y._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">{y.name}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {new Date(y.startDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600">
                      {new Date(y.endDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold capitalize ${
                        y.status === "open"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {y.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {y.isCurrent ? (
                        <span className="text-xs px-3 py-1 rounded-full font-bold bg-blue-100 text-blue-800 inline-flex items-center gap-1">
                          <CheckCircle2 size={13} />
                          Current Active FY
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">Add Financial Year</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Starting Year (July 1st)
                </label>
                <input
                  type="number"
                  min="2020"
                  max="2040"
                  required
                  value={startYear}
                  onChange={(e) => setStartYear(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none"
                />
                <span className="text-xs text-slate-400 mt-1 block">
                  Will create: FY {startYear}-{String(startYear + 1).slice(-2)} (1 Jul {startYear} to 30 Jun {startYear + 1})
                </span>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold"
                >
                  {submitting ? "Creating..." : "Create Period"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
