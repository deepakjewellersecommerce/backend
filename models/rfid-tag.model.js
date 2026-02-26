const mongoose = require("mongoose");

const RFID_STATUS = {
  ACTIVE: "ACTIVE",
  SOLD: "SOLD",
  RETURNED: "RETURNED",
  DEACTIVATED: "DEACTIVATED",
};

const rfidTagSchema = new mongoose.Schema(
  {
    rfidCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVarient",
      default: null,
    },
    skuNo: {
      type: String,
      required: true,
    },
    serialNumber: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(RFID_STATUS),
      default: RFID_STATUS.ACTIVE,
    },
    // Denormalized product fields for CSV/label printing
    productTitle: { type: String },
    metalType: { type: String },
    grossWeight: { type: Number },
    netWeight: { type: Number },
    calculatedPrice: { type: Number },
    variantSize: { type: String },
    // Tracking
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deactivatedAt: { type: Date },
    deactivatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    soldAt: { type: Date },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User_Order",
    },
  },
  { timestamps: true }
);

rfidTagSchema.index({ product: 1, serialNumber: 1 });
rfidTagSchema.index({ product: 1, variant: 1 });
rfidTagSchema.index({ status: 1 });
rfidTagSchema.index({ skuNo: 1 });
// Compound indexes for common query patterns
rfidTagSchema.index({ product: 1, status: 1 });
rfidTagSchema.index({ status: 1, createdAt: 1 });

const RfidTag = mongoose.model("RfidTag", rfidTagSchema);

module.exports = { RfidTag, RFID_STATUS };
