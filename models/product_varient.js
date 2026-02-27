const mongoose = require("mongoose");
const { METAL_TYPES } = require("./metal-price.model");
const { CALCULATION_TYPES } = require("./price-component.model");
const { calculateBreakdown, createPriceBreakdownData, areAllComponentsFrozen } = require("../utils/price-calculator");

/**
 * Pricing Modes (same as Product)
 */
const PRICING_MODES = {
  SUBCATEGORY_DYNAMIC: "SUBCATEGORY_DYNAMIC", // Inherits from subcategory, updates with metal rates
  CUSTOM_DYNAMIC: "CUSTOM_DYNAMIC", // Variant-specific config, still uses live metal rates
  STATIC_PRICE: "STATIC_PRICE" // Fixed price, no dynamic calculation
};

/**
 * Gemstone Schema (embedded in Variant)
 */
const variantGemstoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: [
        "Diamond", "Ruby", "Emerald", "Sapphire", "Pearl",
        "Topaz", "Amethyst", "Garnet", "Opal", "Turquoise",
        "Aquamarine", "Peridot", "Citrine", "Tanzanite", "Custom"
      ]
    },
    customName: { type: String, maxlength: 50 },
    weight: {
      type: Number,
      required: true,
      min: [0.001, "Gemstone weight must be positive"],
    },
    pricePerCarat: {
      type: Number,
      required: true,
      min: [0, "Price per carat cannot be negative"],
    },
    totalCost: { type: Number, default: 0 },
  },
  { _id: true }
);

variantGemstoneSchema.pre("validate", function () {
  this.totalCost = Math.round(this.weight * this.pricePerCarat * 100) / 100;
});

/**
 * Variant Pricing Config Schema (for CUSTOM_DYNAMIC mode)
 * Cloned from Product or SubcategoryPricing when customizing
 */
const variantPricingConfigSchema = new mongoose.Schema(
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
        percentageOf: {
          type: String,
          enum: ["metalCost", "subtotal"]
        },
        metalPriceMode: {
          type: String,
          enum: ["AUTO", "MANUAL", null],
          default: null
        },
        manualMetalPrice: {
          type: Number,
          default: null
        },
        isFrozen: { type: Boolean, default: false },
        frozenValue: Number,
        originalCalculationType: String,
        originalValue: Number,
        frozenAt: Date,
        metalRateAtFreeze: Number,
        freezeReason: String,
        frozenBy: String,
        isActive: { type: Boolean, default: true },
        isVisible: { type: Boolean, default: true },
        sortOrder: { type: Number, default: 0 }
      }
    ],
    clonedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product"
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
 * Product Variant Schema
 */
const productVariantSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    size: { type: String, required: true },
    // Dynamic pricing fields
    pricingMode: {
      type: String,
      enum: Object.values(PRICING_MODES),
      default: PRICING_MODES.SUBCATEGORY_DYNAMIC
    },
    // For CUSTOM_DYNAMIC mode
    pricingConfig: variantPricingConfigSchema,
    // Calculated prices
    calculatedPrice: { type: Number, default: 0 },
    regularPrice: { type: Number, default: 0 },
    salePrice: { type: Number, default: 0 },
    priceBreakdown: priceBreakdownSchema,
    // Flag to track if all components are frozen
    allComponentsFrozen: { type: Boolean, default: false },
    // Legacy static price field (for STATIC_PRICE mode)
    staticPrice: { type: Number, default: 0 },
    // Weight fields for dynamic pricing
    grossWeight: { type: Number, min: 0 },
    netWeight: { type: Number, min: 0 },
    // Gemstones
    gemstones: {
      type: [variantGemstoneSchema],
      default: [],
      validate: [arr => arr.length <= 50, "Maximum 50 gemstones allowed"],
    },
    // Other fields
    isActive: { type: Boolean, default: true },
    stock: { type: Number, required: true },
    imageUrls: [{ type: String }],
    color: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product_Color",
    },
  },
  { timestamps: true }
);

// Virtual for total gemstone cost
productVariantSchema.virtual("totalGemstoneCost").get(function () {
  if (!this.gemstones || this.gemstones.length === 0) return 0;
  return this.gemstones.reduce((sum, g) => sum + (g.totalCost || 0), 0);
});

// Index for efficient queries
productVariantSchema.index({ productId: 1, size: 1 });

/**
 * Instance method: Calculate and update price
 */
productVariantSchema.methods.calculatePrice = async function () {
  const { MetalPrice } = require("./metal-price.model");
  const SubcategoryPricing = require("./subcategory-pricing.model");
  const Subcategory = require("./subcategory.model");
  const Product = require("./product.model");

  // Get the parent product to access metalType
  const product = await Product.findById(this.productId).populate("subcategoryId");
  if (!product) {
    throw new Error("Parent product not found");
  }

  const metalType = product.metalType;

  if (this.pricingMode === PRICING_MODES.STATIC_PRICE) {
    this.calculatedPrice = this.staticPrice || 0;
    this.regularPrice = this.calculatedPrice;
    this.salePrice = this.calculatedPrice;
    this.priceBreakdown = {
      components: [],
      metalType,
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
  const metalPrice = await MetalPrice.getCurrentPrice(metalType);
  const metalRate = metalPrice.pricePerGram;

  // Determine net weight: variant-specific or from product
  const netWeight = this.netWeight || product.netWeight;
  const grossWeight = this.grossWeight || product.grossWeight;

  // Get pricing config
  let pricingConfig;

  if (this.pricingMode === PRICING_MODES.CUSTOM_DYNAMIC && this.pricingConfig) {
    // Use variant's own config
    pricingConfig = this.pricingConfig;
  } else {
    // Inherit from product (which inherits from subcategory)
    if (product.pricingMode === "CUSTOM_DYNAMIC" && product.pricingConfig) {
      pricingConfig = product.pricingConfig;
    } else {
      // Get from subcategory
      const subcategory = await Subcategory.findById(product.subcategoryId);
      if (!subcategory) {
        throw new Error("Product subcategory not found");
      }
      pricingConfig = await subcategory.getPricingConfig();
      if (!pricingConfig) {
        throw new Error("No pricing configuration found");
      }
    }
  }

  // Calculate breakdown using shared utility
  const context = { netWeight, metalRate };
  const breakdown = pricingConfig.calculateBreakdown
    ? pricingConfig.calculateBreakdown(context)
    : calculateBreakdown(pricingConfig, context);

  // Add gemstone cost
  const gemstoneCost = this.totalGemstoneCost;

  // Create price breakdown
  this.priceBreakdown = createPriceBreakdownData(breakdown, metalType, gemstoneCost);

  // Update calculated prices
  this.calculatedPrice = this.priceBreakdown.totalPrice;
  this.regularPrice = this.calculatedPrice;
  this.salePrice = this.calculatedPrice;

  // Check if all components are frozen
  this.allComponentsFrozen = areAllComponentsFrozen(breakdown.components);

  return this.save();
};

/**
 * Instance method: Customize pricing (switch to CUSTOM_DYNAMIC)
 */
productVariantSchema.methods.customizePricing = async function () {
  if (this.pricingMode === PRICING_MODES.CUSTOM_DYNAMIC) {
    return this; // Already customized
  }

  const Product = require("./product.model");
  const Subcategory = require("./subcategory.model");

  const product = await Product.findById(this.productId).populate("subcategoryId");
  if (!product) {
    throw new Error("Parent product not found");
  }

  let sourceConfig;

  if (product.pricingMode === "CUSTOM_DYNAMIC" && product.pricingConfig) {
    sourceConfig = product.pricingConfig;
  } else {
    const subcategory = await Subcategory.findById(product.subcategoryId);
    if (!subcategory) {
      throw new Error("Product subcategory not found");
    }
    const subcategoryPricing = await subcategory.getPricingConfig();
    if (!subcategoryPricing) {
      throw new Error("No pricing configuration found");
    }
    sourceConfig = subcategoryPricing.cloneConfig ? subcategoryPricing.cloneConfig() : {
      components: subcategoryPricing.components.map(c => ({...c})),
      clonedFrom: subcategory._id
    };
  }

  this.pricingMode = PRICING_MODES.CUSTOM_DYNAMIC;
  this.pricingConfig = {
    components: sourceConfig.components.map(c => ({
      componentId: c.componentId,
      componentKey: c.componentKey,
      componentName: c.componentName,
      calculationType: c.calculationType,
      value: c.value,
      percentageOf: c.percentageOf,
      metalPriceMode: c.metalPriceMode,
      manualMetalPrice: c.manualMetalPrice,
      isFrozen: c.isFrozen,
      frozenValue: c.frozenValue,
      originalCalculationType: c.originalCalculationType,
      originalValue: c.originalValue,
      frozenAt: c.frozenAt,
      metalRateAtFreeze: c.metalRateAtFreeze,
      freezeReason: c.freezeReason,
      frozenBy: c.frozenBy,
      isActive: c.isActive,
      isVisible: c.isVisible,
      sortOrder: c.sortOrder
    })),
    clonedFrom: product._id,
    clonedAt: new Date()
  };

  return this.save();
};

/**
 * Instance method: Reset pricing to inherited
 */
productVariantSchema.methods.resetPricing = async function () {
  this.pricingMode = PRICING_MODES.SUBCATEGORY_DYNAMIC;
  this.pricingConfig = undefined;
  return this.save();
};

/**
 * Static: Bulk recalculate prices for variants by metal type
 */
productVariantSchema.statics.bulkRecalculate = async function (metalType, options = {}) {
  const Product = require("./product.model");
  const { batchSize = 100, onProgress } = options;

  const results = {
    success: 0,
    failed: 0,
    failures: []
  };

  // Find variants with products of the given metal type
  const products = await Product.find({ metalType, isActive: true }).select("_id");
  const productIds = products.map(p => p._id);

  const totalVariants = await this.countDocuments({
    productId: { $in: productIds },
    isActive: true,
    pricingMode: { $ne: PRICING_MODES.STATIC_PRICE }
  });

  let processed = 0;

  // Process in batches
  while (processed < totalVariants) {
    const variants = await this.find({
      productId: { $in: productIds },
      isActive: true,
      pricingMode: { $ne: PRICING_MODES.STATIC_PRICE }
    })
      .skip(processed)
      .limit(batchSize);

    for (const variant of variants) {
      try {
        if (variant.allComponentsFrozen) {
          results.skipped = (results.skipped || 0) + 1;
          continue;
        }
        await variant.calculatePrice();
        results.success++;
      } catch (error) {
        results.failed++;
        results.failures.push({
          variantId: variant._id,
          error: error.message
        });
      }
    }

    processed += variants.length;

    if (onProgress) {
      onProgress({
        processed,
        total: totalVariants,
        success: results.success,
        failed: results.failed
      });
    }
  }

  return results;
};

const ProductVariant = mongoose.model("ProductVarient", productVariantSchema);

// Export both model and PRICING_MODES
module.exports = ProductVariant;
module.exports.PRICING_MODES = PRICING_MODES;
