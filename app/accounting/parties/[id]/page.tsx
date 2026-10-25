"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building,
  Phone,
  MapPin,
  Calendar,
  Receipt,
  CreditCard,
  Printer,
  PlusCircle,
  FileText,
  RefreshCw,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react";
import toast from "react-hot-toast";

interface StatementRow {
  id: string;
  date: string;
  voucherNumber: string;
  type: string;
  description: string;
  debit: number;   // Payment made
  credit: number;  // Increase in amount to pay (Bill)
  balance: number; // Running balance
  mode?: string;
}

interface UnpaidBill {
  _id: string;
  billNumber: string;
  billDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  lines: Array<{ description: string; amount: number }>;
}

export default function PartyKhataDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [party, setParty] = useState<any>(null);
  const [statement, setStatement] = useState<StatementRow[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBill[]>([]);

  const fetchStatement = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/accounting/parties/${id}`);
      const data = await res.json();

      if (data.success) {
        setParty(data.data.party);
        setStatement(data.data.statement || []);
        setSummary(data.data.summary || {});
        setUnpaidBills(data.data.unpaidBills || []);
      } else {
        toast.error(data.error || "Failed to load statement");
      }
    } catch {
      toast.error("Failed to connect to server");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStatement();
  }, [fetchStatement]);

  const formatPKR = (amount: number = 0) => {
    return "Rs. " + Math.abs(amount).toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw size={28} className="animate-spin text-emerald-600" />
          <p className="text-sm font-medium text-slate-600">Loading Khata Ledger Statement...</p>
        </div>
      </div>
    );
  }

  if (!party) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
        <p className="text-slate-600">Party not found.</p>
        <Link href="/accounting/parties" className="text-emerald-600 text-sm font-semibold mt-2 inline-block">
          ← Back to Parties List
        </Link>
      </div>
    );
  }

  const isWorker = party.type === "worker";
  const isPayable = (summary?.currentPayableBalance || 0) > 0;
  const isReceivable = !isWorker && (summary?.currentPayableBalance || 0) < 0;
  const isCleared = isWorker ? !isPayable : (summary?.currentPayableBalance || 0) === 0;

  return (
    <div className="space-y-6">
      {/* Top Bar with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/accounting/parties"
            className="p-2 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{party.name}</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-slate-100 text-slate-700 capitalize">
                {party.type}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {isWorker
                ? "Worker Khata Statement of Piece-Rate Wages & Payouts"
                : "Khata Statement of Account & Purchase History"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 shadow-xs cursor-pointer transition-colors"
          >
            <Printer size={15} />
            <span>Print Khata</span>
          </button>
          {isWorker ? (
            <Link
              href="/accounting/wages"
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle size={15} />
              <span>+ Disburse Wages</span>
            </Link>
          ) : (
            <Link
              href={`/accounting/purchases?partyId=${party._id}`}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
            >
              <PlusCircle size={15} />
              <span>+ Record Bill</span>
            </Link>
          )}
          <Link
            href={isWorker ? "/accounting/wages" : `/accounting/payments?partyId=${party._id}`}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-semibold shadow-xs transition-colors"
          >
            <CreditCard size={15} />
            <span>{isWorker ? "Wages Payout" : "+ Make Payment"}</span>
          </Link>
        </div>
      </div>

      {/* Printable Letterhead (Only visible during print) */}
      <div className="hidden print:block text-center border-b pb-4 mb-4">
        <h2 className="text-xl font-bold">CLOTHING MANUFACTURING & RETAIL</h2>
        <p className="text-xs text-gray-500">
          {isWorker ? "Worker Wage Ledger Statement" : "Party Ledger Statement"} — {party.name}
        </p>
        <p className="text-xs text-gray-400">Date: {new Date().toLocaleDateString("en-PK")}</p>
      </div>

      {/* Party Info Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isWorker ? "Worker Contact" : "Party Contact"}
          </span>
          <p className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Phone size={14} className="text-slate-400" />
            {party.phone || "No phone recorded"}
          </p>
          {party.address ? (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <MapPin size={14} className="text-slate-400" />
              {party.address}
            </p>
          ) : party.notes ? (
            <p className="text-xs text-slate-500 mt-1">{party.notes}</p>
          ) : null}
        </div>

        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {isWorker ? "Worker Khata Summary" : "Khata Summary"}
          </span>
          <p className="text-xs text-slate-600 mt-1">
            {isWorker ? "Total Work Earned: " : "Total Purchases: "}
            <strong className="text-slate-900">{formatPKR(summary?.totalBills)}</strong>
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {isWorker ? "Total Wages Paid: " : "Total Paid: "}
            <strong className="text-slate-900">{formatPKR(summary?.totalPaid)}</strong>
          </p>
        </div>

        <div className={`p-4 rounded-xl border ${
          isPayable
            ? "bg-rose-50/60 border-rose-200 text-rose-900"
            : isReceivable
            ? "bg-amber-50/60 border-amber-200 text-amber-900"
            : "bg-emerald-50/60 border-emerald-200 text-emerald-900"
        }`}>
          <span className="text-xs font-semibold uppercase tracking-wider block">
            {isWorker
              ? isPayable
                ? "We Need to Pay (Pending Wages)"
                : "Account Status (Settled)"
              : isPayable
              ? "We Need to Pay (Outstanding)"
              : isReceivable
              ? "We Need to Receive"
              : "Account Status"}
          </span>
          <div className="text-2xl font-black mt-1">
            {isWorker
              ? isPayable
                ? formatPKR(summary?.currentPayableBalance)
                : "Rs. 0 (CLEARED)"
              : isCleared
              ? "Rs. 0 (CLEARED)"
              : formatPKR(summary?.currentPayableBalance)}
          </div>
          <span className="text-xs font-medium block mt-0.5 opacity-80">
            {isWorker
              ? isPayable
                ? "Remaining wages payable to worker for completed work"
                : "All completed work has been fully paid and settled. No advance given."
              : isPayable
              ? "Remaining payable to party"
              : isReceivable
              ? "Advance given / receivable"
              : "All bills and payments settled"}
          </span>
        </div>
      </div>

      {/* Unpaid Bills Section (If any) */}
      {!isWorker && unpaidBills.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200 rounded-2xl p-5 print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-600" />
              <h3 className="font-bold text-amber-900 text-sm">
                Unsettled / Partially Paid Bills ({unpaidBills.length})
              </h3>
            </div>
            <Link
              href={`/accounting/payments?partyId=${party._id}`}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline"
            >
              Pay Selected Bills →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unpaidBills.map((b) => {
              const remaining = Math.max(0, b.totalAmount - (b.paidAmount || 0));
              return (
                <div key={b._id} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-slate-900">{b.billNumber}</span>
                    <span className="text-rose-600 font-extrabold">{formatPKR(remaining)} due</span>
                  </div>
                  <p className="text-slate-500 text-[11px]">
                    Dated: {new Date(b.billDate).toLocaleDateString("en-PK")} · Total: {formatPKR(b.totalAmount)}
                  </p>
                  <p className="text-slate-600 truncate">
                    {b.lines.map((l) => l.description).join(", ")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full Chronological Statement Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900">
              {isWorker ? "Statement of Wages & Work Completed" : "Statement of Account (Khata History)"}
            </h3>
            <p className="text-xs text-slate-500">
              {isWorker
                ? "Every piece-rate wage voucher and work performed recorded in sequence"
                : "Every bill received and payment made in sequence"}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Voucher / Bill #</th>
                <th className="px-5 py-3.5">Description / Narration</th>
                <th className="px-5 py-3.5 text-right text-rose-700">
                  {isWorker ? "Work Earned" : "Increase to Pay (Bill)"}
                </th>
                <th className="px-5 py-3.5 text-right text-emerald-700">
                  {isWorker ? "Wages Paid" : "Payment Made"}
                </th>
                <th className="px-5 py-3.5 text-right">Remaining Balance</th>
                <th className="px-5 py-3.5 text-center">Mode</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statement.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    <FileText size={24} className="mx-auto mb-2 opacity-50" />
                    {isWorker
                      ? "No wage vouchers or work records found for this worker."
                      : "No transactions or bills recorded yet for this party."}
                  </td>
                </tr>
              ) : (
                statement.map((row, index) => (
                  <tr key={row.id || index} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-3.5 font-bold text-slate-900 text-xs">
                      {row.voucherNumber}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 max-w-sm text-xs">
                      {row.description}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-rose-600 text-xs">
                      {row.credit > 0 ? formatPKR(row.credit) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-emerald-600 text-xs">
                      {row.debit > 0 ? formatPKR(row.debit) : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right font-bold text-slate-900 text-xs">
                      {isWorker
                        ? row.balance > 0
                          ? `${formatPKR(row.balance)} (Pending)`
                          : "Cleared"
                        : `${formatPKR(row.balance)} ${
                            row.balance > 0
                              ? "Cr (We owe)"
                              : row.balance < 0
                              ? "Dr (Advance)"
                              : "Cleared"
                          }`}
                    </td>
                    <td className="px-5 py-3.5 text-center text-xs text-slate-500 capitalize">
                      {row.mode || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {statement.length > 0 && (
              <tfoot className="bg-slate-50 font-bold text-xs text-slate-900 border-t border-slate-200">
                <tr>
                  <td colSpan={3} className="px-5 py-3.5 text-right uppercase">
                    Totals & Closing Balance:
                  </td>
                  <td className="px-5 py-3.5 text-right text-rose-600">
                    {formatPKR(summary?.totalBills)}
                  </td>
                  <td className="px-5 py-3.5 text-right text-emerald-600">
                    {formatPKR(summary?.totalPaid)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-extrabold text-sm">
                    {isWorker
                      ? summary?.currentPayableBalance > 0
                        ? formatPKR(summary?.currentPayableBalance)
                        : "Rs. 0 (Settled)"
                      : formatPKR(summary?.currentPayableBalance)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
