"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/app/context/AuthContext";
import Sidebar from "@/app/components/Sidebar";
import { DollarSign, Save, AlertCircle, CheckCircle } from "lucide-react";

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
];

interface Rate {
  department: string;
  ratePerUnit: number;
}

export default function RatesPage() {
  const { user } = useAuth();
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      const response = await fetch("/api/rates");
      const data = await response.json();

      if (data.success) {
        const ratesMap: Record<string, number> = {};
        data.rates.forEach((rate: Rate) => {
          ratesMap[rate.department] = rate.ratePerUnit;
        });
        setRates(ratesMap);
      }
    } catch (err: any) {
      setError("Failed to load rates");
    } finally {
      setLoading(false);
    }
  };

  const handleRateChange = (department: string, value: string) => {
    const numValue = parseFloat(value) || 0;
    setRates((prev) => ({ ...prev, [department]: numValue }));
  };

  const saveRate = async (department: string) => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department,
          ratePerUnit: rates[department] || 0,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Rate for ${department} updated successfully`);
        setTimeout(() => setSuccess(""), 3000);
      } else {
        setError(data.message || "Failed to update rate");
      }
    } catch (err: any) {
      setError("Failed to update rate");
    } finally {
      setSaving(false);
    }
  };

  const saveAllRates = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const promises = DEPARTMENTS.map((dept) =>
        fetch("/api/rates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            department: dept,
            ratePerUnit: rates[dept] || 0,
          }),
        })
      );

      await Promise.all(promises);
      setSuccess("All rates updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: any) {
      setError("Failed to update some rates");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <Sidebar active="rates" setActive={() => {}} />
        <div className="ml-64 w-full p-8">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active="rates" setActive={() => {}} />

      <div className="ml-64 w-full">
        {/* Header */}
        <header className="bg-white border-b px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Department Rates</h1>
              <p className="text-sm text-gray-500">
                Set payment rates per scanned item for each department
              </p>
            </div>
            <button
              onClick={saveAllRates}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              <Save size={18} />
              Save All
            </button>
          </div>
        </header>

        <div className="p-8">
          {/* Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="text-green-600" size={20} />
              <p className="text-green-700">{success}</p>
            </div>
          )}

          {/* Rates Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DEPARTMENTS.map((department) => (
              <div
                key={department}
                className="bg-white rounded-lg border shadow-sm p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="text-blue-600" size={20} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{department}</h3>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Rate per Unit
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                          ₨
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rates[department] || 0}
                          onChange={(e) => handleRateChange(department, e.target.value)}
                          className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="0.00"
                        />
                      </div>
                      <button
                        onClick={() => saveRate(department)}
                        disabled={saving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                      >
                        <Save size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-gray-500">
                    Workers will earn ₨{rates[department] || 0} per scanned item
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
