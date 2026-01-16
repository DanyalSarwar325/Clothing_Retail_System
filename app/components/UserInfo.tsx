"use client";

import { useAuth } from "@/app/context/AuthContext";
import { LogOut, User } from "lucide-react";

export default function UserInfo() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="flex items-center gap-4 px-4 py-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3 flex-1">
        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
          <User size={20} className="text-white" />
        </div>
        <div>
          <p className="font-medium text-gray-900">{user.name}</p>
          <p className="text-sm text-gray-500">{user.department}</p>
        </div>
      </div>
      <button
        onClick={logout}
        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        title="Logout"
      >
        <LogOut size={20} />
      </button>
    </div>
  );
}
