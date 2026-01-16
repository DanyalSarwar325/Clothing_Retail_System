import mongoose, { Schema, Document } from "mongoose";

// Department enum values
export const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Quality",
  "Handmade",
  "Adda Work",
  "Patching",
  "Press",
  "Packing",
  "Store",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

// Department scan history entry
export interface IDepartmentScan {
  department: Department;
  scannedAt: Date;
  scannedBy?: string; // Optional: user who scanned
}

export interface IBarcode extends Document {
  design: string;
  size: "S" | "M" | "L";
  item: "Shalwar" | "Qameez" | "Dupatta";
  unitNumber: number;
  barcodeData: string; // JSON string of barcode payload
  status: "available" | "sold" | "returned";
  currentDepartment: Department; // Current department where item is
  departmentHistory: IDepartmentScan[]; // History of department scans
  productId?: mongoose.Types.ObjectId; // Optional link to product
  createdAt: Date;
  scannedAt?: Date;
  soldAt?: Date;
}

const DepartmentScanSchema = new Schema<IDepartmentScan>({
  department: { 
    type: String, 
    enum: DEPARTMENTS, 
    required: true 
  },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: { type: String },
});

const BarcodeSchema = new Schema<IBarcode>({
  design: { type: String, required: true },
  size: { type: String, enum: ["S", "M", "L"], required: true },
  item: { type: String, enum: ["Shalwar", "Qameez", "Dupatta"], required: true },
  unitNumber: { type: Number, required: true },
  barcodeData: { type: String, required: true },
  status: { type: String, enum: ["available", "sold", "returned"], default: "available" },
  currentDepartment: { 
    type: String, 
    enum: DEPARTMENTS, 
    default: "Cutting" 
  },
  departmentHistory: [DepartmentScanSchema],
  productId: { type: Schema.Types.ObjectId, ref: "Product" },
  createdAt: { type: Date, default: Date.now },
  scannedAt: { type: Date },
  soldAt: { type: Date },
});

// Create compound index for quick lookups
BarcodeSchema.index({ design: 1, size: 1, item: 1, unitNumber: 1 });
BarcodeSchema.index({ barcodeData: 1 });
BarcodeSchema.index({ currentDepartment: 1 });

const Barcode = mongoose.models.Barcode || mongoose.model<IBarcode>("Barcode", BarcodeSchema);

export default Barcode;
