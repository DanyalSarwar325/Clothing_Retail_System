"use client";

import { useEffect, useState } from "react";

interface BarcodeWithQR {
  _id: string;
  design: string;
  size: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  item: string;
  unitNumber: number;
  sequenceNumber?: number;
  totalUnitsInBatch?: number;
  qr: string;
}

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
          🖨️ Print Barcodes (3cm × 5cm)
        </button>
      </div>

      <div className="print:block">
        {barcodes.map((barcode, index) => (
          <div key={barcode._id || index} className="barcode-card border-b-2 border-dashed border-gray-400 pb-2 mb-2 pt-2 text-center bg-white">
            <div className="barcode-info text-center mb-0.5">
              <p className="barcode-design text-[8px] font-bold text-gray-800 truncate max-w-[28mm]">{barcode.design}</p>
              <p className="text-[7px] text-gray-600">
                {barcode.suitType} | {barcode.size}
              </p>
              <p className="text-[7px] font-semibold text-blue-600">
                {barcode.totalUnitsInBatch ? `${barcode.sequenceNumber || barcode.unitNumber}/${barcode.totalUnitsInBatch}` : `#${barcode.sequenceNumber || barcode.unitNumber}`}
              </p>
              <p className="barcode-item text-[8px] font-bold text-gray-900 bg-gray-100 rounded py-0.5">
                {barcode.item}
              </p>
            </div>
            <img src={barcode.qr} alt="QR Code" className="barcode-qr w-24 h-24 mx-auto" />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @media print {
          @page {
            size: 30mm 50mm;
            margin: 1mm;
          }
          body {
            margin: 0 !important;
            padding: 0 !important;
            width: 28mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            font-size: 6pt !important;
          }
          .barcode-card {
            page-break-after: always;
            page-break-inside: avoid;
            padding: 3mm 0 0 0 !important;
            margin: 0 !important;
            border: none !important;
            width: 28mm;
            height: 48mm;
            max-height: 48mm;
            overflow: hidden;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 0;
          }
          .barcode-card .barcode-info {
            text-align: center !important;
            width: 100%;
          }
          .barcode-card .barcode-info p {
            font-size: 5.5pt !important;
            padding: 0.3mm 1mm !important;
            margin: 0 auto !important;
            line-height: 1.2 !important;
            text-align: center !important;
          }
          .barcode-card .barcode-design {
            font-size: 6pt !important;
            max-width: 26mm;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
          .barcode-card .barcode-item {
            font-size: 6.5pt !important;
            font-weight: bold !important;
          }
          .barcode-card .barcode-qr {
            width: 21mm !important;
            height: 21mm !important;
            margin: 0 auto !important;
            margin-left: 3mm !important;
            display: block !important;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
