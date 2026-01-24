"use client";

import { useEffect, useState, useCallback } from "react";
import { Layers, DollarSign } from "lucide-react";

// Departments that have item-based rates
const ITEM_BASED_DEPARTMENTS = ["Cutting", "Sewing", "Press"];

// Departments that use FinalSticker model (show rate per scan)
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

interface DesignPayment {
  design: string;
  scanCount: number;
  ratePerUnit: number | null; // null for item-based departments
  pendingPayment: number;
}

interface PaymentByDesignDisplayProps {
  userName: string;
  department: string;
  scanCount?: number; // Optional key to trigger refresh when scans happen
}

export default function PaymentByDesignDisplay({ userName, department, scanCount }: PaymentByDesignDisplayProps) {
  const [items, setItems] = useState<DesignPayment[]>([]);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/payment/pending/by-design?userName=${encodeURIComponent(userName)}&department=${encodeURIComponent(department)}`
      );
      const data = await response.json();
      if (data.success) {
        setItems(data.data.perDesign || []);
        setRate(data.data.ratePerUnit || 0);
        setNote(data.data.note || "");
      }
    } catch (error) {
      console.error("Failed to fetch payment by design", error);
    } finally {
      setLoading(false);
    }
  }, [userName, department]);

  useEffect(() => {
    fetchData();
  }, [userName, department, scanCount, fetchData]);

  // Refresh data when user comes back to the tab (e.g., after admin makes payment)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (!items.length) return null;

  const isItemBased = ITEM_BASED_DEPARTMENTS.includes(department);
  const isFinalSticker = FINAL_STICKER_DEPARTMENTS.includes(department);

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Layers className="text-emerald-700" size={18} />
        </div>
        <div>
          <p className="text-xs text-gray-500">Payment Pending by Design</p>
          {isItemBased ? (
            <p className="text-sm text-gray-700 italic">Per-item rates (Qameez/Shalwar/Dupatta)</p>
          ) : isFinalSticker ? (
            <p className="text-sm text-gray-700">Rate: ₨{rate}/scan (from final sticker)</p>
          ) : (
            <p className="text-sm text-gray-700">Rate: ₨{rate}/unit</p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.design} className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <p className="font-semibold text-gray-900">{item.design}</p>
              <p className="text-xs text-gray-500">
                Scans: {item.scanCount}
                {!isItemBased && item.ratePerUnit !== null && item.ratePerUnit > 0 && (
                  <span className="ml-2">@ ₨{item.ratePerUnit}/scan</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 text-emerald-700 font-semibold">
              <DollarSign size={16} />
              <span>₨{item.pendingPayment.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
