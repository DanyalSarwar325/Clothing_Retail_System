"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";
import {
  LogOut,
  RefreshCw,
  Package,
  Plus,
  Trash2,
  Save,
  ChevronDown,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface RawMaterialItem {
  item: string;
  price: number;
}

interface RawMaterial {
  _id: string;
  design: string;
  items: RawMaterialItem[];
  totalCost: number;
}

export default function RawMaterialsPage() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [designs, setDesigns] = useState<string[]>([]);
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [selectedDesign, setSelectedDesign] = useState<string>("");
  const [items, setItems] = useState<RawMaterialItem[]>([{ item: "", price: 0 }]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/raw-materials", { cache: "no-store" });
      const result = await response.json();
      if (result.success) {
        setDesigns(result.data.designs || []);
        setRawMaterials(result.data.rawMaterials || []);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // When design changes, load existing raw materials if any
  useEffect(() => {
    if (selectedDesign) {
      const existing = rawMaterials.find((rm) => rm.design === selectedDesign);
      if (existing && existing.items.length > 0) {
        setItems(existing.items);
      } else {
        setItems([{ item: "", price: 0 }]);
      }
    }
  }, [selectedDesign, rawMaterials]);

  const addRow = () => {
    setItems([...items, { item: "", price: 0 }]);
  };

  const removeRow = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: "item" | "price", value: string | number) => {
    const updated = [...items];
    if (field === "item") {
      updated[index].item = value as string;
    } else {
      updated[index].price = typeof value === "string" ? parseFloat(value) || 0 : value;
    }
    setItems(updated);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (item.price || 0), 0);
  };

  const handleSubmit = async () => {
    if (!selectedDesign) {
      toast.error("Please select a design");
      return;
    }

    // Filter out empty items
    const validItems = items.filter((item) => item.item.trim() !== "");
    if (validItems.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/raw-materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design: selectedDesign,
          items: validItems,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success("Raw materials saved successfully!");
        fetchData();
      } else {
        toast.error(result.message || "Failed to save");
      }
    } catch (error) {
      console.error("Failed to save", error);
      toast.error("Failed to save raw materials");
    } finally {
      setSaving(false);
    }
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Package size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-500">Only admins can manage raw materials.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Sidebar active="raw-materials" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        <header className="bg-white border-b px-4 sm:px-8 py-4 pt-16 lg:pt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white">
              <Package size={20} />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-gray-900">Raw Materials</h1>
              <p className="text-xs sm:text-sm text-gray-500">
                Add raw material costs per design
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg hover:bg-gray-50"
              disabled={loading}
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              Refresh
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

        <div className="p-4 sm:p-8 space-y-6">
          {/* Form Card */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 sm:p-6 border-b bg-gray-50">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Add/Edit Raw Materials
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Select a design and add raw material items with their prices
              </p>
            </div>

            <div className="p-4 sm:p-6 space-y-6">
              {/* Design Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Design
                </label>
                <div className="relative">
                  <select
                    value={selectedDesign}
                    onChange={(e) => setSelectedDesign(e.target.value)}
                    className="w-full sm:w-80 appearance-none border rounded-lg px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                  >
                    <option value="">-- Select a Design --</option>
                    {designs.map((design) => (
                      <option key={design} value={design}>
                        {design}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={18}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
              </div>

              {/* Items Table */}
              {selectedDesign && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-700">
                      Raw Material Items
                    </h3>
                    <button
                      onClick={addRow}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                    >
                      <Plus size={16} />
                      Add Row
                    </button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">
                            #
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">
                            Item Name
                          </th>
                          <th className="text-left py-3 px-4 font-medium text-gray-600">
                            Price (₨)
                          </th>
                          <th className="text-center py-3 px-4 font-medium text-gray-600">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {items.map((item, index) => (
                          <tr key={index}>
                            <td className="py-3 px-4 text-gray-500">
                              {index + 1}
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="text"
                                value={item.item}
                                onChange={(e) =>
                                  updateItem(index, "item", e.target.value)
                                }
                                placeholder="e.g., Fabric, Thread, Buttons"
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                              />
                            </td>
                            <td className="py-2 px-4">
                              <input
                                type="number"
                                value={item.price || ""}
                                onChange={(e) =>
                                  updateItem(index, "price", e.target.value)
                                }
                                placeholder="0"
                                min="0"
                                className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
                              />
                            </td>
                            <td className="py-2 px-4 text-center">
                              <button
                                onClick={() => removeRow(index)}
                                disabled={items.length === 1}
                                className={`p-2 rounded-lg transition ${
                                  items.length === 1
                                    ? "text-gray-300 cursor-not-allowed"
                                    : "text-red-500 hover:bg-red-50"
                                }`}
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={2} className="py-3 px-4 text-right font-semibold text-gray-700">
                            Total:
                          </td>
                          <td className="py-3 px-4 font-bold text-green-600 text-lg">
                            ₨{calculateTotal().toLocaleString()}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={handleSubmit}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                    >
                      <Save size={18} />
                      {saving ? "Saving..." : "Submit"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Existing Raw Materials List */}
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="p-4 sm:p-6 border-b bg-gray-50">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                Saved Raw Materials
              </h2>
              <p className="text-xs sm:text-sm text-gray-500">
                Raw materials already added for designs
              </p>
            </div>

            {loading ? (
              <div className="p-8">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse h-16 bg-gray-200 rounded"
                    ></div>
                  ))}
                </div>
              </div>
            ) : rawMaterials.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No raw materials added yet. Select a design above to add.
              </div>
            ) : (
              <div className="divide-y">
                {rawMaterials.map((rm) => (
                  <div
                    key={rm._id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => setSelectedDesign(rm.design)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900">{rm.design}</p>
                        <p className="text-xs text-gray-500">
                          {rm.items.length} item(s)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">
                          ₨{rm.totalCost.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">Total Cost</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {rm.items.slice(0, 5).map((item, idx) => (
                        <span
                          key={idx}
                          className="text-xs bg-gray-100 px-2 py-1 rounded"
                        >
                          {item.item}: ₨{item.price}
                        </span>
                      ))}
                      {rm.items.length > 5 && (
                        <span className="text-xs text-gray-500">
                          +{rm.items.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
