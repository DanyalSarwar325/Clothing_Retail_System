import mongoose, { Schema, Document } from "mongoose";

export interface IProduct extends Document {
  name: string;
  type: string;
  createdAt: Date;
  status: string;
}

const ProductSchema = new Schema<IProduct>({
  name: { type: String, required: true },
  type: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  status: { type: String, default: "checked-in" },
});

const Product = mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
