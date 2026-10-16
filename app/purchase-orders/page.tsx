"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import Link from "next/link";
import {
  FileText,
  Search,
  Filter,
  Plus,
  Scissors,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Printer,
  History,
  X,
  Loader2,
  PackageCheck,
  ArrowRight,
  TrendingUp,
  Receipt,
  Trash2,
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

interface PODepartmentRate {
  department: string;
  ratePerPiece: number;
  item?: "Qameez" | "Shalwar" | "Dupatta";
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
  departmentRates: PODepartmentRate[];
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

export default function PurchaseOrdersPage() {
  const { user, loading: authLoading } = useAuth();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Modals state
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Receive Cut Pieces Form State
  const [receiveCuttingPerson, setReceiveCuttingPerson] = useState("Cutting Master");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveQuantities, setReceiveQuantities] = useState<SizeQuantities>({
    S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
  });
  const [submittingReceive, setSubmittingReceive] = useState(false);

  // Generate Barcode Form State
  const [barcodeSize, setBarcodeSize] = useState<"S" | "M" | "L">("S");
  const [barcodeItem, setBarcodeItem] = useState<"Qameez" | "Shalwar" | "Dupatta">("Qameez");
  const [barcodeQuantity, setBarcodeQuantity] = useState<number>(0);
  const [submittingBarcode, setSubmittingBarcode] = useState(false);
  const [barcodeSuccessMessage, setBarcodeSuccessMessage] = useState("");

  // Delete Confirmation State
  const [poToDelete, setPoToDelete] = useState<PurchaseOrder | null>(null);
  const [deletingPO, setDeletingPO] = useState(false);

  const handleConfirmDelete = async () => {
    if (!poToDelete) return;
    setDeletingPO(true);
    try {
      const res = await fetch(`/api/purchase-orders/${poToDelete._id}?cascade=true`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || `Purchase Order ${poToDelete.poNumber} deleted`);
        setPoToDelete(null);
        fetchPurchaseOrders();
      } else {
        toast.error(data.message || "Failed to delete purchase order");
      }
    } catch (err: any) {
      toast.error(err.message || "Error deleting purchase order");
    } finally {
      setDeletingPO(false);
    }
  };

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
      } else {
        toast.error(data.message || "Failed to load purchase orders");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error fetching purchase orders");
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

  // Open Receive Modal
  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setReceiveCuttingPerson("Cutting Master");
    setReceiveNotes("");
    // Default form with zeroes
    setReceiveQuantities({
      S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    });
    setShowReceiveModal(true);
  };

  // Open Barcode Modal
  const openBarcodeModal = (po: PurchaseOrder, defaultSize?: "S" | "M" | "L", defaultItem?: "Qameez" | "Shalwar" | "Dupatta") => {
    setSelectedPO(po);
    setBarcodeSuccessMessage("");
    const size = defaultSize || "S";
    const item = defaultItem || "Qameez";
    setBarcodeSize(size);
    setBarcodeItem(item);
    
    // Calculate initial available
    const rec = po.receivedQuantities[size]?.[item] || 0;
    const bar = po.barcodedQuantities[size]?.[item] || 0;
    const avail = Math.max(0, rec - bar);
    setBarcodeQuantity(avail > 0 ? avail : 0);
    setShowBarcodeModal(true);
  };

  // Open Details Modal
  const openDetailsModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setShowDetailsModal(true);
  };

  // Handle Receiving Cut Pieces Submission
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    // Build array of items with qty > 0 and validate against remaining planned
    const itemsToReceive: Array<{ size: "S" | "M" | "L"; item: "Qameez" | "Shalwar" | "Dupatta"; quantity: number }> = [];
    for (const s of SIZES) {
      for (const it of ITEMS) {
        const qty = receiveQuantities[s][it];
        if (qty > 0) {
          const planned = selectedPO.plannedQuantities[s]?.[it] || 0;
          const rec = selectedPO.receivedQuantities[s]?.[it] || 0;
          const remaining = Math.max(0, planned - rec);

          if (qty > remaining) {
            toast.error(
              `Cannot receive ${qty} pieces of ${it} (${SIZE_LABELS[s]}). Only ${remaining} remaining planned pieces can be received (${rec}/${planned} already received).`
            );
            return;
          }

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
          cuttingPersonName: "Cutting Master",
          notes: receiveNotes,
          receivedBy: user?.name || "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Cut pieces recorded successfully!");
        setShowReceiveModal(false);
        fetchPurchaseOrders();
      } else {
        toast.error(data.message || "Failed to record cut pieces");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to submit cut pieces");
    } finally {
      setSubmittingReceive(false);
    }
  };

  // Handle Barcode Generation Submission (with strict check)
  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;

    const received = selectedPO.receivedQuantities[barcodeSize]?.[barcodeItem] || 0;
    const barcoded = selectedPO.barcodedQuantities[barcodeSize]?.[barcodeItem] || 0;
    const available = Math.max(0, received - barcoded);

    if (barcodeQuantity <= 0) {
      toast.error("Please enter a quantity greater than 0");
      return;
    }

    if (barcodeQuantity > available) {
      toast.error(
        `Cannot generate ${barcodeQuantity} pieces. Only ${available} pieces of ${barcodeItem} (${SIZE_LABELS[barcodeSize]}) are received from cutting master!`
      );
      return;
    }

    setSubmittingBarcode(true);
    try {
      const res = await fetch(`/api/purchase-orders/${selectedPO._id}/generate-barcodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          size: barcodeSize,
          item: barcodeItem,
          quantity: barcodeQuantity,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Barcodes generated successfully!");
        setBarcodeSuccessMessage(
          `Successfully generated ${data.count} barcodes for ${barcodeItem} (${SIZE_LABELS[barcodeSize]})! They are ready to print.`
        );
        fetchPurchaseOrders();
      } else {
        toast.error(data.message || "Failed to generate barcodes");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate barcodes");
    } finally {
      setSubmittingBarcode(false);
    }
  };

  // Calculate current available for selected barcode size & item
  const currentAvailableForBarcode = useMemo(() => {
    if (!selectedPO) return 0;
    const rec = selectedPO.receivedQuantities[barcodeSize]?.[barcodeItem] || 0;
    const bar = selectedPO.barcodedQuantities[barcodeSize]?.[barcodeItem] || 0;
    return Math.max(0, rec - bar);
  }, [selectedPO, barcodeSize, barcodeItem]);

  // Overall metric cards
  const metrics = useMemo(() => {
    let planned = 0;
    let received = 0;
    let barcoded = 0;
    purchaseOrders.forEach((po) => {
      planned += po.totalPlanned || 0;
      received += po.totalReceived || 0;
      barcoded += po.totalBarcoded || 0;
    });
    return {
      totalPOs: purchaseOrders.length,
      planned,
      received,
      barcoded,
      availableToBarcode: Math.max(0, received - barcoded),
    };
  }, [purchaseOrders]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active="purchase-orders" setActive={() => {}} />

      <div className="w-full lg:ml-64 p-4 sm:p-8 pt-20 lg:pt-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold">
                <FileText size={22} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Purchase Orders (Cutting POs)</h1>
                <p className="text-sm text-gray-500">
                  Manage POs, log received cut pieces from cutting person, and generate barcodes safely.
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/po-receipts"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 rounded-lg font-medium shadow-xs transition"
            >
              <Receipt size={18} />
              PO Receipts
            </Link>
            <Link
              href="/generate-barcodes"
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-sm transition"
            >
              <Plus size={18} />
              Create New PO
            </Link>
            <Link
              href="/print-barcodes"
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg font-medium shadow-sm transition"
            >
              <Printer size={18} />
              Print Barcodes
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total POs</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{metrics.totalPOs}</p>
            <p className="text-xs text-gray-400 mt-1">Orders created</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Planned Pieces</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{metrics.planned}</p>
            <p className="text-xs text-gray-400 mt-1">Target piece volume</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Received Cut Pieces</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{metrics.received}</p>
            <p className="text-xs text-gray-400 mt-1">From cutting person</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available To Barcode</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{metrics.availableToBarcode}</p>
            <p className="text-xs text-gray-400 mt-1">Received & awaiting QR</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search by Design Name or PO #..."
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
              <option value="all">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Purchase Orders Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="py-3.5 px-4">PO Number</th>
                  <th className="py-3.5 px-4">Design Name</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-center">Planned</th>
                  <th className="py-3.5 px-4 text-center">Received</th>
                  <th className="py-3.5 px-4 text-center">Barcoded</th>
                  <th className="py-3.5 px-4 text-center">Available To Barcode</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      <Loader2 className="animate-spin inline-block mr-2" size={20} />
                      Loading Purchase Orders...
                    </td>
                  </tr>
                ) : purchaseOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500">
                      <FileText className="mx-auto text-gray-400 mb-2" size={32} />
                      No Purchase Orders found. Click <strong>"Create New PO"</strong> to start.
                    </td>
                  </tr>
                ) : (
                  purchaseOrders.map((po) => {
                    const statusBadge =
                      po.status === "Completed"
                        ? "bg-green-100 text-green-800"
                        : po.status === "In Progress"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-blue-100 text-blue-800";

                    return (
                      <tr key={po._id} className="hover:bg-gray-50/80 transition">
                        <td className="py-4 px-4 font-bold text-gray-900">
                          {po.poNumber}
                          <span className="block text-xs font-normal text-gray-400">
                            {new Date(po.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-gray-900">
                          {po.design}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge}`}>
                            {po.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-gray-700">
                          {po.totalPlanned}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-amber-700">
                          {po.totalReceived}
                        </td>
                        <td className="py-4 px-4 text-center font-semibold text-blue-700">
                          {po.totalBarcoded}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                              po.availableToBarcode > 0
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 text-gray-500"
                            }`}
                          >
                            {po.availableToBarcode} pcs
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openReceiveModal(po)}
                              title={
                                po.totalReceived >= po.totalPlanned
                                  ? "All planned pieces received"
                                  : "Record cut pieces received from cutting master"
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                                po.totalReceived >= po.totalPlanned
                                  ? "bg-gray-100 text-gray-500 border border-gray-200"
                                  : "bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200"
                              }`}
                            >
                              <Scissors size={14} />
                              {po.totalReceived >= po.totalPlanned ? "Received" : "Receive"}
                            </button>
                            <button
                              onClick={() => openBarcodeModal(po)}
                              disabled={po.availableToBarcode <= 0}
                              title={
                                po.availableToBarcode > 0
                                  ? "Generate barcode for received pieces"
                                  : "Receive cut pieces first before generating barcodes"
                              }
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition ${
                                po.availableToBarcode > 0
                                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                                  : "bg-gray-200 text-gray-400 cursor-not-allowed"
                              }`}
                            >
                              <QrCode size={14} />
                              Generate Barcode
                            </button>
                            <Link
                              href="/po-receipts"
                              title="View official Mughliaz receiving receipt"
                              className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-medium flex items-center gap-1 transition"
                            >
                              <Receipt size={14} />
                              Receipt
                            </Link>
                            <button
                              onClick={() => openDetailsModal(po)}
                              title="View details and audit logs"
                              className="p-1.5 hover:bg-gray-200 text-gray-600 rounded-lg transition"
                            >
                              <ChevronRight size={18} />
                            </button>
                            <button
                              onClick={() => setPoToDelete(po)}
                              title="Delete Purchase Order"
                              className="p-1.5 hover:bg-red-50 text-red-500 hover:text-red-700 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================= MODAL 1: RECEIVE CUT PIECES ================= */}
        {showReceiveModal && selectedPO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between border-b pb-4 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">
                    Receive Cut Pieces from Cutting Master
                  </h3>
                  <p className="text-xs text-gray-500">
                    PO: <strong className="text-gray-800">{selectedPO.poNumber}</strong> | Design:{" "}
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
                {/* Cutting Person & Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Cutting Person
                    </label>
                    <div className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Cutting Master
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      Batch Notes (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. First 20 suits delivered"
                      value={receiveNotes}
                      onChange={(e) => setReceiveNotes(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Check if all planned pieces have already been received */}
                {(() => {
                  const totalRemaining = SIZES.reduce((sumS, s) => {
                    return (
                      sumS +
                      ITEMS.reduce((sumI, it) => {
                        const planned = selectedPO.plannedQuantities[s]?.[it] || 0;
                        const rec = selectedPO.receivedQuantities[s]?.[it] || 0;
                        return sumI + Math.max(0, planned - rec);
                      }, 0)
                    );
                  }, 0);

                  if (totalRemaining === 0) {
                    return (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-xl mb-4 text-xs text-green-800 flex items-center gap-2">
                        <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                        <div>
                          <strong>All Planned Cut Pieces Received!</strong>
                          <p>
                            All planned pieces ({selectedPO.totalPlanned || 0} pcs) for this PO have already been received from the cutting department. No extra pieces can be received.
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Quantities Grid */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Cut Pieces Received in this Delivery (Max: Remaining Planned)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        // Quick fill remaining planned
                        const newQty: SizeQuantities = {
                          S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
                          M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
                          L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
                        };
                        for (const s of SIZES) {
                          for (const it of ITEMS) {
                            const planned = selectedPO.plannedQuantities[s]?.[it] || 0;
                            const rec = selectedPO.receivedQuantities[s]?.[it] || 0;
                            newQty[s][it] = Math.max(0, planned - rec);
                          }
                        }
                        setReceiveQuantities(newQty);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium underline"
                    >
                      Fill Remaining Planned
                    </button>
                  </div>

                  <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-center text-sm">
                      <thead className="bg-gray-50 text-xs font-semibold text-gray-600 border-b">
                        <tr>
                          <th className="py-2.5 px-3 text-left">Size</th>
                          <th className="py-2.5 px-3">Qameez</th>
                          <th className="py-2.5 px-3">Shalwar</th>
                          <th className="py-2.5 px-3">Dupatta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {SIZES.map((size) => (
                          <tr key={size} className="hover:bg-gray-50">
                            <td className="py-3 px-3 text-left font-bold text-gray-900">
                              {SIZE_LABELS[size]} ({size})
                            </td>
                            {ITEMS.map((item) => {
                              const planned = selectedPO.plannedQuantities[size]?.[item] || 0;
                              const alreadyRec = selectedPO.receivedQuantities[size]?.[item] || 0;
                              const remaining = Math.max(0, planned - alreadyRec);
                              const isComplete = remaining === 0;

                              return (
                                <td key={item} className="py-3 px-2">
                                  <div className="flex flex-col items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      max={remaining}
                                      disabled={isComplete}
                                      value={receiveQuantities[size][item] || ""}
                                      onChange={(e) => {
                                        let val = parseInt(e.target.value) || 0;
                                        if (val < 0) val = 0;
                                        if (val > remaining) {
                                          val = remaining;
                                          toast.error(
                                            `Cannot exceed planned quantity! Max allowed for ${SIZE_LABELS[size]} ${item} is ${remaining} (${alreadyRec}/${planned} already received).`
                                          );
                                        }
                                        setReceiveQuantities((prev) => ({
                                          ...prev,
                                          [size]: {
                                            ...prev[size],
                                            [item]: val,
                                          },
                                        }));
                                      }}
                                      placeholder="0"
                                      className={`w-20 text-center border rounded-lg px-2 py-1.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 ${
                                        isComplete
                                          ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                                          : "border-gray-300"
                                      }`}
                                    />
                                    <span
                                      className={`text-[10px] font-medium ${
                                        isComplete
                                          ? "text-green-600 font-semibold"
                                          : alreadyRec > 0
                                          ? "text-amber-600 font-semibold"
                                          : "text-gray-500"
                                      }`}
                                    >
                                      {isComplete
                                        ? `All ${planned} Received`
                                        : `${remaining} left (${alreadyRec}/${planned})`}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowReceiveModal(false)}
                    className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  {(() => {
                    const totalRemaining = SIZES.reduce((sumS, s) => {
                      return (
                        sumS +
                        ITEMS.reduce((sumI, it) => {
                          const planned = selectedPO.plannedQuantities[s]?.[it] || 0;
                          const rec = selectedPO.receivedQuantities[s]?.[it] || 0;
                          return sumI + Math.max(0, planned - rec);
                        }, 0)
                      );
                    }, 0);

                    return (
                      <button
                        type="submit"
                        disabled={submittingReceive || totalRemaining === 0}
                        className={`px-5 py-2 rounded-lg text-sm font-medium shadow-xs flex items-center gap-2 ${
                          submittingReceive || totalRemaining === 0
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-amber-600 hover:bg-amber-700 text-white"
                        }`}
                      >
                        {submittingReceive ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Saving Receipt...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            Confirm & Add Cut Pieces
                          </>
                        )}
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ================= MODAL 2: GENERATE BARCODE BASED ON RECEIVED STOCK ================= */}
        {showBarcodeModal && selectedPO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Generate Barcode</h3>
                  <p className="text-xs text-gray-500">
                    PO: <strong className="text-gray-800">{selectedPO.poNumber}</strong> | Design:{" "}
                    <strong className="text-gray-800">{selectedPO.design}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowBarcodeModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {barcodeSuccessMessage ? (
                <div className="space-y-4 py-3">
                  <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 size={18} className="text-green-600" />
                      Barcodes Generated!
                    </div>
                    <p className="text-sm mt-1">{barcodeSuccessMessage}</p>
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-3">
                    <button
                      onClick={() => {
                        setBarcodeSuccessMessage("");
                        setBarcodeQuantity(0);
                      }}
                      className="px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Generate Another
                    </button>
                    <Link
                      href="/print-barcodes"
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-xs flex items-center gap-1.5"
                    >
                      <Printer size={16} />
                      Go to Print Barcodes
                    </Link>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleBarcodeSubmit}>
                  {/* Notice about inherited rates */}
                  <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl mb-4 text-xs text-indigo-700">
                    <p className="font-semibold flex items-center gap-1.5 mb-1">
                      <CheckCircle2 size={14} /> Department Rates Automatically Applied
                    </p>
                    <p>
                      Rates saved in this PO (Cutting, Sewing, Quality, Overlock, Clipping, etc.) will be attached directly to these barcodes. No need to re-enter rates!
                    </p>
                  </div>

                  {/* Size and Item Selector */}
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Select Item
                      </label>
                      <select
                        value={barcodeItem}
                        onChange={(e) => {
                          const item = e.target.value as "Qameez" | "Shalwar" | "Dupatta";
                          setBarcodeItem(item);
                          const rec = selectedPO.receivedQuantities[barcodeSize]?.[item] || 0;
                          const bar = selectedPO.barcodedQuantities[barcodeSize]?.[item] || 0;
                          setBarcodeQuantity(Math.max(0, rec - bar));
                        }}
                        className="w-full border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {ITEMS.map((it) => (
                          <option key={it} value={it}>
                            {it}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Select Size
                      </label>
                      <select
                        value={barcodeSize}
                        onChange={(e) => {
                          const size = e.target.value as "S" | "M" | "L";
                          setBarcodeSize(size);
                          const rec = selectedPO.receivedQuantities[size]?.[barcodeItem] || 0;
                          const bar = selectedPO.barcodedQuantities[size]?.[barcodeItem] || 0;
                          setBarcodeQuantity(Math.max(0, rec - bar));
                        }}
                        className="w-full border rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        {SIZES.map((s) => (
                          <option key={s} value={s}>
                            {SIZE_LABELS[s]} ({s})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Stock Availability Card */}
                  <div className="p-3.5 bg-gray-50 border rounded-xl mb-4 text-xs space-y-1">
                    <div className="flex justify-between text-gray-600">
                      <span>Received from Cutting Master:</span>
                      <strong className="text-gray-900">
                        {selectedPO.receivedQuantities[barcodeSize]?.[barcodeItem] || 0} pcs
                      </strong>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Already Barcoded:</span>
                      <strong className="text-gray-900">
                        {selectedPO.barcodedQuantities[barcodeSize]?.[barcodeItem] || 0} pcs
                      </strong>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-bold pt-1 border-t border-gray-200">
                      <span>Available to Barcode:</span>
                      <span className="text-sm">{currentAvailableForBarcode} pcs</span>
                    </div>
                  </div>

                  {/* Quantity to generate */}
                  <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Quantity of Barcodes to Generate
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={currentAvailableForBarcode > 0 ? currentAvailableForBarcode : 1}
                      value={barcodeQuantity || ""}
                      onChange={(e) => setBarcodeQuantity(parseInt(e.target.value) || 0)}
                      placeholder="e.g. 15"
                      className="w-full border rounded-lg px-4 py-2.5 text-base font-bold text-gray-900 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* STRICT SAFETY WARNING IF QUANTITY EXCEEDS AVAILABLE */}
                  {barcodeQuantity > currentAvailableForBarcode && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl mb-4 text-xs text-red-700 flex items-start gap-2">
                      <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Cannot generate {barcodeQuantity} pieces!</strong>
                        <p>
                          Only {currentAvailableForBarcode} pieces of {barcodeItem} ({SIZE_LABELS[barcodeSize]}) have been received from the cutting master. You cannot barcode more pieces than you have received.
                        </p>
                      </div>
                    </div>
                  )}

                  {currentAvailableForBarcode === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>No cut pieces available for this item yet!</strong>
                        <p>
                          Please click "Receive" to log cut pieces from the cutting master before generating barcodes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setShowBarcodeModal(false)}
                      className="px-4 py-2 border rounded-lg text-sm text-gray-600 hover:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        submittingBarcode ||
                        barcodeQuantity <= 0 ||
                        barcodeQuantity > currentAvailableForBarcode
                      }
                      className={`px-5 py-2 rounded-lg text-sm font-semibold shadow-xs flex items-center gap-2 ${
                        barcodeQuantity > 0 && barcodeQuantity <= currentAvailableForBarcode && !submittingBarcode
                          ? "bg-blue-600 hover:bg-blue-700 text-white"
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                      }`}
                    >
                      {submittingBarcode ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <QrCode size={16} />
                          Generate {barcodeQuantity || 0} Barcodes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ================= MODAL 3: PO DETAILS & AUDIT LOGS ================= */}
        {showDetailsModal && selectedPO && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
              <div className="flex items-center justify-between border-b pb-4 mb-5">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-bold text-gray-900">
                      PO {selectedPO.poNumber}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                      {selectedPO.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Design: <strong className="text-gray-900">{selectedPO.design}</strong> | Created:{" "}
                    {new Date(selectedPO.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Matrix Breakdown */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider">
                  Quantities Matrix (Planned vs Received vs Barcoded)
                </h4>
                <div className="overflow-x-auto border rounded-xl">
                  <table className="w-full text-center text-xs">
                    <thead className="bg-gray-50 text-gray-600 border-b">
                      <tr>
                        <th className="py-2.5 px-3 text-left">Size</th>
                        <th className="py-2.5 px-3 text-left">Item</th>
                        <th className="py-2.5 px-3">Planned</th>
                        <th className="py-2.5 px-3 text-amber-700">Received (Cutting)</th>
                        <th className="py-2.5 px-3 text-blue-700">Barcoded</th>
                        <th className="py-2.5 px-3 text-emerald-700">Available to Barcode</th>
                        <th className="py-2.5 px-3 text-right">Quick Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {SIZES.map((size) =>
                        ITEMS.map((item) => {
                          const planned = selectedPO.plannedQuantities[size]?.[item] || 0;
                          const received = selectedPO.receivedQuantities[size]?.[item] || 0;
                          const barcoded = selectedPO.barcodedQuantities[size]?.[item] || 0;
                          const avail = Math.max(0, received - barcoded);

                          return (
                            <tr key={`${size}-${item}`} className="hover:bg-gray-50">
                              <td className="py-2 px-3 text-left font-medium text-gray-900">
                                {SIZE_LABELS[size]}
                              </td>
                              <td className="py-2 px-3 text-left font-medium text-gray-800">
                                {item}
                              </td>
                              <td className="py-2 px-3 font-semibold text-gray-700">
                                {planned}
                              </td>
                              <td className="py-2 px-3 font-semibold text-amber-700">
                                {received}
                              </td>
                              <td className="py-2 px-3 font-semibold text-blue-700">
                                {barcoded}
                              </td>
                              <td className="py-2 px-3 font-bold text-emerald-700">
                                {avail}
                              </td>
                              <td className="py-2 px-3 text-right">
                                {avail > 0 ? (
                                  <button
                                    onClick={() => {
                                      setShowDetailsModal(false);
                                      openBarcodeModal(selectedPO, size, item);
                                    }}
                                    className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded font-medium text-[11px]"
                                  >
                                    + Barcode ({avail})
                                  </button>
                                ) : (
                                  <span className="text-gray-400 text-[11px]">No stock</span>
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

              {/* Department Rates Saved for this PO */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-gray-900 mb-2 uppercase tracking-wider">
                  Saved Department Rates (Rs. Per Piece)
                </h4>
                <p className="text-xs text-gray-500 mb-3">
                  These rates are attached automatically to every barcode generated under this PO.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {selectedPO.departmentRates && selectedPO.departmentRates.length > 0 ? (
                    selectedPO.departmentRates.map((r, idx) => (
                      <div key={idx} className="p-2.5 bg-gray-50 border rounded-lg text-xs">
                        <span className="font-semibold text-gray-800 block truncate">{r.department}</span>
                        <span className="text-gray-500">{r.item || "Piece"}: </span>
                        <strong className="text-blue-700">Rs. {r.ratePerPiece}</strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-400 col-span-full">No custom rates attached</p>
                  )}
                </div>
              </div>

              {/* Receiving Logs */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-3 uppercase tracking-wider flex items-center gap-1.5">
                  <History size={16} /> Cut Pieces Delivery History (Audit Logs)
                </h4>
                {selectedPO.receivingLogs && selectedPO.receivingLogs.length > 0 ? (
                  <div className="space-y-3">
                    {selectedPO.receivingLogs.map((log, idx) => (
                      <div key={idx} className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl text-xs">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="font-semibold text-amber-900">
                            Delivered by: {log.cuttingPersonName || "Cutting Master"}
                          </span>
                          <span className="text-gray-500">
                            {new Date(log.receivedAt).toLocaleString()}
                          </span>
                        </div>
                        {log.notes && (
                          <p className="text-gray-600 mb-1.5 italic">Note: "{log.notes}"</p>
                        )}
                        <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200">
                          {log.items.map((it, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white border border-amber-300 rounded font-medium text-amber-800">
                              {it.item} ({SIZE_LABELS[it.size]}): +{it.quantity} pcs
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No cut piece receipts recorded yet.</p>
                )}
              </div>

              {/* Details Modal Footer */}
              <div className="mt-6 pt-4 border-t flex items-center justify-between">
                <button
                  onClick={() => {
                    const toDel = selectedPO;
                    setShowDetailsModal(false);
                    setPoToDelete(toDel);
                  }}
                  className="px-3 py-1.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition font-medium flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 size={14} />
                  Delete PO
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= MODAL 4: DELETE CONFIRMATION ================= */}
        {poToDelete && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                  <Trash2 size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Delete Purchase Order</h3>
                  <p className="text-xs text-gray-500">Please confirm before proceeding</p>
                </div>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-xs mb-4 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">PO Number:</span>
                  <strong className="text-gray-900 font-mono">{poToDelete.poNumber}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Design Name:</span>
                  <strong className="text-gray-900">{poToDelete.design}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Status:</span>
                  <span className="font-semibold text-gray-800">{poToDelete.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Planned Pieces:</span>
                  <span className="font-semibold text-gray-800">{poToDelete.totalPlanned} pcs</span>
                </div>
                {poToDelete.totalBarcoded > 0 && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 font-semibold pt-1.5 mt-2">
                    ⚠️ Warning: This PO has <strong>{poToDelete.totalBarcoded}</strong> generated barcodes. Deleting this PO will also permanently remove these {poToDelete.totalBarcoded} barcodes.
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-600 mb-6">
                Are you sure you want to delete <strong className="text-gray-900">{poToDelete.poNumber}</strong>? This action cannot be undone.
              </p>

              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setPoToDelete(null)}
                  disabled={deletingPO}
                  className="px-4 py-2 border rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deletingPO}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs"
                >
                  {deletingPO ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      Yes, Delete PO
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
