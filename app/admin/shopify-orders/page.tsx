"use client";
import React, { useEffect, useState, useCallback } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";
import { RefreshCw, Package, ShoppingCart, Phone, Mail, MapPin, DollarSign, Hash, User, Truck, Trash2 } from "lucide-react";

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

  const fetchFulfillmentOrders = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshingFulfillment(true);
    try {
      const res = await fetch("/api/shopify/order-fulfilled");
      if (!res.ok) return;
      const data = await res.json();
      setFulfillmentOrders(data.orders || []);
    } catch (e) {
      console.error("Failed to fetch fulfillment orders:", e);
    } finally {
      setLoadingFulfillment(false);
      setRefreshingFulfillment(false);
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

  useEffect(() => {
    fetchCreationOrders();
    fetchFulfillmentOrders();
  }, [fetchCreationOrders, fetchFulfillmentOrders]);

  const isRefreshing = activeTab === "creation" ? refreshingCreation : refreshingFulfillment;
  const handleRefresh = () => {
    if (activeTab === "creation") fetchCreationOrders(true);
    else fetchFulfillmentOrders(true);
  };

  const orders = activeTab === "creation" ? creationOrders : fulfillmentOrders;
  const isLoading = activeTab === "creation" ? loadingCreation : loadingFulfillment;

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

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {orders.map((order) => (
                <OrderCard 
                  key={order._id} 
                  order={order} 
                  type={activeTab}
                  onDelete={deleteOrder}
                  isDeleting={deletingOrders.has(order._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

function OrderCard({ 
  order, 
  type,
  onDelete,
  isDeleting 
}: { 
  order: ParsedOrder; 
  type: OrderTab;
  onDelete: (orderId: string, type: OrderTab) => Promise<void>;
  isDeleting: boolean;
}) {
  const statusColor =
    type === "fulfillment"
      ? "bg-green-100 text-green-700"
      : order.fulfillmentStatus === "fulfilled"
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700";

  const statusLabel =
    type === "fulfillment"
      ? order.fulfillmentStatus || "Fulfilled"
      : order.fulfillmentStatus || "Unfulfilled";

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
      {/* Card Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Hash size={14} className="text-gray-400" />
          <span className="font-semibold text-gray-900">{order.orderName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColor}`}>
            {statusLabel}
          </span>
          <button
            onClick={() => onDelete(order._id, type)}
            disabled={isDeleting}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete order"
          >
            {isDeleting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
          </button>
        </div>
      </div>

      {/* Card Body */}
      <div className="px-5 py-4 space-y-3">
        <InfoRow icon={<User size={15} />} label="Customer" value={order.customerName} />
        <InfoRow
          icon={<DollarSign size={15} />}
          label="Amount"
          value={`${order.currency} ${order.totalPrice}`}
          highlight
        />
        <InfoRow icon={<Phone size={15} />} label="Phone" value={order.phone} />
        <InfoRow icon={<Mail size={15} />} label="Email" value={order.email} />
        <InfoRow icon={<MapPin size={15} />} label="Address" value={order.address} />
        {type === "fulfillment" && order.trackingNumber && order.trackingNumber !== "N/A" && (
          <InfoRow icon={<Truck size={15} />} label="Tracking" value={`${order.trackingCompany}: ${order.trackingNumber}`} />
        )}
      </div>

      {/* Card Footer */}
      <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100">
        <p className="text-xs text-gray-400">
          Received: {new Date(order.receivedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400 leading-none mb-0.5">{label}</p>
        <p className={`text-sm wrap-break-word ${highlight ? "font-semibold text-indigo-600" : "text-gray-700"}`}>
          {value || "N/A"}
        </p>
      </div>
    </div>
  );
}