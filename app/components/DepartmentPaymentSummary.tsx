"use client";

import { useEffect, useState } from "react";
import { Banknote, CircleDollarSign, Wallet, Barcode } from "lucide-react";

interface DepartmentPaymentSummaryProps {
  department: string;
}

interface DepartmentPaymentData {
  department: string;
  ratePerUnit: number;
  totalScans: number;
  totalPaid: number;
  totalDue: number;
  pending: number;
}

export default function DepartmentPaymentSummary({ department }: DepartmentPaymentSummaryProps) {
  const [data, setData] = useState<DepartmentPaymentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`/api/payment/department?department=${encodeURIComponent(department)}`, {
          cache: "no-store",
        });
        const result = await response.json();

        if (result.success) {
          setData(result.data);
        }
      } catch (error) {
        console.error("Failed to load department payment summary", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [department]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white rounded-lg border p-4 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-6 bg-gray-200 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const cards = [
    {
      label: "Total Due",
      value: `₨${data.totalDue.toFixed(2)}`,
      icon: <Banknote size={18} />,
      className: "bg-blue-50 text-blue-800 border-blue-200",
    },
    {
      label: "Paid",
      value: `₨${data.totalPaid.toFixed(2)}`,
      icon: <Wallet size={18} />,
      className: "bg-emerald-50 text-emerald-800 border-emerald-200",
    },
    {
      label: "Pending",
      value: `₨${data.pending.toFixed(2)}`,
      icon: <CircleDollarSign size={18} />,
      className: "bg-amber-50 text-amber-800 border-amber-200",
    },
    {
      label: "Total Scans",
      value: data.totalScans.toLocaleString(),
      icon: <Barcode size={18} />,
      className: "bg-gray-50 text-gray-800 border-gray-200",
      helper: `Rate ₨${data.ratePerUnit}/unit`,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-lg border p-4 shadow-sm flex items-start gap-3 ${card.className}`}
        >
          <div className="w-10 h-10 rounded-lg bg-white/60 flex items-center justify-center text-current border border-white/40">
            {card.icon}
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium opacity-80">{card.label}</p>
            <p className="text-xl font-semibold leading-tight">{card.value}</p>
            {card.helper && <p className="text-xs opacity-70 mt-1">{card.helper}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}