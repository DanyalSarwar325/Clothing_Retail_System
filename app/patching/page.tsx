"use client";

import { useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut, User, Wrench, FileOutput } from "lucide-react";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";
import OutpassModal from "@/app/components/OutpassModal";
import DepartmentScanner from "@/app/components/DepartmentScanner";

export default function PatchingPage() {
  const { user, logout } = useAuth();
  const [scanCount, setScanCount] = useState(0);
  const [showOutpassModal, setShowOutpassModal] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
            <Wrench className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Patching Department</h1>
            <p className="text-sm text-gray-500">Logged in as: {user?.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Scanned Today</p>
            <p className="text-2xl font-bold text-teal-600">{scanCount}</p>
          </div>
          <button
            onClick={() => setShowOutpassModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-teal-100 text-teal-600 hover:bg-teal-200 rounded-lg transition"
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
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <User className="text-teal-600 mt-0.5 shrink-0" size={20} />
            <div>
              <p className="font-semibold text-teal-800">Welcome, {user?.name}</p>
              <p className="text-sm text-teal-700 mt-0.5">
                Continuous scanning is enabled. Point your barcode gun and scan garments continuously—the system queues and updates them to <strong>Patching</strong> automatically with audio confirmation.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Summaries */}
        <DepartmentPaymentSummary department="Patching" refreshKey={scanCount} />
        <PaymentDisplay userName={user?.name || user?.username || ""} department="Patching" scanCount={scanCount} />
        <PaymentByDesignDisplay userName={user?.name || user?.username || ""} department="Patching" scanCount={scanCount} />

        {/* Continuous Always-On Scanner */}
        <DepartmentScanner
          department="Patching"
          userName={user?.name || user?.username || "Patching Staff"}
          colorTheme="teal"
          scanCount={scanCount}
          setScanCount={setScanCount}
          isModalOpen={showOutpassModal}
        />
      </div>

      {/* Outpass Modal */}
      <OutpassModal
        isOpen={showOutpassModal}
        onClose={() => setShowOutpassModal(false)}
        department="Patching"
        userName={user?.name || user?.username || ""}
      />
    </div>
  );
}
