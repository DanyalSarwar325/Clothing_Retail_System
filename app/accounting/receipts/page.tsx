"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  Plus,
  RefreshCw,
  Wallet,
  Building,
  Calendar,
  X,
  CreditCard,
  CheckCircle2,
  FileText,
  User,
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
  rootType: string;
}

interface ReceiptRecord {
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

function ReceiptsContent() {
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [partyId, setPartyId] = useState("");
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [depositAccountId, setDepositAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "cheque" | "online">("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [receiptsRes, partiesRes, accountsRes] = await Promise.all([
        fetch("/api/accounting/receipts"),
        fetch("/api/accounting/parties"),
        fetch("/api/accounting/accounts"),
      ]);

      const [receiptsData, partiesData, accountsData] = await Promise.all([
        receiptsRes.json(),
        partiesRes.json(),
        accountsRes.json(),
      ]);

      if (receiptsData.success) setReceipts(receiptsData.data || []);
      if (partiesData.success) setParties(partiesData.data || []);
      if (accountsData.success) {
        const allAccs: Account[] = accountsData.data.all || [];
        const cashBank = allAccs.filter((a) =>
          ["cash", "bank"].includes(a.accountRole || "") || a.rootType === "asset"
        );
        setCashBankAccounts(cashBank);
        setDepositAccountId((prev) => prev || (cashBank.length > 0 ? cashBank[0]._id : ""));

        // Accounts that can be credited (Revenue, Capital/Equity, Receivables/Assets)
        const creditList = allAccs.filter((a) =>
          ["revenue", "equity", "asset"].includes(a.rootType)
        );
        setCreditAccounts(creditList);
        const defaultReceivable = creditList.find((a) => a.accountRole === "accountsReceivable");
        if (defaultReceivable) {
          setCreditAccountId((prev) => prev || defaultReceivable._id);
        }
      }
    } catch {
      toast.error("Failed to load receipts data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const rAmt = Number(amount);
    if (!rAmt || rAmt <= 0) {
      toast.error("Please enter a valid receipt amount");
      return;
    }
    if (!depositAccountId) {
      toast.error("Please select cash or bank account to deposit into");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/accounting/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: partyId || undefined,
          receiptDate,
          amount: rAmt,
          depositAccountId,
          creditAccountId: creditAccountId || undefined,
          paymentMode,
          referenceNumber,
          description: description || `Money received`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Receipt recorded successfully!");
        setShowModal(false);
        setAmount("");
        setDescription("");
        setReferenceNumber("");
        loadData();
      } else {
        toast.error(data.error || "Failed to record receipt");
      }
    } catch {
      toast.error("An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPKR = (amt: number = 0) => {
    return "Rs. " + amt.toLocaleString("en-PK", { maximumFractionDigits: 0 });
  };

  const totalReceiptsAmount = receipts.reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Money Received (CRV & BRV)
          </h1>
          <p className="text-sm text-slate-500">
            Cash & Bank receipts from customers, wholesale collections, advance returns, and scrap sales
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Record Money Received</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Money Received Recorded
          </span>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {formatPKR(totalReceiptsAmount)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Across {receipts.length} recorded receipt vouchers
          </span>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
          <ArrowDownLeft size={24} />
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Voucher #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Received From</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5">Mode / Ref #</th>
                <th className="px-5 py-3.5 text-right">Amount Received</th>
                <th className="px-5 py-3.5 text-center">Khata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading receipt vouchers...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <ArrowDownLeft size={32} className="mx-auto mb-2 opacity-40" />
                    No receipts recorded yet. Click "Record Money Received" to add incoming funds.
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      <span className="text-xs px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold mr-2">
                        {r.type}
                      </span>
                      {r.voucherNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(r.transactionDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {r.partyId ? (
                        <Link
                          href={`/accounting/parties/${r.partyId._id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {r.partyId.name}
                        </Link>
                      ) : (
                        <span className="text-slate-500 text-xs">General Customer / Sales</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-700 max-w-sm truncate">
                      {r.description}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 capitalize">
                      {r.paymentMode} {r.referenceNumber && `(${r.referenceNumber})`}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-emerald-700">
                      {formatPKR(r.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {r.partyId && (
                        <Link
                          href={`/accounting/parties/${r.partyId._id}`}
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

      {/* Record Receipt Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Record Money Received</h3>
                <p className="text-xs text-slate-500">Customer payments, wholesale sales, return of advance</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Received From (Party)
                  </label>
                  <select
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="">General / Walk-in Customer</option>
                    {parties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Amount Received (Rs.) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-extrabold text-slate-900 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Deposited Into (Cash / Bank) *
                  </label>
                  <select
                    required
                    value={depositAccountId}
                    onChange={(e) => setDepositAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    {cashBankAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.title} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Account to Credit (Offset)
                  </label>
                  <select
                    value={creditAccountId}
                    onChange={(e) => setCreditAccountId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    {creditAccounts.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.title} ({a.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  >
                    <option value="cash">Cash in Hand (CRV)</option>
                    <option value="bank">Bank Transfer (BRV)</option>
                    <option value="cheque">Cheque</option>
                    <option value="online">Online / UPI</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Reference / Slip #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bank slip or Tx ID"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Narration / Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Payment for wholesale batch # 42 or invoice settlement"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>

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
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Posting..." : "Record Receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReceiptsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Receipts...</div>}>
      <ReceiptsContent />
    </Suspense>
  );
}
