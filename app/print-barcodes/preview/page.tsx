"use client";

import { useEffect, useState } from "react";

interface BarcodeWithQR {
  _id: string;
  design: string;
  size: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  item: string;
  unitNumber: number;
  totalUnitsInBatch?: number;
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
    <div className="p-8 print:p-0 bg-white min-h-screen">
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
          <div key={barcode._id || index} className="barcode-card border-b-2 border-dashed border-gray-400 pb-2 mb-2 pt-2 print:pt-3">
            <div className="text-center mb-1">
              <p className="text-xs font-bold text-gray-800 print:text-[8pt]">{barcode.design}</p>
              <p className="text-xs text-gray-600 print:text-[7pt]">
                {barcode.suitType} | {SIZE_LABELS[barcode.size]}
              </p>
              <p className="text-xs font-semibold text-blue-600 print:text-[7pt]">
                {barcode.totalUnitsInBatch ? `${barcode.unitNumber}/${barcode.totalUnitsInBatch}` : `Unit #${barcode.unitNumber}`}
              </p>
              <p className="text-xs font-bold text-gray-900 bg-gray-100 rounded py-0.5 print:text-[8pt]">
                {barcode.item}
              </p>
            </div>
            <img src={barcode.qr} alt="QR Code" className="w-24 h-24 mx-auto print:w-20 print:h-20" />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: 32mm 999mm;
            margin: 0;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 32mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .barcode-card {
            page-break-after: avoid;
            page-break-inside: avoid;
            padding-top: 3mm !important;
            padding-left: 2mm !important;
            padding-right: 2mm !important;
            padding-bottom: 5mm !important;
            margin: 0 !important;
            border-bottom: 1px dashed #999 !important;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
