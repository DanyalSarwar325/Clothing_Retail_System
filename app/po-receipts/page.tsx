"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import Link from "next/link";
import {
  Receipt,
  Search,
  Filter,
  Printer,
  FileText,
  Loader2,
  ArrowLeft,
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

interface ReceivingLogItem {
  _id?: string;
  size: "S" | "M" | "L";
  item: "Qameez" | "Shalwar" | "Dupatta";
  quantity: number;
  rate?: number;
  totalEarned?: number;
  isPaid?: boolean;
  paidAt?: string;
  paidAmount?: number;
  voucherNumber?: string;
  paymentMode?: string;
}

interface ReceivingLog {
  _id?: string;
  receivedAt: string;
  receivedBy: string;
  cuttingPersonName?: string;
  notes?: string;
  items: ReceivingLogItem[];
  batchPiecesCount?: number;
  batchTotalAmount?: number;
  batchPaidAmount?: number;
  batchPendingAmount?: number;
  paymentStatus?: "Paid" | "Partial" | "Pending";
  voucherNumber?: string;
  paymentMode?: string;
  paidAt?: string;
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
  totalCuttingCost?: number;
  totalCuttingPaid?: number;
  totalCuttingPending?: number;
  cuttingPaymentStatus?: "Paid" | "Partial" | "Pending";
  defaultCuttingRate?: number;
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



  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-black" size={32} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 print:bg-white">
      {/* Hide Sidebar during print */}
      <div className="print:hidden">
        <Sidebar active="po-receipts" setActive={() => {}} />
      </div>

      <div className="w-full lg:ml-64 p-4 sm:p-8 pt-20 lg:pt-8 print:m-0 print:p-0 print:w-full print:max-w-none">
        {/* ================= VIEW 1: OFFICIAL FORMAL BLACK & WHITE MUGHLIAZ RECEIPT ================= */}
        {selectedPO ? (
          <div>
            {/* Action Bar (Hidden when printing) */}
            <div className="print:hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <button
                onClick={() => setSelectedPO(null)}
                className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-black bg-white border border-gray-300 px-3.5 py-2 rounded-lg transition"
              >
                <ArrowLeft size={16} />
                Back to Receipts List
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2 bg-black hover:bg-gray-800 text-white rounded-lg text-sm font-semibold shadow-xs transition"
                >
                  <Printer size={16} />
                  Print Formal Receipt (B&W)
                </button>
              </div>
            </div>

            {/* Official Formal Mughliaz Document (Crisp Black & White, No Colors, No Bulky Tabs) */}
            <div
              ref={receiptRef}
              className="bg-white border-2 border-black p-8 sm:p-12 max-w-4xl mx-auto shadow-sm print:shadow-none print:border-none print:p-0 print:max-w-none text-black font-sans"
            >
              {/* Formal Company Header */}
              <div className="border-b-2 border-black pb-4 mb-4 text-center">
                <h1 className="text-3xl sm:text-4xl font-extrabold tracking-widest text-black uppercase font-serif">
                  MUGHLIAZ
                </h1>
                <p className="text-xs uppercase tracking-widest text-black font-semibold mt-1">
                  Apparel & Textile Manufacturing
                </p>
                <div className="mt-3 py-1 px-4 inline-block border border-black text-xs font-bold uppercase tracking-wider">
                  Goods Receiving Note / Cutting Receipt (GRN)
                </div>
              </div>

              {/* Formal 4-Column Metadata Box (Clean Black & White Lines) */}
              <div className="border border-black mb-5 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-black border-b border-black">
                  <div className="p-2.5">
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Receipt Voucher No</span>
                    <strong className="text-sm font-bold text-black">MUG-RCP-{selectedPO.poNumber}</strong>
                  </div>
                  <div className="p-2.5">
                    <span className="block text-[10px] uppercase font-bold text-gray-600">PO Reference</span>
                    <strong className="text-sm font-bold text-black">{selectedPO.poNumber}</strong>
                  </div>
                  <div className="p-2.5">
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Date Issued</span>
                    <span className="text-xs font-semibold text-black">
                      {new Date(selectedPO.createdAt).toLocaleDateString("en-GB")}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Order Status</span>
                    <span className="text-xs font-bold text-black uppercase">
                      {selectedPO.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-black bg-gray-50/50">
                  <div className="p-2.5 col-span-2">
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Design Name</span>
                    <strong className="text-sm font-bold text-black">{selectedPO.design}</strong>
                  </div>
                  <div className="p-2.5">
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Handover Batches</span>
                    <span className="text-xs font-semibold text-black">
                      {selectedPO.receivingLogs?.length || 0} Delivery Batches Logged
                    </span>
                  </div>
                </div>
              </div>

              {/* Formal High-level Quantity & Financial Summary */}
              <div className="border border-black mb-6 bg-white">
                <div className="grid grid-cols-3 divide-x divide-black text-center text-xs py-2 border-b border-black">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Total Planned</span>
                    <strong className="text-base font-bold text-black">{selectedPO.totalPlanned} pcs</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Total Received to Date</span>
                    <strong className="text-base font-bold text-black">{selectedPO.totalReceived} pcs</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Balance Pending</span>
                    <strong className="text-base font-bold text-black">
                      {Math.max(0, selectedPO.totalPlanned - selectedPO.totalReceived)} pcs
                    </strong>
                  </div>
                </div>

                <div className="grid grid-cols-3 divide-x divide-black text-center text-xs py-2 bg-gray-50/70">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Total Received Labor Cost</span>
                    <strong className="text-sm font-bold text-black">
                      ₨{(selectedPO.totalCuttingCost ?? 0).toLocaleString()}
                    </strong>
                    <span className="block text-[9px] text-gray-500 font-medium">Rate: ₨{selectedPO.defaultCuttingRate ?? 5}/pc</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Cutting Wages Paid</span>
                    <strong className="text-sm font-bold text-black">
                      ₨{(selectedPO.totalCuttingPaid ?? 0).toLocaleString()}
                    </strong>
                    <span className="block text-[9px] text-gray-600 font-medium">Settled via Accounting</span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-gray-600">Wage Balance Due</span>
                    <strong className={`text-sm font-bold ${(selectedPO.totalCuttingPending ?? 0) > 0 ? "text-black underline" : "text-black"}`}>
                      ₨{(selectedPO.totalCuttingPending ?? 0).toLocaleString()}
                    </strong>
                    <span className="block text-[9px] font-bold uppercase text-black">
                      {selectedPO.cuttingPaymentStatus || "Pending"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Formal Cumulative Physical Count Table */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                    1. Cumulative Cut Pieces Received (Size & Item Matrix)
                  </h3>
                  <span className="text-[10px] uppercase text-gray-600">Physical Stock Count</span>
                </div>

                <table className="w-full text-xs text-center border-collapse border border-black">
                  <thead>
                    <tr className="border-b border-black bg-gray-100/80 text-black font-bold">
                      <th className="py-2 px-3 text-left border-r border-black">Size</th>
                      <th className="py-2 px-3 border-r border-black">Qameez</th>
                      <th className="py-2 px-3 border-r border-black">Shalwar</th>
                      <th className="py-2 px-3 border-r border-black">Dupatta</th>
                      <th className="py-2 px-3 font-bold">Total Pieces</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black">
                    {SIZES.map((size) => {
                      const q = selectedPO.receivedQuantities[size]?.Qameez || 0;
                      const s = selectedPO.receivedQuantities[size]?.Shalwar || 0;
                      const d = selectedPO.receivedQuantities[size]?.Dupatta || 0;
                      const rowTotal = q + s + d;

                      return (
                        <tr key={size}>
                          <td className="py-2 px-3 text-left font-bold text-black border-r border-black">
                            {SIZE_LABELS[size]} ({size})
                          </td>
                          <td className="py-2 px-3 border-r border-black">{q}</td>
                          <td className="py-2 px-3 border-r border-black">{s}</td>
                          <td className="py-2 px-3 border-r border-black">{d}</td>
                          <td className="py-2 px-3 font-bold text-black bg-gray-50/50">
                            {rowTotal}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-black font-bold bg-gray-100/80 text-black">
                      <td className="py-2 px-3 text-left border-r border-black">TOTAL COUNT</td>
                      <td className="py-2 px-3 border-r border-black">
                        {SIZES.reduce((sum, s) => sum + (selectedPO.receivedQuantities[s]?.Qameez || 0), 0)}
                      </td>
                      <td className="py-2 px-3 border-r border-black">
                        {SIZES.reduce((sum, s) => sum + (selectedPO.receivedQuantities[s]?.Shalwar || 0), 0)}
                      </td>
                      <td className="py-2 px-3 border-r border-black">
                        {SIZES.reduce((sum, s) => sum + (selectedPO.receivedQuantities[s]?.Dupatta || 0), 0)}
                      </td>
                      <td className="py-2 px-3 text-black font-extrabold border-l border-black">
                        {selectedPO.totalReceived} pcs
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Formal Master Delivery Log Schedule & Wage Payment Audit */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-1.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-black">
                    2. Cutting Master Handover Schedule & Wage Payment Audit
                  </h3>
                  <span className="text-[10px] text-gray-600">Audit Trail & Payment Vouchers</span>
                </div>

                {selectedPO.receivingLogs && selectedPO.receivingLogs.length > 0 ? (
                  <table className="w-full text-xs text-left border-collapse border border-black">
                    <thead>
                      <tr className="border-b border-black bg-gray-100/80 text-black font-bold">
                        <th className="py-2 px-2 border-r border-black w-10 text-center">Batch</th>
                        <th className="py-2 px-2 border-r border-black w-24">Date</th>
                        <th className="py-2 px-2 border-r border-black w-28">Cutting Master</th>
                        <th className="py-2 px-2 border-r border-black">Delivered Items Breakdown</th>
                        <th className="py-2 px-2 text-center font-bold border-r border-black w-14">Qty</th>
                        <th className="py-2 px-2 text-right border-r border-black w-20">Batch Value</th>
                        <th className="py-2 px-2 text-right border-r border-black w-20">Paid</th>
                        <th className="py-2 px-2 text-left w-36">Payment Status & Ref</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black">
                      {selectedPO.receivingLogs.map((log, idx) => {
                        const batchQty = log.batchPiecesCount ?? log.items.reduce((sum, it) => sum + it.quantity, 0);
                        const rate = selectedPO.defaultCuttingRate ?? 5;
                        const batchAmount = log.batchTotalAmount ?? (batchQty * rate);
                        const batchPaid = log.batchPaidAmount ?? (log.items.some(it => it.isPaid) ? batchAmount : 0);
                        const batchPending = log.batchPendingAmount ?? Math.max(0, batchAmount - batchPaid);
                        const isPaid = batchPending === 0 && batchQty > 0;
                        const isPartial = batchPaid > 0 && batchPending > 0;
                        const voucher = log.voucherNumber || log.items?.find(it => it.voucherNumber)?.voucherNumber;
                        const mode = log.paymentMode || log.items?.find(it => it.paymentMode)?.paymentMode || "Bank";

                        return (
                          <tr key={idx}>
                            <td className="py-2 px-2 text-center font-bold border-r border-black">#{idx + 1}</td>
                            <td className="py-2 px-2 text-gray-800 border-r border-black">
                              {new Date(log.receivedAt).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
                            </td>
                            <td className="py-2 px-2 font-medium border-r border-black">
                              {log.cuttingPersonName || "Cutting Master"}
                            </td>
                            <td className="py-2 px-2 border-r border-black">
                              {log.items.map((it, i) => (
                                <span key={i} className="inline-block mr-2 text-[11px]">
                                  {it.item} ({it.size}): <strong>{it.quantity}</strong>
                                  {i < log.items.length - 1 ? "," : ""}
                                </span>
                              ))}
                            </td>
                            <td className="py-2 px-2 text-center font-bold text-black border-r border-black">
                              +{batchQty}
                            </td>
                            <td className="py-2 px-2 text-right font-medium text-black border-r border-black">
                              ₨{batchAmount.toLocaleString()}
                            </td>
                            <td className="py-2 px-2 text-right font-bold text-black border-r border-black">
                              ₨{batchPaid.toLocaleString()}
                            </td>
                            <td className="py-2 px-2">
                              {isPaid ? (
                                <div>
                                  <span className="font-bold uppercase text-[10px] text-black">✓ PAID</span>
                                  <span className="block text-[9px] text-gray-600 font-mono">
                                    {voucher ? `${voucher} (${mode})` : "Settled (Accounting)"}
                                  </span>
                                </div>
                              ) : isPartial ? (
                                <div>
                                  <span className="font-bold uppercase text-[10px] text-black">PARTIAL</span>
                                  <span className="block text-[9px] text-gray-600">
                                    Due: ₨{batchPending.toLocaleString()}
                                  </span>
                                </div>
                              ) : (
                                <div>
                                  <span className="font-bold text-[10px] text-black uppercase">⏳ DUE</span>
                                  <span className="block text-[9px] text-gray-600">
                                    ₨{batchAmount.toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-black font-bold bg-gray-100/80 text-black">
                        <td colSpan={4} className="py-2 px-2 text-right border-r border-black">
                          TOTALS:
                        </td>
                        <td className="py-2 px-2 text-center border-r border-black font-extrabold">
                          {selectedPO.totalReceived} pcs
                        </td>
                        <td className="py-2 px-2 text-right border-r border-black">
                          ₨{(selectedPO.totalCuttingCost ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-right border-r border-black font-extrabold">
                          ₨{(selectedPO.totalCuttingPaid ?? 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-left font-bold">
                          {(selectedPO.totalCuttingPending ?? 0) > 0 ? (
                            <span>Due: ₨{(selectedPO.totalCuttingPending ?? 0).toLocaleString()}</span>
                          ) : (
                            <span>Fully Settled</span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                ) : (
                  <div className="p-3 border border-black text-center text-xs text-gray-500 italic">
                    No cut piece deliveries recorded yet from the cutting master.
                  </div>
                )}
              </div>

              {/* Formal Certification Statement */}
              <div className="border border-black p-3 mb-8 text-[11px] leading-relaxed text-black">
                <span className="font-bold block uppercase mb-0.5">Formal Undertaking / Certification:</span>
                Certified that the cut pieces listed in this Goods Receiving Note have been physically delivered by the
                cutting department, inspected for quality, and verified in Mughliaz inventory. Labor earnings and verified payment vouchers are synchronized with the accounting General Ledger.
              </div>

              {/* Formal Sign-off Blocks (3 Columns with Clear Ink Signature Lines) */}
              <div className="grid grid-cols-3 gap-8 pt-4 text-center text-xs">
                <div>
                  <div className="h-16 border-b border-black mb-2"></div>
                  <p className="font-bold uppercase tracking-wider text-black">Cutting Master</p>
                  <p className="text-[10px] text-gray-600">Delivered By & Signature</p>
                </div>

                <div>
                  <div className="h-16 border-b border-black mb-2"></div>
                  <p className="font-bold uppercase tracking-wider text-black">{user?.name || "Inventory Incharge"}</p>
                  <p className="text-[10px] text-gray-600">Received & Checked By</p>
                </div>

                <div>
                  <div className="h-16 border-b border-black mb-2 flex items-center justify-center">
                    <span className="text-[9px] uppercase tracking-widest text-gray-500 font-serif border border-dashed border-gray-400 px-3 py-1">
                      OFFICIAL STAMP
                    </span>
                  </div>
                  <p className="font-bold uppercase tracking-wider text-black">Authorized Signatory</p>
                  <p className="text-[10px] text-gray-600">Mughliaz Production Management</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ================= VIEW 2: FORMAL RECEIPTS DIRECTORY ================= */
          <div>
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-black text-white rounded-lg flex items-center justify-center font-bold">
                    <Receipt size={22} />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">PO Receipts — Mughliaz Official Documents</h1>
                    <p className="text-xs text-gray-500">
                      Formal goods receiving vouchers & cutting challans for master dispatches.
                    </p>
                  </div>
                </div>
              </div>
              <Link
                href="/purchase-orders"
                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg text-sm font-medium transition"
              >
                <FileText size={16} />
                Manage Purchase Orders
              </Link>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-3.5 rounded-xl border border-gray-200 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Search by Design or Receipt #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </form>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter size={15} className="text-gray-500" />
                <span className="text-xs font-medium text-gray-600">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-black bg-white"
                >
                  <option value="all">All Receipts</option>
                  <option value="In Progress">In Progress (Receiving)</option>
                  <option value="Completed">Completed</option>
                  <option value="Open">Open</option>
                </select>
              </div>
            </div>

            {/* Formal Receipts Table */}
            {loading ? (
              <div className="py-16 text-center text-gray-500">
                <Loader2 className="animate-spin inline-block mr-2" size={22} />
                Loading Receipts...
              </div>
            ) : purchaseOrders.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
                <Receipt className="mx-auto text-gray-400 mb-2" size={36} />
                <h3 className="text-sm font-bold text-gray-800">No PO Receipts Found</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Create a Purchase Order first to generate an official receipt for each design.
                </p>
                <div className="mt-4">
                  <Link
                    href="/generate-barcodes"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg text-xs font-semibold hover:bg-gray-800 transition"
                  >
                    + Create New PO
                  </Link>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      <th className="py-3 px-4">Receipt Voucher #</th>
                      <th className="py-3 px-4">Design Name</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4 text-center">Planned</th>
                      <th className="py-3 px-4 text-center">Received</th>
                      <th className="py-3 px-4 text-center">Balance</th>
                      <th className="py-3 px-4 text-center">Cutting Wages</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 text-xs">
                    {purchaseOrders.map((po) => {
                      const balance = Math.max(0, po.totalPlanned - po.totalReceived);

                      return (
                        <tr key={po._id} className="hover:bg-gray-50/70 transition">
                          <td className="py-3.5 px-4 font-bold text-black">
                            MUG-RCP-{po.poNumber}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-gray-900">
                            {po.design}
                          </td>
                          <td className="py-3.5 px-4 text-gray-600">
                            {new Date(po.createdAt).toLocaleDateString("en-GB")}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-gray-700">
                            {po.totalPlanned} pcs
                          </td>
                          <td className="py-3.5 px-4 text-center font-bold text-black">
                            {po.totalReceived} pcs
                          </td>
                          <td className="py-3.5 px-4 text-center font-medium text-gray-700">
                            {balance} pcs
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {po.totalReceived === 0 ? (
                              <span className="text-gray-400">—</span>
                            ) : (po.totalCuttingPending || 0) === 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded text-[11px] font-bold">
                                ✓ Paid (₨{po.totalCuttingPaid || 0})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-300 rounded text-[11px] font-bold">
                                Due: ₨{po.totalCuttingPending || 0}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className="px-2 py-0.5 border border-gray-400 rounded text-[11px] font-bold uppercase text-black">
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => setSelectedPO(po)}
                                className="px-3 py-1.5 bg-black hover:bg-gray-800 text-white rounded text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <Receipt size={13} />
                                View Receipt
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}


      </div>
    </div>
  );
}
