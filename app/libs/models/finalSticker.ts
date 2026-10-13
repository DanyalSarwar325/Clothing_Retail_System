import mongoose, { Schema, Document } from "mongoose";

export const DEPARTMENTS = [
  "Cutting",
  "Sewing",
  "Handmade",
  "Patching",
  "Press",
  "Overlock",
  "Clipping",
  "Adda Work",
  "Quality",
  "Packing",
  "Store",
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export type SuitType = "1pc" | "2pc" | "3pc";

export interface IDepartmentScan {
  department: Department;
  scannedAt: Date;
  scannedBy?: string;
}

// Department rates for Packing and Store
export interface IDepartmentRate {
  department: "Packing" | "Store";
  ratePerPiece: number;
}

// Payment tracking per department
export interface IDepartmentPayment {
  department: "Packing" | "Store";
  paidAt: Date;
  paidBy?: string;
  amount: number;
}

export interface IFinalSticker extends Document {
  design: string;
  size: "S" | "M" | "L";
  suitType: SuitType;
  unitNumber: number;
  barcodeData: string; // JSON string of barcode payload
  sellingPrice: number; // Selling price for this suit type
  departmentRates: IDepartmentRate[]; // Rates for Packing and Store
  paidDepartments?: IDepartmentPayment[]; // Track which departments have been paid
  status: "generated" | "scanned" | "packed" | "in_store" | "dispatched" | "delivered" | "returned";
  currentDepartment: Department;
  departmentHistory: IDepartmentScan[];
  // Delivery tracking
  dispatchInfo?: {
    dispatchedAt: Date;
    dispatchedBy: string;
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
  };
  // Payment tracking
  paymentInfo?: {
    isPaid: boolean;
    amountReceived: number;
    paidAt?: Date;
    receivedBy?: string;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DepartmentScanSchema = new Schema<IDepartmentScan>({
  department: {
    type: String,
    enum: DEPARTMENTS,
    required: true,
  },
  scannedAt: { type: Date, default: Date.now },
  scannedBy: { type: String },
});

const DepartmentRateSchema = new Schema({
  department: {
    type: String,
    enum: ["Packing", "Store"],
    required: true,
  },
  ratePerPiece: { type: Number, required: true, default: 0 },
});

const FinalStickerSchema = new Schema<IFinalSticker>(
  {
    design: { type: String, required: true },
    size: { type: String, enum: ["S", "M", "L"], required: true },
    suitType: { type: String, enum: ["1pc", "2pc", "3pc"], required: true },
    unitNumber: { type: Number, required: true },
    barcodeData: { type: String, required: true, unique: true },
    sellingPrice: { type: Number, required: true, default: 0 },
    departmentRates: [DepartmentRateSchema], // Rates for Packing and Store
    paidDepartments: [
      {
        department: { type: String, enum: ["Packing", "Store"], required: true },
        paidAt: { type: Date, default: Date.now },
        paidBy: { type: String },
        amount: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ["generated", "scanned", "packed", "in_store", "dispatched", "delivered", "returned"],
      default: "generated",
    },
    currentDepartment: {
      type: String,
      enum: DEPARTMENTS,
      default: "Press",
    },
    departmentHistory: [DepartmentScanSchema],
    dispatchInfo: {
      dispatchedAt: { type: Date },
      dispatchedBy: { type: String },
      customerName: { type: String },
      customerPhone: { type: String },
      customerAddress: { type: String },
    },
    paymentInfo: {
      isPaid: { type: Boolean, default: false },
      amountReceived: { type: Number, default: 0 },
      paidAt: { type: Date },
      receivedBy: { type: String },
      notes: { type: String },
    },
  },
  { timestamps: true }
);

// Compound index for efficient queries
FinalStickerSchema.index({ design: 1, size: 1, unitNumber: 1 });
FinalStickerSchema.index({ status: 1 });

// Prevent model overwrite error in development with hot reload
const FinalSticker =
  mongoose.models.FinalSticker ||
  mongoose.model<IFinalSticker>("FinalSticker", FinalStickerSchema);

export default FinalSticker;
