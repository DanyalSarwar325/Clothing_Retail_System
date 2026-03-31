"use client";
import React, { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { RefreshCw, Package, Eye, Trash2, ExternalLink } from "lucide-react";

interface FulfillmentOrder {
  _id: string;
  shopifyOrderId: string;
  receivedAt: string;
  orderName: string;
  customerName: string;
  totalPrice: string;
  currency: string;
  email: string;
  phone: string;
  address: string;
  fulfillmentStatus: string;
  trackingNumber: string;
  trackingCompany: string;
}

interface RawFulfillment {
  _id: string;
  shopifyOrderId: string;
  receivedAt: string;
  orderData: any;
}

export default function AdminFulfillmentPage() {
  const [fulfillments, setFulfillments] = useState<FulfillmentOrder[]>([]);
  const [rawFulfillments, setRawFulfillments] = useState<RawFulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState<Set<string>>(new Set());
  const [selectedFulfillment, setSelectedFulfillment] = useState<RawFulfillment | null>(null);
  const [showRawData, setShowRawData] = useState(false);

  const fetchFulfillments = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch("/api/shopify/order-fulfilled");
      if (!res.ok) return;
      const data = await res.json();
      setFulfillments(data.orders || []);

      // Fetch raw data for inspection
      const rawRes = await fetch("/api/shopify/order-fulfilled/get-fulfillments");
      if (rawRes.ok) {
        const rawData = await rawRes.json();
        setRawFulfillments(rawData.fulfillments || []);
      }
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
      const res = await fetch(`/api/shopify/order-fulfilled?id=${fulfillmentId}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      
      if (data.success) {
        setFulfillments(prev => prev.filter(o => o._id !== fulfillmentId));
        setRawFulfillments(prev => prev.filter(o => o._id !== fulfillmentId));
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
    fetchFulfillments();
  }, [fetchFulfillments]);

  const handleViewRawData = (fulfillment: RawFulfillment) => {
    setSelectedFulfillment(fulfillment);
    setShowRawData(true);
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
                  onClick={() => fetchFulfillments(true)}
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

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
                <p className="text-gray-500 text-sm">Loading fulfillments...</p>
              </div>
            </div>
          ) : fulfillments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Package size={48} className="mb-3" />
              <p className="text-lg font-medium text-gray-500">No fulfillments found</p>
              <p className="text-sm text-gray-400 mt-1">
                Fulfilled orders will appear here when received from Shopify.
              </p>
            </div>
          ) : (
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Order
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Received
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {fulfillments.map((fulfillment) => {
                      const rawFulfillment = rawFulfillments.find(r => r._id === fulfillment._id);
                      return (
                        <tr key={fulfillment._id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div>
                                <div className="text-sm font-medium text-gray-900">
                                  {fulfillment.orderName}
                                </div>
                                <div className="text-sm text-gray-500">
                                  ID: {fulfillment.shopifyOrderId}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{fulfillment.customerName}</div>
                            <div className="text-sm text-gray-500">{fulfillment.email}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {fulfillment.currency} {fulfillment.totalPrice}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              {fulfillment.fulfillmentStatus}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {fulfillment.trackingNumber !== "N/A" ? (
                                <>
                                  <div>{fulfillment.trackingCompany}</div>
                                  <div className="text-xs text-gray-500">{fulfillment.trackingNumber}</div>
                                </>
                              ) : (
                                "No tracking"
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(fulfillment.receivedAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center gap-2">
                              {rawFulfillment && (
                                <button
                                  onClick={() => handleViewRawData(rawFulfillment)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                  title="View raw data"
                                >
                                  <Eye size={16} />
                                </button>
                              )}
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw Data Modal */}
      {showRawData && selectedFulfillment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-medium text-gray-900">
                Raw Fulfillment Data - Order #{selectedFulfillment.shopifyOrderId}
              </h3>
              <button
                onClick={() => setShowRawData(false)}
                className="text-gray-400 hover:text-gray-500"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <pre className="text-xs text-gray-800 bg-gray-50 p-4 rounded overflow-auto">
                {JSON.stringify(selectedFulfillment.orderData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  );
}