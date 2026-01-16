"use client";

import { useEffect, useState } from "react";
import { Layers, DollarSign } from "lucide-react";

interface DesignPayment {
  design: string;
  scanCount: number;
  ratePerUnit: number;
  pendingPayment: number;
}

interface PaymentByDesignDisplayProps {
  userName: string;
  department: string;
}

export default function PaymentByDesignDisplay({ userName, department }: PaymentByDesignDisplayProps) {
  const [items, setItems] = useState<DesignPayment[]>([]);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [userName, department]);

  const fetchData = async () => {
    try {
      const response = await fetch(
        `/api/payment/pending/by-design?userName=${encodeURIComponent(userName)}&department=${encodeURIComponent(department)}`
      );
      const data = await response.json();
      if (data.success) {
        setItems(data.data.perDesign || []);
        setRate(data.data.ratePerUnit || 0);
      }
    } catch (error) {
      console.error("Failed to fetch payment by design", error);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <div className="bg-white rounded-lg border shadow-sm p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Layers className="text-emerald-700" size={18} />
        </div>
        <div>
          <p className="text-xs text-gray-500">Payment Pending by Design</p>
          <p className="text-sm text-gray-700">Rate: ₨{rate}/unit</p>
        </div>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.design} className="flex items-center justify-between border rounded-md px-3 py-2">
            <div>
              <p className="font-semibold text-gray-900">{item.design}</p>
              <p className="text-xs text-gray-500">Scans: {item.scanCount}</p>
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
