"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Wallet,
  Building,
  ArrowUpRight,
  ArrowDownLeft,
  Factory,
  Receipt,
  TrendingUp,
  Package,
  PlusCircle,
  RefreshCw,
  Calendar,
  FileText,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

interface DashboardSummary {
  cashInHand: number;
  bankBalance: number;
  totalToPay: number;
  totalToReceive: number;
  totalManufacturingCost: number;
  totalExpenses: number;
  totalRevenue: number;
  grossProfit: number;
  netProfitOrLoss: number;
  stockValue: number;
}

interface FinancialYear {
  _id: string;
  name: string;
  isCurrent: boolean;
}

export default function AccountingDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
  const [selectedFY, setSelectedFY] = useState<string>("");
  const [recentVouchers, setRecentVouchers] = useState<any[]>([]);

  const fetchDashboardData = useCallback(async (fyId?: string) => {
    try {
      setLoading(true);
      const url = fyId
        ? `/api/accounting/dashboard?financialYearId=${fyId}`
        : "/api/accounting/dashboard";

      const res = await fetch(url);
      const data = await res.json();

      if (data.success) {
        setSummary(data.data.summary);
        setFinancialYears(data.data.allYears || []);
        if (data.data.financialYear) {
          setSelectedFY(data.data.financialYear._id);
        }
        setRecentVouchers(data.data.recentVouchers || []);
      } else {
        toast.error(data.error || "Failed to load dashboard metrics");
      }
    } catch (error) {
      toast.error("Failed to connect to accounting server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatPKR = (amount: number = 0) => {
    return "Rs. " + amount.toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Accounting Department
          </h1>
          <p className="text-sm text-slate-500">
            Real-time verified ledger metrics & financial position
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Financial Year Selector */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-xs">
            <Calendar size={16} className="text-slate-500" />
            <select
              value={selectedFY}
              onChange={(e) => {
                setSelectedFY(e.target.value);
                fetchDashboardData(e.target.value);
              }}
              className="text-sm font-semibold text-slate-800 bg-transparent outline-none cursor-pointer"
            >
              {financialYears.map((fy) => (
                <option key={fy._id} value={fy._id}>
                  {fy.name} {fy.isCurrent ? "(Current)" : ""}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => fetchDashboardData(selectedFY)}
            disabled={loading}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900 transition-colors shadow-xs"
            title="Refresh Ledger Figures"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Link
          href="/accounting/purchases"
          className="flex items-center gap-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
        >
          <PlusCircle size={16} />
          <span>Record Purchase (Fabric/Bill)</span>
        </Link>
        <Link
          href="/accounting/payments"
          className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
        >
          <PlusCircle size={16} />
          <span>Make a Payment</span>
        </Link>
        <Link
          href="/accounting/expenses"
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-xs"
        >
          <Receipt size={16} />
          <span>Record Factory Expense</span>
        </Link>
        <Link
          href="/accounting/receipts"
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-xs"
        >
          <ArrowDownLeft size={16} />
          <span>Record Money Received</span>
        </Link>
        <Link
          href="/accounting/wages"
          className="flex items-center gap-2 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium transition-colors"
        >
          <span>Worker Wages (Piece Work)</span>
        </Link>
      </div>

      {/* Main 8 Financial Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Cash in Hand */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Cash in Hand</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Wallet size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPKR(summary?.cashInHand)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Available in drawer & counter</p>
        </div>

        {/* 2. Bank Balance */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Bank Balance</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Building size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPKR(summary?.bankBalance)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Total in business accounts</p>
        </div>

        {/* 3. We Need to Pay */}
        <div className="bg-white p-5 rounded-xl border border-rose-100 bg-rose-50/20 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">We Need to Pay</span>
            <div className="p-2 rounded-lg bg-rose-100 text-rose-600">
              <ArrowUpRight size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {formatPKR(summary?.totalToPay)}
          </div>
          <p className="text-xs text-rose-700/80 mt-1">Suppliers & contractors due</p>
        </div>

        {/* 4. We Need to Receive */}
        <div className="bg-white p-5 rounded-xl border border-amber-100 bg-amber-50/20 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">We Need to Receive</span>
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <ArrowDownLeft size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {formatPKR(summary?.totalToReceive)}
          </div>
          <p className="text-xs text-amber-700/80 mt-1">Pending customer collections</p>
        </div>

        {/* 5. Total Manufacturing Cost */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Manufacturing Cost</span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <Factory size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPKR(summary?.totalManufacturingCost)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Fabric consumed + Direct piece labor</p>
        </div>

        {/* 6. Total Operating Expenses */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Expenses</span>
            <div className="p-2 rounded-lg bg-slate-100 text-slate-600">
              <Receipt size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPKR(summary?.totalExpenses)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Rent, electricity, fuel, repairs</p>
        </div>

        {/* 7. Net Profit / Loss */}
        <div className={`p-5 rounded-xl border shadow-xs ${
          (summary?.netProfitOrLoss || 0) >= 0
            ? "bg-emerald-50/30 border-emerald-200"
            : "bg-rose-50/30 border-rose-200"
        }`}>
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Net Profit / Loss</span>
            <div className={`p-2 rounded-lg ${
              (summary?.netProfitOrLoss || 0) >= 0
                ? "bg-emerald-100 text-emerald-700"
                : "bg-rose-100 text-rose-700"
            }`}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className={`text-2xl font-bold ${
            (summary?.netProfitOrLoss || 0) >= 0 ? "text-emerald-700" : "text-rose-700"
          }`}>
            {formatPKR(summary?.netProfitOrLoss)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Revenue minus all costs & expenses</p>
        </div>

        {/* 8. Stock Valuation */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Stock Value</span>
            <div className="p-2 rounded-lg bg-teal-50 text-teal-600">
              <Package size={18} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {formatPKR(summary?.stockValue)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Raw fabric + WIP + Packed goods</p>
        </div>
      </div>

      {/* Explanatory Note for Owner/Accountant */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 text-blue-900 text-sm flex items-start gap-3">
        <AlertCircle size={20} className="text-blue-600 shrink-0 mt-0.5" />
        <p>
          <strong className="font-semibold">Unified Ledger Principle:</strong> All numbers above are derived from the single verified general ledger.
          Supplier balances update atomically when bills and payments are recorded.
        </p>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">Recent Accounting Vouchers</h3>
            <p className="text-xs text-slate-500">Latest financial postings across Cash, Bank, and Bills</p>
          </div>
          <Link
            href="/accounting/vouchers"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>View All Vouchers</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3">Voucher #</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Party / Description</th>
                <th className="px-5 py-3">Payment Mode</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentVouchers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                    <FileText size={24} className="mx-auto mb-2 opacity-50" />
                    No vouchers recorded yet for this financial period.
                  </td>
                </tr>
              ) : (
                recentVouchers.map((v) => (
                  <tr key={v._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-slate-900">{v.voucherNumber}</td>
                    <td className="px-5 py-3.5 text-slate-600">
                      {new Date(v.transactionDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs px-2 py-0.5 font-semibold rounded bg-slate-100 text-slate-700">
                        {v.type}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">
                        {v.partyId ? v.partyId.name : v.description}
                      </div>
                      {v.partyId && (
                        <div className="text-xs text-slate-400 truncate max-w-xs">{v.description}</div>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600 capitalize">{v.paymentMode || "Cash"}</td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900">
                      {formatPKR(v.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        v.status === "posted"
                          ? "bg-emerald-100 text-emerald-800"
                          : v.status === "reversed"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
