"use client";
import React, { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { RefreshCw, Package, Eye, Trash2, ExternalLink, Link as LinkIcon } from "lucide-react";

interface TransformedFulfillment {
  _id: string;
  orderId: string;
  orderNumber: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    city: string;
    address: string;
    province?: string;
    postalCode?: string;
    country?: string;
  };
  product: {
    name: string;
    variant: string;
    sku?: string;
    quantity: number;
    price: number;
  };
  payment: {
    method: string;
    status: string;
  };
  fulfillment: {
    status: string;
    trackingCompany: string;
    trackingNumber: string;
    trackingUrl: string;
  };
  pricing: {
    subtotal: number;
    tax: number;
    shipping: number;
    total: number;
    currency: string;
  };
  createdAt: string;
  updatedAt: string;
  shopifyOrderId?: string;
  rawPayload?: any;
}



export default function AdminFulfillmentPage() {
  const [fulfillments, setFulfillments] = useState<TransformedFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState<Set<string>>(new Set());
  const [selectedFulfillment, setSelectedFulfillment] = useState<TransformedFulfillment | null>(null);
  const [showRawData, setShowRawData] = useState(false);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>("all");

  const fetchFulfillments = useCallback(async (showRefresh = false, status: string = "all") => {
    if (showRefresh) setRefreshing(true);
    try {
      let url = "/api/fulfillments";
      if (status !== "all") {
        url += `?status=${encodeURIComponent(status)}`;
      }
      
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setFulfillments(data.data || []);
    } catch (e) {
      console.error("Failed to fetch fulfillments:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const deleteFulfillment = useCallback(async (fulfillmentId: string) => {
    if (!confirm("Are you sure you want to delete this fulfillment?")) return;
    
    setDeletingOrders(prev => new Set(prev.add(fulfillmentId)));
    
    try {
      const res = await fetch(`/api/fulfillments?id=${fulfillmentId}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      
      if (data.success) {
        setFulfillments(prev => prev.filter(o => o._id !== fulfillmentId));
        alert("Fulfillment deleted successfully!");
      } else {
        throw new Error(data.error || "Failed to delete fulfillment");
      }
    } catch (e: any) {
      console.error("Delete error:", e);
      alert(`Failed to delete fulfillment: ${e.message}`);
    } finally {
      setDeletingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(fulfillmentId);
        return newSet;
      });
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchFulfillments(false, paymentStatusFilter);
  }, [fetchFulfillments, paymentStatusFilter]);

  const handleViewRawData = (fulfillment: TransformedFulfillment) => {
    setSelectedFulfillment(fulfillment);
    setShowRawData(true);
  };

  const getPaymentStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "pending") return "bg-yellow-100 text-yellow-800";
    if (lowerStatus === "paid") return "bg-green-100 text-green-800";
    if (lowerStatus === "failed") return "bg-red-100 text-red-800";
    return "bg-gray-100 text-gray-800";
  };

  const getFulfillmentStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "fulfilled") return "bg-green-100 text-green-800";
    if (lowerStatus === "pending") return "bg-yellow-100 text-yellow-800";
    if (lowerStatus === "cancelled") return "bg-red-100 text-red-800";
    return "bg-blue-100 text-blue-800";
  };

  const handleFilterChange = (status: string) => {
    setPaymentStatusFilter(status);
  };

  const getFilterButtonClass = (status: string) => {
    const isActive = paymentStatusFilter === status;
    return `px-4 py-2 rounded-lg font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 text-white"
        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
    }`;
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Package className="text-indigo-600" size={24} />
                <h1 className="text-xl font-bold text-gray-900">Fulfillment Orders</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {fulfillments.length} fulfillment{fulfillments.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => fetchFulfillments(true, paymentStatusFilter)}
                  disabled={refreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>



        {/* Filter Section */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Filter by Payment Status:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleFilterChange("all")}
                  className={getFilterButtonClass("all")}
                >
                  All
                </button>
                <button
                  onClick={() => handleFilterChange("pending")}
                  className={getFilterButtonClass("pending")}
                >
                  Pending
                </button>
                <button
                  onClick={() => handleFilterChange("paid")}
                  className={getFilterButtonClass("paid")}
                >
                  Paid
                </button>
                <button
                  onClick={() => handleFilterChange("voided")}
                  className={getFilterButtonClass("voided")}
                >
                  Voided
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
                <p className="text-gray-500 text-sm">Loading orders...</p>
              </div>
            </div>
          ) : fulfillments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Package size={48} className="mb-3" />
              <p className="text-lg font-medium text-gray-500">No orders found</p>
              <p className="text-sm text-gray-400 mt-1">
                Orders will appear here when received from Shopify.
              </p>
            </div>
          ) : (
            // Orders Table - Structured Table
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Payment Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Fulfillment Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fulfillments.map((fulfillment) => (
                      <tr key={fulfillment._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                #{fulfillment.orderNumber}
                              </div>
                              <div className="text-sm text-gray-500">
                                {fulfillment.orderId}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {fulfillment.customer.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            {fulfillment.customer.email}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-mono text-gray-900">
                            {fulfillment.fulfillment.trackingNumber}
                          </div>
                          <div className="text-sm text-gray-500">
                            {fulfillment.fulfillment.trackingCompany}
                          </div>
                          {fulfillment.fulfillment.trackingUrl && (
                            <a
                              href={fulfillment.fulfillment.trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 text-xs mt-1"
                            >
                              <LinkIcon size={12} />
                              Track
                            </a>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(fulfillment.payment.status)}`}>
                            {fulfillment.payment.status}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {fulfillment.payment.method}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getFulfillmentStatusColor(fulfillment.fulfillment.status)}`}>
                            {fulfillment.fulfillment.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {fulfillment.pricing.currency} {fulfillment.pricing.total.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Tax: {fulfillment.pricing.currency} {fulfillment.pricing.tax.toFixed(2)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleViewRawData(fulfillment)}
                              className="text-indigo-600 hover:text-indigo-900"
                              title="View details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => deleteFulfillment(fulfillment._id)}
                              disabled={deletingOrders.has(fulfillment._id)}
                              className="text-red-600 hover:text-red-900 disabled:opacity-50"
                              title="Delete fulfillment"
                            >
                              {deletingOrders.has(fulfillment._id) ? (
                                <RefreshCw size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showRawData && selectedFulfillment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b bg-gray-50">
              <h3 className="text-lg font-medium text-gray-900">
                Fulfillment Details - Order #{selectedFulfillment.orderNumber}
              </h3>
              <button
                onClick={() => setShowRawData(false)}
                className="text-gray-400 hover:text-gray-500 text-2xl"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-60px)]">
              {/* Fulfillment Details */}
              <div className="grid grid-cols-2 gap-6">
                {/* Order Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Order Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Order ID:</span> <span className="font-mono">{selectedFulfillment.orderId}</span></div>
                    <div><span className="text-gray-500">Order Number:</span> <span className="font-medium">#{selectedFulfillment.orderNumber}</span></div>
                    <div><span className="text-gray-500">Created:</span> <span>{new Date(selectedFulfillment.createdAt).toLocaleString()}</span></div>
                  </div>
                </div>

                {/* Customer Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Customer Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedFulfillment.customer.name}</span></div>
                    <div><span className="text-gray-500">Email:</span> <span>{selectedFulfillment.customer.email}</span></div>
                    <div><span className="text-gray-500">Phone:</span> <span>{selectedFulfillment.customer.phone}</span></div>
                  </div>
                </div>

                {/* Shipping Address */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Shipping Address</h4>
                  <div className="space-y-2 text-sm">
                    <div>{selectedFulfillment.shippingAddress.address}</div>
                    <div>{selectedFulfillment.shippingAddress.city}, {selectedFulfillment.shippingAddress.province}</div>
                    <div>{selectedFulfillment.shippingAddress.postalCode}</div>
                    <div>{selectedFulfillment.shippingAddress.country}</div>
                  </div>
                </div>

                {/* Product Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Product Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Name:</span> <span className="font-medium">{selectedFulfillment.product.name}</span></div>
                    <div><span className="text-gray-500">Variant:</span> <span>{selectedFulfillment.product.variant}</span></div>
                    <div><span className="text-gray-500">SKU:</span> <span className="font-mono text-xs">{selectedFulfillment.product.sku || 'N/A'}</span></div>
                    <div><span className="text-gray-500">Quantity:</span> <span>{selectedFulfillment.product.quantity}</span></div>
                  </div>
                </div>

                {/* Payment Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Payment Information</h4>
                  <div className="space-y-2 text-sm">
                    <div><span className="text-gray-500">Method:</span> <span className="font-medium">{selectedFulfillment.payment.method}</span></div>
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(selectedFulfillment.payment.status)}`}>
                        {selectedFulfillment.payment.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fulfillment Info */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3">Fulfillment Information</h4>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getFulfillmentStatusColor(selectedFulfillment.fulfillment.status)}`}>
                        {selectedFulfillment.fulfillment.status}
                      </span>
                    </div>
                    <div><span className="text-gray-500">Tracking Company:</span> <span className="font-medium">{selectedFulfillment.fulfillment.trackingCompany}</span></div>
                    <div><span className="text-gray-500">Tracking Number:</span> <span className="font-mono">{selectedFulfillment.fulfillment.trackingNumber}</span></div>
                    {selectedFulfillment.fulfillment.trackingUrl && (
                      <div>
                        <a
                          href={selectedFulfillment.fulfillment.trackingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:text-indigo-900 flex items-center gap-2"
                        >
                          <LinkIcon size={14} />
                          View Tracking
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Pricing */}
                <div className="col-span-2">
                  <h4 className="font-semibold text-gray-900 mb-3">Pricing Breakdown</h4>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal:</span>
                        <span>{selectedFulfillment.pricing.currency} {selectedFulfillment.pricing.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Tax:</span>
                        <span>{selectedFulfillment.pricing.currency} {selectedFulfillment.pricing.tax.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Shipping:</span>
                        <span>{selectedFulfillment.pricing.currency} {selectedFulfillment.pricing.shipping.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-2">
                        <span>Total:</span>
                        <span>{selectedFulfillment.pricing.currency} {selectedFulfillment.pricing.total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}