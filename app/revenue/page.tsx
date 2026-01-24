"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { 
  DollarSign, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  RefreshCw,
  ArrowLeft,
  CreditCard,
  AlertCircle,
  XCircle,
  Search
} from "lucide-react";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

interface RevenueSummary {
  totalInStore: number;
  totalDispatched: number;
  totalDelivered: number;
  totalReturned: number;
  inventoryValue: number;
  totalCreditSale: number;
  totalRevenue: number;
  totalPending: number;
}

interface DispatchedItem {
  _id: string;
  design: string;
  size: string;
  suitType: string;
  unitNumber: number;
  sellingPrice: number;
  status: string;
  dispatchInfo?: {
    dispatchedAt: string;
    dispatchedBy: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
  };
  paymentInfo?: {
    isPaid: boolean;
    amountReceived: number;
    paidAt?: string;
    receivedBy?: string;
  };
}

export default function RevenuePage() {
  const { user, logout } = useAuth();
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [dispatchedItems, setDispatchedItems] = useState<DispatchedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"pending" | "delivered">("pending");
  const [paymentModal, setPaymentModal] = useState<{
    show: boolean;
    item: DispatchedItem | null;
    amount: string;
    notes: string;
  }>({ show: false, item: null, amount: "", notes: "" });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, itemsRes] = await Promise.all([
        fetch("/api/revenue"),
        fetch("/api/revenue/items")
      ]);

      const summaryData = await summaryRes.json();
      const itemsData = await itemsRes.json();

      if (summaryData.success) {
        setSummary(summaryData.summary);
      }
      if (itemsData.success) {
        setDispatchedItems(itemsData.items);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load revenue data");
    } finally {
      setLoading(false);
    }
  };

  const openPaymentModal = (item: DispatchedItem) => {
    setPaymentModal({
      show: true,
      item,
      amount: item.sellingPrice.toString(),
      notes: ""
    });
  };

  const handleMarkPayment = async () => {
    if (!paymentModal.item) return;
    
    setProcessingId(paymentModal.item._id);
    try {
      const response = await fetch("/api/revenue/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stickerId: paymentModal.item._id,
          amountReceived: parseFloat(paymentModal.amount),
          receivedBy: user?.name || user?.username,
          notes: paymentModal.notes
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Payment of Rs. ${paymentModal.amount} received!`);
        setPaymentModal({ show: false, item: null, amount: "", notes: "" });
        fetchData();
      } else {
        toast.error(result.message || "Failed to record payment");
      }
    } catch (error) {
      toast.error("Failed to record payment");
    } finally {
      setProcessingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  };

  const filteredItems = dispatchedItems.filter(item => {
    const matchesSearch = 
      item.design.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.suitType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.dispatchInfo?.customerName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === "pending") {
      return matchesSearch && item.status === "dispatched";
    } else {
      return matchesSearch && item.status === "delivered";
    }
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-gray-900">
              <ArrowLeft size={24} />
            </Link>
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <DollarSign className="text-white" size={24} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Revenue & Payments</h1>
              <p className="text-sm text-gray-500">Track dispatched items and record payments</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <RefreshCw size={18} />
            Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Package className="text-blue-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">In Store</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalInStore}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">Value: Rs. {summary.inventoryValue.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Truck className="text-orange-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dispatched</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalDispatched}</p>
                </div>
              </div>
              <p className="text-xs text-orange-600 mt-2">Credit: Rs. {summary.totalCreditSale.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="text-green-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Delivered & Paid</p>
                  <p className="text-2xl font-bold text-gray-900">{summary.totalDelivered}</p>
                </div>
              </div>
              <p className="text-xs text-green-600 mt-2">Revenue: Rs. {summary.totalRevenue.toLocaleString()}</p>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Clock className="text-yellow-600" size={20} />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Pending Payment</p>
                  <p className="text-2xl font-bold text-yellow-600">Rs. {summary.totalPending.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs and Search */}
        <div className="bg-white rounded-xl shadow-sm mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "pending"
                  ? "text-orange-600 border-b-2 border-orange-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Truck className="inline-block mr-2" size={16} />
              Pending Payments ({dispatchedItems.filter(i => i.status === "dispatched").length})
            </button>
            <button
              onClick={() => setActiveTab("delivered")}
              className={`flex-1 px-4 py-3 text-sm font-medium ${
                activeTab === "delivered"
                  ? "text-green-600 border-b-2 border-green-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <CheckCircle className="inline-block mr-2" size={16} />
              Paid & Delivered ({dispatchedItems.filter(i => i.status === "delivered").length})
            </button>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by design, suit type, or customer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Items List */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="text-center py-12">
              <Package className="mx-auto text-gray-300 mb-4" size={48} />
              <p className="text-gray-500">
                {activeTab === "pending" ? "No pending payments" : "No delivered items"}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredItems.map((item) => (
                <div key={item._id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-gray-900">{item.design}</h3>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full">
                          #{item.unitNumber}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.status === "dispatched" 
                            ? "bg-orange-100 text-orange-700" 
                            : "bg-green-100 text-green-700"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span>{item.suitType}</span>
                        <span>Size: {item.size}</span>
                        <span className="font-semibold text-green-600">
                          Rs. {item.sellingPrice.toLocaleString()}
                        </span>
                      </div>
                      {item.dispatchInfo && (
                        <div className="mt-2 text-xs text-gray-400">
                          <span>Dispatched: {formatDate(item.dispatchInfo.dispatchedAt)}</span>
                          <span className="mx-2">|</span>
                          <span>By: {item.dispatchInfo.dispatchedBy}</span>
                          {item.dispatchInfo.customerName && (
                            <>
                              <span className="mx-2">|</span>
                              <span>Customer: {item.dispatchInfo.customerName}</span>
                            </>
                          )}
                        </div>
                      )}
                      {item.paymentInfo?.isPaid && item.paymentInfo.paidAt && (
                        <div className="mt-2 text-xs text-green-600">
                          <span>Paid: Rs. {item.paymentInfo.amountReceived.toLocaleString()}</span>
                          <span className="mx-2">|</span>
                          <span>{formatDate(item.paymentInfo.paidAt)}</span>
                          <span className="mx-2">|</span>
                          <span>By: {item.paymentInfo.receivedBy}</span>
                        </div>
                      )}
                    </div>
                    
                    {item.status === "dispatched" && (
                      <button
                        onClick={() => openPaymentModal(item)}
                        disabled={processingId === item._id}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
                      >
                        {processingId === item._id ? (
                          <RefreshCw className="animate-spin" size={16} />
                        ) : (
                          <CreditCard size={16} />
                        )}
                        Payment Received
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal.show && paymentModal.item && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Record Payment</h3>
              <button
                onClick={() => setPaymentModal({ show: false, item: null, amount: "", notes: "" })}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle size={20} />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-500">Item Details</p>
                <p className="font-semibold">{paymentModal.item.design} - {paymentModal.item.suitType}</p>
                <p className="text-xs text-gray-400">Unit #{paymentModal.item.unitNumber} | Size: {paymentModal.item.size}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Received (Rs.)
                </label>
                <input
                  type="number"
                  value={paymentModal.amount}
                  onChange={(e) => setPaymentModal({ ...paymentModal, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Selling price: Rs. {paymentModal.item.sellingPrice.toLocaleString()}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={paymentModal.notes}
                  onChange={(e) => setPaymentModal({ ...paymentModal, notes: e.target.value })}
                  placeholder="Any payment notes..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {parseFloat(paymentModal.amount) < paymentModal.item.sellingPrice && (
                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 p-2 rounded-lg text-sm">
                  <AlertCircle size={16} />
                  Amount is less than selling price
                </div>
              )}
            </div>

            <div className="p-4 border-t flex gap-3">
              <button
                onClick={() => setPaymentModal({ show: false, item: null, amount: "", notes: "" })}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkPayment}
                disabled={!paymentModal.amount || processingId !== null}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processingId ? (
                  <RefreshCw className="animate-spin" size={16} />
                ) : (
                  <CheckCircle size={16} />
                )}
                Confirm Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
