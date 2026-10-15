"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Banknote,
  Users,
  Wallet,
  Building,
  RefreshCw,
  PlusCircle,
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  DollarSign,
} from "lucide-react";
import toast from "react-hot-toast";

interface WorkerParty {
  _id: string;
  name: string;
  phone?: string;
  advanceBalance: number;
}

interface Account {
  _id: string;
  title: string;
  code: string;
}

const DEPARTMENTS = [
  "Sewing",
  "Cutting",
  "Patching",
  "Press",
  "Handmade",
  "Adda Work",
  "Quality",
  "Packing",
];

export default function WorkerWagesPage() {
  const [activeTab, setActiveTab] = useState<"wages" | "advances">("wages");
  const [selectedDept, setSelectedDept] = useState("Sewing");
  const [loading, setLoading] = useState(true);
  const [workers, setWorkers] = useState<WorkerParty[]>([]);
  const [departmentData, setDepartmentData] = useState<any>(null);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);

  // Advance Modal State
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceWorkerName, setAdvanceWorkerName] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advancePaidFrom, setAdvancePaidFrom] = useState("");
  const [advanceMode, setAdvanceMode] = useState<"cash" | "bank">("cash");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  // Wage Payout Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedWorkerToPay, setSelectedWorkerToPay] = useState<any>(null);
  const [payGrossAmount, setPayGrossAmount] = useState<number>(0);
  const [payAdvanceDeduct, setPayAdvanceDeduct] = useState<number>(0);
  const [payFromAccountId, setPayFromAccountId] = useState("");
  const [payMode, setPayMode] = useState<"cash" | "bank">("cash");
  const [submittingPay, setSubmittingPay] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [wagesRes, accountsRes] = await Promise.all([
        fetch(`/api/accounting/wages?department=${encodeURIComponent(selectedDept)}`),
        fetch("/api/accounting/accounts"),
      ]);

      const [wagesData, accountsData] = await Promise.all([
        wagesRes.json(),
        accountsRes.json(),
      ]);

      if (wagesData.success) {
        setWorkers(wagesData.data.workers || []);
        setDepartmentData(wagesData.data.departmentData);
      }

      if (accountsData.success) {
        const cashBank = (accountsData.data.all || []).filter((a: any) =>
          ["cash", "bank"].includes(a.accountRole || "")
        );
        setCashBankAccounts(cashBank);
        if (cashBank.length > 0) {
          if (!advancePaidFrom) setAdvancePaidFrom(cashBank[0]._id);
          if (!payFromAccountId) setPayFromAccountId(cashBank[0]._id);
        }
      }
    } catch {
      toast.error("Failed to load worker wage data");
    } finally {
      setLoading(false);
    }
  }, [selectedDept, advancePaidFrom, payFromAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Give Advance Handler
  const handleGiveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advanceWorkerName.trim() || Number(advanceAmount) <= 0) {
      toast.error("Enter worker name and valid advance amount");
      return;
    }

    try {
      setSubmittingAdvance(true);
      const res = await fetch("/api/accounting/wages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "give_advance",
          workerName: advanceWorkerName.trim(),
          department: selectedDept,
          amount: Number(advanceAmount),
          paidFromAccountId: advancePaidFrom,
          paymentMode: advanceMode,
          notes: advanceNotes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Advance given successfully!");
        setShowAdvanceModal(false);
        setAdvanceAmount("");
        setAdvanceWorkerName("");
        setAdvanceNotes("");
        loadData();
      } else {
        toast.error(data.error || "Failed to disburse advance");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmittingAdvance(false);
    }
  };

  // Open Wage Payment Modal
  const openPayWageModal = (worker: any) => {
    const gross = worker.pendingAmount || worker.netPendingAmount || 0;
    const existingAdv = workers.find(
      (w) => w.name.toLowerCase() === worker.workerName.toLowerCase()
    )?.advanceBalance || 0;

    setSelectedWorkerToPay(worker);
    setPayGrossAmount(gross);
    // Suggest deducting either full advance or up to gross wage
    setPayAdvanceDeduct(Math.min(existingAdv, gross));
    setShowPayModal(true);
  };

  // Disburse Wage Handler
  const handleDisburseWage = async (e: React.FormEvent) => {
    e.preventDefault();
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
          advanceDeduction: payAdvanceDeduct,
          paidFromAccountId: payFromAccountId,
          paymentMode: payMode,
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
      toast.error("An error occurred");
    } finally {
      setSubmittingPay(false);
    }
  };

  const formatPKR = (amt: number = 0) => {
    return "Rs. " + Math.max(0, amt).toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const totalAdvancesOutstanding = workers.reduce((sum, w) => sum + (w.advanceBalance || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Worker Wages & Advances (Peshgi)
          </h1>
          <p className="text-sm text-slate-500">
            Reconcile scanned piece wages, deduct advances, and post disbursements
          </p>
        </div>

        <button
          onClick={() => setShowAdvanceModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <PlusCircle size={18} />
          <span>+ Give Worker Advance (Peshgi)</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 border-b border-slate-200">
        <button
          onClick={() => setActiveTab("wages")}
          className={`pb-3 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === "wages"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Department Piece Wages Payouts
        </button>
        <button
          onClick={() => setActiveTab("advances")}
          className={`pb-3 text-sm font-bold border-b-2 cursor-pointer transition-colors ${
            activeTab === "advances"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Worker Advances Ledger ({workers.filter((w) => w.advanceBalance > 0).length} active)
        </button>
      </div>

      {/* TAB 1: DEPARTMENT WAGES */}
      {activeTab === "wages" && (
        <div className="space-y-5">
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
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {formatPKR(departmentData?.totals?.pendingAmount || 0)}
              </div>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Across {departmentData?.workers?.length || 0} active workers
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Total Outstanding Advances (All Workers)
              </span>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {formatPKR(totalAdvancesOutstanding)}
              </div>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Available to adjust against wages
              </span>
            </div>

            <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Already Paid This Week
              </span>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {formatPKR(departmentData?.totals?.paidAmount || 0)}
              </div>
              <span className="text-xs text-slate-500 mt-0.5 block">
                Settled piece scans
              </span>
            </div>
          </div>

          {/* Workers Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                {selectedDept} Department Workers
              </h3>
              <span className="text-xs text-slate-400">
                Data computed from physical barcode scans
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-5 py-3.5">Worker Name</th>
                    <th className="px-5 py-3.5 text-center">Scanned Units</th>
                    <th className="px-5 py-3.5 text-right">Gross Earned</th>
                    <th className="px-5 py-3.5 text-right">Already Paid</th>
                    <th className="px-5 py-3.5 text-right">Current Advance (Loan)</th>
                    <th className="px-5 py-3.5 text-right">Net Pending Wage</th>
                    <th className="px-5 py-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                        Calculating piece rates and worker scans...
                      </td>
                    </tr>
                  ) : !departmentData?.workers || departmentData.workers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                        <Users size={32} className="mx-auto mb-2 opacity-40" />
                        No workers recorded in {selectedDept} department yet.
                      </td>
                    </tr>
                  ) : (
                    departmentData.workers.map((w: any) => {
                      const matchedWorker = workers.find(
                        (wk) => wk.name.toLowerCase() === w.workerName.toLowerCase()
                      );
                      const advBalance = matchedWorker?.advanceBalance || 0;
                      const pending = w.pendingAmount || w.netPendingAmount || 0;

                      return (
                        <tr key={w.workerName} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 font-bold text-slate-900">
                            {w.workerName}
                          </td>
                          <td className="px-5 py-4 text-center text-slate-600 text-xs">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-bold">
                              {w.totalPieces || 0} pcs
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right font-medium text-slate-800">
                            {formatPKR((w.paidAmount || 0) + pending)}
                          </td>
                          <td className="px-5 py-4 text-right text-emerald-700 font-semibold text-xs">
                            {formatPKR(w.paidAmount || 0)}
                          </td>
                          <td className="px-5 py-4 text-right font-bold text-amber-700 text-xs">
                            {advBalance > 0 ? formatPKR(advBalance) : "—"}
                          </td>
                          <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                            {formatPKR(pending)}
                          </td>
                          <td className="px-5 py-4 text-center">
                            {pending > 0 ? (
                              <button
                                onClick={() => openPayWageModal(w)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                              >
                                Disburse Wage
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Cleared</span>
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
        </div>
      )}

      {/* TAB 2: WORKER ADVANCES LEDGER */}
      {activeTab === "advances" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Active Worker Advance Loans</h3>
              <p className="text-xs text-slate-500">
                Advances are recorded as business assets and deducted when paying piece wages
              </p>
            </div>
            <button
              onClick={() => setShowAdvanceModal(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold"
            >
              + Give Advance
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Worker Name</th>
                  <th className="px-5 py-3.5">Contact</th>
                  <th className="px-5 py-3.5 text-right">Outstanding Advance Loan</th>
                  <th className="px-5 py-3.5 text-center">Khata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.filter((w) => w.advanceBalance > 0).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-slate-400">
                      <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                      No workers currently have outstanding advances. All loans are cleared!
                    </td>
                  </tr>
                ) : (
                  workers
                    .filter((w) => w.advanceBalance > 0)
                    .map((w) => (
                      <tr key={w._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4 font-bold text-slate-900">{w.name}</td>
                        <td className="px-5 py-4 text-xs text-slate-500">{w.phone || "—"}</td>
                        <td className="px-5 py-4 text-right font-black text-rose-600">
                          {formatPKR(w.advanceBalance)}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <Link
                            href={`/accounting/parties/${w._id}`}
                            className="text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1"
                          >
                            <span>Open Khata</span>
                            <ArrowRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Give Advance (Peshgi) */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Give Worker Advance</h3>
                <p className="text-xs text-slate-500">Record loan without double-counting as an expense</p>
              </div>
              <button
                onClick={() => setShowAdvanceModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGiveAdvance} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Worker Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rashid (Sewing), Hamza Master"
                  value={advanceWorkerName}
                  onChange={(e) => setAdvanceWorkerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Advance Amount (Rs.) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 5000"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Disbursed From
                  </label>
                  <select
                    value={advancePaidFrom}
                    onChange={(e) => setAdvancePaidFrom(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
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
                    value={advanceMode}
                    onChange={(e) => setAdvanceMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Advance requested before weekend"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdvance}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {submittingAdvance ? "Disbursing..." : "Disburse Advance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Disburse Wage with Advance Deduction */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">
                  Disburse Wages: {selectedWorkerToPay?.workerName}
                </h3>
                <p className="text-xs text-slate-500">Department: {selectedDept}</p>
              </div>
              <button
                onClick={() => setShowPayModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDisburseWage} className="p-5 space-y-4">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Wage Earned:</span>
                  <span className="font-bold text-slate-900">{formatPKR(payGrossAmount)}</span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <span className="text-amber-800 font-semibold">Deduct Advance (Peshgi):</span>
                  <input
                    type="number"
                    min="0"
                    max={payGrossAmount}
                    value={payAdvanceDeduct}
                    onChange={(e) => setPayAdvanceDeduct(Number(e.target.value) || 0)}
                    className="w-24 text-right px-2 py-1 bg-white border border-amber-300 rounded font-bold text-xs text-amber-800"
                  />
                </div>

                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold">
                  <span className="text-slate-900">Net Cash Handed to Worker:</span>
                  <span className="text-emerald-700">
                    {formatPKR(payGrossAmount - payAdvanceDeduct)}
                  </span>
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
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
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
              </div>

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
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
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
