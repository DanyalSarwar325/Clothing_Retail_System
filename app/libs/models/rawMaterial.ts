import mongoose, { Schema, Document } from "mongoose";

export interface IRawMaterialItem {
  item: string;
  price: number;
}

export interface IRawMaterial extends Document {
  design: string;
  items: IRawMaterialItem[];
  totalCost: number;
  createdAt: Date;
  updatedAt: Date;
}

const RawMaterialItemSchema = new Schema<IRawMaterialItem>({
  item: { type: String, required: true },
  price: { type: Number, required: true, min: 0 },
});

const RawMaterialSchema = new Schema<IRawMaterial>(
  {
    design: { type: String, required: true, unique: true },
    items: [RawMaterialItemSchema],
    totalCost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Pre-save hook to calculate total cost
RawMaterialSchema.pre("save", function () {
  this.totalCost = this.items.reduce((sum, item) => sum + item.price, 0);
});

// Delete model if it exists to force fresh schema loading
if (mongoose.models.RawMaterial) {
  delete mongoose.models.RawMaterial;
}

const RawMaterial = mongoose.model<IRawMaterial>("RawMaterial", RawMaterialSchema);

export default RawMaterial;
