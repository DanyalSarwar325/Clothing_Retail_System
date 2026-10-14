"use client";

import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, User, Box, FileOutput } from "lucide-react";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import OutpassModal from "@/app/components/OutpassModal";
import DepartmentScanner from "@/app/components/DepartmentScanner";

export default function PackingPage() {
  const { user, logout } = useAuth();
  const [scanCount, setScanCount] = useState(0);
  const [showOutpassModal, setShowOutpassModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <Box className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Packing Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Scanned Today</p>
            <p className="text-2xl font-bold text-blue-600">{scanCount}</p>
          </div>
          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-600 hover:bg-blue-200 rounded-lg transition"
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <User className="text-blue-600 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-blue-800">Welcome, {user?.name}</p>
              <p className="text-sm text-blue-700 mt-0.5">
                Continuous scanning is enabled for both individual garment pieces and Final Stickers. Point your barcode gun and scan garments continuously—the system queues and updates them to <strong>Packing</strong> automatically with audio confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summaries */}
        <DepartmentPaymentSummary department="Packing" refreshKey={scanCount} />
        <PaymentDisplay userName={user?.name || user?.username || ""} department="Packing" scanCount={scanCount} />

        {/* Continuous Always-On Scanner with Final Sticker fallback */}
        <DepartmentScanner
          department="Packing"
          userName={user?.name || user?.username || "Packing Staff"}
          colorTheme="blue"
          allowFinalStickers={true}
          scanCount={scanCount}
          setScanCount={setScanCount}
          isModalOpen={showOutpassModal}
        />
      </div>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => setShowOutpassModal(false)}
        department="Packing"
        userName={user?.name || user?.username || ""}
      />
    </div>
  );
}
