"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  Plus,
  RefreshCw,
  Wallet,
  Building,
  CheckCircle2,
  Calendar,
  X,
  PlusCircle,
  FileText,
  Clock,
  ArrowRight,
} from "lucide-react";
import toast from "react-hot-toast";

interface Party {
  _id: string;
  name: string;
  type: string;
}

interface Account {
  _id: string;
  code: string;
  title: string;
  accountRole: string;
}

interface PaymentRecord {
  _id: string;
  voucherNumber: string;
  type: string;
  transactionDate: string;
  partyId?: { _id: string; name: string };
  totalAmount: number;
  paymentMode: string;
  referenceNumber?: string;
  description: string;
  status: string;
}

interface UnpaidBill {
  _id: string;
  billNumber: string;
  billDate: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  allocatedAmount: number;
}

function PaymentsContent() {
  const searchParams = useSearchParams();
  const preselectedPartyId = searchParams.get("partyId");

  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form
  const [partyId, setPartyId] = useState(preselectedPartyId || "");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "cheque" | "online">("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");

  // Unpaid bills for the selected party
  const [unpaidBills, setUnpaidBills] = useState<UnpaidBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [paymentsRes, partiesRes, accountsRes] = await Promise.all([
        fetch("/api/accounting/payments"),
        fetch("/api/accounting/parties"),
        fetch("/api/accounting/accounts"),
      ]);

      const [paymentsData, partiesData, accountsData] = await Promise.all([
        paymentsRes.json(),
        partiesRes.json(),
        accountsRes.json(),
      ]);

      if (paymentsData.success) setPayments(paymentsData.data || []);
      if (partiesData.success) setParties(partiesData.data || []);
      if (accountsData.success) {
        const cashBank = (accountsData.data.all || []).filter((a: any) =>
          ["cash", "bank"].includes(a.accountRole || "") || a.rootType === "asset"
        );
        setCashBankAccounts(cashBank);
        setPaidFromAccountId((prev) => prev || (cashBank.length > 0 ? cashBank[0]._id : ""));
      }
    } catch {
      toast.error("Failed to load payments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (preselectedPartyId) {
      setPartyId(preselectedPartyId);
      setShowModal(true);
    }
  }, [loadData, preselectedPartyId]);

  // When party changes, fetch their unpaid bills
  useEffect(() => {
    if (!partyId) {
      setUnpaidBills([]);
      return;
    }

    const fetchPartyBills = async () => {
      try {
        setLoadingBills(true);
        const res = await fetch(`/api/accounting/parties/${partyId}`);
        const data = await res.json();
        if (data.success && data.data.unpaidBills) {
          const formatted: UnpaidBill[] = data.data.unpaidBills.map((b: any) => ({
            _id: b._id,
            billNumber: b.billNumber,
            billDate: b.billDate,
            totalAmount: b.totalAmount,
            paidAmount: b.paidAmount || 0,
            remainingAmount: Math.max(0, b.totalAmount - (b.paidAmount || 0)),
            allocatedAmount: 0,
          }));
          setUnpaidBills(formatted);
        }
      } catch {
        console.error("Failed to fetch party bills");
      } finally {
        setLoadingBills(false);
      }
    };

    fetchPartyBills();
  }, [partyId]);

  // Handle bill allocation
  const handleBillAllocationChange = (index: number, val: number) => {
    const updated = [...unpaidBills];
    updated[index].allocatedAmount = val;
    setUnpaidBills(updated);

    const totalAllocated = updated.reduce((sum, b) => sum + (Number(b.allocatedAmount) || 0), 0);
    if (totalAllocated > 0) {
      setAmount(String(totalAllocated));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Please select a party");
      return;
    }
    const payAmt = Number(amount);
    if (!payAmt || payAmt <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }
    if (!paidFromAccountId) {
      toast.error("Please select the cash/bank account paid from");
      return;
    }

    // Prepare bill allocations
    const allocations = unpaidBills
      .filter((b) => b.allocatedAmount > 0)
      .map((b) => ({
        billId: b._id,
        amount: b.allocatedAmount,
      }));

    try {
      setSubmitting(true);
      const res = await fetch("/api/accounting/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId,
          paymentDate,
          amount: payAmt,
          paidFromAccountId,
          paymentMode,
          referenceNumber,
          description: description || `Payment made to party`,
          billAllocations: allocations,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Payment voucher posted!");
        setShowModal(false);
        setAmount("");
        setDescription("");
        setReferenceNumber("");
        loadData();
      } else {
        toast.error(data.error || "Failed to post payment");
      }
    } catch {
      toast.error("An error occurred while saving payment");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPKR = (amt: number = 0) => {
    return "Rs. " + amt.toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Payments Made (CPV & BPV)
          </h1>
          <p className="text-sm text-slate-500">
            Cash & Bank payments made to fabric suppliers, contractors, workers, and bills
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Make a Payment</span>
        </button>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Voucher #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Paid To (Party)</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Mode / Ref #</th>
                <th className="px-5 py-3.5 text-right">Amount Paid</th>
                <th className="px-5 py-3.5 text-center">Khata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading payment records...
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <CreditCard size={32} className="mx-auto mb-2 opacity-40" />
                    No payments recorded yet. Click "Make a Payment" to disburse funds.
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-bold text-slate-900">
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 mr-2 font-mono">
                        {p.type}
                      </span>
                      {p.voucherNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(p.transactionDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {p.partyId ? (
                        <Link
                          href={`/accounting/parties/${p.partyId._id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {p.partyId.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-700 max-w-sm truncate">
                      {p.description}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 capitalize">
                      {p.paymentMode} {p.referenceNumber && `(${p.referenceNumber})`}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-700">
                      {formatPKR(p.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {p.partyId && (
                        <Link
                          href={`/accounting/parties/${p.partyId._id}`}
                          className="text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Khata</span>
                          <ArrowRight size={12} />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Make Payment Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Make a Payment</h3>
                <p className="text-xs text-slate-500">
                  Record Cash (CPV) or Bank (BPV) payment against party & bills
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Paid To (Party) *
                  </label>
                  <select
                    required
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">Select Party</option>
                    {parties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Unpaid Bills Allocation (If party has unpaid bills) */}
              {unpaidBills.length > 0 && (
                <div className="p-3.5 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 block">
                    Allocate to Unpaid Bills ({unpaidBills.length} available)
                  </span>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {unpaidBills.map((b, idx) => (
                      <div
                        key={b._id}
                        className="bg-white p-2.5 rounded-lg border border-amber-200 text-xs flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{b.billNumber}</p>
                          <p className="text-[11px] text-slate-500">
                            Total: {formatPKR(b.totalAmount)} · Remaining:{" "}
                            <strong className="text-rose-600">{formatPKR(b.remainingAmount)}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBillAllocationChange(idx, b.remainingAmount)}
                            className="px-2 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded font-bold text-[11px]"
                          >
                            Full Due
                          </button>
                          <input
                            type="number"
                            min="0"
                            max={b.remainingAmount}
                            placeholder="Rs. to pay"
                            value={b.allocatedAmount || ""}
                            onChange={(e) =>
                              handleBillAllocationChange(idx, Number(e.target.value) || 0)
                            }
                            className="w-28 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-bold text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amount & Account */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Total Amount to Pay (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Pay From (Cash / Bank) *
                  </label>
                  <select
                    required
                    value={paidFromAccountId}
                    onChange={(e) => setPaidFromAccountId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    {cashBankAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.title} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Mode & Reference */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                  >
                    <option value="cash">Cash in Hand</option>
                    <option value="bank">Bank Transfer</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online / UPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Reference / Cheque #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cheque # 40921 or Tx ID"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Narration
                </label>
                <input
                  type="text"
                  placeholder="e.g. Part payment for lawn fabric delivered on credit"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Posting..." : "Confirm & Post Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Payments...</div>}>
      <PaymentsContent />
    </Suspense>
  );
}
