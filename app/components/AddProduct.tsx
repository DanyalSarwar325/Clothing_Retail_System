"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ITEMS = ["Shalwar", "Qameez", "Dupatta"];

export default function AddProduct() {
  const router = useRouter();
  const [design, setDesign] = useState("");
  const [total, setTotal] = useState(0);
  const [s, setS] = useState(0);
  const [m, setM] = useState(0);
  const [l, setL] = useState(0);
  const [error, setError] = useState("");

  const generateBarcodes = () => {
    // Validate design name
    if (!design.trim()) {
      setError("Please enter a design name");
      return;
    }

    // Validate quantities
    if (s + m + l !== total) {
      setError("Small + Medium + Large must equal Total Quantity");
      return;
    }

    if (total === 0) {
      setError("Please enter at least one quantity");
      return;
    }

    setError("");

    // Calculate total barcodes to be generated
    const totalBarcodes = (s + m + l) * 3; // 3 items per unit (Shalwar, Qameez, Dupatta)
    
    // Navigate to print page with query params
    const params = new URLSearchParams({
      design: design,
      s: s.toString(),
      m: m.toString(),
      l: l.toString(),
    });

    router.push(`/print-barcodes?${params.toString()}`);
  };

  // Calculate preview of barcodes to be generated
  const previewTotal = (s + m + l) * 3;

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 max-w-xl mx-auto">
      <h2 className="text-lg font-semibold mb-3">Product Details</h2>

      <div className="grid grid-cols-2 gap-3">
        <Input label="Design Name" placeholder="e.g. Wedding Suit" onChange={setDesign} />
        
        <Input label="Small Quantity" type="number" onChange={setS} />
        <Input label="Medium Quantity" type="number" onChange={setM} />

        <Input label="Large Quantity" type="number" onChange={setL} />
        <Input label="Total Quantity" type="number" onChange={setTotal} />

        <Textarea label="Notes (Optional)" />
      </div>

      {/* Preview Info */}
      {(s > 0 || m > 0 || l > 0) && (
        <div className="mt-3 p-2.5 bg-blue-50 rounded-md border border-blue-200">
          <h3 className="text-sm font-semibold text-blue-800 mb-1.5">Barcode Preview:</h3>
          <ul className="text-xs text-blue-700 space-y-0.5">
            {s > 0 && (
              <li>• Small: {s} units × 3 items (Shalwar, Qameez, Dupatta) = <strong>{s * 3} barcodes</strong></li>
            )}
            {m > 0 && (
              <li>• Medium: {m} units × 3 items (Shalwar, Qameez, Dupatta) = <strong>{m * 3} barcodes</strong></li>
            )}
            {l > 0 && (
              <li>• Large: {l} units × 3 items (Shalwar, Qameez, Dupatta) = <strong>{l * 3} barcodes</strong></li>
            )}
            <li className="pt-1.5 border-t border-blue-300 font-bold">
              Total: {previewTotal} barcodes
            </li>
          </ul>
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

      <button
        onClick={generateBarcodes}
        className="mt-3 w-full bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
      >
        Add Product & Generate Barcodes →
      </button>
    </div>
  );
}

/* Reusable UI Components */
function Input({ label, type = "text", placeholder, onChange }: any) {
  return (
    <div>
      <label className="text-xs text-gray-600">{label}</label>
      <input
        type={type}
        placeholder={placeholder}
        onChange={(e) => onChange(+e.target.value || e.target.value)}
        className="mt-0.5 w-full border rounded-md px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}



function Textarea({ label }: any) {
  return (
    <div className="col-span-2">
      <label className="text-xs text-gray-600">{label}</label>
      <textarea
        className="mt-0.5 w-full border rounded-md px-2.5 py-1.5 text-sm bg-gray-50 focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="Additional notes..."
        rows={2}
      />
    </div>
  );
}
