import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  department: string;
  workerName: string; // Worker who received the payment
  amount: number;
  note?: string;
  createdAt: Date;
  createdBy?: string; // Admin who made the payment
}

const PaymentSchema = new Schema<IPayment>(
  {
    department: { type: String, required: true },
    workerName: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Index for efficient queries
PaymentSchema.index({ department: 1, workerName: 1 });
PaymentSchema.index({ workerName: 1 });

const Payment = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;