import mongoose, { Schema, Document } from "mongoose";

export interface IPacket extends Document {
  packetId: string; // Unique packet identifier
  design: string;
  size: "S" | "M" | "L";
  unitNumber: number;
  barcodeIds: mongoose.Types.ObjectId[]; // References to 3 barcode documents
  items: {
    item: "Shalwar" | "Qameez" | "Dupatta";
    barcodeId: mongoose.Types.ObjectId;
    barcodeData: string;
  }[];
  packetBarcodeData: string; // QR code data for the packet
  status: "packed" | "sold" | "returned";
  packedBy: string;
  packedAt: Date;
  createdAt: Date;
}

const PacketSchema = new Schema<IPacket>({
  packetId: { type: String, required: true, unique: true },
  design: { type: String, required: true },
  size: { type: String, enum: ["S", "M", "L"], required: true },
  unitNumber: { type: Number, required: true },
  barcodeIds: [{ type: Schema.Types.ObjectId, ref: "Barcode" }],
  items: [{
    item: { type: String, enum: ["Shalwar", "Qameez", "Dupatta"], required: true },
    barcodeId: { type: Schema.Types.ObjectId, ref: "Barcode" },
    barcodeData: { type: String, required: true },
  }],
  packetBarcodeData: { type: String, required: true },
  status: { type: String, enum: ["packed", "sold", "returned"], default: "packed" },
  packedBy: { type: String, required: true },
  packedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
});

// Indexes (packetId already has unique:true which creates an index)
PacketSchema.index({ design: 1, size: 1, unitNumber: 1 });
PacketSchema.index({ packedBy: 1 });

// Delete model if it exists to force fresh schema loading
if (mongoose.models.Packet) {
  delete mongoose.models.Packet;
}

const Packet = mongoose.model<IPacket>("Packet", PacketSchema);

export default Packet;
