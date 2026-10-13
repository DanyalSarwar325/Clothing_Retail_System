"use client";

import { useState } from "react";
import { DollarSign, Check, Loader2, FileText, ArrowRight } from "lucide-react";
import Link from "next/link";

// Departments that have item-based rates (all except Packing and Store)
// Packing and Store rates are set when generating final stickers
const ITEM_BASED_DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
];

const SIZES = ["S", "M", "L"] as const;
const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };
const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

interface ItemQuantity {
  Qameez: number;
  Shalwar: number;
  Dupatta: number;
}

interface SizeQuantities {
  S: ItemQuantity;
  M: ItemQuantity;
  L: ItemQuantity;
}

interface ItemRate {
  Qameez: number;
  Shalwar: number;
  Dupatta: number;
}

interface DepartmentRate {
  department: string;
  ratePerPiece: number;
  item?: string;
}

export default function AdminBarcodeGenerator() {
  const [design, setDesign] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [quantities, setQuantities] = useState<SizeQuantities>({
    S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
  });

  // Item-based rates for all departments (including Overlock & Clipping)
  const [itemRates, setItemRates] = useState<Record<string, ItemRate>>({
    Cutting: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Sewing: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Quality: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Handmade: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    "Adda Work": { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Patching: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Press: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Overlock: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Clipping: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
  });

  const [error, setError] = useState("");
  const [showRates, setShowRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [createdPO, setCreatedPO] = useState<any>(null);

  const setQuantityValue = (
    size: keyof SizeQuantities,
    item: keyof ItemQuantity,
    value: number
  ) => {
    setQuantities((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        [item]: Math.max(0, value),
      },
    }));
  };

  const updateItemRate = (department: string, item: keyof ItemRate, value: number) => {
    setItemRates((prev) => ({
      ...prev,
      [department]: {
        ...prev[department],
        [item]: Math.max(0, value),
      },
    }));
  };

  // Get which items are needed based on quantities
  const getRequiredItems = (): string[] => {
    const items: string[] = [];
    for (const item of ITEMS) {
      if (SIZES.some((s) => quantities[s][item] > 0)) {
        items.push(item);
      }
    }
    return items;
  };

  // Calculate totals
  const getTotalPlannedUnits = () => {
    let total = 0;
    for (const size of SIZES) {
      for (const item of ITEMS) {
        total += quantities[size][item];
      }
    }
    return total;
  };

  const getItemTotal = (item: (typeof ITEMS)[number]) => {
    let total = 0;
    for (const size of SIZES) {
      total += quantities[size][item];
    }
    return total;
  };

  // Reset all fields
  const resetForm = () => {
    setDesign("");
    setPoNumber("");
    setNotes("");
    setQuantities({
      S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    });
    setItemRates({
      Cutting: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Sewing: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Quality: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Handmade: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      "Adda Work": { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Patching: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Press: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Overlock: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      Clipping: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    });
  };

  // Handle PO Creation
  const handleCreatePO = async () => {
    if (!design.trim()) {
      setError("Please enter a design name");
      return;
    }

    const totalUnits = getTotalPlannedUnits();
    if (totalUnits === 0) {
      setError("Please enter at least one planned quantity");
      return;
    }

    const requiredItems = getRequiredItems();

    // Validate rates for all departments (including Overlock & Clipping)
    for (const dept of ITEM_BASED_DEPARTMENTS) {
      for (const item of requiredItems) {
        const rate = itemRates[dept][item as keyof ItemRate];
        if (rate === undefined || rate === null || isNaN(rate) || rate < 0) {
          setError(`Please set ${dept} rate for ${item}`);
          return;
        }
      }
    }

    setError("");
    setSaving(true);
    setSuccess(false);
    setCreatedPO(null);

    // Build rates array
    const rates: DepartmentRate[] = [];
    for (const dept of ITEM_BASED_DEPARTMENTS) {
      for (const item of requiredItems) {
        rates.push({
          department: dept,
          ratePerPiece: itemRates[dept][item as keyof ItemRate],
          item: item,
        });
      }
    }

    try {
      const response = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design: design.trim(),
          poNumber: poNumber.trim() || undefined,
          plannedQuantities: quantities,
          departmentRates: rates,
          notes,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setSuccess(true);
        setCreatedPO(result.purchaseOrder);
        resetForm();
      } else {
        setError(result.message || "Failed to create Purchase Order");
      }
    } catch (err: any) {
      setError(err.message || "Failed to create Purchase Order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
      {/* Card Header */}
      <div className="flex items-center gap-3 pb-5 border-b mb-6">
        <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
          <FileText className="text-indigo-600" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            Create Cutting Purchase Order (PO)
          </h2>
          <p className="text-xs text-gray-500">
            Enter design, planned sizes & department rates once. Barcodes will be generated based on cut pieces received from the master.
          </p>
        </div>
      </div>

      {/* Design Name and PO Number */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Design Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Wedding Collection 2026, Summer Lawn Vol 1"
            value={design}
            onChange={(e) => setDesign(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            PO Number <span className="text-xs text-gray-400 font-normal">(Leave blank to auto-generate)</span>
          </label>
          <input
            type="text"
            placeholder="e.g. PO-2026-0001"
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            className="w-full border rounded-lg px-4 py-2 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Quantity Grid */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-3">
          Planned Quantities by Size & Item
        </h3>

        <div className="overflow-x-auto border rounded-xl">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 text-xs font-semibold text-gray-600">
                <th className="border-b px-4 py-2.5 text-left">Size</th>
                <th className="border-b px-4 py-2.5 text-center">Qameez</th>
                <th className="border-b px-4 py-2.5 text-center">Shalwar</th>
                <th className="border-b px-4 py-2.5 text-center">Dupatta</th>
                <th className="border-b px-4 py-2.5 text-center">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {SIZES.map((size) => (
                <tr key={size} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-gray-900 text-sm">
                    {SIZE_LABELS[size]}
                  </td>
                  {ITEMS.map((item) => (
                    <td key={item} className="px-2 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        value={quantities[size][item] || ""}
                        onChange={(e) =>
                          setQuantityValue(size, item, parseInt(e.target.value) || 0)
                        }
                        placeholder="0"
                        className="w-20 text-center border rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </td>
                  ))}
                  <td className="px-4 py-2 text-center font-bold text-gray-700 text-sm">
                    {quantities[size]["Qameez"] +
                      quantities[size]["Shalwar"] +
                      quantities[size]["Dupatta"]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Department Rates Section (including Overlock & Clipping) */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => setShowRates(!showRates)}
          className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <DollarSign size={16} />
          {showRates
            ? "Hide Department Rates"
            : "Set Department Rates Per Piece (Cutting, Sewing, Overlock, Clipping, etc.)"}
        </button>

        {showRates && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-sm font-semibold text-gray-800 mb-1">
              Department Piece Rates (Rs. Per Piece)
            </h4>
            <p className="text-xs text-gray-500 mb-3">
              Rates will be attached once in this PO. When barcodes are generated later from received cut pieces, they will automatically inherit these rates without asking again.
            </p>

            <div className="overflow-x-auto border rounded-xl bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100/70 border-b text-xs font-semibold text-gray-600">
                    <th className="py-2.5 px-3 text-left">Department</th>
                    <th className="py-2.5 px-3 text-center">Qameez (Rs.)</th>
                    <th className="py-2.5 px-3 text-center">Shalwar (Rs.)</th>
                    <th className="py-2.5 px-3 text-center">Dupatta (Rs.)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ITEM_BASED_DEPARTMENTS.map((dept) => (
                    <tr key={dept} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 font-medium text-gray-900">
                        {dept}
                        {(dept === "Overlock" || dept === "Clipping") && (
                          <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded">
                            New
                          </span>
                        )}
                      </td>
                      {ITEMS.map((item) => {
                        const requiredItems = getRequiredItems();
                        const isNeeded = requiredItems.includes(item);
                        const rateValue = itemRates[dept][item];
                        return (
                          <td key={item} className="py-2 px-2 text-center">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={rateValue}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === "" || /^\d*\.?\d*$/.test(val)) {
                                  updateItemRate(dept, item, parseFloat(val) || 0);
                                }
                              }}
                              placeholder="0"
                              disabled={!isNeeded}
                              className={`w-24 text-center border rounded-lg px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                !isNeeded ? "bg-gray-100 text-gray-400" : ""
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              * Only items with entered quantities are enabled for rates
            </p>
          </div>
        )}
      </div>

      {/* Summary Box */}
      {getTotalPlannedUnits() > 0 && (
        <div className="mb-6 p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-sm text-indigo-900">
          <div className="flex justify-between items-center font-bold mb-2">
            <span>Summary of Planned Pieces:</span>
            <span className="text-base text-indigo-700">{getTotalPlannedUnits()} pieces planned</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-indigo-700">
            {ITEMS.map((item) => (
              <div key={item} className="bg-white p-2 rounded-lg border border-indigo-100">
                <span className="font-semibold block">{item}:</span>
                <span>{getItemTotal(item)} pieces total</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Success Message for PO Creation */}
      {success && createdPO && (
        <div className="mb-6 p-5 bg-green-50 border border-green-200 text-green-900 rounded-xl">
          <div className="flex items-center gap-2 font-bold text-base text-green-800">
            <Check size={20} className="text-green-600" />
            Purchase Order {createdPO.poNumber} Created Successfully!
          </div>
          <p className="text-sm text-green-700 mt-1">
            Planned for Design <strong>"{createdPO.design}"</strong> with all department rates saved.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/purchase-orders"
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-xs transition"
            >
              Open Purchase Orders
              <ArrowRight size={16} />
            </Link>
            <button
              onClick={() => {
                setSuccess(false);
                setCreatedPO(null);
              }}
              className="px-4 py-2 bg-white border border-green-300 text-green-800 hover:bg-green-100 rounded-lg text-sm font-medium transition"
            >
              Create Another PO
            </button>
          </div>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleCreatePO}
        disabled={saving}
        className={`w-full py-3.5 rounded-xl font-bold transition flex items-center justify-center gap-2 shadow-xs ${
          saving
            ? "bg-gray-400 text-gray-200 cursor-not-allowed"
            : "bg-indigo-600 hover:bg-indigo-700 text-white"
        }`}
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Creating Purchase Order...
          </>
        ) : (
          <>
            <FileText size={18} />
            Create Purchase Order (PO)
          </>
        )}
      </button>
    </div>
  );
}
