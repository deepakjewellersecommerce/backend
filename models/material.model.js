const mongoose = require("mongoose");

/**
 * Material Model (Level 1 of Category Hierarchy)
 * Represents specific purity variants of base metals (Gold 24K, Gold 22K, Silver 999, etc.)
 * Links to MetalGroup for MCX pricing and applies purity formula for final price
 *
 * Pricing Flow:
 * 1. MetalGroup has: mcxPrice + premium = basePrice
 * 2. Material applies purity: basePrice × (purityNumerator / purityDenominator) = pricePerGram
 * 3. Override can replace calculated price with manual price
 */
const materialSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Material name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
      // E.g., "Gold 22K", "Silver 925", "Platinum"
    },

    displayName: {
      type: String,
      trim: true,
      maxlength: [100, "Display name cannot exceed 100 characters"]
      // E.g., "Gold (22K)", "Silver (92.5%)"
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
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [10, "ID attribute cannot exceed 10 characters"],
      validate: {
        validator: function (v) {
          return !/[-]/.test(v);
        },
        message: "ID attribute cannot contain hyphens"
      }
      // E.g., "G24", "G22", "S999", "S925", "PT"
    },

    // METAL GROUP REFERENCE
    metalGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MetalGroup",
      required: [true, "Metal group is required"],
      // Links to Gold, Silver, or Platinum group
    },

    // PURITY DEFINITION
    purityType: {
      type: String,
      enum: ["BASE", "DERIVED"],
      required: [true, "Purity type is required"],
      default: "DERIVED",
      // BASE: 100% purity (uses metalGroup.basePrice directly)
      // DERIVED: Custom purity (applies formula to metalGroup.basePrice)
    },

    purityNumerator: {
      type: Number,
      required: [true, "Purity numerator is required"],
      min: [0, "Purity numerator cannot be negative"],
      default: 99.995,
      // For 22K gold: 91.6667
      // For 925 silver: 92.5
    },

    purityDenominator: {
      type: Number,
      required: [true, "Purity denominator is required"],
      min: [0.001, "Purity denominator must be greater than 0"],
      default: 99.995,
      // Standard: 99.995 for gold, 99.9 for silver
    },

    purityFormula: {
      type: String,
      trim: true,
      // Human-readable formula: "91.6667 / 99.995"
      // Auto-generated from numerator/denominator
    },

    purityPercentage: {
      type: Number,
      min: [0, "Purity percentage cannot be negative"],
      max: [100, "Purity percentage cannot exceed 100"],
      // Display value: 91.67%, 92.5%, etc.
      // Auto-calculated from numerator/denominator
    },

    // CALCULATED PRICE
    pricePerGram: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
      // Auto-calculated: metalGroup.basePrice × purity multiplier
      // Updated when metalGroup price changes or purity changes
    },

    lastCalculated: {
      type: Date,
      default: null,
      // When was pricePerGram last calculated
    },

    // PRICE OVERRIDE (Manual pricing)
    priceOverride: {
      isActive: {
        type: Boolean,
        default: false,
        // Is manual override active?
      },
      overridePrice: {
        type: Number,
        default: null,
        min: [0, "Override price cannot be negative"],
        // Static price set by admin (bypasses calculation)
      },
      reason: {
        type: String,
        trim: true,
        maxlength: [200, "Reason cannot exceed 200 characters"],
        // Why was price overridden? E.g., "Promotional pricing", "Special customer rate"
      },
      setBy: {
        type: String,
        trim: true,
        // Admin user who set the override
      },
      setAt: {
        type: Date,
        default: null,
        // When was override set
      }
    },

    // METADATA
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
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },

    // LEGACY FIELD (for backward compatibility during migration)
    metalType: {
      type: String,
      // Will be deprecated after migration
      // E.g., "GOLD_24K", "GOLD_22K", "SILVER_999"
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// INDEXES
materialSchema.index({ slug: 1 }, { unique: true });
materialSchema.index({ idAttribute: 1 }, { unique: true });
materialSchema.index({ metalGroup: 1, isActive: 1 });
materialSchema.index({ isActive: 1, sortOrder: 1 });
materialSchema.index({ metalType: 1 }); // Legacy index for migration

// PRE-SAVE HOOKS

/**
 * Auto-generate slug, displayName, formula, and percentage before save
 */
materialSchema.pre("save", function (next) {
  // Auto-generate slug from name if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Auto-generate displayName if not provided
  if (!this.displayName && this.name) {
    this.displayName = this.name;
  }

  // Auto-generate purity formula
  if (this.isModified("purityNumerator") || this.isModified("purityDenominator")) {
    this.purityFormula = `${this.purityNumerator} / ${this.purityDenominator}`;
    this.purityPercentage = parseFloat(
      ((this.purityNumerator / this.purityDenominator) * 100).toFixed(2)
    );
  }

  // Uppercase ID attribute
  if (this.isModified("idAttribute")) {
    this.idAttribute = this.idAttribute.toUpperCase();
  }

  next();
});

// VIRTUAL FIELDS

/**
 * Virtual: Level indicator (always 1 for Material)
 */
materialSchema.virtual("level").get(function () {
  return 1;
});

/**
 * Virtual: Get effective price (considers override)
 * Returns override price if active, otherwise calculated price
 */
materialSchema.virtual("effectivePrice").get(function () {
  if (this.priceOverride?.isActive && this.priceOverride?.overridePrice) {
    return this.priceOverride.overridePrice;
  }
  return this.pricePerGram;
});

// INSTANCE METHODS

/**
 * Calculate purity multiplier from numerator/denominator
 * BASE type returns 1 (100%), DERIVED returns calculated ratio
 */
materialSchema.methods.getPurityMultiplier = function () {
  if (this.purityType === "BASE") {
    return 1;
  }
  return this.purityNumerator / this.purityDenominator;
};

/**
 * Calculate price per gram based on metal group base price and purity
 * @param {Object} metalGroup - MetalGroup document
 * @returns {Number} Calculated price per gram
 */
materialSchema.methods.calculatePrice = function (metalGroup) {
  if (!metalGroup || !metalGroup.basePrice) {
    return 0;
  }

  const purityMultiplier = this.getPurityMultiplier();
  return parseFloat((metalGroup.basePrice * purityMultiplier).toFixed(2));
};

/**
 * Update price per gram from metal group
 * @param {Object} metalGroup - MetalGroup document
 * @returns {Promise} Updated material
 */
materialSchema.methods.updatePriceFromMetalGroup = async function (metalGroup) {
  // Skip if price is overridden
  if (this.priceOverride?.isActive) {
    return this;
  }

  this.pricePerGram = this.calculatePrice(metalGroup);
  this.lastCalculated = new Date();
  return this.save();
};

/**
 * Set price override (manual pricing)
 * @param {Number} price - Override price
 * @param {String} reason - Reason for override
 * @param {String} setBy - Admin user who set it
 */
materialSchema.methods.setOverridePrice = function (price, reason, setBy) {
  this.priceOverride = {
    isActive: true,
    overridePrice: price,
    reason: reason || "Manual override",
    setBy: setBy || "Admin",
    setAt: new Date()
  };
  return this;
};

/**
 * Remove price override (return to calculated pricing)
 */
materialSchema.methods.removeOverridePrice = async function () {
  this.priceOverride = {
    isActive: false,
    overridePrice: null,
    reason: null,
    setBy: null,
    setAt: null
  };

  // Recalculate price from metal group
  const MetalGroup = mongoose.model("MetalGroup");
  const metalGroup = await MetalGroup.findById(this.metalGroup);
  if (metalGroup) {
    this.pricePerGram = this.calculatePrice(metalGroup);
    this.lastCalculated = new Date();
  }

  return this.save();
};

// STATIC METHODS

/**
 * Get all active materials
 */
materialSchema.statics.getActiveMaterials = function () {
  return this.find({ isActive: true })
    .populate("metalGroup", "name symbol basePrice")
    .sort({ sortOrder: 1, name: 1 });
};

/**
 * Get all materials for a specific metal group
 */
materialSchema.statics.getByMetalGroup = function (metalGroupId) {
  return this.find({ metalGroup: metalGroupId, isActive: true }).sort({
    sortOrder: 1,
    name: 1
  });
};

/**
 * Get material with full metal group details
 */
materialSchema.statics.getWithMetalGroup = function (materialId) {
  return this.findById(materialId).populate("metalGroup");
};

/**
 * Legacy: Get material by metal type (for backward compatibility)
 */
materialSchema.statics.getByMetalType = function (metalType) {
  return this.findOne({ metalType, isActive: true });
};

/**
 * Recalculate prices for all materials in a metal group
 * Called when metal group's base price changes
 */
materialSchema.statics.recalculatePricesForMetalGroup = async function (
  metalGroupId
) {
  const MetalGroup = mongoose.model("MetalGroup");
  const metalGroup = await MetalGroup.findById(metalGroupId);

  if (!metalGroup) {
    throw new Error("Metal group not found");
  }

  const materials = await this.find({ metalGroup: metalGroupId });

  for (const material of materials) {
    // Skip if price is overridden
    if (material.priceOverride?.isActive) {
      continue;
    }

    material.pricePerGram = material.calculatePrice(metalGroup);
    material.lastCalculated = new Date();
    await material.save();
  }

  return materials;
};

const Material = mongoose.model("Material", materialSchema);
module.exports = Material;
