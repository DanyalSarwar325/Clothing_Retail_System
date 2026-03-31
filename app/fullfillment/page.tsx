"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";

type FulfillmentRecord = {
  _id: string;
  shopifyOrderId: number;
  receivedAt: string;
  orderData?: any;
  rawPayload?: any;
};

export default function FullfillmentJsonPage() {
  const [records, setRecords] = useState<FulfillmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string>("");

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/shopify/order-fulfilled/get-fulfillments", {
        cache: "no-store",
      });
      const data = await res.json();
      if (data.success) {
        const fulfillments = data.fulfillments || [];
        setRecords(fulfillments);
        if (fulfillments.length > 0) {
          setSelectedId((prev) => prev || fulfillments[0]._id);
        }
      } else {
        console.error("Failed to load fulfillment JSON:", data.error);
      }
    } catch (error) {
      console.error("Failed to fetch fulfillment records:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, []);

  const selectedRecord = useMemo(
    () => records.find((item) => item._id === selectedId) || records[0],
    [records, selectedId]
  );

  const selectedPayload = selectedRecord?.rawPayload || selectedRecord?.orderData || null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Shopify Fullfillment JSON</h1>
            <p className="text-sm text-slate-600">
              Inspect the complete JSON object received from Shopify webhooks.
            </p>
          </div>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            Loading fulfillment JSON...
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
            No fulfillment records found in DB.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white lg:col-span-4">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">Webhook Records</h2>
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {records.map((record) => (
                  <button
                    key={record._id}
                    onClick={() => setSelectedId(record._id)}
                    className={`w-full border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${
                      selectedRecord?._id === record._id ? "bg-slate-100" : "bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900">
                      Order ID: {record.shopifyOrderId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(record.receivedAt).toLocaleString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white lg:col-span-8">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="font-semibold text-slate-900">Complete JSON Payload</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Record ID: {selectedRecord?._id}
                </p>
              </div>
              <div className="max-h-[70vh] overflow-auto p-4">
                <pre className="whitespace-pre-wrap wrap-break-word rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
                  {JSON.stringify(selectedPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
