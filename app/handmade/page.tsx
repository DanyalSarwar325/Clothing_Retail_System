"use client";

import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, User, Handshake, FileOutput } from "lucide-react";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import OutpassModal from "@/app/components/OutpassModal";
import DepartmentScanner from "@/app/components/DepartmentScanner";

export default function HandmadePage() {
  const { user, logout } = useAuth();
  const [scanCount, setScanCount] = useState(0);
  const [showOutpassModal, setShowOutpassModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
            <Handshake className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Handmade Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Scanned Today</p>
            <p className="text-2xl font-bold text-purple-600">{scanCount}</p>
          </div>
          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-600 hover:bg-purple-200 rounded-lg transition"
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
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <User className="text-purple-600 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-purple-800">Welcome, {user?.name}</p>
              <p className="text-sm text-purple-700 mt-0.5">
                Continuous scanning is enabled. Point your barcode gun and scan garments continuously—the system queues and updates them to <strong>Handmade</strong> automatically with audio confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summaries */}
        <DepartmentPaymentSummary department="Handmade" refreshKey={scanCount} />
        <PaymentDisplay userName={user?.name || user?.username || ""} department="Handmade" scanCount={scanCount} />
        <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Handmade" scanCount={scanCount} />

        {/* Continuous Always-On Scanner */}
        <DepartmentScanner
          department="Handmade"
          userName={user?.name || user?.username || "Handmade Staff"}
          colorTheme="purple"
          scanCount={scanCount}
          setScanCount={setScanCount}
          isModalOpen={showOutpassModal}
        />
      </div>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => setShowOutpassModal(false)}
        department="Handmade"
        userName={user?.name || user?.username || ""}
      />
    </div>
  );
}
