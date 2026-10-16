"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Wallet,
  RefreshCw,
  X,
  CheckCircle2,
  DollarSign,
  Scissors,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import toast from "react-hot-toast";

interface WorkerParty {
  _id: string;
  name: string;
  phone?: string;
}

interface Account {
  _id: string;
  title: string;
  code: string;
}

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Overlock",
  "Clipping",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

export default function WorkerWagesPage() {
  const [selectedDept, setSelectedDept] = useState("Cutting");
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<WorkerParty[]>([]);
  const [departmentData, setDepartmentData] = useState<any>(null);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

  // Wage Payout Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedWorkerToPay, setSelectedWorkerToPay] = useState<any>(null);
  const [payGrossAmount, setPayGrossAmount] = useState<number>(0);
  const [payFromAccountId, setPayFromAccountId] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "bank" | "cheque">("cash");
  const [reference, setReference] = useState("");
  const [submittingPay, setSubmittingPay] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [piecesRes, accountsRes] = await Promise.all([
        fetch(`/api/payment/worker-pieces?department=${encodeURIComponent(selectedDept)}&_t=${Date.now()}`, {
          cache: "no-store",
        }),
        fetch(`/api/accounting/accounts?_t=${Date.now()}`, {
          cache: "no-store",
        }),
      ]);

      const [piecesData, accountsData] = await Promise.all([
        piecesRes.json(),
        accountsRes.json(),
      ]);

      if (piecesData.success) {
        setDepartmentData(piecesData.data);
      } else {
        setDepartmentData(null);
      }

      if (accountsData.success) {
        const cashBank = (accountsData.data.all || []).filter((a: any) =>
          ["cash", "bank"].includes(a.accountRole || "") || a.rootType === "asset"
        );
        setCashBankAccounts(cashBank);
        if (cashBank.length > 0 && !payFromAccountId) {
          setPayFromAccountId(cashBank[0]._id);
        }
      }
    } catch {
      toast.error("Failed to load worker wage data");
    } finally {
      setLoading(false);
    }
  }, [selectedDept, payFromAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Wage Payment Modal
  const openPayWageModal = (worker: any) => {
    const gross = worker.pendingAmount ?? worker.netPendingAmount ?? 0;
    setSelectedWorkerToPay(worker);
    setPayGrossAmount(gross);
    setReference("");
    setShowPayModal(true);
  };

  // Disburse Wage Handler
  const handleDisburseWage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payFromAccountId) {
      toast.error("Select a Cash or Bank account to disburse from");
      return;
    }

    try {
      setSubmittingPay(true);
      const res = await fetch("/api/accounting/wages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pay_wages",
          workerName: selectedWorkerToPay.workerName,
          department: selectedDept,
          amount: payGrossAmount,
          paidFromAccountId: payFromAccountId,
          paymentMode: payMode,
          reference: reference.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Wages recorded & voucher posted!");
        setShowPayModal(false);
        loadData();
      } else {
        toast.error(data.error || "Failed to disburse wages");
      }
    } catch {
      toast.error("An error occurred while disbursing wages");
    } finally {
      setSubmittingPay(false);
    }
  };

  const formatPKR = (amt: number = 0) => {
    return "₨" + Math.max(0, amt).toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const isCutting = selectedDept === "Cutting";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Worker Wages Payouts
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
              {selectedDept}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Disburse factory piece-rate wages. All payments post verified cash/bank vouchers to the General Ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/payments"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <span>View Production Ledger</span>
            <ArrowUpRight size={14} />
          </Link>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-xs cursor-pointer transition-colors"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Policy Banner: Item Scans vs PO Receiving */}
      <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-950">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0 mt-0.5 sm:mt-0">
            {isCutting ? <Scissors size={16} /> : <Layers size={16} />}
          </div>
          <div>
            <span className="font-bold">
              {isCutting ? "Cutting Master Wage Policy:" : "Production Workers Wage Policy:"}{" "}
            </span>
            <span className="text-emerald-800">
              {isCutting
                ? "Cutting Master payment is calculated from cut pieces received after entering Purchase Orders (PO) in the system. Advance payments are disabled."
                : "Worker payment is calculated strictly based on items scanned. Payouts post CPV/BPV wage vouchers directly to Accounting."}
            </span>
          </div>
        </div>
        <span className="font-mono text-[11px] text-emerald-700 bg-white px-2 py-1 rounded border border-emerald-200 whitespace-nowrap">
          {isCutting ? "Basis: PO Cut Receipts" : "Basis: Item Scans"}
        </span>
      </div>

      {/* Department Selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {DEPARTMENTS.map((dept) => (
          <button
            key={dept}
            onClick={() => setSelectedDept(dept)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap cursor-pointer transition-all ${
              selectedDept === dept
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            {dept === "Cutting" && "✂️ "}
            {dept}
          </button>
        ))}
      </div>

      {/* Department Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Pending Wages ({selectedDept})
          </span>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {formatPKR(departmentData?.totals?.pendingAmount || 0)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Across {departmentData?.workers?.length || 0} active {isCutting ? "cutting master(s)" : "workers"}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Calculation Basis
          </span>
          <div className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            {isCutting ? <Scissors size={18} className="text-rose-600" /> : <Layers size={18} className="text-blue-600" />}
            <span>{isCutting ? "PO Cut Piece Receipts" : "Physical Barcode Scans"}</span>
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            {isCutting ? "Recorded upon PO delivery" : "Scanned on production line"}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Already Paid ({selectedDept})
          </span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {formatPKR(departmentData?.totals?.paidAmount || 0)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Settled wage vouchers
          </span>
        </div>
      </div>

      {/* Workers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">
              {selectedDept} {isCutting ? "Master Payouts" : "Workers"}
            </h3>
            <p className="text-xs text-slate-400">
              {isCutting
                ? "Calculated from cut pieces logged upon receiving items from cutting master on POs"
                : "Calculated from completed item barcode scans by each worker"}
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500">
            {departmentData?.workers?.length || 0} Record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Worker Name</th>
                <th className="px-5 py-3.5 text-center">
                  {isCutting ? "Received Cut Units" : "Scanned Units"}
                </th>
                <th className="px-5 py-3.5 text-right">Gross Earned</th>
                <th className="px-5 py-3.5 text-right">Already Paid</th>
                <th className="px-5 py-3.5 text-right">Net Due Payout</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Calculating piece rates and worker earnings...
                  </td>
                </tr>
              ) : !departmentData?.workers || departmentData.workers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    No worker records found in {selectedDept} department yet.
                  </td>
                </tr>
              ) : (
                departmentData.workers.map((w: any) => {
                  const pending = w.pendingAmount ?? w.netPendingAmount ?? 0;
                  const gross = (w.paidAmount || 0) + pending;

                  return (
                    <tr key={w.workerName} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {w.workerName}
                      </td>
                      <td className="px-5 py-4 text-center text-slate-600 text-xs">
                        <span className="px-2.5 py-1 rounded bg-slate-100 font-bold">
                          {w.totalPieces || 0} pcs
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-800">
                        {formatPKR(gross)}
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-700 font-semibold text-xs">
                        {formatPKR(w.paidAmount || 0)}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                        {pending > 0 ? (
                          <span className="text-amber-700">{formatPKR(pending)}</span>
                        ) : (
                          <span className="text-emerald-700">₨0</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {pending > 0 ? (
                          <button
                            onClick={() => openPayWageModal(w)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                          >
                            Disburse Wage
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-bold px-3 py-1 bg-emerald-100 rounded-full border border-emerald-300 shadow-2xs">
                            <CheckCircle2 size={13} className="text-emerald-700" />
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Disburse Wage (Direct Cash/Bank Voucher) */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Disburse Wages: {selectedWorkerToPay?.workerName}
                </h3>
                <p className="text-xs text-slate-500">
                  Department: <strong className="text-slate-800">{selectedDept}</strong>
                </p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDisburseWage} className="p-5 space-y-4">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Pending Pieces:</span>
                  <span className="font-bold text-slate-900">
                    {selectedWorkerToPay?.totalPending ?? selectedWorkerToPay?.pendingCount ?? 0} pcs
                  </span>
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold">
                  <span className="text-slate-900">Net Amount Paid to Worker:</span>
                  <span className="text-emerald-700 text-base">{formatPKR(payGrossAmount)}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Disbursed From
                  </label>
                  <select
                    value={payFromAccountId}
                    onChange={(e) => setPayFromAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    {cashBankAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Reference / Cheque No.{" "}
                  <span className="text-slate-400 font-normal lowercase">(optional - leave empty if cash)</span>
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={
                    payMode === "cheque"
                      ? "Enter Cheque Number (e.g. CHQ-98421)"
                      : payMode === "bank"
                      ? "e.g. Transaction Ref / Cheque No."
                      : "Leave empty if paid by cash (optional)"
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none placeholder:text-slate-400"
                />
              </div>

              <p className="text-[11px] text-slate-400 italic">
                * Posting will record a wage voucher in the General Ledger and mark these production pieces as paid.
              </p>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPay}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submittingPay ? "Posting..." : "Confirm & Disburse Wage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
