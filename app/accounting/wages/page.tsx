"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
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
  Tag,
  Filter,
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
  const [selectedDesign, setSelectedDesign] = useState<string>("all");
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

  // Reset design filter when department changes
  useEffect(() => {
    setSelectedDesign("all");
  }, [selectedDept]);

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

  // Flatten worker records by design for accurate per-design tracking & job costing
  const displayRows = useMemo(() => {
    if (!departmentData?.workers) return [];

    return departmentData.workers.flatMap((w: any) => {
      const workerAdjustments = w.adjustments || [];
      const totalWorkerAdjustment = workerAdjustments.reduce(
        (s: number, a: any) => s + (a.rate || 0),
        0
      );
      let unabsorbedAdjustment = totalWorkerAdjustment;

      if (w.designs && w.designs.length > 0) {
        return w.designs
          .filter((d: any) => selectedDesign === "all" || d.design === selectedDesign)
          .map((d: any) => {
            const grossPending = d.pendingAmount || 0;
            const adjustmentToApply = Math.min(grossPending, unabsorbedAdjustment);
            unabsorbedAdjustment = Math.max(0, unabsorbedAdjustment - adjustmentToApply);

            const netPendingAmount = Math.max(0, grossPending - adjustmentToApply);

            const designAdjustments = workerAdjustments.filter(
              (a: any) => a.design === d.design
            );
            const displayAdjustments =
              designAdjustments.length > 0
                ? designAdjustments
                : (adjustmentToApply > 0 ? workerAdjustments : []);

            return {
              workerName: w.workerName,
              design: d.design || "General",
              totalPieces: d.totalPieces || (d.paidCount || 0) + (d.pendingCount || 0),
              totalAmount: d.totalAmount || (d.paidAmount || 0) + (d.pendingAmount || 0),
              paidCount: d.paidCount || 0,
              paidAmount: d.paidAmount || 0,
              pendingCount: d.pendingCount || 0,
              pendingAmount: grossPending,
              adjustedAmount: adjustmentToApply,
              netPendingAmount,
              adjustments: displayAdjustments,
              allWorkerAdjustments: workerAdjustments,
              items: d.items || [],
            };
          });
      } else {
        if (selectedDesign !== "all") return [];
        const grossPending = w.pendingAmount || 0;
        const adjustedAmount = Math.min(grossPending, totalWorkerAdjustment);
        const netPendingAmount = Math.max(0, grossPending - adjustedAmount);
        const gross = (w.paidAmount || 0) + grossPending;
        return [
          {
            workerName: w.workerName,
            design: "General",
            totalPieces: w.totalPieces || 0,
            totalAmount: gross,
            paidCount: w.totalPaid || 0,
            paidAmount: w.paidAmount || 0,
            pendingCount: w.totalPending || 0,
            pendingAmount: grossPending,
            adjustedAmount,
            netPendingAmount,
            adjustments: workerAdjustments,
            allWorkerAdjustments: workerAdjustments,
            items: [],
          },
        ];
      }
    });
  }, [departmentData, selectedDesign]);

  // Filtered Totals
  const filteredPending = useMemo(() => {
    if (selectedDesign === "all") {
      return departmentData?.totals?.netPendingAmount ?? departmentData?.totals?.pendingAmount ?? 0;
    }
    return displayRows.reduce((sum: number, r: any) => sum + (r.netPendingAmount || 0), 0);
  }, [selectedDesign, departmentData, displayRows]);

  const filteredPaid = useMemo(() => {
    if (selectedDesign === "all") {
      return departmentData?.totals?.paidAmount || 0;
    }
    return displayRows.reduce((sum: number, r: any) => sum + (r.paidAmount || 0), 0);
  }, [selectedDesign, departmentData, displayRows]);

  // Open Wage Payment Modal
  const openPayWageModal = (row: any) => {
    const gross = row.pendingAmount || 0;
    const adjusted = row.adjustedAmount || 0;
    const netDue = Math.max(0, gross - adjusted);

    const workerObj = departmentData?.workers?.find(
      (w: any) => w.workerName.toLowerCase() === row.workerName.toLowerCase()
    );

    const workerAdjustments =
      row.adjustments && row.adjustments.length > 0
        ? row.adjustments
        : row.allWorkerAdjustments || workerObj?.adjustments || [];

    const cancelledPieces = (workerObj?.cancelledPieces || []).filter(
      (c: any) => selectedDesign === "all" || c.design === row.design
    );

    setSelectedWorkerToPay({
      ...row,
      grossPending: gross,
      totalAdjusted: adjusted,
      netDue,
      adjustments: workerAdjustments,
      cancelledPieces,
    });
    setPayGrossAmount(netDue);
    setReference("");
    setShowPayModal(true);
  };

  // Disburse Wage Handler
  const handleDisburseWage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payGrossAmount > 0 && !payFromAccountId) {
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
          design:
            selectedWorkerToPay.design && selectedWorkerToPay.design !== "General"
              ? selectedWorkerToPay.design
              : undefined,
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
            {selectedDesign !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
                <Tag size={12} />
                {selectedDesign}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 mt-0.5">
            Disburse factory piece-rate wages by design. All payments post verified cash/bank vouchers to the General Ledger with design job costing.
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

      {/* Design Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter size={15} className="text-slate-400" />
            <span>Design Filter:</span>
          </div>
          <select
            value={selectedDesign}
            onChange={(e) => setSelectedDesign(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none cursor-pointer"
          >
            <option value="all">
              All Designs ({departmentData?.availableDesigns?.length || 0})
            </option>
            {departmentData?.availableDesigns?.map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          {selectedDesign !== "all" && (
            <button
              onClick={() => setSelectedDesign("all")}
              className="px-2.5 py-1 text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-md transition-colors cursor-pointer"
            >
              Clear Filter
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <span>
            Showing <strong className="text-slate-900">{displayRows.length}</strong> record(s)
          </span>
          {selectedDesign !== "all" && (
            <span className="inline-flex items-center gap-1 font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 text-[11px]">
              <Tag size={11} />
              {selectedDesign}
            </span>
          )}
        </div>
      </div>

      {/* Department Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Pending Wages ({selectedDept}
            {selectedDesign !== "all" ? ` • ${selectedDesign}` : ""})
          </span>
          <div className="text-2xl font-bold text-amber-700 mt-1">
            {formatPKR(filteredPending)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Across {displayRows.length} active row(s)
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Calculation Basis
          </span>
          <div className="text-base font-bold text-slate-900 mt-1 flex items-center gap-1.5">
            {isCutting ? (
              <Scissors size={18} className="text-rose-600" />
            ) : (
              <Layers size={18} className="text-blue-600" />
            )}
            <span>{isCutting ? "PO Cut Piece Receipts" : "Physical Barcode Scans"}</span>
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            {isCutting ? "Recorded upon PO delivery" : "Scanned on production line"}
          </span>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Already Paid ({selectedDept}
            {selectedDesign !== "all" ? ` • ${selectedDesign}` : ""})
          </span>
          <div className="text-2xl font-bold text-emerald-700 mt-1">
            {formatPKR(filteredPaid)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">Settled wage vouchers</span>
        </div>
      </div>

      {/* Workers Table with Design Column */}
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
            {displayRows.length} Record(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Worker Name</th>
                <th className="px-5 py-3.5">Design</th>
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
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Calculating piece rates and worker earnings...
                  </td>
                </tr>
              ) : displayRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    {selectedDesign !== "all"
                      ? `No records found for design "${selectedDesign}" in ${selectedDept}.`
                      : `No worker records found in ${selectedDept} department yet.`}
                  </td>
                </tr>
              ) : (
                displayRows.map((row: any, idx: number) => {
                  const pending = row.pendingAmount || 0;
                  const gross = (row.paidAmount || 0) + pending;

                  return (
                    <tr
                      key={`${row.workerName}-${row.design}-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {row.workerName}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                          <Tag size={12} className="text-indigo-500" />
                          {row.design || "General"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-slate-600 text-xs">
                        <span className="px-2.5 py-1 rounded bg-slate-100 font-bold">
                          {row.totalPieces || 0} pcs
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-medium text-slate-800">
                        {formatPKR(gross)}
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-700 font-semibold text-xs">
                        {formatPKR(row.paidAmount || 0)}
                      </td>
                      <td className="px-5 py-4 text-right font-extrabold text-slate-900">
                        {row.netPendingAmount > 0 ? (
                          <div>
                            <span className="text-amber-700">{formatPKR(row.netPendingAmount)}</span>
                            {row.adjustedAmount > 0 && (
                              <span className="text-[10px] text-rose-600 font-semibold block">
                                (Less -₨{row.adjustedAmount} defect deduction)
                              </span>
                            )}
                          </div>
                        ) : row.pendingAmount > 0 && row.adjustedAmount >= row.pendingAmount ? (
                          <div>
                            <span className="text-rose-600">₨0</span>
                            <span className="text-[10px] text-rose-600 font-semibold block">
                              (Fully absorbed by defect deduction)
                            </span>
                          </div>
                        ) : (
                          <span className="text-emerald-700">₨0</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        {row.netPendingAmount > 0 ? (
                          <button
                            onClick={() => openPayWageModal(row)}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
                          >
                            Disburse Wage
                          </button>
                        ) : row.pendingAmount > 0 && row.adjustedAmount >= row.pendingAmount ? (
                          <button
                            onClick={() => openPayWageModal(row)}
                            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors inline-flex items-center gap-1"
                          >
                            Settle (₨0)
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
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-slate-500">
                    Dept: <strong className="text-slate-800">{selectedDept}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    <Tag size={11} />
                    {selectedWorkerToPay?.design || "General"}
                  </span>
                </div>
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
                  <span className="text-slate-600">Design:</span>
                  <span className="font-bold text-indigo-700">
                    {selectedWorkerToPay?.design || "General"}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600">Pending Pieces:</span>
                  <span className="font-bold text-slate-900">
                    {selectedWorkerToPay?.pendingCount ??
                      selectedWorkerToPay?.totalPending ??
                      0}{" "}
                    pcs
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-600">Gross Pending Wages:</span>
                  <span className="font-bold text-slate-900">
                    {formatPKR(selectedWorkerToPay?.grossPending ?? selectedWorkerToPay?.pendingAmount ?? 0)}
                  </span>
                </div>

                {selectedWorkerToPay?.totalAdjusted > 0 && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                    <div className="flex justify-between text-rose-800 font-bold">
                      <span>Defect Adjustment Deduction:</span>
                      <span>- {formatPKR(selectedWorkerToPay.totalAdjusted)}</span>
                    </div>
                    <p className="text-[11px] text-rose-600">
                      Deducted for {selectedWorkerToPay.adjustments?.length} previously paid defective piece(s):
                    </p>
                    <div className="max-h-24 overflow-y-auto divide-y divide-rose-200/50 text-[10px] text-rose-700">
                      {selectedWorkerToPay.adjustments?.map((adj: any, i: number) => (
                        <div key={i} className="py-1 flex justify-between">
                          <span>
                            {adj.design} • {adj.item} #{adj.unitNumber}{" "}
                            {adj.reason ? `(${adj.reason})` : ""}
                          </span>
                          <span className="font-semibold">-₨{adj.rate}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedWorkerToPay?.cancelledPieces?.length > 0 && (
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800">
                    ℹ️ {selectedWorkerToPay.cancelledPieces.length} defective piece(s) were cancelled and withheld from payout.
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold">
                  <span className="text-slate-900">Net Amount Paid to Worker:</span>
                  <span className="text-emerald-700 text-base">
                    {formatPKR(payGrossAmount)}
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
                  <span className="text-slate-400 font-normal lowercase">
                    (optional - leave empty if cash)
                  </span>
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
                * Posting will record a wage voucher in the General Ledger tagged with design &quot;{selectedWorkerToPay?.design || "General"}&quot; and mark these pieces as paid.
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
                  className={`px-5 py-2.5 ${
                    payGrossAmount === 0
                      ? "bg-rose-600 hover:bg-rose-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  } text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer`}
                >
                  {submittingPay
                    ? "Posting..."
                    : payGrossAmount === 0
                    ? "Confirm & Settle Wage (₨0.00)"
                    : "Confirm & Disburse Wage"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
