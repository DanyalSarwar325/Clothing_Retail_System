"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Receipt,
  CreditCard,
  ArrowDownLeft,
  Banknote,
  FolderTree,
  FileSpreadsheet,
  BarChart3,
  Calendar,
  Settings,
  LogOut,
  Menu,
  X,
  Building2,
  ArrowLeftRight,
} from "lucide-react";

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick?: () => void;
  badge?: string;
}

function NavItem({ href, label, icon, active, onClick, badge }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
        active
          ? "bg-emerald-600 text-white shadow-sm"
          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={active ? "text-white" : "text-slate-500"}>{icon}</span>
        <span>{label}</span>
      </div>
      {badge && (
        <span
          className={`text-xs px-2 py-0.5 rounded-full ${
            active ? "bg-emerald-700 text-white" : "bg-slate-200 text-slate-700"
          }`}
        >
          {badge}
        </span>
      )}
    </Link>
  );
}

export default function AccountingSidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  if (!user) return null;

  const toggleSidebar = () => setIsOpen(!isOpen);
  const closeSidebar = () => setIsOpen(false);

  const navItems = [
    { href: "/accounting", label: "Dashboard", icon: <LayoutDashboard size={18} /> },
    { href: "/accounting/parties", label: "Parties & Khata", icon: <Users size={18} /> },
    { href: "/accounting/purchases", label: "Purchases (Bills)", icon: <ShoppingCart size={18} /> },
    { href: "/accounting/expenses", label: "Expenses", icon: <Receipt size={18} /> },
    { href: "/accounting/payments", label: "Payments Made", icon: <CreditCard size={18} /> },
    { href: "/accounting/receipts", label: "Money Received", icon: <ArrowDownLeft size={18} /> },
    { href: "/accounting/wages", label: "Worker Wages & Advances", icon: <Banknote size={18} /> },
    { href: "/accounting/accounts", label: "Account Heads", icon: <FolderTree size={18} /> },
    { href: "/accounting/vouchers", label: "Vouchers", icon: <FileSpreadsheet size={18} /> },
    { href: "/accounting/reports", label: "Financial Reports", icon: <BarChart3 size={18} /> },
    { href: "/accounting/financial-years", label: "Financial Years", icon: <Calendar size={18} /> },
  ];

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow border border-slate-200"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-slate-900/40 z-40 backdrop-blur-xs"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar aside */}
      <aside
        className={`fixed top-0 bottom-0 left-0 bg-white border-r border-slate-200 flex flex-col z-40 w-64 transition-transform duration-200 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Header Branding */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-sm">
              <Building2 size={22} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 leading-tight">Accounts Dept</h2>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md inline-block">
                General Ledger
              </span>
            </div>
          </div>
        </div>

        {/* User Card */}
        <div className="p-3 mx-3 my-2 bg-slate-50 border border-slate-100 rounded-xl">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
            {user.role === "admin" && (
              <Link
                href="/"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1 bg-blue-50 px-2 py-1 rounded"
                title="Switch to Manufacturing"
              >
                <ArrowLeftRight size={12} />
                Mfg
              </Link>
            )}
          </div>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href}
              onClick={closeSidebar}
            />
          ))}
        </nav>

        {/* Footer actions */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
