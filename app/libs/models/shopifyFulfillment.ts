import mongoose, { Schema } from "mongoose";

const ShopifyFulfillmentSchema = new Schema(
  {
    shopifyOrderId: { type: Number, required: true, unique: true },
    receivedAt: { type: String, required: true },
    orderData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const ShopifyFulfillment =
  mongoose.models.ShopifyFulfillment ||
  mongoose.model("ShopifyFulfillment", ShopifyFulfillmentSchema);

export default ShopifyFulfillment;
