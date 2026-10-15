"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  FileText,
  CreditCard,
  Building,
  ArrowRight,
  RefreshCw,
  X,
  PlusCircle,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";

interface Party {
  _id: string;
  name: string;
  type: "supplier" | "contractor" | "worker" | "customer" | "serviceProvider";
  phone?: string;
  address?: string;
  openingBalance: number;
  openingBalanceType: "payable" | "receivable" | "none";
  status: "active" | "inactive";
  totalBills: number;
  totalPaid: number;
  netPayable: number;
  unpaidBillsCount: number;
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<Party["type"]>("supplier");
  const [formPhone, setFormPhone] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formOpeningBalance, setFormOpeningBalance] = useState("0");
  const [formOpeningType, setFormOpeningType] = useState<Party["openingBalanceType"]>("none");
  const [submitting, setSubmitting] = useState(false);

  const fetchParties = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (searchTerm) params.append("search", searchTerm);
      if (filterType !== "all") params.append("type", filterType);

      const res = await fetch(`/api/accounting/parties?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setParties(data.data || []);
      } else {
        toast.error(data.error || "Failed to load parties");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchParties();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchParties]);

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter party name");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/accounting/parties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName,
          type: formType,
          phone: formPhone,
          address: formAddress,
          notes: formNotes,
          openingBalance: Number(formOpeningBalance) || 0,
          openingBalanceType: formOpeningType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Party created successfully");
        setShowAddModal(false);
        // Reset form
        setFormName("");
        setFormPhone("");
        setFormAddress("");
        setFormNotes("");
        setFormOpeningBalance("0");
        setFormOpeningType("none");
        fetchParties();
      } else {
        toast.error(data.error || "Failed to create party");
      }
    } catch {
      toast.error("An error occurred while creating party");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPKR = (amount: number = 0) => {
    return "Rs. " + Math.abs(amount).toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const typeLabels: Record<string, string> = {
    supplier: "Supplier (Fabric/Trims)",
    contractor: "Contractor (Dyeing/Emb)",
    worker: "Worker (Piece Wages)",
    customer: "Customer (Wholesale/Retail)",
    serviceProvider: "Service Provider (Rent/Transport)",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Parties & Khata (Ledgers)
          </h1>
          <p className="text-sm text-slate-500">
            Suppliers, fabric mills, contractors, workers and customers
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus size={18} />
          <span>Add New Party</span>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search party by name (e.g. Bilal Sons, Al-Karam) or phone..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        {/* Type Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Parties" },
            { id: "supplier", label: "Suppliers" },
            { id: "contractor", label: "Contractors" },
            { id: "worker", label: "Workers" },
            { id: "customer", label: "Customers" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterType(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                filterType === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Parties List / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Party Name</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Contact</th>
                <th className="px-5 py-3.5 text-right">Total Bills</th>
                <th className="px-5 py-3.5 text-right">Total Paid</th>
                <th className="px-5 py-3.5 text-right">Current Status</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading parties and calculating Khata balances...
                  </td>
                </tr>
              ) : parties.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    No parties found matching your search. Click "Add New Party" to create one.
                  </td>
                </tr>
              ) : (
                parties.map((party) => {
                  const isPayable = party.netPayable > 0;
                  const isReceivable = party.netPayable < 0;
                  const isSettled = party.netPayable === 0;

                  return (
                    <tr
                      key={party._id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      <td className="px-5 py-4 font-semibold text-slate-900">
                        <Link href={`/accounting/parties/${party._id}`} className="hover:text-emerald-600 block">
                          {party.name}
                          {party.address && (
                            <span className="block text-xs font-normal text-slate-400 truncate max-w-xs">
                              {party.address}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs px-2 py-0.5 rounded font-medium bg-slate-100 text-slate-700 capitalize">
                          {party.type}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-600">
                        {party.phone ? (
                          <span className="flex items-center gap-1.5 text-xs text-slate-700">
                            <Phone size={12} className="text-slate-400" />
                            {party.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-800">
                        {formatPKR(party.totalBills)}
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-800">
                        {formatPKR(party.totalPaid)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {isPayable && (
                          <div>
                            <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                              We need to pay {formatPKR(party.netPayable)}
                            </span>
                            {party.unpaidBillsCount > 0 && (
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                {party.unpaidBillsCount} unpaid bill(s)
                              </p>
                            )}
                          </div>
                        )}
                        {isReceivable && (
                          <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            We need to receive {formatPKR(party.netPayable)}
                          </span>
                        )}
                        {isSettled && (
                          <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            No pending amount
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/accounting/parties/${party._id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        >
                          <span>Open Khata</span>
                          <ArrowRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Party Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Add New Party</h3>
                <p className="text-xs text-slate-500">Create a central Khata profile</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateParty} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Party Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Bilal Sons, Al-Madina Trims"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Party Type *
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as any)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="supplier">Supplier (Fabric/Trims)</option>
                    <option value="contractor">Contractor (Dyeing/Embroidery)</option>
                    <option value="worker">Worker (Piece-Rate Labor)</option>
                    <option value="customer">Customer (Wholesale/Retail)</option>
                    <option value="serviceProvider">Service Provider (Rent/Cargo)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Phone (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="0300-1234567"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Address (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Market name, City, or Shop #"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              {/* Opening Balance with Business Language */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="block text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Previous Balance (Opening Balance)
                </span>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Balance Type</label>
                    <select
                      value={formOpeningType}
                      onChange={(e) => setFormOpeningType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none"
                    >
                      <option value="none">No pending amount</option>
                      <option value="payable">We need to pay</option>
                      <option value="receivable">We need to receive</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Amount (Rs.)</label>
                    <input
                      type="number"
                      min="0"
                      disabled={formOpeningType === "none"}
                      value={formOpeningBalance}
                      onChange={(e) => setFormOpeningBalance(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                    />
                  </div>
                </div>
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
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : "Save Party"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
