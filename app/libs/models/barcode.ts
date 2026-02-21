import mongoose, { Schema, Document } from "mongoose";

// Department enum values
export const DEPARTMENTS = [
  "Admin",
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
  "Outpass",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// Suit type enum
export const SUIT_TYPES = ["1pc", "2pc", "3pc"] as const;
export type SuitType = (typeof SUIT_TYPES)[number];

// Items based on suit type
export const SUIT_ITEMS: Record<SuitType, string[]> = {
  "1pc": ["Qameez"],
  "2pc": ["Qameez", "Shalwar"],
  "3pc": ["Qameez", "Shalwar", "Dupatta"],
};

// Department rates for a specific design
// All departments (except Packing & Store) have item-based rates (Qameez, Shalwar, Dupatta)
// Packing & Store rates are set when generating final stickers
export interface IDesignDepartmentRate {
  department: Department;
  ratePerPiece: number;
  item?: "Qameez" | "Shalwar" | "Dupatta"; // Optional: for item-based rates
}

// Department scan history entry
export interface IDepartmentScan {
  department: Department;
  scannedAt: Date;
  scannedBy?: string; // Optional: user who scanned
}

// Defective/Waste tracking
export const DEFECT_REASONS = [
  "Wrong cutting",
  "Fabric damaged",
  "Stitching error",
  "Machine damage",
  "Color defect",
  "Size error",
  "Quality issue",
  "Other"
] as const;

export type DefectReason = (typeof DEFECT_REASONS)[number];

export interface IDefectiveInfo {
  markedAt: Date;
  markedBy: string;
  department: Department;
  reason: DefectReason;
  notes?: string; // Additional notes for "Other" reason
}

// Payment tracking per department
export interface IDepartmentPayment {
  department: Department;
  paidAt: Date;
  paidBy?: string;
  amount: number;
}

// Quality check info
export interface IQualityCheckInfo {
  checkedAt: Date;
  checkedBy: string;
  status: "quality_ok" | "damaged";
  department?: string; // Department responsible for damage
  responsiblePerson?: string; // Person who last scanned before damage was found
  notes?: string;
}

export interface IBarcode extends Document {
  design: string;
  size: "S" | "M" | "L";
  suitType: SuitType; // 1pc, 2pc, or 3pc suit
  item: "Shalwar" | "Qameez" | "Dupatta";
  unitNumber: number;
  sequenceNumber: number; // Global sequential number for X/Y display (1/10, 2/10...)
  totalUnitsInBatch: number; // Total pieces in the batch for X/Y display
  barcodeData: string; // JSON string of barcode payload
  status: "generated" | "scanned" | "available" | "sold" | "returned" | "packed" | "defective" | "quality_ok" | "damaged";
  currentDepartment: Department; // Current department where item is
  departmentHistory: IDepartmentScan[]; // History of department scans
  departmentRates: IDesignDepartmentRate[]; // Rates per department for this design
  defectiveInfo?: IDefectiveInfo; // Info when marked as defective/damaged
  qualityCheckInfo?: IQualityCheckInfo; // Info when quality checked
  paidDepartments?: IDepartmentPayment[]; // Tracks which departments have paid for this piece
  productId?: mongoose.Types.ObjectId; // Optional link to product
  createdAt: Date;
  scannedAt?: Date;
  soldAt?: Date;
}

const DesignDepartmentRateSchema = new Schema<IDesignDepartmentRate>({
  department: { 
    type: String, 
    enum: DEPARTMENTS, 
    required: true 
  },
  ratePerPiece: { type: Number, required: true, min: 0 },
  item: { 
    type: String, 
    enum: ["Qameez", "Shalwar", "Dupatta"],
    required: false // Optional: for item-based rates (all depts except Packing, Store)
  },
});

const DepartmentScanSchema = new Schema<IDepartmentScan>({
  department: { 
    type: String, 
    enum: DEPARTMENTS, 
    required: true 
  },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: { type: String },
});

const DefectiveInfoSchema = new Schema<IDefectiveInfo>({
  markedAt: { type: Date, default: Date.now },
  markedBy: { type: String, required: true },
  department: { 
    type: String, 
    enum: DEPARTMENTS, 
    required: true 
  },
  reason: { 
    type: String, 
    enum: DEFECT_REASONS, 
    required: true 
  },
  notes: { type: String },
});

const QualityCheckInfoSchema = new Schema<IQualityCheckInfo>({
  checkedAt: { type: Date, default: Date.now },
  checkedBy: { type: String, required: true },
  status: { 
    type: String, 
    enum: ["quality_ok", "damaged"], 
    required: true 
  },
  department: { 
    type: String, 
    enum: DEPARTMENTS, 
    required: false // Only required for damaged status
  },
  responsiblePerson: { 
    type: String, 
    required: false // Person who last scanned before damage was found
  },
  notes: { type: String },
});

const DepartmentPaymentSchema = new Schema<IDepartmentPayment>({
  department: { 
    type: String, 
    enum: DEPARTMENTS, 
    required: true 
  },
  paidAt: { type: Date, default: Date.now },
  paidBy: { type: String },
  amount: { type: Number, required: true },
});

const BarcodeSchema = new Schema<IBarcode>({
  design: { type: String, required: true },
  size: { type: String, enum: ["S", "M", "L"], required: true },
  suitType: { type: String, enum: ["1pc", "2pc", "3pc"], required: true, default: "3pc" },
  item: { type: String, enum: ["Shalwar", "Qameez", "Dupatta"], required: true },
  unitNumber: { type: Number, required: true },
  sequenceNumber: { type: Number, required: false }, // Global sequential number for X/Y display
  totalUnitsInBatch: { type: Number, required: false }, // Total pieces in the batch for X/Y display
  barcodeData: { type: String, required: true },
  status: { type: String, enum: ["generated", "scanned", "available", "sold", "returned", "packed", "defective", "quality_ok", "damaged"], default: "generated" },
  currentDepartment: { 
    type: String, 
    enum: DEPARTMENTS, 
    default: "Cutting" 
  },
  departmentHistory: [DepartmentScanSchema],
  departmentRates: [DesignDepartmentRateSchema],
  defectiveInfo: DefectiveInfoSchema,
  qualityCheckInfo: QualityCheckInfoSchema,
  paidDepartments: [DepartmentPaymentSchema],
  productId: { type: Schema.Types.ObjectId, ref: "Product" },
  createdAt: { type: Date, default: Date.now },
  scannedAt: { type: Date },
  soldAt: { type: Date },
});

// Create compound index for quick lookups
BarcodeSchema.index({ design: 1, size: 1, suitType: 1, item: 1, unitNumber: 1 });
BarcodeSchema.index({ barcodeData: 1 });
BarcodeSchema.index({ status: 1 }); // For filtering by status (generated, scanned, etc.)
BarcodeSchema.index({ currentDepartment: 1 });
BarcodeSchema.index({ design: 1 }); // For fetching rates by design

// const Barcode = mongoose.models.Barcode || mongoose.model<IBarcode>("Barcode", BarcodeSchema);
// Delete model if it exists to force fresh schema loading
if (mongoose.models.Barcode) {
  delete mongoose.models.Barcode;
}

const Barcode = mongoose.model<IBarcode>("Barcode", BarcodeSchema);

export default Barcode;
