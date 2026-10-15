"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Receipt,
  Plus,
  RefreshCw,
  Wallet,
  Building,
  Calendar,
  X,
  PlusCircle,
  FileText,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

interface Account {
  _id: string;
  code: string;
  title: string;
  rootType: string;
}

interface ExpenseRecord {
  _id: string;
  billNumber: string;
  partyId?: { _id: string; name: string };
  billDate: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  lines: Array<{ description: string; amount: number; accountId?: { title: string; code: string } }>;
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [expenseAccounts, setExpenseAccounts] = useState<Account[]>([]);
  const [cashBankAccounts, setCashBankAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [paidToName, setPaidToName] = useState("");
  const [paidFromAccountId, setPaidFromAccountId] = useState("");
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank" | "cheque" | "online">("cash");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [paymentOption, setPaymentOption] = useState<"now" | "later">("now");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [accountsRes, billsRes] = await Promise.all([
        fetch("/api/accounting/accounts"),
        fetch("/api/accounting/bills?billType=service"),
      ]);

      const [accountsData, billsData] = await Promise.all([
        accountsRes.json(),
        billsRes.json(),
      ]);

      if (accountsData.success) {
        const allAccs: Account[] = accountsData.data.all || [];
        const expHeads = allAccs.filter((a) =>
          ["indirectExpense", "directExpense"].includes(a.rootType)
        );
        setExpenseAccounts(expHeads);
        setSelectedAccountId((prev) => prev || (expHeads.length > 0 ? expHeads[0]._id : ""));

        const cashBank = allAccs.filter((a) =>
          ["cash", "bank"].includes((a as any).accountRole || "") || a.rootType === "asset"
        );
        setCashBankAccounts(cashBank);
        setPaidFromAccountId((prev) => prev || (cashBank.length > 0 ? cashBank[0]._id : ""));
      }

      if (billsData.success) {
        setExpenses(billsData.data || []);
      }
    } catch {
      toast.error("Failed to load factory expenses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expAmt = Number(amount);
    if (!expAmt || expAmt <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }
    if (!selectedAccountId) {
      toast.error("Please select an expense head");
      return;
    }

    try {
      setSubmitting(true);

      // Find or create a Service Provider party if paidToName is entered
      let targetPartyId = "";
      if (paidToName.trim()) {
        const partyRes = await fetch("/api/accounting/parties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: paidToName.trim(),
            type: "serviceProvider",
          }),
        });
        const partyData = await partyRes.json();
        if (partyData.success && partyData.data?._id) {
          targetPartyId = partyData.data._id;
        }
      }

      // If no party name, use a default general party or find first serviceProvider
      if (!targetPartyId) {
        const partiesRes = await fetch("/api/accounting/parties?type=serviceProvider");
        const partiesData = await partiesRes.json();
        if (partiesData.data && partiesData.data.length > 0) {
          targetPartyId = partiesData.data[0]._id;
        } else {
          // Create general service provider party
          const genParty = await fetch("/api/accounting/parties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: "General Factory Expenses",
              type: "serviceProvider",
            }),
          });
          const genData = await genParty.json();
          targetPartyId = genData.data._id;
        }
      }

      const selectedHead = expenseAccounts.find((a) => a._id === selectedAccountId);

      const res = await fetch("/api/accounting/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partyId: targetPartyId,
          billDate: expenseDate,
          supplierInvoiceNumber: referenceNumber,
          billType: "service",
          lines: [
            {
              description: description || `${selectedHead?.title || "Expense"} payment`,
              quantity: 1,
              rate: expAmt,
              amount: expAmt,
              accountId: selectedAccountId,
            },
          ],
          subtotal: expAmt,
          totalAmount: expAmt,
          isPaidImmediately: paymentOption === "now",
          paidFromAccountId: paymentOption === "now" ? paidFromAccountId : undefined,
          paymentMode: paymentOption === "now" ? paymentMode : undefined,
          notes: description,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Expense recorded successfully!");
        setShowModal(false);
        setAmount("");
        setDescription("");
        setPaidToName("");
        setReferenceNumber("");
        loadData();
      } else {
        toast.error(data.error || "Failed to record expense");
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

  const totalRecognizedExpenses = expenses.reduce((sum, e) => sum + e.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Factory & Operating Expenses
          </h1>
          <p className="text-sm text-slate-500">
            Rent, electricity/WAPDA, generator fuel, machine repairs, food & supplies
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-xs cursor-pointer transition-colors"
        >
          <Plus size={18} />
          <span>Record Factory Expense</span>
        </button>
      </div>

      {/* Summary Card */}
      <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Recognized Operating Expenses
          </span>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {formatPKR(totalRecognizedExpenses)}
          </div>
          <span className="text-xs text-slate-500 mt-0.5 block">
            Across {expenses.length} recorded expense vouchers
          </span>
        </div>
        <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl">
          <Receipt size={24} />
        </div>
      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider border-b border-slate-100">
              <tr>
                <th className="px-5 py-3.5">Bill #</th>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Expense Head</th>
                <th className="px-5 py-3.5">Paid To / Payee</th>
                <th className="px-5 py-3.5">Description</th>
                <th className="px-5 py-3.5 text-right">Amount</th>
                <th className="px-5 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <RefreshCw size={24} className="mx-auto mb-2 animate-spin text-emerald-600" />
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <Receipt size={32} className="mx-auto mb-2 opacity-40" />
                    No expenses recorded yet. Click "Record Factory Expense" to add one.
                  </td>
                </tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-slate-900 text-xs">
                      {exp.billNumber}
                    </td>
                    <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                      {new Date(exp.billDate).toLocaleDateString("en-PK")}
                    </td>
                    <td className="px-5 py-4 font-semibold text-slate-900">
                      {exp.lines[0]?.accountId?.title || "Operating Expense"}
                    </td>
                    <td className="px-5 py-4 text-slate-700 text-xs font-medium">
                      {exp.partyId?.name || "General"}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-600 max-w-sm truncate">
                      {exp.lines.map((l) => l.description).join(", ")}
                    </td>
                    <td className="px-5 py-4 text-right font-black text-slate-900">
                      {formatPKR(exp.totalAmount)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        exp.paymentStatus === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}>
                        {exp.paymentStatus === "paid" ? "Paid" : "Pay Later (Accrued)"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Record Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Record Factory Expense</h3>
                <p className="text-xs text-slate-500">Rent, electricity, generator fuel, maintenance, tea</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Expense Category (Head of Account) *
                </label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                >
                  {loading && expenseAccounts.length === 0 ? (
                    <option value="" disabled>Loading expense categories...</option>
                  ) : expenseAccounts.length === 0 ? (
                    <option value="" disabled>No expense heads found (add one in Chart of Accounts)</option>
                  ) : (
                    <>
                      <option value="" disabled>-- Select Expense Head --</option>
                      {expenseAccounts.some((a) => a.rootType === "indirectExpense") && (
                        <optgroup label="Indirect Expenses (Factory Overheads & Admin)">
                          {expenseAccounts
                            .filter((a) => a.rootType === "indirectExpense")
                            .map((a) => (
                              <option key={a._id} value={a._id}>
                                {a.title} ({a.code})
                              </option>
                            ))}
                        </optgroup>
                      )}
                      {expenseAccounts.some((a) => a.rootType === "directExpense") && (
                        <optgroup label="Direct Expenses (Production / Factory Operations)">
                          {expenseAccounts
                            .filter((a) => a.rootType === "directExpense")
                            .map((a) => (
                              <option key={a._id} value={a._id}>
                                {a.title} ({a.code})
                              </option>
                            ))}
                        </optgroup>
                      )}
                    </>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Amount (Rs.) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Paid To / Vendor Name (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Factory Landlord, Shell Pump"
                    value={paidToName}
                    onChange={(e) => setPaidToName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                    Bill / Ref # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. WAPDA Bill # or Slip #"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Narration
                </label>
                <input
                  type="text"
                  placeholder="e.g. 50 liters diesel for 50kVA generator backup"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none"
                />
              </div>

              {/* Payment Status Option */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                  Payment Status
                </span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="expPay"
                      checked={paymentOption === "now"}
                      onChange={() => setPaymentOption("now")}
                    />
                    <span>Paid Now (Cash / Bank)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      type="radio"
                      name="expPay"
                      checked={paymentOption === "later"}
                      onChange={() => setPaymentOption("later")}
                    />
                    <span>Pay Later (Accrued Liability)</span>
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
                      <label className="block text-[11px] text-slate-600 mb-1">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="cash">Cash in Hand</option>
                        <option value="bank">Bank Transfer</option>
                        <option value="cheque">Cheque</option>
                        <option value="online">Online</option>
                      </select>
                    </div>
                  </div>
                )}
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
                  {submitting ? "Saving..." : "Record Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
