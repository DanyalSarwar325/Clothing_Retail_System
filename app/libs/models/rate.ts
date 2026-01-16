import mongoose, { Schema, Document } from "mongoose";

export interface IRate extends Document {
  department: string;
  ratePerUnit: number;
  createdAt: Date;
  updatedAt: Date;
}

const RateSchema = new Schema<IRate>(
  {
    department: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "Cutting",
        "Sewing",
        "Quality",
        "Handmade",
        "Adda Work",
        "Patching",
        "Press",
        "Packing",
        "Store",
      ],
    },
    ratePerUnit: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Rate = mongoose.models.Rate || mongoose.model<IRate>("Rate", RateSchema);

export default Rate;
