"use client";
import React, { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import Link from "next/link";
import { RefreshCw, Package, ShoppingCart, Phone, Mail, MapPin, DollarSign, Hash, User, Truck, Trash2, Eye, X, Upload, Search, Edit2 } from "lucide-react";

type OrderTab = "creation" | "fulfillment";

interface ParsedOrder {
  _id: string;
  shopifyOrderId: number;
  receivedAt: string;
  orderName: string;
  customerName: string;
  totalPrice: string;
  currency: string;
  email: string;
  phone: string;
  address: string;
  financialStatus?: string;
  fulfillmentStatus?: string;
  trackingNumber?: string;
  trackingCompany?: string;
}

export default function ShopifyOrdersPage() {
  const [activeTab, setActiveTab] = useState<OrderTab>("creation");
  const [creationOrders, setCreationOrders] = useState<ParsedOrder[]>([]);
  const [fulfillmentOrders, setFulfillmentOrders] = useState<ParsedOrder[]>([]);
  const [loadingCreation, setLoadingCreation] = useState(true);
  const [loadingFulfillment, setLoadingFulfillment] = useState(true);
  const [refreshingCreation, setRefreshingCreation] = useState(false);
  const [refreshingFulfillment, setRefreshingFulfillment] = useState(false);
  const [deletingOrders, setDeletingOrders] = useState<Set<string>>(new Set());
  
  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ParsedOrder[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTotal, setSearchTotal] = useState(0);
  const [searchPage, setSearchPage] = useState(1);
  const [searchPageSize] = useState(25);
  
  // Pagination state for fulfillment orders
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(25);
  const [totalFulfillmentRecords, setTotalFulfillmentRecords] = useState(0);
  const totalPages = Math.ceil(totalFulfillmentRecords / pageSize);
  const searchTotalPages = Math.ceil(searchTotal / searchPageSize);
  
  // Edit payment status modal state
  const [editingOrder, setEditingOrder] = useState<ParsedOrder | null>(null);
  const [updatingPaymentStatus, setUpdatingPaymentStatus] = useState(false);
  
  // Modal state for order details
  const [selectedOrder, setSelectedOrder] = useState<ParsedOrder | null>(null);
  const [selectedOrderRawData, setSelectedOrderRawData] = useState<any>(null);
  const [detailsModalTab, setDetailsModalTab] = useState<"structured" | "raw">("structured");

  const fetchCreationOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshingCreation(true);
    try {
      const res = await fetch("/api/shopify/order-created");
      if (!res.ok) return;
      const data = await res.json();
      setCreationOrders(data.orders || []);
    } catch (e) {
      console.error("Failed to fetch creation orders:", e);
    } finally {
      setLoadingCreation(false);
      setRefreshingCreation(false);
    }
  }, []);

  const fetchFulfillmentOrders = useCallback(async (showRefresh = false, page = 1) => {
    if (showRefresh) setRefreshingFulfillment(true);
    try {
      const skip = (page - 1) * pageSize;
      const res = await fetch(`/api/shopify/order-fulfilled?limit=${pageSize}&skip=${skip}`);
      if (!res.ok) return;
      const data = await res.json();
      setFulfillmentOrders(data.orders || []);
      setTotalFulfillmentRecords(data.total || 0);
      setCurrentPage(page);
    } catch (e) {
      console.error("Failed to fetch fulfillment orders:", e);
    } finally {
      setLoadingFulfillment(false);
      setRefreshingFulfillment(false);
    }
  }, [pageSize]);

  const openOrderDetails = useCallback(async (order: ParsedOrder, type: OrderTab) => {
    setSelectedOrder(order);
    setDetailsModalTab("structured");
    try {
      const endpoint = type === "creation" ? "/api/shopify/order-created" : "/api/shopify/order-fulfilled";
      const res = await fetch(`${endpoint}?id=${order._id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrderRawData(data);
      }
    } catch (e) {
      console.error("Failed to fetch order details:", e);
    }
  }, []);
  
  const deleteOrder = useCallback(async (orderId: string, type: OrderTab) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    
    setDeletingOrders(prev => new Set(prev.add(orderId)));
    
    try {
      const endpoint = type === "creation" ? "/api/shopify/order-created" : "/api/shopify/order-fulfilled";
      const res = await fetch(`${endpoint}?id=${orderId}`, {
        method: "DELETE",
      });
      
      const data = await res.json();
      
      if (data.success) {
        // Remove from local state
        if (type === "creation") {
          setCreationOrders(prev => prev.filter(o => o._id !== orderId));
        } else {
          setFulfillmentOrders(prev => prev.filter(o => o._id !== orderId));
        }
        
        // Show success feedback (you can replace with toast notification)
        alert("Order deleted successfully!");
      } else {
        throw new Error(data.error || "Failed to delete order");
      }
    } catch (e: any) {
      console.error("Delete error:", e);
      alert(`Failed to delete order: ${e.message}`);
    } finally {
      setDeletingOrders(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, []);

  const updatePaymentStatus = useCallback(async (orderId: string, newStatus: string) => {
    setUpdatingPaymentStatus(true);
    try {
      // Update in database
      const res = await fetch(`/api/shopify/order-fulfilled?id=${orderId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          financialStatus: newStatus,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update payment status");
      }

      // Update in local state
      setFulfillmentOrders(prev =>
        prev.map(order =>
          order._id === orderId ? { ...order, financialStatus: newStatus } : order
        )
      );

      setSearchResults(prev =>
        prev.map(order =>
          order._id === orderId ? { ...order, financialStatus: newStatus } : order
        )
      );

      alert("Payment status updated successfully!");
      setEditingOrder(null);
    } catch (e: any) {
      console.error("Update error:", e);
      alert(`Failed to update payment status: ${e.message}`);
    } finally {
      setUpdatingPaymentStatus(false);
    }
  }, []);

  const performSearch = useCallback(async (query: string, page = 1) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchQuery("");
      setSearchTotal(0);
      setSearchPage(1);
      return;
    }

    setIsSearching(true);
    try {
      const type = activeTab === "creation" ? "creation" : "fulfillment";
      const res = await fetch(
        `/api/shopify/search?q=${encodeURIComponent(query)}&type=${type}&page=${page}&limit=${searchPageSize}`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.orders || []);
        setSearchTotal(data.pagination.total);
        setSearchPage(data.pagination.page);
      }
    } catch (e) {
      console.error("Search failed:", e);
    } finally {
      setIsSearching(false);
    }
  }, [activeTab, searchPageSize]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (value.trim()) {
      performSearch(value, 1);
    } else {
      setSearchResults([]);
      setSearchTotal(0);
      setSearchPage(1);
    }
  };

  useEffect(() => {
    fetchCreationOrders();
    fetchFulfillmentOrders(false, 1);
  }, []);

  const isRefreshing = activeTab === "creation" ? refreshingCreation : refreshingFulfillment;
  const handleRefresh = () => {
    if (activeTab === "creation") fetchCreationOrders(true);
    else fetchFulfillmentOrders(true, currentPage);
  };

  const allOrders = activeTab === "creation" ? creationOrders : fulfillmentOrders;
  
  // Use search results if searching, otherwise use paginated orders
  const orders = searchQuery.trim() ? searchResults : allOrders;
  const isLoading = searchQuery.trim() ? isSearching : (activeTab === "creation" ? loadingCreation : loadingFulfillment);
  const currentPageNum = searchQuery.trim() ? searchPage : currentPage;
  const totalPages_ = searchQuery.trim() ? searchTotalPages : totalPages;

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-gray-50">
        {/* Navbar */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <Package className="text-indigo-600" size={24} />
                <h1 className="text-xl font-bold text-gray-900">Order Details</h1>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">
                  {orders.length} order{orders.length !== 1 ? "s" : ""}
                </span>
                <Link
                  href="/invoices/upload"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  title="Upload invoice PDF to update multiple orders"
                >
                  <Upload size={16} />
                  Upload Invoice
                </Link>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex">
              <button
                onClick={() => setActiveTab("creation")}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "creation"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <ShoppingCart size={18} />
                Order Creation
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === "creation"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {creationOrders.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab("fulfillment")}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === "fulfillment"
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Truck size={18} />
                Order Fulfillment
                <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === "fulfillment"
                    ? "bg-indigo-100 text-indigo-700"
                    : "bg-gray-100 text-gray-600"
                }`}>
                  {fulfillmentOrders.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="relative flex items-center max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-indigo-500" />
            </div>
            <input
              type="text"
              placeholder="Search by order #, customer, email, phone, or tracking..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="block w-full pl-10 pr-4 py-2.5 border-2 border-indigo-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm transition-all"
            />
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600">
              Found <span className="font-semibold text-indigo-600">{searchTotal}</span> result{searchTotal !== 1 ? "s" : ""} {searchTotalPages > 1 && `(Page ${searchPage} of ${searchTotalPages})`}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="mx-2 lg:mx-4 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw size={32} className="animate-spin text-indigo-500" />
                <p className="text-gray-500 text-sm">Loading orders...</p>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Package size={48} className="mb-3" />
              <p className="text-lg font-medium text-gray-500">No orders found</p>
              <p className="text-sm text-gray-400 mt-1">
                {activeTab === "creation"
                  ? "New orders will appear here when received from Shopify."
                  : "Fulfilled orders will appear here when received from Shopify."}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
              <div className="overflow-x-auto flex-1">
                <table className="w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Order ID
                      </th>
                      <th className="px-0.5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Customer
                      </th>
                      <th className="px-0.5 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Amount
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Phone
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Email
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Payment
                      </th>
                      {activeTab === "fulfillment" && (
                        <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          Tracking
                        </th>
                      )}
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Status
                      </th>
                      <th className="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Received
                      </th>
                      <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {orders.map((order) => {
                      const statusColor =
                        activeTab === "fulfillment"
                          ? "bg-green-100 text-green-700"
                          : order.fulfillmentStatus === "fulfilled"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700";

                      const statusLabel =
                        activeTab === "fulfillment"
                          ? order.fulfillmentStatus || "Fulfilled"
                          : order.fulfillmentStatus || "Unfulfilled";

                      return (
                        <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {order.orderName}
                            </div>
                            <div className="text-xs text-gray-500 font-mono">
                              {order.shopifyOrderId}
                            </div>
                          </td>
                          <td className="px-0.5 py-2 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {order.customerName}
                            </div>
                          </td>
                          <td className="px-0.5 py-2 whitespace-nowrap">
                            <div className="text-sm font-semibold text-gray-900">
                              {order.currency} {order.totalPrice}
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="text-sm text-gray-700">
                              {order.phone}
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap max-w-sm">
                            <div className="text-sm text-gray-700 truncate" title={order.email}>
                              {order.email}
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                              order.financialStatus?.toLowerCase() === "paid"
                                ? "bg-green-100 text-green-700"
                                : order.financialStatus?.toLowerCase() === "pending"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {order.financialStatus || "Pending"}
                            </span>
                          </td>
                          {activeTab === "fulfillment" && (
                            <td className="px-2 py-2 whitespace-nowrap">
                              {order.trackingNumber && order.trackingNumber !== "N/A" ? (
                                <span className="text-sm font-mono text-gray-900">
                                  {order.trackingNumber}
                                </span>
                              ) : (
                                <span className="text-sm text-gray-400 italic">N/A</span>
                              )}
                            </td>
                          )}
                          <td className="px-2 py-2 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor}`}>
                              {statusLabel}
                            </span>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap">
                            <div className="text-sm text-gray-600">
                              {new Date(order.receivedAt).toLocaleDateString()} <br />
                              <span className="text-gray-500 text-xs">{new Date(order.receivedAt).toLocaleTimeString()}</span>
                            </div>
                          </td>
                          <td className="px-2 py-2 whitespace-nowrap text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => setEditingOrder(order)}
                                className="text-purple-600 hover:text-purple-900 hover:bg-purple-50 p-1 rounded transition-colors"
                                title="Edit payment status"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => openOrderDetails(order, activeTab)}
                                className="text-blue-600 hover:text-blue-900 hover:bg-blue-50 p-1 rounded transition-colors"
                                title="View details"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => deleteOrder(order._id, activeTab)}
                                disabled={deletingOrders.has(order._id)}
                                className="text-red-600 hover:text-red-900 hover:bg-red-50 p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Delete order"
                              >
                                {deletingOrders.has(order._id) ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
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
              {/* Horizontal scroll indicator */}
              <div className="bg-gray-50 border-t border-gray-200 px-4 py-2 flex items-center justify-between">
                <p className="text-xs text-gray-500">💡 Scroll right to see all columns</p>
                {activeTab === "fulfillment" && !searchQuery && totalFulfillmentRecords > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">
                      Page <span className="font-semibold">{currentPage}</span> of <span className="font-semibold">{totalPages}</span> 
                      <span className="ml-2 text-gray-500">({totalFulfillmentRecords} total)</span>
                    </span>
                  </div>
                )}
              </div>
              
              {/* Pagination Controls */}
              {searchQuery && searchTotalPages > 1 && (
                <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => performSearch(searchQuery, searchPage - 1)}
                    disabled={searchPage === 1 || isSearching}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(searchTotalPages, 5) }, (_, i) => {
                      const pageNum = searchPage <= 3 ? i + 1 : searchPage - 2 + i;
                      if (pageNum > searchTotalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => performSearch(searchQuery, pageNum)}
                          disabled={isSearching}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            pageNum === searchPage
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => performSearch(searchQuery, searchPage + 1)}
                    disabled={searchPage === searchTotalPages || isSearching}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
              
              {activeTab === "fulfillment" && !searchQuery && totalFulfillmentRecords > pageSize && (
                <div className="bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
                  <button
                    onClick={() => fetchFulfillmentOrders(false, currentPage - 1)}
                    disabled={currentPage === 1 || loadingFulfillment}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    ← Previous
                  </button>
                  
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const pageNum = currentPage <= 3 ? i + 1 : currentPage - 2 + i;
                      if (pageNum > totalPages) return null;
                      return (
                        <button
                          key={pageNum}
                          onClick={() => fetchFulfillmentOrders(false, pageNum)}
                          disabled={loadingFulfillment}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            pageNum === currentPage
                              ? "bg-indigo-600 text-white"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => fetchFulfillmentOrders(false, currentPage + 1)}
                    disabled={currentPage === totalPages || loadingFulfillment}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900">
                  Fulfillment Details - Order #{selectedOrder.orderName}
                </h2>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 px-6">
                <button
                  onClick={() => setDetailsModalTab("structured")}
                  className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                    detailsModalTab === "structured"
                      ? "text-indigo-600 border-indigo-600"
                      : "text-gray-600 border-transparent hover:text-gray-900"
                  }`}
                >
                  Structured Data
                </button>
                <button
                  onClick={() => setDetailsModalTab("raw")}
                  className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
                    detailsModalTab === "raw"
                      ? "text-indigo-600 border-indigo-600"
                      : "text-gray-600 border-transparent hover:text-gray-900"
                  }`}
                >
                  Shopify Raw Response
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {detailsModalTab === "structured" ? (
                  <div className="space-y-6">
                    {/* Order Information */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Order Information</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Order ID</p>
                            <p className="text-sm text-indigo-600 font-mono">{selectedOrder.shopifyOrderId}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Order Number</p>
                            <p className="text-sm font-semibold text-gray-900">#{selectedOrder.orderName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Created</p>
                            <p className="text-sm text-gray-900">
                              {new Date(selectedOrder.receivedAt).toLocaleDateString()}, {new Date(selectedOrder.receivedAt).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Customer Information */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Customer Information</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Name</p>
                            <p className="text-sm text-gray-900">{selectedOrder.customerName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm text-gray-900">{selectedOrder.email || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Phone</p>
                            <p className="text-sm text-gray-900">{selectedOrder.phone || "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Shipping Address */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Shipping Address</h3>
                        <div className="space-y-2">
                          <p className="text-sm text-gray-900">{selectedOrder.address || "N/A"}</p>
                        </div>
                      </div>

                      {/* Product Information */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Product Information</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Total Amount</p>
                            <p className="text-sm font-semibold text-gray-900">{selectedOrder.currency} {selectedOrder.totalPrice}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment Information */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Payment Information</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Method</p>
                            <p className="text-sm text-gray-900">Pending</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Status</p>
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                              {selectedOrder.financialStatus || "Pending"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Fulfillment & Tracking */}
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Fulfillment & Tracking</h3>
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs text-gray-500">Status</p>
                            <span className="inline-flex px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              {selectedOrder.fulfillmentStatus || "Fulfilled"}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Tracking Number</p>
                            <p className="text-sm font-mono text-gray-900">
                              {selectedOrder.trackingNumber && selectedOrder.trackingNumber !== "N/A" ? selectedOrder.trackingNumber : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Info Warning */}
                    {!selectedOrder.trackingNumber || selectedOrder.trackingNumber === "N/A" ? (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                        <p className="text-xs text-yellow-800">⚠ No tracking information available yet</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <pre className="text-xs text-gray-800 overflow-x-auto max-h-96">
                      {JSON.stringify(selectedOrderRawData || selectedOrder, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Edit Payment Status Modal */}
        {editingOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-gray-200 p-6">
                <h2 className="text-lg font-bold text-gray-900">
                  Update Payment Status
                </h2>
                <button
                  onClick={() => setEditingOrder(null)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  disabled={updatingPaymentStatus}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {/* Order Info */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div>
                    <p className="text-xs text-gray-500">Order Number</p>
                    <p className="text-sm font-semibold text-gray-900">#{editingOrder.orderName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Customer</p>
                    <p className="text-sm text-gray-900">{editingOrder.customerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Current Status</p>
                    <p className="text-sm">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-semibold ${
                        editingOrder.financialStatus?.toLowerCase() === "paid"
                          ? "bg-green-100 text-green-700"
                          : editingOrder.financialStatus?.toLowerCase() === "pending"
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-gray-100 text-gray-700"
                      }`}>
                        {editingOrder.financialStatus || "Pending"}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Status Options */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-900">Select New Status:</p>
                  <button
                    onClick={() => updatePaymentStatus(editingOrder._id, "paid")}
                    disabled={updatingPaymentStatus}
                    className="w-full px-4 py-3 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left"
                  >
                    <p className="font-semibold text-green-900">Paid</p>
                    <p className="text-xs text-green-700">Mark this order as paid</p>
                  </button>
                </div>

                {/* Loading State */}
                {updatingPaymentStatus && (
                  <div className="flex items-center justify-center gap-2 text-sm text-indigo-600">
                    <RefreshCw size={16} className="animate-spin" />
                    <span>Updating...</span>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 border-t border-gray-200 p-6">
                <button
                  onClick={() => setEditingOrder(null)}
                  disabled={updatingPaymentStatus}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}