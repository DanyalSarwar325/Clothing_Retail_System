"use client";

import { useEffect, useState } from "react";

interface BarcodeWithQR {
  _id: string;
  design: string;
  size: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  item: string;
  unitNumber: number;
  qr: string;
}

const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };

export default function PrintPreviewPage() {
  const [barcodes, setBarcodes] = useState<BarcodeWithQR[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get barcodes from sessionStorage
    const storedBarcodes = sessionStorage.getItem("printBarcodes");
    if (storedBarcodes) {
      setBarcodes(JSON.parse(storedBarcodes));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (barcodes.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">No Barcodes Selected</h1>
          <p className="text-gray-600">Please go back and select barcodes to print.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="print:hidden mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Print Preview</h1>
          <p className="text-gray-600">{barcodes.length} barcodes ready to print</p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700"
        >
          🖨️ Print Barcodes
        </button>
      </div>

      <div className="print:block">
        {barcodes.map((barcode, index) => (
          <div key={barcode._id || index} className="barcode-card border-b-2 border-dashed border-gray-400 pb-4 mb-4">
            <img src={barcode.qr} alt="QR Code" className="w-40 h-40 mx-auto" />
            <div className="mt-2 text-center">
              <p className="text-sm font-bold text-gray-800">{barcode.design}</p>
              <p className="text-sm text-gray-600">
                {barcode.suitType} | {SIZE_LABELS[barcode.size]}
              </p>
              <p className="text-sm font-semibold text-blue-600">
                Unit #{barcode.unitNumber}
              </p>
              <p className="text-sm font-bold text-gray-900 bg-gray-100 rounded py-1">
                {barcode.item}
              </p>
            </div>
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: 50mm auto;
            margin: 0;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .barcode-card {
            page-break-after: always;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
