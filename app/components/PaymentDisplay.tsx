"use client";

import { useState, useEffect, useCallback } from "react";
import { DollarSign } from "lucide-react";

// Departments that have item-based rates
const ITEM_BASED_DEPARTMENTS = ["Cutting", "Sewing", "Press"];

// Departments that use FinalSticker model
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

interface PaymentDisplayProps {
  userName: string;
  department: string;
  scanCount?: number;
}

export default function PaymentDisplay({ userName, department, scanCount }: PaymentDisplayProps) {
  const [payment, setPayment] = useState<{
    pendingPayment: number;
    scanCount: number;
    ratePerUnit: number;
    note?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPayment = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/payment/pending?userName=${encodeURIComponent(userName)}&department=${encodeURIComponent(department)}`
      );
      const data = await response.json();

      if (data.success) {
        setPayment(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch payment:", error);
    } finally {
      setLoading(false);
    }
  }, [userName, department]);

  useEffect(() => {
    fetchPayment();
  }, [userName, department, scanCount, fetchPayment]);

  // Refresh data when user comes back to the tab (e.g., after admin makes payment)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchPayment();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchPayment]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  if (!payment) return null;

  const isItemBased = ITEM_BASED_DEPARTMENTS.includes(department);
  const isFinalSticker = FINAL_STICKER_DEPARTMENTS.includes(department);

  return (
    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200 shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
            <DollarSign className="text-white" size={20} />
          </div>
          <div>
            <p className="text-xs text-green-700 font-medium">Payment Pending</p>
            <p className="text-2xl font-bold text-green-900">
              ₨{payment.pendingPayment.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-green-700">Total Scans</p>
          <p className="text-xl font-semibold text-green-900">{payment.scanCount}</p>
          {isItemBased ? (
            <p className="text-xs text-green-600 italic">Per-item rates</p>
          ) : isFinalSticker ? (
            <p className="text-xs text-green-600">@ ₨{payment.ratePerUnit}/scan</p>
          ) : (
            <p className="text-xs text-green-600">@ ₨{payment.ratePerUnit}/unit</p>
          )}
        </div>
      </div>
    </div>
  );
}
