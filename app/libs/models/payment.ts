import mongoose, { Schema, Document } from "mongoose";

export interface IPayment extends Document {
  department: string;
  amount: number;
  note?: string;
  createdAt: Date;
  createdBy?: string;
}

const PaymentSchema = new Schema<IPayment>(
  {
    department: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String },
    createdBy: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const Payment = mongoose.models.Payment || mongoose.model<IPayment>("Payment", PaymentSchema);

export default Payment;