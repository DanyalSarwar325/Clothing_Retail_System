"use client";

import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import AdminBarcodeGenerator from "@/app/components/AdminBarcodeGenerator";
import { LogOut } from "lucide-react";

export default function GenerateBarcodesPage() {
  const { user, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only admins can generate barcodes.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active="generate-barcodes" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b px-4 sm:px-8 py-6 pt-16 lg:pt-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Generate Barcodes</h1>
            <p className="text-gray-600 text-sm sm:text-base">Create barcodes for new designs</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </header>

        <div className="p-4 sm:p-8">
          <AdminBarcodeGenerator />
        </div>
      </div>
    </div>
  );
}
