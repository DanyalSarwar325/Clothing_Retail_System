import mongoose, { Schema } from "mongoose";

const FulfillmentOrderSchema = new Schema(
  {
    orderId: { type: String, required: true, unique: true, sparse: true },
    orderNumber: { type: String, sparse: true },
    customer: {
      name: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    shippingAddress: {
      city: { type: String },
      address: { type: String },
      province: { type: String },
      postalCode: { type: String },
      country: { type: String },
    },
    product: {
      name: { type: String },
      variant: { type: String },
      sku: { type: String },
      quantity: { type: Number },
      price: { type: Number },
    },
    payment: {
      method: { type: String },
      status: { type: String },
    },
    fulfillment: {
      status: { type: String },
      trackingCompany: { type: String },
      trackingNumber: { type: String },
      trackingUrl: { type: String },
    },
    pricing: {
      subtotal: { type: Number },
      tax: { type: Number },
      shipping: { type: Number },
      total: { type: Number },
      currency: { type: String, default: "PKR" },
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    shopifyOrderId: { type: String, sparse: true },
    rawPayload: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

const FulfillmentOrder =
  mongoose.models.FulfillmentOrder ||
  mongoose.model("FulfillmentOrder", FulfillmentOrderSchema);

export default FulfillmentOrder;
