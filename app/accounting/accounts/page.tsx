"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderTree,
  Plus,
  Search,
  Shield,
  Tag,
  RefreshCw,
  X,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";

interface Account {
  _id: string;
  code: string;
  title: string;
  rootType: "directExpense" | "indirectExpense" | "asset" | "liability" | "revenue" | "equity";
  accountRole: string;
  isSystem: boolean;
  status: string;
  description?: string;
}

export default function ChartOfAccountsPage() {
  const [groupedAccounts, setGroupedAccounts] = useState<Record<string, Account[]>>({});
  const [activeTab, setActiveTab] = useState<Account["rootType"]>("directExpense");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formRootType, setFormRootType] = useState<Account["rootType"]>("directExpense");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/accounting/accounts");
      const data = await res.json();
      if (data.success) {
        setGroupedAccounts(data.data.grouped || {});
      } else {
        toast.error(data.error || "Failed to load accounts");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.error("Please enter sub-heading title");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          rootType: formRootType,
          code: formCode || undefined,
          description: formDescription,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Account created successfully!");
        setShowAddModal(false);
        setFormTitle("");
        setFormCode("");
        setFormDescription("");
        loadAccounts();
      } else {
        toast.error(data.error || "Failed to create account");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const categories = [
    { id: "directExpense", label: "Direct Expenses", desc: "Fabric, Direct Piece Wages, Dyeing, Printing & Trims" },
    { id: "indirectExpense", label: "Indirect Expenses", desc: "Factory Rent, Electricity, Generator Fuel, Machine Repairs" },
    { id: "asset", label: "Assets", desc: "Cash in Hand, Bank Accounts, Fabric Inventory, Customer Receivables" },
    { id: "liability", label: "Liabilities", desc: "Supplier Payables, Contractor Payables, Wages Accrued" },
    { id: "revenue", label: "Revenue", desc: "Garment Retail Sales, Wholesale Orders, Scrap Sales" },
    { id: "equity", label: "Equity / Capital", desc: "Owner Capital, Drawings, Retained Earnings" },
  ];

  const currentAccounts = groupedAccounts[activeTab] || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Chart of Accounts & Heads
          </h1>
          <p className="text-sm text-slate-500">
            Fixed main root headings with customizable sub-accounts managed by the accountant
          </p>
        </div>

        <button
          onClick={() => {
            setFormRootType(activeTab);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Add New Sub-Heading</span>
        </button>
      </div>

      {/* Main Headings Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {categories.map((cat) => {
          const count = (groupedAccounts[cat.id] || []).length;
          const isActive = activeTab === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id as any)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                isActive
                  ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span className="block text-xs font-bold truncate">{cat.label}</span>
              <span className={`text-[11px] font-medium mt-0.5 block ${isActive ? "text-slate-300" : "text-slate-400"}`}>
                {count} heads
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Category Description Banner */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-600">
        <div>
          <strong className="font-bold text-slate-900 uppercase">
            {categories.find((c) => c.id === activeTab)?.label}:
          </strong>{" "}
          {categories.find((c) => c.id === activeTab)?.desc}
        </div>
        <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
          {currentAccounts.length} Active Sub-Heads
        </span>
      </div>

      {/* Sub-Headings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Account Code</th>
                <th className="px-5 py-3.5">Sub-Heading Title</th>
                <th className="px-5 py-3.5">System Role / Purpose</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5 text-center">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading chart of accounts...
                  </td>
                </tr>
              ) : currentAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                    <FolderTree size={32} className="mx-auto mb-2 opacity-40" />
                    No sub-headings added under this main heading yet. Click "Add New Sub-Heading".
                  </td>
                </tr>
              ) : (
                currentAccounts.map((acc) => (
                  <tr key={acc._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900 text-xs">
                      {acc.code}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900 text-sm">
                      {acc.title}
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700">
                        {acc.accountRole || "general"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-500 max-w-sm">
                      {acc.description || "—"}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {acc.isSystem ? (
                        <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-blue-50 text-blue-700">
                          System Default
                        </span>
                      ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700">
                          Custom Head
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Sub-Heading Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Add New Sub-Heading</h3>
                <p className="text-xs text-slate-500">Create an account head under chosen category</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Main Heading (Root Type) *
                </label>
                <select
                  value={formRootType}
                  onChange={(e) => setFormRootType(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                >
                  <option value="directExpense">Direct Expense (Production Costs)</option>
                  <option value="indirectExpense">Indirect Expense (Factory Overheads)</option>
                  <option value="asset">Asset (Cash, Bank, Inventory, Receivables)</option>
                  <option value="liability">Liability (Payables, Accrued Wages)</option>
                  <option value="revenue">Revenue (Garment Sales, Wholesale)</option>
                  <option value="equity">Equity (Owner Capital, Drawings)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Sub-Heading Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator Diesel, Sewing Machine Needles"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Account Code (Optional - will auto-generate if blank)
                </label>
                <input
                  type="text"
                  placeholder="e.g. IE-109 (leave blank for auto)"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Explain what transactions will be booked here..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving..." : "Save Sub-Heading"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
