"use client"
import {
  LayoutDashboard,
  Plus,
  Scan,
  Box,
  LogOut,
  User,
  Scissors,
  Printer,
  Package,
  DollarSign,
  Wallet
} from "lucide-react";
import { useAuth } from "@/app/context/AuthContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar({ active, setActive }: any) {
  const { user, logout, canAccess } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  return (
    <aside className="fixed w-64 h-screen bg-white border-r flex flex-col">
      <div className="p-6 flex items-center gap-3 font-bold text-lg">
        <div className="bg-blue-600 text-white p-2 rounded">📦</div>
        Inventory
      </div>

      {/* User Info */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
            <User size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500">{user.department}</p>
          </div>
        </div>
      </div>

      <nav className="px-4 space-y-2 flex-1">
        {canAccess("/") && user.role === "admin" && (
          <Link href="/">
            <SidebarItem
              icon={<LayoutDashboard size={18} />}
              label="Dashboard"
              active={pathname === "/"}
            />
          </Link>
        )}

        {canAccess("/cutting") && (
          <Link href="/cutting">
            <SidebarItem
              icon={<Scissors size={18} />}
              label="Cutting"
              active={pathname === "/cutting" || active === "add"}
            />
          </Link>
        )}

        {canAccess("/create-product") && (
          <Link href="/create-product">
            <SidebarItem
              icon={<Plus size={18} />}
              label="Create Product"
              active={pathname.startsWith("/create-product")}
            />
          </Link>
        )}

        {canAccess("/print-barcodes") && (
          <Link href="/print-barcodes">
            <SidebarItem
              icon={<Printer size={18} />}
              label="Print Barcodes"
              active={pathname === "/print-barcodes"}
            />
          </Link>
        )}

        {canAccess("/product") && (
          <Link href="/product">
            <SidebarItem
              icon={<Package size={18} />}
              label="Products"
              active={pathname.startsWith("/product")}
            />
          </Link>
        )}

        {canAccess("/store") && (
          <Link href="/store">
            <SidebarItem
              icon={<Box size={18} />}
              label="Store Scan"
              active={pathname.startsWith("/store")}
            />
          </Link>
        )}

        {canAccess("/rates") && (
          <Link href="/rates">
            <SidebarItem
              icon={<DollarSign size={18} />}
              label="Manage Rates"
              active={pathname.startsWith("/rates")}
            />
          </Link>
        )}

        {canAccess("/payments") && user.role === "admin" && (
          <Link href="/payments">
            <SidebarItem
              icon={<Wallet size={18} />}
              label="Payments"
              active={pathname.startsWith("/payments")}
            />
          </Link>
        )}
      </nav>

      {/* Logout Button */}
      <div className="px-4 pb-4">
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm text-red-600 hover:bg-red-50 transition"
        >
          <LogOut size={18} />
          Logout
        </button>
      </div>

      <p className="pb-4 w-full text-center text-xs text-gray-400">
        © 2026 Clothing Inventory
      </p>
    </aside>
  );
}

function SidebarItem({ icon, label, active, onClick }: any) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm cursor-pointer
      ${active ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
    >
      {icon}
      {label}
    </div>
  );
}
