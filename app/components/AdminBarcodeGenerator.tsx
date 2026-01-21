"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Scissors, Plus, Minus, DollarSign } from "lucide-react";

const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
];

const SUIT_TYPES = ["1pc", "2pc", "3pc"] as const;
const SIZES = ["S", "M", "L"] as const;
const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };

interface SuitQuantity {
  "1pc": number;
  "2pc": number;
  "3pc": number;
}

interface SizeQuantities {
  S: SuitQuantity;
  M: SuitQuantity;
  L: SuitQuantity;
}

interface DepartmentRate {
  department: string;
  ratePerPiece: number;
}

export default function AdminBarcodeGenerator() {
  const router = useRouter();
  const [design, setDesign] = useState("");
  const [quantities, setQuantities] = useState<SizeQuantities>({
    S: { "1pc": 0, "2pc": 0, "3pc": 0 },
    M: { "1pc": 0, "2pc": 0, "3pc": 0 },
    L: { "1pc": 0, "2pc": 0, "3pc": 0 },
  });
  const [rates, setRates] = useState<DepartmentRate[]>(
    DEPARTMENTS.map((dept) => ({ department: dept, ratePerPiece: 0 }))
  );
  const [error, setError] = useState("");
  const [showRates, setShowRates] = useState(false);

  const updateQuantity = (
    size: keyof SizeQuantities,
    suitType: keyof SuitQuantity,
    delta: number
  ) => {
    setQuantities((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        [suitType]: Math.max(0, prev[size][suitType] + delta),
      },
    }));
  };

  const setQuantityValue = (
    size: keyof SizeQuantities,
    suitType: keyof SuitQuantity,
    value: number
  ) => {
    setQuantities((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        [suitType]: Math.max(0, value),
      },
    }));
  };

  const updateRate = (department: string, value: number) => {
    setRates((prev) =>
      prev.map((r) =>
        r.department === department ? { ...r, ratePerPiece: Math.max(0, value) } : r
      )
    );
  };

  // Calculate totals
  const getTotalBarcodes = () => {
    let total = 0;
    for (const size of SIZES) {
      for (const suitType of SUIT_TYPES) {
        const qty = quantities[size][suitType];
        const itemCount = suitType === "1pc" ? 1 : suitType === "2pc" ? 2 : 3;
        total += qty * itemCount;
      }
    }
    return total;
  };

  const getTotalUnits = () => {
    let total = 0;
    for (const size of SIZES) {
      for (const suitType of SUIT_TYPES) {
        total += quantities[size][suitType];
      }
    }
    return total;
  };

  const generateBarcodes = () => {
    if (!design.trim()) {
      setError("Please enter a design name");
      return;
    }

    const totalUnits = getTotalUnits();
    if (totalUnits === 0) {
      setError("Please enter at least one quantity");
      return;
    }

    // Check if all rates are set
    const hasAllRates = rates.every((r) => r.ratePerPiece > 0);
    if (!hasAllRates) {
      setError("Please set rates for all departments");
      return;
    }

    setError("");

    // Build query params
    const params = new URLSearchParams({
      design: design,
      // Small quantities
      s1pc: quantities.S["1pc"].toString(),
      s2pc: quantities.S["2pc"].toString(),
      s3pc: quantities.S["3pc"].toString(),
      // Medium quantities
      m1pc: quantities.M["1pc"].toString(),
      m2pc: quantities.M["2pc"].toString(),
      m3pc: quantities.M["3pc"].toString(),
      // Large quantities
      l1pc: quantities.L["1pc"].toString(),
      l2pc: quantities.L["2pc"].toString(),
      l3pc: quantities.L["3pc"].toString(),
      // Rates as JSON
      rates: JSON.stringify(rates),
    });

    router.push(`/print-barcodes?${params.toString()}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
          <Scissors className="text-red-600" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Cutting - Generate Barcodes</h2>
          <p className="text-sm text-gray-500">Create barcodes for new designs</p>
        </div>
      </div>

      {/* Design Name */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Design Name</label>
        <input
          type="text"
          placeholder="e.g. Wedding Collection 2026"
          value={design}
          onChange={(e) => setDesign(e.target.value)}
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Quantity Grid */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Quantities by Size & Suit Type</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="border px-4 py-2 text-left text-sm font-medium text-gray-600">Size</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">1pc Suit</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">2pc Suit</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">3pc Suit</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((size) => (
                <tr key={size}>
                  <td className="border px-4 py-3 font-medium text-gray-900">
                    {SIZE_LABELS[size]}
                  </td>
                  {SUIT_TYPES.map((suitType) => (
                    <td key={suitType} className="border px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateQuantity(size, suitType, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={quantities[size][suitType]}
                          onChange={(e) =>
                            setQuantityValue(size, suitType, parseInt(e.target.value) || 0)
                          }
                          className="w-14 text-center border rounded px-1 py-1 text-sm"
                        />
                        <button
                          onClick={() => updateQuantity(size, suitType, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  ))}
                  <td className="border px-4 py-2 text-center font-semibold text-gray-700">
                    {quantities[size]["1pc"] + quantities[size]["2pc"] + quantities[size]["3pc"]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Rates Section */}
      <div className="mb-6">
        <button
          onClick={() => setShowRates(!showRates)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <DollarSign size={16} />
          {showRates ? "Hide Department Rates" : "Set Department Rates (Per Piece)"}
        </button>

        {showRates && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
            {rates.map((rate) => (
              <div key={rate.department} className="flex items-center gap-2">
                <label className="text-sm text-gray-600 w-24 truncate" title={rate.department}>
                  {rate.department}:
                </label>
                <div className="flex items-center border rounded px-2 py-1 flex-1">
                  <span className="text-gray-500 text-sm">Rs.</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={rate.ratePerPiece || ""}
                    onChange={(e) =>
                      updateRate(rate.department, parseFloat(e.target.value) || 0)
                    }
                    placeholder="0"
                    className="w-full ml-1 text-sm focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {getTotalUnits() > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Preview Summary</h3>
          <div className="space-y-2 text-sm text-blue-700">
            {SIZES.map((size) => {
              const sizeTotal = SUIT_TYPES.reduce((sum, st) => {
                const qty = quantities[size][st];
                const items = st === "1pc" ? 1 : st === "2pc" ? 2 : 3;
                return sum + qty * items;
              }, 0);
              if (sizeTotal === 0) return null;
              return (
                <div key={size}>
                  <strong>{SIZE_LABELS[size]}:</strong>
                  <ul className="ml-4">
                    {SUIT_TYPES.map((st) => {
                      const qty = quantities[size][st];
                      if (qty === 0) return null;
                      const items = st === "1pc" ? 1 : st === "2pc" ? 2 : 3;
                      return (
                        <li key={st}>
                          • {qty} × {st} = {qty * items} barcodes
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <div className="pt-2 border-t border-blue-300 font-bold">
              Total: {getTotalUnits()} units = {getTotalBarcodes()} barcodes
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateBarcodes}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
      >
        <Scissors size={18} />
        Generate Barcodes & Print
      </button>
    </div>
  );
}
