"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  Plus,
  Trash2,
  FileText,
  Building,
  RefreshCw,
  PlusCircle,
  X,
  Calendar,
  CheckCircle,
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
  rootType: string;
}

interface BillLineItem {
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  accountId: string;
  amount: number;
}

interface BillRecord {
  _id: string;
  billNumber: string;
  supplierInvoiceNumber?: string;
  partyId: { _id: string; name: string };
  billDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: "unpaid" | "partially_paid" | "paid";
  lines: Array<{ description: string; quantity: number; amount: number }>;
}

function PurchasesContent() {
  const searchParams = useSearchParams();
  const preselectedPartyId = searchParams.get("partyId");

  const [bills, setBills] = useState<BillRecord[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [partyId, setPartyId] = useState(preselectedPartyId || "");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [billType, setBillType] = useState<"purchase" | "service">("purchase");
  const [paymentOption, setPaymentOption] = useState<"later" | "now">("later");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "cheque" | "online">("cash");
  const [taxAmount, setTaxAmount] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<BillLineItem[]>([
    { description: "", quantity: 1, unit: "meters", rate: 0, accountId: "", amount: 0 },
  ]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [billsRes, partiesRes, accountsRes] = await Promise.all([
        fetch("/api/accounting/bills"),
        fetch("/api/accounting/parties"),
        fetch("/api/accounting/accounts"),
      ]);

      const [billsData, partiesData, accountsData] = await Promise.all([
        billsRes.json(),
        partiesRes.json(),
        accountsRes.json(),
      ]);

      if (billsData.success) setBills(billsData.data || []);
      if (partiesData.success) setParties(partiesData.data || []);
      if (accountsData.success) {
        const allAccs: Account[] = accountsData.data.all || [];
        setAccounts(allAccs);
        const cashBank = allAccs.filter((a) =>
          ["cash", "bank"].includes((a as any).accountRole || "")
        );
        setCashBankAccounts(cashBank);
        setPaidFromAccountId((prev) => prev || (cashBank.length > 0 ? cashBank[0]._id : ""));
      }
    } catch {
      toast.error("Failed to load purchase bills");
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

  // Recalculate line amounts
  const handleLineChange = (index: number, field: keyof BillLineItem, value: any) => {
    const updated = [...lines];
    (updated[index] as any)[field] = value;

    if (field === "quantity" || field === "rate") {
      const qty = Number(field === "quantity" ? value : updated[index].quantity) || 0;
      const rate = Number(field === "rate" ? value : updated[index].rate) || 0;
      updated[index].amount = qty * rate;
    }

    setLines(updated);
  };

  const addLine = () => {
    setLines([
      ...lines,
      { description: "", quantity: 1, unit: "meters", rate: 0, accountId: "", amount: 0 },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length === 1) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const subtotal = lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const totalAmount = subtotal + (Number(taxAmount) || 0) + (Number(otherCharges) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyId) {
      toast.error("Please select a supplier");
      return;
    }
    if (lines.some((l) => !l.description.trim() || l.amount <= 0)) {
      toast.error("Please enter item description and valid rate/amount for all lines");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/accounting/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId,
          billDate,
          supplierInvoiceNumber,
          billType,
          lines,
          subtotal,
          taxAmount: Number(taxAmount) || 0,
          otherCharges: Number(otherCharges) || 0,
          totalAmount,
          isPaidImmediately: paymentOption === "now",
          paidFromAccountId: paymentOption === "now" ? paidFromAccountId : undefined,
          paymentMode: paymentOption === "now" ? paymentMode : undefined,
          notes,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Bill recorded successfully!");
        setShowModal(false);
        // Reset
        setLines([{ description: "", quantity: 1, unit: "meters", rate: 0, accountId: "", amount: 0 }]);
        setSupplierInvoiceNumber("");
        setNotes("");
        loadData();
      } else {
        toast.error(data.error || "Failed to record bill");
      }
    } catch {
      toast.error("An error occurred while saving bill");
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
            Purchases & Supplier Bills
          </h1>
          <p className="text-sm text-slate-500">
            Record fabric purchases, trims, raw material invoices & bills
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Record New Purchase Bill</span>
        </button>
      </div>

      {/* Bills Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Bill #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Supplier (Party)</th>
                <th className="px-5 py-3.5">Items Summary</th>
                <th className="px-5 py-3.5 text-right">Total Amount</th>
                <th className="px-5 py-3.5 text-right">Paid Amount</th>
                <th className="px-5 py-3.5 text-right">Status</th>
                <th className="px-5 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading purchase bills...
                  </td>
                </tr>
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-slate-400">
                    <ShoppingCart size={32} className="mx-auto mb-2 opacity-40" />
                    No purchase bills recorded yet. Click "Record New Purchase Bill" above.
                  </td>
                </tr>
              ) : (
                bills.map((bill) => {
                  const remaining = Math.max(0, bill.totalAmount - (bill.paidAmount || 0));
                  return (
                    <tr key={bill._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 font-bold text-slate-900">
                        {bill.billNumber}
                        {bill.supplierInvoiceNumber && (
                          <span className="block text-[11px] font-normal text-slate-400">
                            Inv: {bill.supplierInvoiceNumber}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                        {new Date(bill.billDate).toLocaleDateString("en-PK")}
                      </td>
                      <td className="px-5 py-4 font-medium text-slate-900">
                        <Link
                          href={`/accounting/parties/${bill.partyId?._id}`}
                          className="hover:text-emerald-600 hover:underline"
                        >
                          {bill.partyId?.name || "Unknown Supplier"}
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-xs text-slate-600 max-w-xs truncate">
                        {bill.lines.map((l) => l.description).join(", ")}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-900">
                        {formatPKR(bill.totalAmount)}
                      </td>
                      <td className="px-5 py-4 text-right text-emerald-700 font-semibold text-xs">
                        {formatPKR(bill.paidAmount || 0)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {bill.paymentStatus === "paid" ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                            Paid
                          </span>
                        ) : bill.paymentStatus === "partially_paid" ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">
                            Partially Paid ({formatPKR(remaining)} due)
                          </span>
                        ) : (
                          <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800">
                            Unpaid ({formatPKR(remaining)} due)
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <Link
                          href={`/accounting/parties/${bill.partyId?._id}`}
                          className="text-xs font-semibold text-emerald-600 hover:underline inline-flex items-center gap-1"
                        >
                          <span>Khata</span>
                          <ArrowRight size={12} />
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

      {/* Record Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-3xl my-8 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Record Purchase Bill</h3>
                <p className="text-xs text-slate-500">Fabric, trims, accessories or raw materials</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Top Row: Supplier, Date, Invoice # */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Supplier (Party) *
                  </label>
                  <select
                    required
                    value={partyId}
                    onChange={(e) => setPartyId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  >
                    <option value="">Select Supplier</option>
                    {parties.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Bill Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Supplier Bill/Inv #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BS-904"
                    value={supplierInvoiceNumber}
                    onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Purchase Line Items
                  </span>
                  <button
                    type="button"
                    onClick={addLine}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>+ Add Line</span>
                  </button>
                </div>

                <div className="p-3 space-y-2.5">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-5">
                        <input
                          type="text"
                          required
                          placeholder="Item name (e.g. 50m Lawn Fabric Design 102)"
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Rate"
                          value={line.rate}
                          onChange={(e) => handleLineChange(idx, "rate", e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <div className="px-2.5 py-1.5 text-xs font-bold text-slate-900 bg-slate-100 rounded-lg text-right">
                          {formatPKR(line.amount)}
                        </div>
                      </div>
                      <div className="col-span-1 text-center">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Payment Option */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                {/* Left: Payment Option */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    Payment Terms
                  </span>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="payOption"
                        checked={paymentOption === "later"}
                        onChange={() => setPaymentOption("later")}
                      />
                      <span>Pay Later (On Credit)</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="payOption"
                        checked={paymentOption === "now"}
                        onChange={() => setPaymentOption("now")}
                      />
                      <span>Pay Immediately</span>
                    </label>
                  </div>

                  {paymentOption === "now" && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Paid From</label>
                        <select
                          value={paidFromAccountId}
                          onChange={(e) => setPaidFromAccountId(e.target.value)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          {cashBankAccounts.map((a) => (
                            <option key={a._id} value={a._id}>
                              {a.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-600 mb-1">Mode</label>
                        <select
                          value={paymentMode}
                          onChange={(e) => setPaymentMode(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                        >
                          <option value="cash">Cash</option>
                          <option value="bank">Bank Transfer</option>
                          <option value="cheque">Cheque</option>
                          <option value="online">Online</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Bill Totals */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="font-bold">{formatPKR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">Other Charges / Freight:</span>
                    <input
                      type="number"
                      min="0"
                      value={otherCharges}
                      onChange={(e) => setOtherCharges(e.target.value)}
                      className="w-24 text-right px-2 py-0.5 bg-white border border-slate-200 rounded text-xs"
                    />
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-extrabold text-slate-900">
                    <span>Total Bill:</span>
                    <span className="text-emerald-700">{formatPKR(totalAmount)}</span>
                  </div>
                </div>
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
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? "Saving Bill..." : "Record Bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PurchasesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Loading Purchases...</div>}>
      <PurchasesContent />
    </Suspense>
  );
}
