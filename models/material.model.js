const mongoose = require("mongoose");
const { METAL_TYPES } = require("./metal-price.model");

/**
 * Material Model (Level 1 of Category Hierarchy)
 * Represents the primary material/metal type (Gold 24k, Gold 22k, Silver, Platinum)
 * Maps directly to METAL_TYPES enum for pricing integration
 */
const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true
    },
    idAttribute: {
      type: String,
      required: [true, "ID attribute is required"],
      trim: true,
      maxlength: [10, "ID attribute cannot exceed 10 characters"],
      validate: {
        validator: function (v) {
          return !/[-]/.test(v);
        },
        message: "ID attribute cannot contain hyphens"
      }
    },
    metalType: {
      type: String,
      required: [true, "Metal type is required"],
      enum: {
        values: Object.values(METAL_TYPES),
        message: "{VALUE} is not a valid metal type"
      },
      unique: true
    },
    imageUrl: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
materialSchema.index({ slug: 1 }, { unique: true });
materialSchema.index({ idAttribute: 1 }, { unique: true });
materialSchema.index({ metalType: 1 }, { unique: true });
materialSchema.index({ isActive: 1 });
materialSchema.index({ sortOrder: 1 });

// Pre-save: Auto-generate slug from name if not provided
materialSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  next();
});

// Virtual: Level indicator (always 1 for Material)
materialSchema.virtual("level").get(function () {
  return 1;
});

// Virtual: Display name with metal type
materialSchema.virtual("displayName").get(function () {
  return this.name;
});

/**
 * Static: Get all active materials
 */
materialSchema.statics.getActiveMaterials = async function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

/**
 * Static: Get material by metal type
 */
materialSchema.statics.getByMetalType = async function (metalType) {
  return this.findOne({ metalType, isActive: true });
};

const Material = mongoose.model("Material", materialSchema);
module.exports = Material;
