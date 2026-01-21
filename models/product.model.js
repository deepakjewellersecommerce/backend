const mongoose = require("mongoose");
const { METAL_TYPES } = require("./metal-price.model");
const { CALCULATION_TYPES } = require("./price-component.model");

/**
 * Pricing Modes
 */
const PRICING_MODES = {
  SUBCATEGORY_DYNAMIC: "SUBCATEGORY_DYNAMIC", // Inherits from subcategory, updates with metal rates
  CUSTOM_DYNAMIC: "CUSTOM_DYNAMIC", // Product-specific config, still uses live metal rates
  STATIC_PRICE: "STATIC_PRICE" // Fixed price, no dynamic calculation
};

/**
 * Gemstone Schema (embedded in Product)
 */
const gemstoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: [
        "Diamond",
        "Ruby",
        "Emerald",
        "Sapphire",
        "Pearl",
        "Topaz",
        "Amethyst",
        "Garnet",
        "Opal",
        "Turquoise",
        "Aquamarine",
        "Peridot",
        "Citrine",
        "Tanzanite",
        "Custom"
      ]
    },
    customName: {
      type: String,
      maxlength: 50
    },
    weight: {
      type: Number,
      required: true,
      min: [0.001, "Gemstone weight must be positive"],
      validate: {
        validator: function (v) {
          return Number.isFinite(v) && v.toString().split(".")[1]?.length <= 3;
        },
        message: "Weight must have at most 3 decimal places"
      }
    },
    pricePerCarat: {
      type: Number,
      required: true,
      min: [0, "Price per carat cannot be negative"]
    },
    totalCost: {
      type: Number,
      default: 0
    }
  },
  { _id: true }
);

// Auto-calculate total cost
gemstoneSchema.pre("validate", function () {
  this.totalCost = Math.round(this.weight * this.pricePerCarat * 100) / 100;
});

/**
 * Product Pricing Config Schema (for CUSTOM_DYNAMIC mode)
 * Cloned from SubcategoryPricing when user clicks "Customize Pricing"
 */
const productPricingConfigSchema = new mongoose.Schema(
  {
    components: [
      {
        componentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PriceComponent"
        },
        componentKey: String,
        componentName: String,
        calculationType: {
          type: String,
          enum: Object.values(CALCULATION_TYPES)
        },
        value: Number,
        formula: String,
        formulaChips: [String],
        percentageOf: {
          type: String,
          enum: ["metalCost", "subtotal", "grossWeight", "netWeight"]
        },
        // Freeze state (reason optional for product-level)
        isFrozen: { type: Boolean, default: false },
        frozenValue: Number,
        originalCalculationType: String,
        originalValue: Number,
        originalFormula: String,
        frozenAt: Date,
        metalRateAtFreeze: Number,
        freezeReason: String,
        frozenBy: String,
        // Active/visibility
        isActive: { type: Boolean, default: true },
        isVisible: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 }
      }
    ],
    // Tracks where config was cloned from
    clonedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory"
    },
    clonedAt: Date
  },
  { _id: false }
);

/**
 * Price Breakdown Schema (calculated prices)
 */
const priceBreakdownSchema = new mongoose.Schema(
  {
    components: [
      {
        componentKey: String,
        componentName: String,
        value: Number,
        isFrozen: Boolean,
        isVisible: Boolean
      }
    ],
    metalType: {
      type: String,
      enum: Object.values(METAL_TYPES)
    },
    metalRate: Number,
    metalCost: Number,
    gemstoneCost: Number,
    subtotal: Number,
    totalPrice: Number,
    lastCalculated: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

/**
 * Product Schema
 */
const productSchema = new mongoose.Schema(
  {
    // Basic Info
    productTitle: {
      type: String,
      required: [true, "Product title is required"],
      minlength: [3, "Title must be at least 3 characters"],
      trim: true
    },
    productSlug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    skuNo: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true
    },
    productDescription: {
      type: String,
      default: ""
    },
    careHandling: {
      type: String,
      default: ""
    },

    // Category Hierarchy (References Level 5+ Subcategory)
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: [true, "Subcategory is required"]
    },
    // Denormalized for quick access/filtering
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material"
    },
    genderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gender"
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item"
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category"
    },
    // Full category path for display
    categoryHierarchyPath: {
      type: String // "G22-F-N-T-SI"
    },

    // Metal Type (auto-filled from Material)
    metalType: {
      type: String,
      enum: Object.values(METAL_TYPES),
      required: [true, "Metal type is required"]
    },

    // Weights
    grossWeight: {
      type: Number,
      required: [true, "Gross weight is required"],
      min: [0, "Gross weight cannot be negative"]
    },
    netWeight: {
      type: Number,
      required: [true, "Net weight is required"],
      min: [0, "Net weight cannot be negative"],
      validate: {
        validator: function (v) {
          return v <= this.grossWeight;
        },
        message: "Net weight cannot exceed gross weight"
      }
    },

    // Gemstones (max 50)
    gemstones: {
      type: [gemstoneSchema],
      validate: {
        validator: function (v) {
          return v.length <= 50;
        },
        message: "Maximum 50 gemstones allowed per product"
      }
    },

    // Pricing Mode
    pricingMode: {
      type: String,
      enum: Object.values(PRICING_MODES),
      default: PRICING_MODES.SUBCATEGORY_DYNAMIC
    },

    // For CUSTOM_DYNAMIC mode - product's own pricing config
    pricingConfig: productPricingConfigSchema,

    // For STATIC_PRICE mode - fixed price
    staticPrice: {
      type: Number,
      min: [0, "Static price cannot be negative"]
    },

    // Calculated price breakdown (updated on metal rate changes or config changes)
    priceBreakdown: priceBreakdownSchema,

    // Final calculated price (for quick access)
    calculatedPrice: {
      type: Number,
      default: 0
    },

    // Display prices (for legacy compatibility)
    regularPrice: {
      type: Number,
      default: 0
    },
    salePrice: {
      type: Number,
      default: 0
    },

    // Freeze tracking
    allComponentsFrozen: {
      type: Boolean,
      default: false
    },

    // Images
    productImageUrl: [
      {
        type: String
      }
    ],
    sizeChartUrl: String,

    // Status
    isActive: {
      type: Boolean,
      default: false
    },
    isFeatured: {
      type: Boolean,
      default: false
    },

    // Associations
    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand"
    },
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product_Color"
    },

    // SEO
    seoTitle: {
      type: String,
      maxlength: 60
    },
    seoDescription: {
      type: String,
      maxlength: 160
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
productSchema.index({ productSlug: 1 }, { unique: true });
productSchema.index({ skuNo: 1 }, { unique: true });
productSchema.index({ subcategoryId: 1 });
productSchema.index({ materialId: 1 });
productSchema.index({ genderId: 1 });
productSchema.index({ itemId: 1 });
productSchema.index({ categoryId: 1 });
productSchema.index({ metalType: 1 });
productSchema.index({ pricingMode: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ calculatedPrice: 1 });
productSchema.index({ categoryHierarchyPath: 1 });
// Compound index for filtering
productSchema.index({ isActive: 1, metalType: 1, pricingMode: 1 });

// Virtual: Weight difference percentage
productSchema.virtual("weightDifferencePercent").get(function () {
  if (this.grossWeight === 0) return 0;
  return ((this.grossWeight - this.netWeight) / this.grossWeight) * 100;
});

// Virtual: Total gemstone cost
productSchema.virtual("totalGemstoneCost").get(function () {
  if (!this.gemstones || this.gemstones.length === 0) return 0;
  return this.gemstones.reduce((sum, g) => sum + (g.totalCost || 0), 0);
});

// Virtual: Total gemstone weight in grams (1 carat = 0.2g)
productSchema.virtual("totalGemstoneWeightGrams").get(function () {
  if (!this.gemstones || this.gemstones.length === 0) return 0;
  return this.gemstones.reduce((sum, g) => sum + g.weight * 0.2, 0);
});

// Pre-save middleware
productSchema.pre("save", async function (next) {
  // Auto-generate slug if not provided
  if (!this.productSlug && this.productTitle) {
    this.productSlug = this.productTitle
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Populate hierarchy from subcategory on create
  if (this.isNew && this.subcategoryId) {
    try {
      const Subcategory = mongoose.model("Subcategory");
      const subcategory = await Subcategory.findById(this.subcategoryId);

      if (subcategory) {
        this.materialId = subcategory.materialId;
        this.genderId = subcategory.genderId;
        this.itemId = subcategory.itemId;
        this.categoryId = subcategory.categoryId;
        this.categoryHierarchyPath = subcategory.fullCategoryId;

        // Get metal type from material
        const Material = mongoose.model("Material");
        const material = await Material.findById(subcategory.materialId);
        if (material) {
          this.metalType = material.metalType;
        }
      }
    } catch (error) {
      return next(error);
    }
  }

  next();
});

/**
 * Instance method: Calculate and update price
 */
productSchema.methods.calculatePrice = async function () {
  const { MetalPrice } = require("./metal-price.model");
  const SubcategoryPricing = require("./subcategory-pricing.model");
  const Subcategory = require("./subcategory.model.js");

  if (this.pricingMode === PRICING_MODES.STATIC_PRICE) {
    this.calculatedPrice = this.staticPrice || 0;
    this.priceBreakdown = {
      components: [],
      metalType: this.metalType,
      metalRate: 0,
      metalCost: 0,
      gemstoneCost: this.totalGemstoneCost,
      subtotal: this.staticPrice || 0,
      totalPrice: this.staticPrice || 0,
      lastCalculated: new Date()
    };
    return this.save();
  }

  // Get current metal rate
  const metalPrice = await MetalPrice.getCurrentPrice(this.metalType);
  const metalRate = metalPrice.pricePerGram;

  // Get pricing config
  let pricingConfig;

  if (this.pricingMode === PRICING_MODES.CUSTOM_DYNAMIC && this.pricingConfig) {
    // Use product's own config
    pricingConfig = this.pricingConfig;
  } else {
    // Get from subcategory (with inheritance)
    const subcategory = await Subcategory.findById(this.subcategoryId);
    if (!subcategory) {
      throw new Error("Product subcategory not found");
    }

    pricingConfig = await subcategory.getPricingConfig();
    if (!pricingConfig) {
      throw new Error("No pricing configuration found in subcategory hierarchy");
    }
  }

  // Calculate breakdown
  const context = {
    grossWeight: this.grossWeight,
    netWeight: this.netWeight,
    metalRate
  };

  const breakdown = pricingConfig.calculateBreakdown
    ? pricingConfig.calculateBreakdown(context)
    : this._calculateBreakdownFromConfig(pricingConfig, context);

  // Add gemstone cost
  const gemstoneCost = this.totalGemstoneCost;
  const totalPrice = breakdown.subtotal + gemstoneCost;

  // Check if all components are frozen
  const allFrozen =
    breakdown.components.length > 0 &&
    breakdown.components.every((c) => c.isFrozen);

  // Update product
  this.priceBreakdown = {
    components: breakdown.components,
    metalType: this.metalType,
    metalRate,
    metalCost: breakdown.metalCost,
    gemstoneCost,
    subtotal: breakdown.subtotal,
    totalPrice: Math.round(totalPrice * 100) / 100,
    lastCalculated: new Date()
  };

  this.calculatedPrice = this.priceBreakdown.totalPrice;
  this.regularPrice = this.calculatedPrice;
  this.salePrice = this.calculatedPrice;
  this.allComponentsFrozen = allFrozen;

  return this.save();
};

/**
 * Helper: Calculate breakdown from config (for CUSTOM_DYNAMIC)
 */
productSchema.methods._calculateBreakdownFromConfig = function (config, context) {
  const { grossWeight, netWeight, metalRate } = context;
  const metalCost = netWeight * metalRate;

  const breakdown = [];
  let subtotal = 0;

  const components = config.components || [];
  const sortedComponents = [...components].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );

  for (const component of sortedComponents) {
    if (!component.isActive) continue;

    let value;

    if (component.isFrozen) {
      value = component.frozenValue;
    } else {
      switch (component.calculationType) {
        case "PER_GRAM":
          value = netWeight * metalRate * (component.value || 1);
          break;

        case "PERCENTAGE":
          let base;
          switch (component.percentageOf) {
            case "subtotal":
              base = subtotal;
              break;
            case "grossWeight":
              base = grossWeight * metalRate;
              break;
            case "netWeight":
              base = netWeight * metalRate;
              break;
            default:
              base = metalCost;
          }
          value = (base * component.value) / 100;
          break;

        case "FIXED":
          value = component.value;
          break;

        case "FORMULA":
          if (!component.formula) {
            value = 0;
          } else {
            try {
              let jsFormula = component.formula
                .replace(/×/g, "*")
                .replace(/÷/g, "/")
                .replace(/grossWeight/g, grossWeight)
                .replace(/netWeight/g, netWeight)
                .replace(/metalRate/g, metalRate)
                .replace(/metalCost/g, metalCost)
                .replace(/subtotal/g, subtotal);

              value = eval(jsFormula);
              if (!isFinite(value)) value = 0;
            } catch (error) {
              value = 0;
            }
          }
          break;

        default:
          value = 0;
      }
    }

    value = Math.round(value * 100) / 100;

    breakdown.push({
      componentKey: component.componentKey,
      componentName: component.componentName,
      value,
      isFrozen: component.isFrozen,
      isVisible: component.isVisible
    });

    subtotal += value;
  }

  return {
    components: breakdown,
    subtotal: Math.round(subtotal * 100) / 100,
    metalRate,
    metalCost: Math.round(metalCost * 100) / 100
  };
};

/**
 * Instance method: Customize pricing (switch to CUSTOM_DYNAMIC)
 */
productSchema.methods.customizePricing = async function () {
  if (this.pricingMode === PRICING_MODES.CUSTOM_DYNAMIC) {
    return this; // Already customized
  }

  const Subcategory = require("./subcategory.model.js");
  const subcategory = await Subcategory.findById(this.subcategoryId);

  if (!subcategory) {
    throw new Error("Product subcategory not found");
  }

  const pricingConfig = await subcategory.getPricingConfig();
  if (!pricingConfig) {
    throw new Error("No pricing configuration to clone");
  }

  // Clone the config
  this.pricingConfig = pricingConfig.cloneConfig();
  this.pricingMode = PRICING_MODES.CUSTOM_DYNAMIC;

  return this.save();
};

/**
 * Instance method: Revert to subcategory pricing
 */
productSchema.methods.revertToSubcategoryPricing = async function () {
  this.pricingMode = PRICING_MODES.SUBCATEGORY_DYNAMIC;
  this.pricingConfig = undefined;
  return this.save();
};

/**
 * Static: Get products affected by metal rate change
 */
productSchema.statics.getAffectedByMetalRate = async function (metalType) {
  return this.find({
    metalType,
    isActive: true,
    pricingMode: { $ne: PRICING_MODES.STATIC_PRICE },
    allComponentsFrozen: { $ne: true }
  });
};

/**
 * Static: Bulk recalculate prices for a metal type
 */
productSchema.statics.bulkRecalculate = async function (
  metalType,
  options = {}
) {
  const { batchSize = 100, onProgress } = options;

  const products = await this.getAffectedByMetalRate(metalType);
  const total = products.length;
  let processed = 0;
  let success = 0;
  let failed = 0;
  const failures = [];

  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (product) => {
        try {
          await product.calculatePrice();
          success++;
        } catch (error) {
          failed++;
          failures.push({
            productId: product._id,
            productTitle: product.productTitle,
            error: error.message
          });
        }
        processed++;
      })
    );

    if (onProgress) {
      onProgress({ processed, total, success, failed });
    }
  }

  return { total, success, failed, failures };
};

/**
 * Static: Validate gemstones for a product
 */
productSchema.statics.validateGemstones = function (gemstones, grossWeight) {
  const warnings = [];
  const errors = [];

  if (gemstones.length > 50) {
    errors.push("Maximum 50 gemstones allowed per product");
  }

  // Check for duplicates
  const nameCount = {};
  for (const gem of gemstones) {
    const name = gem.customName || gem.name;
    nameCount[name] = (nameCount[name] || 0) + 1;
  }
  for (const [name, count] of Object.entries(nameCount)) {
    if (count > 1) {
      warnings.push(`Duplicate gemstone type: ${name} (${count} entries)`);
    }
  }

  // Check total weight
  const totalGemWeightGrams = gemstones.reduce((sum, g) => sum + g.weight * 0.2, 0);
  if (grossWeight > 0 && totalGemWeightGrams > grossWeight * 0.5) {
    warnings.push(
      `Gemstone weight (${totalGemWeightGrams.toFixed(2)}g) exceeds 50% of gross weight (${grossWeight}g)`
    );
  }

  return { warnings, errors, valid: errors.length === 0 };
};

const Product = mongoose.model("Product", productSchema);

module.exports = {
  Product,
  PRICING_MODES
};
