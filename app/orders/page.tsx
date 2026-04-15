"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { Search, Filter, Download, MoreHorizontal, ExternalLink, RefreshCw } from "lucide-react";

interface Order {
  _id: string;
  orderName: string;
  shopifyOrderId: number;
  customerName: string;
  channel: string;
  totalPrice: string;
  currency: string;
  paymentStatus: "paid" | "pending" | "failed" | "refunded";
  fulfillmentStatus: "fulfilled" | "unfulfilled" | "partial" | "cancelled";
  itemCount: number;
  tags: string[];
  createdAt: string;
  email: string;
  phone: string;
  financialStatus?: string;
  trackingNumber?: string;
}

type FilterType = "all" | "unfulfilled" | "unpaid" | "open" | "archived" | "fulfilled";

const mockOrders: Order[] = [
  {
    _id: "1",
    orderName: "#45268",
    shopifyOrderId: 45268,
    customerName: "Almir Khan",
    channel: "Online Store",
    totalPrice: "6,999.00",
    currency: "Rs",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    itemCount: 1,
    tags: ["Complete Address"],
    createdAt: new Date().toISOString(),
    email: "almir@example.com",
    phone: "+92 300 1234567"
  },
  {
    _id: "2",
    orderName: "#45267",
    shopifyOrderId: 45267,
    customerName: "Test order Test",
    channel: "Online Store",
    totalPrice: "6,999.00",
    currency: "Rs",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    itemCount: 1,
    tags: ["Incomplete Address"],
    createdAt: new Date().toISOString(),
    email: "test@example.com",
    phone: "+92 300 9876543"
  },
  {
    _id: "3",
    orderName: "#45266",
    shopifyOrderId: 45266,
    customerName: "Fathima Jami",
    channel: "Online Store",
    totalPrice: "14,998.00",
    currency: "Rs",
    paymentStatus: "pending",
    fulfillmentStatus: "unfulfilled",
    itemCount: 2,
    tags: ["Complete Address"],
    createdAt: new Date().toISOString(),
    email: "fathima@example.com",
    phone: "+92 300 5556666"
  }
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>(mockOrders);
  const [searchResults, setSearchResults] = useState<Order[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [searchPaginationInfo, setSearchPaginationInfo] = useState<{ page: number; pages: number; total: number } | null>(null);

  // Shows search results if searching, otherwise filtered orders
  const displayOrders = searchQuery.trim() ? searchResults : filteredOrders;

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;
  const totalPages = searchQuery.trim() 
    ? (searchPaginationInfo?.pages || 0)
    : Math.ceil(filteredOrders.length / pageSize);
  const startIdx = (currentPage - 1) * pageSize;
  const endIdx = startIdx + pageSize;
  const paginatedOrders = displayOrders.slice(startIdx, endIdx);

  const filters = [
    { key: "all", label: "All", count: orders.length },
    { key: "unfulfilled", label: "Unfulfilled", count: orders.filter(o => o.fulfillmentStatus === "unfulfilled").length },
    { key: "unpaid", label: "Unpaid", count: orders.filter(o => o.paymentStatus !== "paid").length },
    { key: "open", label: "Open", count: orders.filter(o => o.fulfillmentStatus === "unfulfilled" && o.paymentStatus !== "paid").length },
    { key: "archived", label: "Archived", count: 0 },
    { key: "fulfilled", label: "Fulfilled", count: orders.filter(o => o.fulfillmentStatus === "fulfilled").length }
  ] as const;

  // Search orders from database by tracking ID or order number
  const handleDatabaseSearch = async (query: string, page = 1) => {
    if (!query.trim()) {
      setSearchResults([]);
      setSearchPaginationInfo(null);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/orders/search?q=${encodeURIComponent(query)}&page=${page}&limit=25`);
      if (res.ok) {
        const data = await res.json();
        console.log(`[Orders Search] Found ${data.pagination.total} results`);
        
        // Transform API results to Order format
        const results = data.results.map((r: any) => ({
          _id: r._id,
          orderName: r.orderNumber || `#${r._id}`,
          shopifyOrderId: 0,
          customerName: r.customerName || "Unknown",
          channel: "Online Store",
          totalPrice: r.total?.toString() || "0",
          currency: r.currency || "Rs",
          paymentStatus: r.paymentStatus || "pending",
          fulfillmentStatus: r.fulfillmentStatus || "unfulfilled",
          itemCount: 1,
          tags: [],
          createdAt: r.createdAt,
          email: r.customerEmail || "",
          phone: r.customerPhone || "",
          trackingNumber: r.trackingNumber,
        }));

        setSearchResults(results);
        setSearchPaginationInfo({
          page: data.pagination.page,
          pages: data.pagination.pages,
          total: data.pagination.total,
        });
        setCurrentPage(page);
      }
    } catch (error) {
      console.error("[Orders Search] Error:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    let filtered = [...orders];

    // Apply filter
    switch (activeFilter) {
      case "unfulfilled":
        filtered = filtered.filter(o => o.fulfillmentStatus === "unfulfilled");
        break;
      case "unpaid":
        filtered = filtered.filter(o => o.paymentStatus !== "paid");
        break;
      case "open":
        filtered = filtered.filter(o => o.fulfillmentStatus === "unfulfilled" && o.paymentStatus !== "paid");
        break;
      case "fulfilled":
        filtered = filtered.filter(o => o.fulfillmentStatus === "fulfilled");
        break;
      case "archived":
        filtered = [];
        break;
    }

    // Apply search - searches across ALL orders, including tracking number and order number
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderName.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.email.toLowerCase().includes(query) ||
        order.phone.toLowerCase().includes(query) ||
        order.shopifyOrderId.toString().includes(query)
      );
    }

    setFilteredOrders(filtered);
    // Reset to page 1 when filter or search changes
    setCurrentPage(1);
  }, [orders, activeFilter, searchQuery]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Select only items on current page
      setSelectedOrders(new Set(paginatedOrders.map(o => o._id)));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const getPaymentStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "paid":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "pending":
        return `${baseClasses} bg-amber-100 text-amber-800`;
      case "failed":
        return `${baseClasses} bg-red-100 text-red-800`;
      case "refunded":
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-amber-100 text-amber-800`;
    }
  };

  const getFulfillmentStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case "fulfilled":
        return `${baseClasses} bg-green-100 text-green-800`;
      case "unfulfilled":
        return `${baseClasses} bg-amber-100 text-amber-800`;
      case "partial":
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case "cancelled":
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-amber-100 text-amber-800`;
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    try {
      // Here you would fetch from your API
      // const response = await fetch('/api/orders');
      // const data = await response.json();
      // setOrders(data.orders);
      
      // For now, using mock data
      setTimeout(() => {
        setOrders(mockOrders);
        setLoading(false);
      }, 500);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (searchQuery.trim()) {
        handleDatabaseSearch(searchQuery, 1);
      } else {
        setSearchResults([]);
        setSearchPaginationInfo(null);
        setCurrentPage(1);
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  useEffect(() => {
    fetchOrders();
  }, []);

  return (
    <ProtectedRoute allowedRoles={["admin", "manager", "user", "cutting", "sewing", "packing", "pressing", "handmade", "patching", "quality"]}>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Orders</h1>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={fetchOrders}
                  disabled={loading}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  <Download size={16} className="mr-2" />
                  Export
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Create order
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center space-x-8 overflow-x-auto">
              {filters.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    activeFilter === filter.key
                      ? "border-indigo-500 text-indigo-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`ml-2 py-0.5 px-2 rounded-full text-xs ${
                      activeFilter === filter.key
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-gray-100 text-gray-900"
                    }`}>
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Actions */}
        <div className="bg-white px-4 sm:px-6 lg:px-8 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search by order #, tracking ID, customer name, or email"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  disabled={searching}
                  className="block w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm disabled:opacity-50"
                />
                {searching && (
                  <RefreshCw size={16} className="absolute right-3 top-2 text-gray-400 animate-spin" />
                )}
              </div>
              <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                <Filter size={16} className="mr-2" />
                Filter
              </button>
            </div>
            
            {selectedOrders.size > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">
                  {selectedOrders.size} selected
                </span>
                <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  Bulk actions
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="mt-8 flow-root">
              <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead>
                      <tr>
                        <th scope="col" className="relative px-7 sm:w-12 sm:px-6">
                          <input
                            type="checkbox"
                            className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                            checked={paginatedOrders.length > 0 && paginatedOrders.every(o => selectedOrders.has(o._id))}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                          />
                        </th>
                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0">
                          Order
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Date
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Customer
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Channel
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Total
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Payment status
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Fulfillment status
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Items
                        </th>
                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                          Tags
                        </th>
                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-0">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-14 text-center">
                            <RefreshCw size={32} className="mx-auto animate-spin text-gray-400" />
                            <p className="mt-2 text-sm text-gray-500">Loading orders...</p>
                          </td>
                        </tr>
                      ) : filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-6 py-14 text-center">
                            <p className="text-sm text-gray-500">No orders found</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedOrders.map((order) => (
                          <tr key={order._id} className="hover:bg-gray-50">
                            <td className="relative px-7 sm:w-12 sm:px-6">
                              <input
                                type="checkbox"
                                className="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                checked={selectedOrders.has(order._id)}
                                onChange={(e) => handleSelectOrder(order._id, e.target.checked)}
                              />
                            </td>
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-0">
                              <div className="flex items-center">
                                <span className="text-indigo-600 hover:text-indigo-900 cursor-pointer">
                                  {order.orderName}
                                </span>
                                <ExternalLink size={14} className="ml-1 text-gray-400" />
                              </div>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {new Date(order.createdAt).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                              {order.customerName}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {order.channel}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                              {order.currency} {order.totalPrice}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={getPaymentStatusBadge(order.paymentStatus)}>
                                {order.paymentStatus === "pending" ? "Payment pending" : order.paymentStatus}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className={getFulfillmentStatusBadge(order.fulfillmentStatus)}>
                                {order.fulfillmentStatus === "unfulfilled" ? "Unfulfilled" : order.fulfillmentStatus}
                              </span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                              {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                            </td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <div className="flex flex-wrap gap-1">
                                {order.tags.map((tag, index) => (
                                  <span
                                    key={index}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-0">
                              <button className="text-gray-400 hover:text-gray-500">
                                <MoreHorizontal size={16} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pagination */}
        {displayOrders.length > 0 && (
          <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
            <div className="flex-1 flex justify-between sm:hidden">
              <button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1);
                  if (searchQuery.trim()) {
                    handleDatabaseSearch(searchQuery, newPage);
                  } else {
                    setCurrentPage(newPage);
                  }
                }}
                disabled={currentPage === 1}
                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1);
                  if (searchQuery.trim()) {
                    handleDatabaseSearch(searchQuery, newPage);
                  } else {
                    setCurrentPage(newPage);
                  }
                }}
                disabled={currentPage === totalPages}
                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">{displayOrders.length === 0 ? 0 : startIdx + 1}</span> to{' '}
                  <span className="font-medium">{Math.min(endIdx, displayOrders.length)}</span> of{' '}
                  <span className="font-medium">{searchQuery.trim() ? (searchPaginationInfo?.total || 0) : displayOrders.length}</span> results
                  {searchQuery.trim() && <span className="ml-1 text-gray-500">(searching database)</span>}
                </p>
              </div>
              <div>
                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => {
                      const newPage = Math.max(1, currentPage - 1);
                      if (searchQuery.trim()) {
                        handleDatabaseSearch(searchQuery, newPage);
                      } else {
                        setCurrentPage(newPage);
                      }
                    }}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  
                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => {
                    // Show first page, last page, current page, and pages around current
                    const isVisible = pageNum === 1 || pageNum === totalPages || 
                                     Math.abs(pageNum - currentPage) <= 1;
                    
                    if (!isVisible && pageNum !== 2 && pageNum !== totalPages - 1) {
                      return null;
                    }
                    
                    if (pageNum === 2 && currentPage > 3) {
                      return (
                        <span key="ellipsis-start" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      );
                    }
                    
                    if (pageNum === totalPages - 1 && currentPage < totalPages - 2) {
                      return (
                        <span key="ellipsis-end" className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                          ...
                        </span>
                      );
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        onClick={() => {
                          if (searchQuery.trim()) {
                            handleDatabaseSearch(searchQuery, pageNum);
                          } else {
                            setCurrentPage(pageNum);
                          }
                        }}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === pageNum
                            ? "bg-indigo-50 text-indigo-600 border-indigo-300"
                            : "bg-white text-gray-500 border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => {
                      const newPage = Math.min(totalPages, currentPage + 1);
                      if (searchQuery.trim()) {
                        handleDatabaseSearch(searchQuery, newPage);
                      } else {
                        setCurrentPage(newPage);
                      }
                    }}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}