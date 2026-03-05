import mongoose, { Schema } from "mongoose";

const ShopifyOrderSchema = new Schema(
  {
    shopifyOrderId: { type: Number, required: true, unique: true },
    receivedAt: { type: String, required: true },
    orderData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

ShopifyOrderSchema.index({ shopifyOrderId: 1 }, { unique: true });

const ShopifyOrder =
  mongoose.models.ShopifyOrder ||
  mongoose.model("ShopifyOrder", ShopifyOrderSchema);

export default ShopifyOrder;
