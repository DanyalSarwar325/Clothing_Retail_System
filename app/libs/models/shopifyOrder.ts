import mongoose, { Schema } from "mongoose";

const ShopifyOrderSchema = new Schema(
  {
    receivedAt: { type: String, required: true },
    orderData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const ShopifyOrder =
  mongoose.models.ShopifyOrder ||
  mongoose.model("ShopifyOrder", ShopifyOrderSchema);

export default ShopifyOrder;
