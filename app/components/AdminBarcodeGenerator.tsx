"use client";

import { useState } from "react";
import { Scissors, Plus, Minus, DollarSign, Check, Loader2 } from "lucide-react";

// Departments that have item-based rates (all except Packing and Store)
// Packing and Store rates are set when generating final stickers
const ITEM_BASED_DEPARTMENTS = ["Cutting", "Sewing", "Quality", "Handmade", "Adda Work", "Patching", "Press"];

// No single rate departments for initial barcode generation
// Packing and Store are handled in Final Sticker generation
const FINAL_STICKER_DEPARTMENTS = ["Packing", "Store"];

const ALL_DEPARTMENTS = [...ITEM_BASED_DEPARTMENTS];

const SUIT_TYPES = ["1pc", "2pc", "3pc"] as const;
const SIZES = ["S", "M", "L"] as const;
const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };
const ITEMS = ["Qameez", "Shalwar", "Dupatta"] as const;

// Items based on suit type
const SUIT_ITEMS: Record<string, string[]> = {
  "1pc": ["Qameez"],
  "2pc": ["Qameez", "Shalwar"],
  "3pc": ["Qameez", "Shalwar", "Dupatta"],
};

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
  const [quantities, setQuantities] = useState<SizeQuantities>({
    S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
  });
  
  // Item-based rates for all departments (except Packing and Store)
  const [itemRates, setItemRates] = useState<Record<string, ItemRate>>({
    Cutting: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Sewing: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Quality: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Handmade: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    "Adda Work": { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Patching: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
    Press: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
  });
  
  const [error, setError] = useState("");
  const [showRates, setShowRates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const updateQuantity = (
    size: keyof SizeQuantities,
    item: keyof ItemQuantity,
    delta: number
  ) => {
    setQuantities((prev) => ({
      ...prev,
      [size]: {
        ...prev[size],
        [item]: Math.max(0, prev[size][item] + delta),
      },
    }));
  };

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
  const getTotalBarcodes = () => {
    let total = 0;
    for (const size of SIZES) {
      for (const item of ITEMS) {
        total += quantities[size][item];
      }
    }
    return total;
  };

  const getTotalUnits = () => {
    return getTotalBarcodes();
  };

  // Get total count for a specific item across all sizes
  const getItemTotal = (item: typeof ITEMS[number]) => {
    let total = 0;
    for (const size of SIZES) {
      total += quantities[size][item];
    }
    return total;
  };

  const generateBarcodes = async () => {
    if (!design.trim()) {
      setError("Please enter a design name");
      return;
    }

    const totalUnits = getTotalUnits();
    if (totalUnits === 0) {
      setError("Please enter at least one quantity");
      return;
    }

    const requiredItems = getRequiredItems();

    // Validate item-based rates for all departments (except Packing and Store)
    // 0 is a valid rate - only reject negative, undefined, null, or NaN
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

    try {
      // Build rates array
      const rates: DepartmentRate[] = [];
      
      // Add item-based rates for all departments (except Packing and Store)
      for (const dept of ITEM_BASED_DEPARTMENTS) {
        for (const item of requiredItems) {
          rates.push({
            department: dept,
            ratePerPiece: itemRates[dept][item as keyof ItemRate],
            item: item,
          });
        }
      }

      // Generate barcode data per item type with per-item sequence numbering
      const barcodesToSave: any[] = [];
      
      // Map item to suitType for backward compatibility
      const ITEM_TO_SUIT_TYPE: Record<string, string> = {
        Qameez: "1pc",
        Shalwar: "2pc",
        Dupatta: "3pc",
      };
      
      // For each item type, generate barcodes with per-item sequence numbering
      // e.g., 10 Small Qameez + 3 Medium Qameez + 4 Large Qameez = 17 total Qameez
      // Sequence: 1/17, 2/17, ..., 17/17 (across all sizes for that item)
      for (const item of ITEMS) {
        const totalForItem = getItemTotal(item);
        if (totalForItem === 0) continue;
        
        let itemSequence = 0;
        
        for (const size of SIZES) {
          const qty = quantities[size][item];
          if (qty === 0) continue;
          
          for (let unit = 1; unit <= qty; unit++) {
            itemSequence++;
            const suitType = ITEM_TO_SUIT_TYPE[item];
            // QR payload includes size so it's printed on the QR code
            const payload = { design, size, item, seq: itemSequence, totalItems: totalForItem };
            const barcodeDataStr = JSON.stringify(payload);
            
            barcodesToSave.push({
              design: design,
              size: size,
              suitType: suitType,
              item: item,
              unitNumber: unit,
              sequenceNumber: itemSequence, // Per-item sequential number
              totalUnitsInBatch: totalForItem, // Total for this item type
              barcodeData: barcodeDataStr,
              status: "generated",
              currentDepartment: "Admin",
              departmentHistory: [{
                department: "Admin",
                scannedAt: new Date().toISOString(),
                scannedBy: "Admin",
              }],
              departmentRates: rates,
            });
          }
        }
      }

      // Save barcodes to database
      const response = await fetch("/api/barcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcodes: barcodesToSave }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setSavedCount(result.count || barcodesToSave.length);
        
        // Reset form after successful save
        setDesign("");
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
        });
      } else {
        setError(result.message || "Failed to save barcodes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate barcodes");
    } finally {
      setSaving(false);
    }
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
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">Qameez</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">Shalwar</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">Dupatta</th>
                <th className="border px-4 py-2 text-center text-sm font-medium text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody>
              {SIZES.map((size) => (
                <tr key={size}>
                  <td className="border px-4 py-3 font-medium text-gray-900">
                    {SIZE_LABELS[size]}
                  </td>
                  {ITEMS.map((item) => (
                    <td key={item} className="border px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateQuantity(size, item, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          <Minus size={14} />
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={quantities[size][item]}
                          onChange={(e) =>
                            setQuantityValue(size, item, parseInt(e.target.value) || 0)
                          }
                          className="w-14 text-center border rounded px-1 py-1 text-sm"
                        />
                        <button
                          onClick={() => updateQuantity(size, item, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </td>
                  ))}
                  <td className="border px-4 py-2 text-center font-semibold text-gray-700">
                    {quantities[size]["Qameez"] + quantities[size]["Shalwar"] + quantities[size]["Dupatta"]}
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
          <div className="mt-4 space-y-6">
            {/* Item-Based Rates for All Departments (except Packing, Store) */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Item-Based Rates (Per Department)
              </h4>
              <p className="text-xs text-gray-500 mb-2">Packing & Store rates are set when generating final stickers</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border px-3 py-2 text-left font-medium text-gray-600">Department</th>
                      <th className="border px-3 py-2 text-center font-medium text-gray-600">Qameez (Rs.)</th>
                      <th className="border px-3 py-2 text-center font-medium text-gray-600">Shalwar (Rs.)</th>
                      <th className="border px-3 py-2 text-center font-medium text-gray-600">Dupatta (Rs.)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ITEM_BASED_DEPARTMENTS.map((dept) => (
                      <tr key={dept}>
                        <td className="border px-3 py-2 font-medium text-gray-900">{dept}</td>
                        {ITEMS.map((item) => {
                          const requiredItems = getRequiredItems();
                          const isNeeded = requiredItems.includes(item);
                          const rateValue = itemRates[dept][item];
                          return (
                            <td key={item} className="border px-2 py-2">
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
                                className={`w-full text-center border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 ${
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
                * Only items required by your selected suit types are enabled
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Preview */}
      {getTotalUnits() > 0 && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-3">Preview Summary</h3>
          <div className="space-y-2 text-sm text-blue-700">
            {ITEMS.map((item) => {
              const itemTotal = getItemTotal(item);
              if (itemTotal === 0) return null;
              return (
                <div key={item}>
                  <strong>{item}:</strong> {itemTotal} pieces (Sequence: 1/{itemTotal} → {itemTotal}/{itemTotal})
                  <ul className="ml-4">
                    {SIZES.map((size) => {
                      const qty = quantities[size][item];
                      if (qty === 0) return null;
                      return (
                        <li key={size}>
                          • {SIZE_LABELS[size]}: {qty}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            <div className="pt-2 border-t border-blue-300 font-bold">
              Total: {getTotalBarcodes()} barcodes
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

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg">
          <div className="flex items-center gap-2">
            <Check size={20} className="text-green-600" />
            <span className="font-semibold">Barcodes Generated Successfully!</span>
          </div>
          <p className="text-sm mt-1">
            {savedCount} barcodes have been saved. Go to <strong>"Print Barcodes"</strong> page to view and print them.
          </p>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={generateBarcodes}
        disabled={saving}
        className={`w-full py-3 rounded-lg font-semibold transition flex items-center justify-center gap-2 ${
          saving 
            ? "bg-gray-400 text-gray-200 cursor-not-allowed" 
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {saving ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            Generating & Saving...
          </>
        ) : (
          <>
            <Scissors size={18} />
            Generate Barcodes
          </>
        )}
      </button>
    </div>
  );
}

