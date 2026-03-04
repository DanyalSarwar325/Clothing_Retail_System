"use client";
import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/app/components/ProtectedRoute";

const fetchOrders = async () => {
  const res = await fetch("/api/shopify/order-created");
  if (!res.ok) return [];
  const data = await res.json();
  return data.orders || [];
};

export default function ShopifyOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders().then((o) => {
      setOrders(o);
      setLoading(false);
    });

    // Poll every 3 seconds for new orders
    const interval = setInterval(() => {
      fetchOrders().then((o) => setOrders(o));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div style={{ padding: 24 }}>
        <h1>Shopify Orders (Webhook Data)</h1>
        {loading ? (
          <div>Loading...</div>
        ) : orders.length === 0 ? (
          <div>No orders received yet.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {orders.map((order, idx) => (
              <li key={idx} style={{ marginBottom: 24, border: "1px solid #ccc", borderRadius: 8, padding: 16 }}>
                <div><b>Received At:</b> {order.receivedAt}</div>
                <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#f8f8f8", padding: 8, borderRadius: 4 }}>
                  {JSON.stringify(order.orderData || order, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </ProtectedRoute>
  );
}