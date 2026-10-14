"use client";

import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, User, FileOutput } from "lucide-react";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import OutpassModal from "@/app/components/OutpassModal";
import DepartmentScanner from "@/app/components/DepartmentScanner";

export default function SewingPage() {
  const { user, logout } = useAuth();
  const [scanCount, setScanCount] = useState(0);
  const [showOutpassModal, setShowOutpassModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-xl">🧵</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sewing Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Scanned Today</p>
            <p className="text-2xl font-bold text-orange-600">{scanCount}</p>
          </div>
          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg transition"
          >
            <FileOutput size={18} />
            Outpass
          </button>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Info Card */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <User className="text-orange-600 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-orange-800">Welcome, {user?.name}</p>
              <p className="text-sm text-orange-700 mt-0.5">
                Continuous scanning is enabled. Point your barcode gun and scan garments continuously—the system queues and updates them to <strong>Sewing</strong> automatically with audio confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summaries */}
        <DepartmentPaymentSummary department="Sewing" refreshKey={scanCount} />
        <PaymentDisplay userName={user?.name || user?.username || ""} department="Sewing" scanCount={scanCount} />
        <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Sewing" scanCount={scanCount} />

        {/* Continuous Always-On Scanner */}
        <DepartmentScanner
          department="Sewing"
          userName={user?.name || user?.username || "Sewing Staff"}
          colorTheme="orange"
          scanCount={scanCount}
          setScanCount={setScanCount}
          isModalOpen={showOutpassModal}
        />
      </div>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => setShowOutpassModal(false)}
        department="Sewing"
        userName={user?.name || user?.username || ""}
      />
    </div>
  );
}
