"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

interface Fulfillment {
  _id: string;
  shopifyOrderId: string;
  receivedAt: string;
  orderData: any;
}

export default function FulfillmentsPage() {
  const [fulfillments, setFulfillments] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFulfillments = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/shopify/order-fulfilled/get-fulfillments");
      const data = await response.json();
      if (data.success) {
        setFulfillments(data.fulfillments);
      } else {
        console.error("Failed to fetch fulfillments:", data.error);
      }
    } catch (error) {
      console.error("Error fetching fulfillments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillments();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fulfillment Orders</h1>
          <button
            onClick={fetchFulfillments}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw size={32} className="animate-spin text-indigo-500" />
              <p className="text-gray-500 text-sm">Loading fulfillments...</p>
            </div>
          </div>
        ) : fulfillments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <p className="text-lg font-medium text-gray-500">No fulfillments found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shopify Order ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Received At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fulfillment Data
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {fulfillments.map((fulfillment) => (
                  <tr key={fulfillment._id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {fulfillment.shopifyOrderId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(fulfillment.receivedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-pre-wrap text-sm text-gray-500">
                      <code>{JSON.stringify(fulfillment.orderData, null, 2)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}