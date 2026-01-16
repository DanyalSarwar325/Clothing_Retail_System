"use client";

import { useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import AddProduct from "@/app/components/AddProduct";
import { useAuth } from "@/app/context/AuthContext";
import { LogOut } from "lucide-react";
import PaymentDisplay from "@/app/components/PaymentDisplay";
import PaymentByDesignDisplay from "@/app/components/PaymentByDesignDisplay";
import DepartmentPaymentSummary from "@/app/components/DepartmentPaymentSummary";

export default function CuttingPage() {
  const [active, setActive] = useState("add");
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active={active} setActive={setActive} />

      <div className="ml-64 w-full">
        {/* Header with user info and logout */}
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Cutting Department</h1>
            <p className="text-sm text-gray-500">Welcome, {user?.name}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        </header>

        <div className="p-8">
          <div className="mb-6">
            <DepartmentPaymentSummary department="Cutting" />
          </div>

          {/* Payment Display */}
          <div className="mb-6">
            <PaymentDisplay userName={user?.name || ""} department="Cutting" />
          </div>

          {/* Payment by Design */}
          <div className="mb-6">
            <PaymentByDesignDisplay userName={user?.name || ""} department="Cutting" />
          </div>
          
          {active === "add" && <AddProduct />}
          {active === "scan" && <div className="card">Scan Product</div>}
          {active === "list" && <div className="card">Product List</div>}
        </div>
      </div>
    </div>
  );
}
