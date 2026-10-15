"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import AccountingSidebar from "./components/AccountingSidebar";

export default function AccountingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push("/accounting-login");
      } else if (user.role !== "admin" && user.role !== "accountant") {
        router.push("/unauthorized");
      }
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-600">Loading Accounting Department...</p>
        </div>
      </div>
    );
  }

  if (user.role !== "admin" && user.role !== "accountant") {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <AccountingSidebar />
      <main className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
