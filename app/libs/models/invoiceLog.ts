import mongoose from 'mongoose';

const InvoiceLogSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    uploadedBy: {
      type: String,
      default: 'admin',
    },
    extractedText: {
      type: String,
      maxlength: 50000,
    },
    trackingIdsFound: {
      type: Number,
      default: 0,
    },
    trackingIds: [String],
    processedResults: [
      {
        trackingId: String,
        status: String, // 'MARKED PAID', 'SKIPPED', 'NOT FOUND', 'ERROR'
        orderStatus: String, // 'delivered', 'pending', etc.
        _id: false,
      },
    ],
    processingSummary: {
      totalTracking: {
        type: Number,
        default: 0,
      },
      markedPaid: {
        type: Number,
        default: 0,
      },
      skipped: {
        type: Number,
        default: 0,
      },
      notFound: {
        type: Number,
        default: 0,
      },
      errors: {
        type: Number,
        default: 0,
      },
    },
    parsingStatus: {
      type: String,
      enum: ['success', 'partial', 'error'],
      default: 'success',
    },
    parsingMethod: String, // 'pdf-parse', 'pdfjs-dist', 'raw-extraction'
    errorMessage: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.models.InvoiceLog || mongoose.model('InvoiceLog', InvoiceLogSchema);
