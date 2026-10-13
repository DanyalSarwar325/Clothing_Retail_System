import mongoose, { Schema, Document } from "mongoose";

export interface IItemQuantity {
  Qameez: number;
  Shalwar: number;
  Dupatta: number;
}

export interface ISizeQuantities {
  S: IItemQuantity;
  M: IItemQuantity;
  L: IItemQuantity;
}

export interface IPODepartmentRate {
  department: string;
  ratePerPiece: number;
  item?: "Qameez" | "Shalwar" | "Dupatta";
}

export interface IReceivingLogItem {
  size: "S" | "M" | "L";
  item: "Qameez" | "Shalwar" | "Dupatta";
  quantity: number;
}

export interface IReceivingLog {
  receivedAt: Date;
  receivedBy: string;
  cuttingPersonName?: string;
  notes?: string;
  items: IReceivingLogItem[];
}

export interface IPurchaseOrder extends Document {
  poNumber: string;
  design: string;
  status: "Open" | "In Progress" | "Completed" | "Cancelled";
  plannedQuantities: ISizeQuantities;
  receivedQuantities: ISizeQuantities;
  barcodedQuantities: ISizeQuantities;
  departmentRates: IPODepartmentRate[];
  receivingLogs: IReceivingLog[];
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ItemQuantitySchema = new Schema<IItemQuantity>(
  {
    Qameez: { type: Number, default: 0, min: 0 },
    Shalwar: { type: Number, default: 0, min: 0 },
    Dupatta: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const SizeQuantitiesSchema = new Schema<ISizeQuantities>(
  {
    S: { type: ItemQuantitySchema, default: () => ({ Qameez: 0, Shalwar: 0, Dupatta: 0 }) },
    M: { type: ItemQuantitySchema, default: () => ({ Qameez: 0, Shalwar: 0, Dupatta: 0 }) },
    L: { type: ItemQuantitySchema, default: () => ({ Qameez: 0, Shalwar: 0, Dupatta: 0 }) },
  },
  { _id: false }
);

const PODepartmentRateSchema = new Schema<IPODepartmentRate>(
  {
    department: { type: String, required: true },
    ratePerPiece: { type: Number, required: true, min: 0 },
    item: { type: String, enum: ["Qameez", "Shalwar", "Dupatta"] },
  },
  { _id: false }
);

const ReceivingLogItemSchema = new Schema<IReceivingLogItem>(
  {
    size: { type: String, enum: ["S", "M", "L"], required: true },
    item: { type: String, enum: ["Qameez", "Shalwar", "Dupatta"], required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ReceivingLogSchema = new Schema<IReceivingLog>(
  {
    receivedAt: { type: Date, default: Date.now },
    receivedBy: { type: String, default: "Admin" },
    cuttingPersonName: { type: String },
    notes: { type: String },
    items: [ReceivingLogItemSchema],
  },
  { _id: true }
);

const PurchaseOrderSchema = new Schema<IPurchaseOrder>(
  {
    poNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    design: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Completed", "Cancelled"],
      default: "Open",
    },
    plannedQuantities: {
      type: SizeQuantitiesSchema,
      required: true,
      default: () => ({
        S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      }),
    },
    receivedQuantities: {
      type: SizeQuantitiesSchema,
      default: () => ({
        S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      }),
    },
    barcodedQuantities: {
      type: SizeQuantitiesSchema,
      default: () => ({
        S: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        M: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
        L: { Qameez: 0, Shalwar: 0, Dupatta: 0 },
      }),
    },
    departmentRates: [PODepartmentRateSchema],
    receivingLogs: [ReceivingLogSchema],
    notes: { type: String },
  },
  { timestamps: true }
);

PurchaseOrderSchema.index({ poNumber: 1 });
PurchaseOrderSchema.index({ design: 1 });
PurchaseOrderSchema.index({ status: 1 });

if (mongoose.models.PurchaseOrder) {
  delete mongoose.models.PurchaseOrder;
}

const PurchaseOrder = mongoose.model<IPurchaseOrder>("PurchaseOrder", PurchaseOrderSchema);

export default PurchaseOrder;
