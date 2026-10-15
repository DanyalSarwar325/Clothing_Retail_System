"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  BarChart3,
  Printer,
  Calendar,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Wallet,
  Users,
  Building,
} from "lucide-react";
import toast from "react-hot-toast";

export default function FinancialReportsPage() {
  const [activeReport, setActiveReport] = useState<"profit-loss" | "trial-balance" | "cash-book" | "outstanding">("profit-loss");
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/accounting/reports?type=${activeReport}`);
      const data = await res.json();
      if (data.success) {
        setReportData(data.data);
      } else {
        toast.error(data.error || "Failed to load report");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [activeReport]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const formatPKR = (amt: number = 0) => {
    return "Rs. " + Math.abs(amt).toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Financial Reports & Statements
          </h1>
          <p className="text-sm text-slate-500">
            Verified ledger-driven reports (July 1 to June 30 cycle)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs cursor-pointer transition-colors"
          >
            <Printer size={15} />
            <span>Print Report</span>
          </button>
          <button
            onClick={fetchReport}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            title="Refresh Report"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 print:hidden">
        {[
          { id: "profit-loss", label: "Profit & Loss (P&L)" },
          { id: "trial-balance", label: "Trial Balance" },
          { id: "cash-book", label: "Cash & Bank Book" },
          { id: "outstanding", label: "Outstanding Khata Balances" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as any)}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
              activeReport === tab.id
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Printable Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h2 className="text-xl font-bold">CLOTHING MANUFACTURING & RETAIL</h2>
        <p className="text-sm font-semibold capitalize">{activeReport.replace("-", " ")} Statement</p>
        <p className="text-xs text-gray-500">
          Financial Year: {reportData?.financialYear?.name || "Current Year"} · Printed on: {new Date().toLocaleDateString("en-PK")}
        </p>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex items-center justify-center bg-white rounded-2xl border border-slate-200">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw size={24} className="animate-spin text-emerald-600" />
            <p className="text-xs font-medium text-slate-500">Compiling financial report from posted ledgers...</p>
          </div>
        </div>
      ) : (
        <>
          {/* 1. PROFIT & LOSS STATEMENT */}
          {activeReport === "profit-loss" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-4xl mx-auto">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Manufacturing Profit & Loss Statement</h3>
                  <p className="text-xs text-slate-500">
                    Period: {reportData?.financialYear?.name || "Current Period"}
                  </p>
                </div>
                <div className={`px-4 py-2 rounded-xl text-sm font-extrabold ${
                  (reportData?.netProfitOrLoss || 0) >= 0 ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                }`}>
                  Net {(reportData?.netProfitOrLoss || 0) >= 0 ? "Profit" : "Loss"}: {formatPKR(reportData?.netProfitOrLoss)}
                </div>
              </div>

              <div className="p-6 space-y-6 text-sm">
                {/* 1.1 Revenue Section */}
                <div>
                  <div className="flex justify-between font-bold text-slate-900 border-b pb-2">
                    <span>1. Sales Revenue & Income</span>
                    <span className="text-emerald-700">{formatPKR(reportData?.revenueTotal)}</span>
                  </div>
                  <div className="divide-y divide-slate-100 pl-4 py-2 text-xs">
                    {reportData?.revenueLines?.length === 0 ? (
                      <p className="text-slate-400 py-1">No sales revenue recognized yet.</p>
                    ) : (
                      reportData?.revenueLines?.map((r: any) => (
                        <div key={r.code} className="flex justify-between py-1.5 text-slate-700">
                          <span>{r.title} ({r.code})</span>
                          <span>{formatPKR(r.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 1.2 Direct Manufacturing Costs (COGS) */}
                <div>
                  <div className="flex justify-between font-bold text-slate-900 border-b pb-2">
                    <span>2. Less: Direct Manufacturing Costs (COGS)</span>
                    <span className="text-rose-600">({formatPKR(reportData?.cogsTotal)})</span>
                  </div>
                  <div className="divide-y divide-slate-100 pl-4 py-2 text-xs">
                    {reportData?.cogsLines?.length === 0 ? (
                      <p className="text-slate-400 py-1">No direct manufacturing costs booked yet.</p>
                    ) : (
                      reportData?.cogsLines?.map((c: any) => (
                        <div key={c.code} className="flex justify-between py-1.5 text-slate-700">
                          <span>{c.title} ({c.code})</span>
                          <span>{formatPKR(c.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Gross Profit Subtotal */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex justify-between font-extrabold text-slate-900">
                  <span>GROSS PROFIT:</span>
                  <span className="text-emerald-700">{formatPKR(reportData?.grossProfit)}</span>
                </div>

                {/* 1.3 Factory & Operating Expenses */}
                <div>
                  <div className="flex justify-between font-bold text-slate-900 border-b pb-2">
                    <span>3. Less: Factory & Operating Overheads</span>
                    <span className="text-rose-600">({formatPKR(reportData?.operatingExpenseTotal)})</span>
                  </div>
                  <div className="divide-y divide-slate-100 pl-4 py-2 text-xs">
                    {reportData?.expenseLines?.length === 0 ? (
                      <p className="text-slate-400 py-1">No operating expenses booked yet.</p>
                    ) : (
                      reportData?.expenseLines?.map((e: any) => (
                        <div key={e.code} className="flex justify-between py-1.5 text-slate-700">
                          <span>{e.title} ({e.code})</span>
                          <span>{formatPKR(e.amount)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Net Profit Final */}
                <div className={`p-4 rounded-xl border flex justify-between font-black text-base ${
                  (reportData?.netProfitOrLoss || 0) >= 0
                    ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                    : "bg-rose-50 border-rose-300 text-rose-900"
                }`}>
                  <span>FINAL NET {(reportData?.netProfitOrLoss || 0) >= 0 ? "PROFIT" : "LOSS"}:</span>
                  <span>{formatPKR(reportData?.netProfitOrLoss)}</span>
                </div>
              </div>
            </div>
          )}

          {/* 2. TRIAL BALANCE */}
          {activeReport === "trial-balance" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-4xl mx-auto">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Trial Balance</h3>
                  <p className="text-xs text-slate-500">Reconciling all debit and credit account balances</p>
                </div>
                <div className="flex items-center gap-2">
                  {reportData?.isBalanced ? (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      <CheckCircle2 size={14} />
                      Books Balanced
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                      <AlertCircle size={14} />
                      Unbalanced
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Code</th>
                      <th className="px-5 py-3">Account Title</th>
                      <th className="px-5 py-3">Category</th>
                      <th className="px-5 py-3 text-right">Debit (Dr)</th>
                      <th className="px-5 py-3 text-right">Credit (Cr)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData?.lines?.map((line: any) => (
                      <tr key={line.code} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-mono font-bold text-slate-800">{line.code}</td>
                        <td className="px-5 py-3 font-semibold text-slate-900">{line.title}</td>
                        <td className="px-5 py-3 text-slate-500 capitalize">{line.rootType}</td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {line.debit > 0 ? formatPKR(line.debit) : "—"}
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {line.credit > 0 ? formatPKR(line.credit) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-extrabold text-sm text-slate-900">
                    <tr>
                      <td colSpan={3} className="px-5 py-3.5 text-right uppercase">
                        Trial Balance Totals:
                      </td>
                      <td className="px-5 py-3.5 text-right text-emerald-700">
                        {formatPKR(reportData?.grandTotalDebit)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-emerald-700">
                        {formatPKR(reportData?.grandTotalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* 3. CASH & BANK BOOK */}
          {activeReport === "cash-book" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden max-w-5xl mx-auto">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Daily Cash & Bank Book</h3>
                  <p className="text-xs text-slate-500">Every cash and bank movement in sequence</p>
                </div>
                <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs">
                  <span className="text-slate-600 block">Current Available Balance:</span>
                  <strong className="text-emerald-700 text-base">{formatPKR(reportData?.closingBalance)}</strong>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Party / Narration</th>
                      <th className="px-4 py-3 text-right text-emerald-700">In-flow (Received)</th>
                      <th className="px-4 py-3 text-right text-rose-700">Out-flow (Paid)</th>
                      <th className="px-4 py-3 text-right">Running Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportData?.rows?.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                          No cash or bank transactions recorded yet.
                        </td>
                      </tr>
                    ) : (
                      reportData?.rows?.map((row: any, i: number) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">
                            {new Date(row.date).toLocaleDateString("en-PK")}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-slate-800">{row.accountTitle}</td>
                          <td className="px-4 py-2.5 text-slate-700 max-w-xs truncate">
                            {row.partyName ? <strong>{row.partyName}: </strong> : null}
                            {row.description}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-emerald-700">
                            {row.inflow > 0 ? formatPKR(row.inflow) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-rose-600">
                            {row.outflow > 0 ? formatPKR(row.outflow) : "—"}
                          </td>
                          <td className="px-4 py-2.5 text-right font-black text-slate-900">
                            {formatPKR(row.balance)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 4. OUTSTANDING KHATA BALANCES */}
          {activeReport === "outstanding" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl mx-auto">
              {/* Suppliers to Pay */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-rose-50/50 border-b border-rose-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-rose-900 text-sm">We Need to Pay (Suppliers & Contractors)</h3>
                    <p className="text-xs text-rose-700/70">{reportData?.payables?.length || 0} parties pending</p>
                  </div>
                  <strong className="text-rose-700 text-base">{formatPKR(reportData?.totalToPay)}</strong>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {reportData?.payables?.map((p: any) => (
                    <div key={p._id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <Link href={`/accounting/parties/${p._id}`} className="font-bold text-slate-900 hover:text-emerald-600 block">
                          {p.name}
                        </Link>
                        <span className="text-slate-400 capitalize">{p.type} {p.phone && `· ${p.phone}`}</span>
                      </div>
                      <span className="font-black text-rose-600 text-sm">{formatPKR(p.netPayable)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customers to Collect From */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-amber-50/50 border-b border-amber-100 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-amber-900 text-sm">We Need to Receive (Customer Receivables)</h3>
                    <p className="text-xs text-amber-700/70">{reportData?.receivables?.length || 0} clients pending</p>
                  </div>
                  <strong className="text-amber-700 text-base">{formatPKR(reportData?.totalToReceive)}</strong>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {reportData?.receivables?.map((p: any) => (
                    <div key={p._id} className="p-3.5 flex items-center justify-between hover:bg-slate-50">
                      <div>
                        <Link href={`/accounting/parties/${p._id}`} className="font-bold text-slate-900 hover:text-emerald-600 block">
                          {p.name}
                        </Link>
                        <span className="text-slate-400 capitalize">{p.type} {p.phone && `· ${p.phone}`}</span>
                      </div>
                      <span className="font-black text-amber-600 text-sm">{formatPKR(p.netPayable)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
