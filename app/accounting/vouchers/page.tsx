"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileSpreadsheet,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  CreditCard,
  FileText,
  Calendar,
  User,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

interface Voucher {
  _id: string;
  voucherNumber: string;
  type: string;
  transactionDate: string;
  partyId?: { _id: string; name: string };
  totalAmount: number;
  paymentMode?: string;
  referenceNumber?: string;
  description: string;
  status: string;
  createdBy?: { name: string; username: string };
}

interface VoucherDetailModalData {
  voucher: Voucher;
  journalEntry?: {
    lines: Array<{
      accountId: { code: string; title: string };
      partyId?: { name: string };
      debit: number;
      credit: number;
      description?: string;
    }>;
    totalDebit: number;
    totalCredit: number;
  };
}

export default function VouchersPage() {
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [activeModalData, setActiveModalData] = useState<VoucherDetailModalData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchVouchers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedType !== "all") params.append("type", selectedType);
      if (search) params.append("search", search);

      const res = await fetch(`/api/accounting/vouchers?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setVouchers(data.data || []);
      } else {
        toast.error(data.error || "Failed to load vouchers");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [selectedType, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVouchers();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchVouchers]);

  const handleOpenDetail = async (id: string) => {
    try {
      setLoadingDetail(true);
      const res = await fetch(`/api/accounting/vouchers/${id}`);
      const data = await res.json();
      if (data.success) {
        setActiveModalData(data.data);
      } else {
        toast.error(data.error || "Failed to load voucher details");
      }
    } catch {
      toast.error("Failed to fetch voucher details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const formatPKR = (amt: number = 0) => {
    return "Rs. " + amt.toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const typeColorMap: Record<string, string> = {
    CPV: "bg-emerald-100 text-emerald-800",
    BPV: "bg-blue-100 text-blue-800",
    CRV: "bg-teal-100 text-teal-800",
    BRV: "bg-indigo-100 text-indigo-800",
    JV: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial Vouchers
          </h1>
          <p className="text-sm text-slate-500">
            CPV (Cash Payments), BPV (Bank Payments), and JV (Journal Vouchers)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/accounting/payments"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            + Create Payment Voucher
          </Link>
          <button
            onClick={() => fetchVouchers()}
            className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search voucher #, description, or reference..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: "all", label: "All Types" },
            { id: "CPV", label: "CPV (Cash Paid)" },
            { id: "BPV", label: "BPV (Bank Paid)" },
            { id: "JV", label: "JV (Journal / Bills)" },
            { id: "CRV", label: "CRV (Cash Recv)" },
            { id: "BRV", label: "BRV (Bank Recv)" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedType === tab.id
                  ? "bg-slate-900 text-white"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Vouchers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Voucher #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Party / Beneficiary</th>
                <th className="px-5 py-3.5">Narration / Description</th>
                <th className="px-5 py-3.5">Payment Mode</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-center">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading vouchers...
                  </td>
                </tr>
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <FileSpreadsheet size={32} className="mx-auto mb-2 opacity-40" />
                    No vouchers found matching your filter.
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      {v.voucherNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(v.transactionDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-bold ${typeColorMap[v.type] || "bg-slate-100 text-slate-700"}`}>
                        {v.type}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {v.partyId ? (
                        <Link
                          href={`/accounting/parties/${v.partyId._id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {v.partyId.name}
                        </Link>
                      ) : (
                        <span className="text-slate-400 text-xs">General Entry</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-700 max-w-sm truncate">
                      {v.description}
                      {v.referenceNumber && (
                        <span className="block text-[11px] text-slate-400 font-mono">
                          Ref: {v.referenceNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 capitalize">
                      {v.paymentMode || "—"}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-slate-900">
                      {formatPKR(v.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => handleOpenDetail(v._id)}
                        className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="View Double Entry Breakdown"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Double-Entry Journal Breakdown Modal */}
      {activeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-lg">
                    {activeModalData.voucher.voucherNumber}
                  </h3>
                  <span className={`text-xs px-2 py-0.5 rounded font-bold ${typeColorMap[activeModalData.voucher.type]}`}>
                    {activeModalData.voucher.type}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Transaction Date: {new Date(activeModalData.voucher.transactionDate).toLocaleDateString("en-PK")}
                </p>
              </div>
              <button
                onClick={() => setActiveModalData(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <p>
                  <strong className="text-slate-700">Narration:</strong> {activeModalData.voucher.description}
                </p>
                {activeModalData.voucher.createdBy && (
                  <p className="text-slate-500">
                    Posted by: {activeModalData.voucher.createdBy.name} (@{activeModalData.voucher.createdBy.username})
                  </p>
                )}
              </div>

              {/* Balanced Journal Lines */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-2.5 bg-slate-100 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Verified Double-Entry Ledger Lines
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-2">Account Head</th>
                      <th className="px-4 py-2">Line Narration</th>
                      <th className="px-4 py-2 text-right">Debit (Dr)</th>
                      <th className="px-4 py-2 text-right">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeModalData.journalEntry?.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-semibold text-slate-900">
                          {line.accountId?.title} ({line.accountId?.code})
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">
                          {line.description || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                          {line.debit > 0 ? formatPKR(line.debit) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                          {line.credit > 0 ? formatPKR(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                    <tr>
                      <td colSpan={2} className="px-4 py-2.5 text-right uppercase">
                        Balanced Total:
                      </td>
                      <td className="px-4 py-2.5 text-right text-emerald-700 font-extrabold">
                        {formatPKR(activeModalData.journalEntry?.totalDebit)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-emerald-700 font-extrabold">
                        {formatPKR(activeModalData.journalEntry?.totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 text-right">
              <button
                onClick={() => setActiveModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg"
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
