"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/app/components/Sidebar";
import { UserPlus, Users, Phone, Lock, User, Search, Trash2 } from "lucide-react";

const DEPARTMENTS = [
  "Admin",
  "Accounting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

interface UserData {
  _id: string;
  username: string;
  name: string;
  department: string;
  contactNo: string;
  isActive: boolean;
  createdAt: string;
}

export default function AddUserPage() {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    department: "",
    password: "",
    contactNo: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [users, setUsers] = useState<UserData[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (deleteConfirmId !== userId) {
      setDeleteConfirmId(userId);
      return;
    }

    try {
      setDeletingUserId(userId);
      const res = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: `User "${userName}" deleted successfully` });
        fetchUsers();
      } else {
        setMessage({ type: "error", text: data.error || "Failed to delete user" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred while deleting user" });
    } finally {
      setDeletingUserId(null);
      setDeleteConfirmId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setMessage({ type: "success", text: "User created successfully!" });
        setFormData({
          username: "",
          name: "",
          department: "",
          password: "",
          contactNo: "",
        });
        fetchUsers(); // Refresh the user list
      } else {
        setMessage({ type: "error", text: data.error || "Failed to create user" });
      }
    } catch (error) {
      setMessage({ type: "error", text: "An error occurred" });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      (user.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (user.username?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesDepartment = !filterDepartment || user.department === filterDepartment;
    return matchesSearch && matchesDepartment;
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active={null} setActive={() => {}} />

      <main className="flex-1 lg:ml-64 p-3 lg:p-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <UserPlus size={22} className="text-blue-600" />
              Add User
            </h1>
            <p className="text-sm text-gray-500">Create new users for departments</p>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            {/* Add User Form - Compact */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-4">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 text-gray-700">
                <User size={16} />
                New User
              </h2>

              <form onSubmit={handleSubmit} className="space-y-3">
                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Username"
                      required
                    />
                  </div>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Full name"
                    required
                  />
                </div>

                {/* Department & Password Row */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Department
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-2 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      required
                    >
                      <option value="">Select</option>
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Password"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Contact Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Contact No.
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                    <input
                      type="tel"
                      value={formData.contactNo}
                      onChange={(e) => setFormData({ ...formData, contactNo: e.target.value })}
                      className="w-full pl-8 pr-3 py-2 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Contact number"
                    />
                  </div>
                </div>

                {/* Message */}
                {message.text && (
                  <div
                    className={`p-2 rounded text-xs ${
                      message.type === "success"
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {message.text}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create User
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* User List - Takes more space */}
            <div className="lg:col-span-3 bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2 text-gray-700">
                  <Users size={16} />
                  Users ({filteredUsers.length})
                </h2>
              </div>

              {/* Search and Filter */}
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-2 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All</option>
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              {/* User List */}
              <div className="max-h-80 overflow-y-auto space-y-2">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-sm">
                    No users found
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-2.5 bg-gray-50 rounded-md hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {(user.name || user.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name || user.username}</p>
                          <p className="text-xs text-gray-500">@{user.username}</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          {user.department}
                        </span>
                        {user.contactNo && (
                          <span className="text-xs text-gray-500 items-center gap-1 hidden sm:flex">
                            <Phone size={10} />
                            {user.contactNo}
                          </span>
                        )}
                        {user.department !== "Admin" && (
                          <button
                            onClick={() => handleDeleteUser(user._id, user.name || user.username)}
                            disabled={deletingUserId === user._id}
                            className={`p-1.5 rounded transition ${
                              deleteConfirmId === user._id
                                ? "bg-red-600 text-white hover:bg-red-700"
                                : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                            } disabled:opacity-50`}
                            title={deleteConfirmId === user._id ? "Click again to confirm" : "Delete user"}
                          >
                            {deletingUserId === user._id ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                            ) : (
                              <Trash2 size={14} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
