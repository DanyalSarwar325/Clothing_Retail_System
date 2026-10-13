"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import Link from "next/link";
import {
  Receipt,
  Search,
  Filter,
  Printer,
  Scissors,
  CheckCircle2,
  Clock,
  Building2,
  FileText,
  Calendar,
  User,
  X,
  Plus,
  Loader2,
  ChevronRight,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

interface ItemQuantity {
  Qameez: number;
  Shalwar: number;
  Dupatta: number;
}

interface SizeQuantities {
  S: ItemQuantity;
  M: ItemQuantity;
  L: ItemQuantity;
}

interface ReceivingLog {
  _id?: string;
  receivedAt: string;
  receivedBy: string;
  cuttingPersonName?: string;
  notes?: string;
  items: Array<{
    size: "S" | "M" | "L";
    item: "Qameez" | "Shalwar" | "Dupatta";
    quantity: number;
  }>;
}

interface PurchaseOrder {
  _id: string;
  poNumber: string;
  design: string;
  status: "Open" | "In Progress" | "Completed" | "Cancelled";
  plannedQuantities: SizeQuantities;
  receivedQuantities: SizeQuantities;
  barcodedQuantities: SizeQuantities;
  receivingLogs: ReceivingLog[];
  notes?: string;
  createdAt: string;
  totalPlanned: number;
  totalReceived: number;
  totalBarcoded: number;
  availableToBarcode: number;
}

const SIZES = ["S", "M", "L"] as const;
const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };
const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

export default function POReceiptsPage() {
  const { user, loading: authLoading } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  // Quick Receive from Master Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveCuttingPerson, setReceiveCuttingPerson] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveQuantities, setReceiveQuantities] = useState<SizeQuantities>({
    S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
  });
  const [submittingReceive, setSubmittingReceive] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  const fetchPurchaseOrders = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/purchase-orders?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setPurchaseOrders(data.purchaseOrders);
        // If a PO was selected, refresh it
        if (selectedPO) {
          const updated = data.purchaseOrders.find((p: PurchaseOrder) => p._id === selectedPO._id);
          if (updated) setSelectedPO(updated);
        }
      } else {
        toast.error(data.message || "Failed to load receipts");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPurchaseOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchPurchaseOrders();
  };

  const handlePrint = () => {
    window.print();
  };

  // Open Receive Cut Pieces Modal
  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setReceiveCuttingPerson("");
    setReceiveNotes("");
    setReceiveQuantities({
      S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    });
    setShowReceiveModal(true);
  };

  // Submit Receiving from Master
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    const itemsToReceive: Array<{ size: "S" | "M" | "L"; item: "Qameez" | "Shalwar" | "Dupatta"; quantity: number }> = [];
    for (const s of SIZES) {
      for (const it of ITEMS) {
        const qty = receiveQuantities[s][it];
        if (qty > 0) {
          itemsToReceive.push({ size: s, item: it, quantity: qty });
        }
      }
    }

    if (itemsToReceive.length === 0) {
      toast.error("Please enter at least one quantity greater than 0");
      return;
    }

    setSubmittingReceive(true);
    try {
      const res = await fetch(`/api/purchase-orders/${selectedPO._id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToReceive,
          cuttingPersonName: receiveCuttingPerson || "Cutting Master",
          notes: receiveNotes,
          receivedBy: user?.name || "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Additional cut pieces recorded on Mughliaz receipt!");
        setShowReceiveModal(false);
        fetchPurchaseOrders();
      } else {
        toast.error(data.message || "Failed to record cut pieces");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit receipt items");
    } finally {
      setSubmittingReceive(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Hide Sidebar during print */}
      <div className="print:hidden">
        <Sidebar active="po-receipts" setActive={() => {}} />
      </div>

      <div className="w-full lg:ml-64 p-4 sm:p-8 pt-20 lg:pt-8 print:m-0 print:p-0 print:w-full">
        {/* ================= VIEW 1: SINGLE OFFICIAL MUGHLIAZ RECEIPT VIEW ================= */}
        {selectedPO ? (
          <div>
            {/* Action Bar (Hidden when printing) */}
            <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <button
                onClick={() => setSelectedPO(null)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-900 bg-white border px-3 py-2 rounded-lg transition"
              >
                <ArrowLeft size={16} />
                Back to All Design Receipts
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => openReceiveModal(selectedPO)}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
                >
                  <Plus size={16} />
                  Receive More from Master
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold shadow-xs transition"
                >
                  <Printer size={16} />
                  Print Official Receipt
                </button>
              </div>
            </div>

            {/* Official Mughliaz Document Card */}
            <div
              ref={receiptRef}
              className="bg-white rounded-2xl shadow-md border border-gray-200 p-8 sm:p-12 max-w-4xl mx-auto print:shadow-none print:border-none print:p-4 print:max-w-none text-gray-900"
            >
              {/* Header: Mughliaz Brand Header */}
              <div className="border-b-2 border-gray-900 pb-6 mb-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-black tracking-widest text-gray-900 font-serif uppercase">
                      MUGHLIAZ
                    </h1>
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mt-0.5">
                      Apparel & Production Manufacturing
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Official Factory Receipt & Goods Receiving Voucher
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-gray-900 text-white text-xs font-bold uppercase tracking-wider rounded">
                      CUTTING RECEIPT
                    </span>
                    <p className="text-xs font-semibold text-gray-600 mt-2">
                      Receipt #: <span className="text-gray-900 font-bold">MUG-RCP-{selectedPO.poNumber}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Date Issued: {new Date(selectedPO.createdAt).toLocaleDateString("en-GB")}
                    </p>
                  </div>
                </div>
              </div>

              {/* Document Overview Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200 mb-6 text-xs">
                <div>
                  <span className="text-gray-500 block uppercase font-medium">Design Name</span>
                  <strong className="text-sm text-gray-900 block mt-0.5">{selectedPO.design}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block uppercase font-medium">PO Reference</span>
                  <strong className="text-sm text-gray-900 block mt-0.5">{selectedPO.poNumber}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block uppercase font-medium">Status</span>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded text-xs font-bold ${
                      selectedPO.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : selectedPO.status === "In Progress"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {selectedPO.status}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block uppercase font-medium">Total Deliveries</span>
                  <strong className="text-sm text-gray-900 block mt-0.5">
                    {selectedPO.receivingLogs?.length || 0} Delivery Batches
                  </strong>
                </div>
              </div>

              {/* High-level Pieces Summary Table */}
              <div className="grid grid-cols-3 gap-3 mb-6 text-center">
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <span className="text-xs font-semibold text-indigo-700 uppercase">Total Planned</span>
                  <p className="text-xl font-black text-indigo-900 mt-1">{selectedPO.totalPlanned} pcs</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <span className="text-xs font-semibold text-amber-700 uppercase">Received from Master</span>
                  <p className="text-xl font-black text-amber-900 mt-1">{selectedPO.totalReceived} pcs</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-xs font-semibold text-emerald-700 uppercase">Pending from Master</span>
                  <p className="text-xl font-black text-emerald-900 mt-1">
                    {Math.max(0, selectedPO.totalPlanned - selectedPO.totalReceived)} pcs
                  </p>
                </div>
              </div>

              {/* Cumulative Items Breakdown */}
              <div className="mb-8">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Cumulative Cut Pieces Received (By Size & Item)</span>
                  <span className="text-gray-400 font-normal">Official Physical Count</span>
                </h3>

                <div className="border border-gray-300 rounded-xl overflow-hidden">
                  <table className="w-full text-xs text-center border-collapse">
                    <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-300">
                      <tr>
                        <th className="py-2 px-3 text-left">Size</th>
                        <th className="py-2 px-3">Qameez Received</th>
                        <th className="py-2 px-3">Shalwar Received</th>
                        <th className="py-2 px-3">Dupatta Received</th>
                        <th className="py-2 px-3 font-bold">Total Pieces</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {SIZES.map((size) => {
                        const q = selectedPO.receivedQuantities[size]?.Qameez || 0;
                        const s = selectedPO.receivedQuantities[size]?.Shalwar || 0;
                        const d = selectedPO.receivedQuantities[size]?.Dupatta || 0;
                        const rowTotal = q + s + d;

                        return (
                          <tr key={size} className="hover:bg-gray-50/50">
                            <td className="py-2.5 px-3 text-left font-bold text-gray-900">
                              {SIZE_LABELS[size]} ({size})
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800">{q}</td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800">{s}</td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800">{d}</td>
                            <td className="py-2.5 px-3 font-bold text-gray-900 bg-gray-50">
                              {rowTotal} pcs
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-100/80 font-bold border-t border-gray-300">
                      <tr>
                        <td className="py-2 px-3 text-left">Total Count</td>
                        <td className="py-2 px-3">
                          {SIZES.reduce((sum, s) => sum + (selectedPO.receivedQuantities[s]?.Qameez || 0), 0)}
                        </td>
                        <td className="py-2 px-3">
                          {SIZES.reduce((sum, s) => sum + (selectedPO.receivedQuantities[s]?.Shalwar || 0), 0)}
                        </td>
                        <td className="py-2 px-3">
                          {SIZES.reduce((sum, s) => sum + (selectedPO.receivedQuantities[s]?.Dupatta || 0), 0)}
                        </td>
                        <td className="py-2 px-3 text-gray-900 bg-gray-200">
                          {selectedPO.totalReceived} pcs
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Delivery History Schedule: Every time pieces were received from master */}
              <div className="mb-8">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-2">
                  Delivery History & Master Dispatch Schedule
                </h3>
                <p className="text-[11px] text-gray-500 mb-3">
                  Log of every delivery received from the cutting person for this design.
                </p>

                {selectedPO.receivingLogs && selectedPO.receivingLogs.length > 0 ? (
                  <div className="border border-gray-300 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead className="bg-gray-100 text-gray-700 font-semibold border-b border-gray-300">
                        <tr>
                          <th className="py-2 px-3">Batch #</th>
                          <th className="py-2 px-3">Date & Time</th>
                          <th className="py-2 px-3">Cutting Master</th>
                          <th className="py-2 px-3">Delivered Pieces</th>
                          <th className="py-2 px-3">Notes</th>
                          <th className="py-2 px-3 text-right">Batch Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedPO.receivingLogs.map((log, idx) => {
                          const batchTotal = log.items.reduce((sum, it) => sum + it.quantity, 0);

                          return (
                            <tr key={idx} className="hover:bg-gray-50/50">
                              <td className="py-2.5 px-3 font-bold text-gray-900">#{idx + 1}</td>
                              <td className="py-2.5 px-3 text-gray-600">
                                {new Date(log.receivedAt).toLocaleString("en-GB", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-gray-800">
                                {log.cuttingPersonName || "Cutting Master"}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-wrap gap-1">
                                  {log.items.map((it, i) => (
                                    <span
                                      key={i}
                                      className="px-1.5 py-0.5 bg-gray-100 border rounded text-[10px] font-medium"
                                    >
                                      {it.item} ({it.size}): {it.quantity}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-gray-500 italic">
                                {log.notes || "—"}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                                +{batchTotal} pcs
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic p-4 border rounded-xl">
                    No cut pieces recorded yet from cutting master.
                  </p>
                )}
              </div>

              {/* Official Terms & Certification */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl mb-10 text-[11px] text-gray-600">
                <p className="font-semibold text-gray-800 mb-0.5">Mughliaz Certification:</p>
                <p>
                  This official document verifies that the cut suit pieces specified above have been physically
                  received from the cutting department, inspected for quality, and logged into Mughliaz production
                  records. Only confirmed received pieces are permitted for barcode generation.
                </p>
              </div>

              {/* Signatures & Seal Section */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-gray-800 text-center text-xs">
                <div>
                  <div className="h-14 border-b border-gray-400 mb-2"></div>
                  <p className="font-bold text-gray-900">Cutting Master</p>
                  <p className="text-[10px] text-gray-500">Delivered By & Signature</p>
                </div>
                <div>
                  <div className="h-14 border-b border-gray-400 mb-2"></div>
                  <p className="font-bold text-gray-900">{user?.name || "Inventory Officer"}</p>
                  <p className="text-[10px] text-gray-500">Received & Verified By</p>
                </div>
                <div>
                  <div className="h-14 border-b border-gray-400 mb-2 flex items-center justify-center">
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-serif border border-dashed border-gray-300 px-3 py-1 rounded">
                      MUGHLIAZ SEAL
                    </span>
                  </div>
                  <p className="font-bold text-gray-900">Authorized Signatory</p>
                  <p className="text-[10px] text-gray-500">Mughliaz Production Management</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= VIEW 2: ALL DESIGN RECEIPTS DIRECTORY ================= */
          <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                    <Receipt size={22} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">PO Receipts — Mughliaz Official Documents</h1>
                    <p className="text-sm text-gray-500">
                      Official goods receiving vouchers for cut pieces delivered by the cutting master.
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href="/purchase-orders"
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium shadow-xs transition"
              >
                <FileText size={18} />
                Manage Purchase Orders
              </Link>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search by Design or Receipt #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={16} className="text-gray-500" />
                <span className="text-sm text-gray-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="all">All Receipts</option>
                  <option value="In Progress">In Progress (Receiving)</option>
                  <option value="Completed">Completed</option>
                  <option value="Open">Open (Pending First Cut)</option>
                </select>
              </div>
            </div>

            {/* Receipt Cards Grid */}
            {loading ? (
              <div className="py-16 text-center text-gray-500">
                <Loader2 className="animate-spin inline-block mr-2" size={24} />
                Loading Mughliaz PO Receipts...
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-500">
                <Receipt className="mx-auto text-gray-400 mb-3" size={40} />
                <h3 className="text-base font-bold text-gray-800">No PO Receipts Found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Create a Purchase Order first. Once created, an official Mughliaz receipt is generated for each design.
                </p>
                <div className="mt-4">
                  <Link
                    href="/generate-barcodes"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition"
                  >
                    + Create New PO
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {purchaseOrders.map((po) => {
                  const percentReceived =
                    po.totalPlanned > 0
                      ? Math.min(100, Math.round((po.totalReceived / po.totalPlanned) * 100))
                      : 0;

                  return (
                    <div
                      key={po._id}
                      className="bg-white rounded-2xl border border-gray-200 shadow-xs hover:shadow-md transition p-6 flex flex-col justify-between"
                    >
                      <div>
                        {/* Receipt Top Header */}
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-[11px] font-bold tracking-wider uppercase text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded">
                            MUG-RCP-{po.poNumber}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              po.status === "Completed"
                                ? "bg-green-100 text-green-800"
                                : po.status === "In Progress"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {po.status}
                          </span>
                        </div>

                        {/* Design Title */}
                        <h3 className="text-base font-bold text-gray-900 truncate mb-1">
                          {po.design}
                        </h3>
                        <p className="text-xs text-gray-400 mb-4">
                          Created {new Date(po.createdAt).toLocaleDateString("en-GB")}
                        </p>

                        {/* Progress Bar */}
                        <div className="mb-4">
                          <div className="flex justify-between text-xs font-semibold mb-1">
                            <span className="text-gray-600">Cut Pieces Received:</span>
                            <span className="text-amber-700 font-bold">
                              {po.totalReceived} / {po.totalPlanned} pcs ({percentReceived}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                            <div
                              className="bg-amber-500 h-full rounded-full transition-all"
                              style={{ width: `${percentReceived}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Stats Matrix */}
                        <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-2.5 rounded-xl border border-gray-100 mb-4">
                          <div>
                            <span className="text-gray-400 block">Deliveries:</span>
                            <strong className="text-gray-800">
                              {po.receivingLogs?.length || 0} batches
                            </strong>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Available to Barcode:</span>
                            <strong className="text-emerald-700 font-bold">
                              {po.availableToBarcode} pcs
                            </strong>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center gap-2 pt-3 border-t">
                        <button
                          onClick={() => setSelectedPO(po)}
                          className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Receipt size={14} />
                          View Official Receipt
                        </button>
                        <button
                          onClick={() => openReceiveModal(po)}
                          title="Record cut pieces from master"
                          className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs transition"
                        >
                          <Scissors size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ================= MODAL: RECEIVE MORE FROM MASTER ================= */}
        {showReceiveModal && selectedPO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 print:hidden">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between border-b pb-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Add Pieces to Mughliaz Receipt from Master
                  </h3>
                  <p className="text-xs text-gray-500">
                    Receipt: <strong className="text-gray-800">MUG-RCP-{selectedPO.poNumber}</strong> | Design:{" "}
                    <strong className="text-gray-800">{selectedPO.design}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowReceiveModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleReceiveSubmit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cutting Master / Person Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Master Aslam, Cutting Floor 1"
                      value={receiveCuttingPerson}
                      onChange={(e) => setReceiveCuttingPerson(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Delivery Note / Memo
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Second delivery batch"
                      value={receiveNotes}
                      onChange={(e) => setReceiveNotes(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Quantities Table */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                    Pieces Delivered in this Batch
                  </label>
                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-600 border-b">
                        <tr>
                          <th className="py-2 px-3 text-left">Size</th>
                          <th className="py-2 px-3">Qameez</th>
                          <th className="py-2 px-3">Shalwar</th>
                          <th className="py-2 px-3">Dupatta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {SIZES.map((size) => (
                          <tr key={size} className="hover:bg-gray-50">
                            <td className="py-3 px-3 text-left font-medium text-gray-900">
                              {SIZE_LABELS[size]}
                              <span className="block text-[11px] text-gray-400">
                                Total received so far: Q:{" "}
                                {selectedPO.receivedQuantities[size]?.Qameez || 0} | S:{" "}
                                {selectedPO.receivedQuantities[size]?.Shalwar || 0} | D:{" "}
                                {selectedPO.receivedQuantities[size]?.Dupatta || 0}
                              </span>
                            </td>
                            {ITEMS.map((item) => (
                              <td key={item} className="py-3 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={receiveQuantities[size][item] || ""}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 0;
                                    setReceiveQuantities((prev) => ({
                                      ...prev,
                                      [size]: {
                                        ...prev[size],
                                        [item]: Math.max(0, val),
                                      },
                                    }));
                                  }}
                                  placeholder="0"
                                  className="w-20 text-center border rounded-lg px-2 py-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowReceiveModal(false)}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReceive}
                    className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center gap-2"
                  >
                    {submittingReceive ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Adding to Receipt...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Update Mughliaz Receipt
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
