const mongoose = require("mongoose");

const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  PRICE_CHANGE: "PRICE_CHANGE",
  BULK_RECALCULATE: "BULK_RECALCULATE",
  STATUS_CHANGE: "STATUS_CHANGE",
  RFID_GENERATE: "RFID_GENERATE",
  RFID_DEACTIVATE: "RFID_DEACTIVATE",
  FREEZE: "FREEZE",
  UNFREEZE: "UNFREEZE"
};

const AUDIT_ENTITIES = {
  PRODUCT: "Product",
  PRODUCT_VARIANT: "ProductVariant",
  CATEGORY: "Category",
  SUBCATEGORY: "Subcategory",
  MATERIAL: "Material",
  GENDER: "Gender",
  ITEM: "Item",
  METAL_PRICE: "MetalPrice",
  PRICING_CONFIG: "PricingConfig",
  RFID_TAG: "RfidTag",
  BATCH_JOB: "BatchJob"
};

const auditLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      required: true,
      enum: Object.values(AUDIT_ENTITIES),
      index: true
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: Object.values(AUDIT_ACTIONS),
      index: true
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    actorName: {
      type: String,
      default: "System"
    },
    summary: {
      type: String,
      required: true
    },
    changes: {
      before: { type: mongoose.Schema.Types.Mixed, default: null },
      after: { type: mongoose.Schema.Types.Mixed, default: null }
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  { timestamps: true }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

/**
 * Log an audit event (fire-and-forget, never blocks caller)
 */
async function logAudit({
  entityType,
  entityId,
  action,
  actorId = null,
  actorName = "System",
  summary,
  changes = {},
  metadata = {}
}) {
  try {
    await AuditLog.create({
      entityType,
      entityId,
      action,
      actorId,
      actorName,
      summary,
      changes,
      metadata
    });
  } catch (err) {
    console.error("Audit log write failed (non-blocking):", err.message);
  }
}

module.exports = { AuditLog, logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES };
