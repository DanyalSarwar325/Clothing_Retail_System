import mongoose from "mongoose";

const OrderWithTASchema = new mongoose.Schema(
  {
    shopifyWebhookId: String,
    rawPayload: mongoose.Schema.Types.Mixed,
    orderId: String,
    orderNumber: String,
    customerId: String,
    createdAt: { type: Date, default: Date.now },
    processedAt: Date,
    status: { type: String, default: "received" },
  },
  { timestamps: true }
);

export default mongoose.models.OrderWithTA ||
  mongoose.model("OrderWithTA", OrderWithTASchema);
