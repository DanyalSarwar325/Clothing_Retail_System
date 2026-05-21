"use client";

import { useEffect, useState, useCallback } from "react";
import QRCode from "qrcode";
import { Printer, RefreshCw, CheckSquare, Square, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import Sidebar from "@/app/components/Sidebar";
import { useAuth } from "@/app/context/AuthContext";

interface DepartmentRate {
  department: string;
  ratePerPiece: number;
  item?: string;
}

interface BarcodeFromDB {
  _id: string;
  design: string;
  size: "S" | "M" | "L";
  suitType: "1pc" | "2pc" | "3pc";
  item: string;
  unitNumber: number;
  sequenceNumber?: number;
  totalUnitsInBatch?: number;
  barcodeData: string;
  status: string;
  departmentRates: DepartmentRate[];
  createdAt: string;
  printed?: boolean;
}

interface BarcodeWithQR extends BarcodeFromDB {
  qr: string;
}

interface DesignGroup {
  design: string;
  barcodes: BarcodeFromDB[];
  selected: boolean;
  expanded: boolean;
}

const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };

function BarcodePreviewItem({ barcode }: { barcode: BarcodeFromDB }) {
  const [qr, setQr] = useState<string>("");

  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(barcode.barcodeData)
      .then((url) => {
        if (isMounted) setQr(url);
      })
      .catch(console.error);
    return () => {
      isMounted = false;
    };
  }, [barcode.barcodeData]);

  return (
    <div className="bg-white rounded-lg p-2 border text-center">
      {qr ? (
        <img src={qr} alt="QR Code" className="w-20 h-20 mx-auto" />
      ) : (
        <div className="w-20 h-20 mx-auto bg-gray-100 animate-pulse rounded mb-1"></div>
      )}
      <p className="text-xs font-medium text-gray-700 mt-1">
        {barcode.item} | {barcode.size}
      </p>
      <p className="text-xs text-gray-500">
        {barcode.totalUnitsInBatch
          ? `${barcode.sequenceNumber || barcode.unitNumber}/${barcode.totalUnitsInBatch}`
          : `#${barcode.sequenceNumber || barcode.unitNumber}`}
      </p>
    </div>
  );
}

export default function PrintBarcodesPage() {
  const { user, loading: authLoading } = useAuth();
  const [designGroups, setDesignGroups] = useState<DesignGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ design: string; barcodeIds: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Sort barcodes helper
  const sortBarcodes = (barcodes: BarcodeFromDB[]) => {
    return [...barcodes].sort((a, b) => {
      const sizeOrder = { S: 1, M: 2, L: 3 };
      const suitOrder = { "1pc": 1, "2pc": 2, "3pc": 3 };
      const itemOrder: Record<string, number> = { Qameez: 1, Shalwar: 2, Dupatta: 3 };
      if (sizeOrder[a.size] !== sizeOrder[b.size]) return sizeOrder[a.size] - sizeOrder[b.size];
      if (suitOrder[a.suitType] !== suitOrder[b.suitType]) return suitOrder[a.suitType] - suitOrder[b.suitType];
      if (a.unitNumber !== b.unitNumber) return a.unitNumber - b.unitNumber;
      return (itemOrder[a.item] || 0) - (itemOrder[b.item] || 0);
    });
  };

  // Fetch all generated (not yet printed) barcodes — NO QR generation here
  const fetchBarcodes = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/barcodes?status=generated");
      const result = await response.json();
      console.log(result)

      if (result.success) {
        const barcodes: BarcodeFromDB[] = result.barcodes;

        // Group by design (no QR generation yet)
        const groups: Record<string, BarcodeFromDB[]> = {};
        barcodes.forEach((barcode) => {
          if (!groups[barcode.design]) groups[barcode.design] = [];
          groups[barcode.design].push(barcode);
        });

        // Convert to array, sort
        const groupArray: DesignGroup[] = [];
        for (const [design, rawBarcodes] of Object.entries(groups)) {
          const sorted = sortBarcodes(rawBarcodes);
          groupArray.push({
            design,
            barcodes: sorted,
            selected: false,
            expanded: false,
          });
        }

        // Sort groups by newest
        groupArray.sort((a, b) => {
          const aDate = new Date(a.barcodes[0]?.createdAt || 0).getTime();
          const bDate = new Date(b.barcodes[0]?.createdAt || 0).getTime();
          return bDate - aDate;
        });

        setDesignGroups(groupArray);
      } else {
        setError(result.message || "Failed to fetch barcodes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch barcodes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBarcodes();
  }, []);

  // Delete design barcodes
  const handleDeleteDesign = (design: string, barcodeIds: string[]) => {
    setDeleteConfirm({ design, barcodeIds });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    setDeleting(true);
    try {
      // Delete all barcodes for this design
      const response = await fetch(`/api/barcodes?design=${encodeURIComponent(deleteConfirm.design)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      
      if (result.success) {
        // Remove from local state
        setDesignGroups((prev) => prev.filter((g) => g.design !== deleteConfirm.design));
        setDeleteConfirm(null);
      } else {
        setError(result.message || "Failed to delete barcodes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete barcodes");
    } finally {
      setDeleting(false);
    }
  };

  // Toggle design selection
  const toggleDesignSelection = (designIndex: number) => {
    setDesignGroups((prev) =>
      prev.map((group, idx) =>
        idx === designIndex ? { ...group, selected: !group.selected } : group
      )
    );
  };

  // Toggle design expansion
  const toggleDesignExpansion = (designIndex: number) => {
    setDesignGroups((prev) =>
      prev.map((group, idx) =>
        idx === designIndex ? { ...group, expanded: !group.expanded } : group
      )
    );
  };

  // Select all designs
  const selectAll = () => {
    setDesignGroups((prev) => prev.map((group) => ({ ...group, selected: true })));
  };

  // Deselect all
  const deselectAll = () => {
    setDesignGroups((prev) => prev.map((group) => ({ ...group, selected: false })));
  };

  // Get all selected barcodes (raw, no QR)
  const getSelectedBarcodes = (): BarcodeFromDB[] => {
    return designGroups
      .filter((group) => group.selected)
      .flatMap((group) => group.barcodes);
  };

  // Print selected barcodes
  const [preparingPrint, setPreparingPrint] = useState(false);
  const printSelected = async () => {
    const selectedBarcodes = getSelectedBarcodes();
    if (selectedBarcodes.length === 0) {
      alert("Please select at least one design to print");
      return;
    }

    setPreparingPrint(true);
    try {
      // Store selected barcodes in localStorage without QR codes to avoid QuotaExceededError
      localStorage.setItem("printBarcodes", JSON.stringify(selectedBarcodes));

      // Open print preview in new window
      window.open("/print-barcodes/preview", "_blank");
    } catch (err: any) {
      console.error(err);
      alert("Failed to prepare barcodes for printing: " + (err.message || err));
    } finally {
      setPreparingPrint(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">Only admins can print barcodes.</p>
        </div>
      </div>
    );
  }

  const selectedCount = designGroups.filter((g) => g.selected).length;
  const totalSelectedBarcodes = getSelectedBarcodes().length;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar active="print-barcodes" setActive={() => {}} />

      <div className="w-full lg:ml-64">
        {/* Header */}
        <header className="bg-white border-b px-4 sm:px-8 py-6 pt-16 lg:pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Print Barcodes</h1>
              <p className="text-gray-600 text-sm sm:text-base">
                View and print all generated barcodes
              </p>
            </div>
            <button
              onClick={fetchBarcodes}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-800 rounded-lg">
              ❌ {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading barcodes...</p>
              </div>
            </div>
          ) : preparingPrint ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Preparing barcodes for print...</p>
              </div>
            </div>
          ) : designGroups.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-xl font-semibold text-gray-700 mb-2">No Barcodes to Print</h2>
              <p className="text-gray-500">
                Generate barcodes from the "Generate Barcodes" page first.
              </p>
            </div>
          ) : (
            <>
              {/* Action Bar */}
              <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={selectAll}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      Select All
                    </button>
                    <button
                      onClick={deselectAll}
                      className="text-sm text-gray-600 hover:text-gray-700"
                    >
                      Deselect All
                    </button>
                    <span className="text-sm text-gray-500">
                      {selectedCount} design(s) selected ({totalSelectedBarcodes} barcodes)
                    </span>
                  </div>
                  <button
                    onClick={printSelected}
                    disabled={selectedCount === 0 || preparingPrint}
                    className={`flex items-center gap-2 px-6 py-2 rounded-lg font-semibold transition ${
                      selectedCount === 0 || preparingPrint
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    }`}
                  >
                    {preparingPrint ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-500"></div>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Printer size={18} />
                        Print Selected ({totalSelectedBarcodes})
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Design Groups */}
              <div className="space-y-4">
                {designGroups.map((group, idx) => (
                  <div
                    key={group.design}
                    className={`bg-white rounded-xl shadow-sm overflow-hidden border-2 transition ${
                      group.selected ? "border-blue-500" : "border-transparent"
                    }`}
                  >
                    {/* Design Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleDesignSelection(idx)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-blue-600">
                          {group.selected ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{group.design}</h3>
                          <p className="text-sm text-gray-500">
                            {group.barcodes.length} barcodes • Created{" "}
                            {new Date(group.barcodes[0]?.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDesign(group.design, group.barcodes.map((b) => b._id));
                          }}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="Delete design"
                        >
                          <Trash2 size={20} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleDesignExpansion(idx);
                          }}
                          className="p-2 hover:bg-gray-200 rounded-lg"
                        >
                          {group.expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded View - Show barcodes preview */}
                    {group.expanded && (
                      <div className="border-t p-4 bg-gray-50">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                          {group.barcodes.slice(0, 12).map((barcode) => (
                            <BarcodePreviewItem key={barcode._id} barcode={barcode} />
                          ))}
                          {group.barcodes.length > 12 && (
                            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center border">
                              <p className="text-sm text-gray-500 text-center">
                                +{group.barcodes.length - 12} more
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="text-red-600" size={24} />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Design?</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete <span className="font-semibold">"{deleteConfirm.design}"</span>?
                This will remove all {deleteConfirm.barcodeIds.length} barcodes for this design.
              </p>
              <p className="text-sm text-red-600 mb-6">This action cannot be undone.</p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
