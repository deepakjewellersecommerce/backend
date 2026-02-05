const mongoose = require("mongoose");
const { CALCULATION_TYPES } = require("./price-component.model");

/**
 * Component Configuration Schema (embedded in SubcategoryPricing)
 * Stores the configuration for each price component in a subcategory
 */
const componentConfigSchema = new mongoose.Schema(
  {
    componentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PriceComponent",
      required: true
    },
    componentKey: {
      type: String,
      required: true
    },
    componentName: {
      type: String,
      required: true
    },
    // Calculation settings (can override component defaults)
    calculationType: {
      type: String,
      enum: Object.values(CALCULATION_TYPES),
      required: true
    },
    value: {
      type: Number,
      default: 0
    },
    percentageOf: {
      type: String,
      default: "metalCost",
      enum: ["metalCost", "subtotal"]
    },
    // Metal price mode for metal_cost component (AUTO or MANUAL)
    metalPriceMode: {
      type: String,
      enum: ["AUTO", "MANUAL", null],
      default: null
    },
    // Manual metal price per gram (used when metalPriceMode is MANUAL)
    manualMetalPrice: {
      type: Number,
      default: null
    },
    // Freeze state
    isFrozen: {
      type: Boolean,
      default: false
    },
    frozenValue: {
      type: Number,
      default: null
    },
    // Original calculation preserved for unfreeze
    originalCalculationType: {
      type: String,
      enum: Object.values(CALCULATION_TYPES)
    },
    originalValue: {
      type: Number,
      default: null
    },
    frozenAt: {
      type: Date,
      default: null
    },
    metalRateAtFreeze: {
      type: Number,
      default: null
    },
    freezeReason: {
      type: String,
      default: null
    },
    frozenBy: {
      type: String,
      default: null
    },
    // Active/visibility
    isActive: {
      type: Boolean,
      default: true
    },
    isVisible: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

/**
 * Freeze History Entry Schema
 */
const freezeHistoryEntrySchema = new mongoose.Schema(
  {
    componentKey: {
      type: String,
      required: true
    },
    action: {
      type: String,
      enum: ["freeze", "unfreeze"],
      required: true
    },
    frozenValue: {
      type: Number
    },
    previousValue: {
      type: Number
    },
    metalRate: {
      type: Number,
      required: true
    },
    reason: {
      type: String
    },
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin"
    },
    adminName: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

/**
 * Subcategory Pricing Model
 * Stores the pricing configuration for a subcategory
 * Products inherit this configuration (or can override with CUSTOM_DYNAMIC)
 */
const subcategoryPricingSchema = new mongoose.Schema(
  {
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: true,
      unique: true
    },
    // Array of component configurations
    components: [componentConfigSchema],
    // Freeze history for audit trail
    freezeHistory: [freezeHistoryEntrySchema],
    // Metadata
    lastUpdatedBy: {
      type: String
    },
    // Count of products using this config
    affectedProductsCount: {
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
subcategoryPricingSchema.index({ subcategoryId: 1 }, { unique: true });

/**
 * Static: Create default pricing config for a subcategory
 * Uses system default components
 */
subcategoryPricingSchema.statics.createDefault = async function (
  subcategoryId,
  adminName = "System"
) {
  const { PriceComponent } = require("./price-component.model");
  const systemComponents = await PriceComponent.getSystemComponents();

  const components = systemComponents.map((comp, index) => ({
    componentId: comp._id,
    componentKey: comp.key,
    componentName: comp.name,
    calculationType: comp.calculationType,
    value: comp.defaultValue,
    percentageOf: comp.percentageOf,
    metalPriceMode: comp.metalPriceMode || (comp.key === "metal_cost" ? "AUTO" : null),
    manualMetalPrice: null,
    isActive: comp.isActive,
    isVisible: comp.isVisible,
    sortOrder: comp.sortOrder || index
  }));

  return this.create({
    subcategoryId,
    components,
    lastUpdatedBy: adminName
  });
};

/**
 * Instance method: Freeze a component
 */
subcategoryPricingSchema.methods.freezeComponent = async function (
  componentKey,
  frozenValue,
  metalRate,
  reason,
  adminId,
  adminName
) {
  const component = this.components.find((c) => c.componentKey === componentKey);
  if (!component) {
    throw new Error(`Component not found: ${componentKey}`);
  }

  if (!reason) {
    throw new Error("Freeze reason is required for subcategory-level freeze");
  }

  // Store original values for unfreeze
  component.originalCalculationType = component.calculationType;
  component.originalValue = component.value;

  // Set frozen state
  component.isFrozen = true;
  component.frozenValue = frozenValue;
  component.frozenAt = new Date();
  component.metalRateAtFreeze = metalRate;
  component.freezeReason = reason;
  component.frozenBy = adminName;

  // Add to history
  this.freezeHistory.push({
    componentKey,
    action: "freeze",
    frozenValue,
    previousValue: component.value,
    metalRate,
    reason,
    adminId,
    adminName,
    timestamp: new Date()
  });

  return this.save();
};

/**
 * Instance method: Unfreeze a component
 */
subcategoryPricingSchema.methods.unfreezeComponent = async function (
  componentKey,
  currentMetalRate,
  adminId,
  adminName
) {
  const component = this.components.find((c) => c.componentKey === componentKey);
  if (!component) {
    throw new Error(`Component not found: ${componentKey}`);
  }

  if (!component.isFrozen) {
    throw new Error(`Component is not frozen: ${componentKey}`);
  }

  const previousFrozenValue = component.frozenValue;

  // Restore original calculation
  component.calculationType = component.originalCalculationType;
  component.value = component.originalValue;

  // Clear frozen state
  component.isFrozen = false;
  component.frozenValue = null;
  component.frozenAt = null;
  component.metalRateAtFreeze = null;
  component.freezeReason = null;
  component.frozenBy = null;
  component.originalCalculationType = null;
  component.originalValue = null;

  // Add to history
  this.freezeHistory.push({
    componentKey,
    action: "unfreeze",
    previousValue: previousFrozenValue,
    metalRate: currentMetalRate,
    adminId,
    adminName,
    timestamp: new Date()
  });

  return this.save();
};

/**
 * Instance method: Update component configuration
 */
subcategoryPricingSchema.methods.updateComponent = function (
  componentKey,
  updates
) {
  const component = this.components.find((c) => c.componentKey === componentKey);
  if (!component) {
    throw new Error(`Component not found: ${componentKey}`);
  }

  if (component.isFrozen) {
    throw new Error(
      `Cannot update frozen component: ${componentKey}. Unfreeze first.`
    );
  }

  const allowedUpdates = [
    "calculationType",
    "value",
    "percentageOf",
    "metalPriceMode",
    "manualMetalPrice",
    "isActive",
    "isVisible",
    "sortOrder"
  ];

  for (const key of allowedUpdates) {
    if (updates[key] !== undefined) {
      component[key] = updates[key];
    }
  }

  return this;
};

/**
 * Instance method: Add a custom component
 */
subcategoryPricingSchema.methods.addComponent = async function (
  componentId,
  overrides = {}
) {
  const { PriceComponent } = require("./price-component.model");
  const component = await PriceComponent.findById(componentId);

  if (!component) {
    throw new Error("Component not found");
  }

  // Check if already added
  if (this.components.find((c) => c.componentId.equals(componentId))) {
    throw new Error("Component already exists in this configuration");
  }

  const maxSortOrder = Math.max(...this.components.map((c) => c.sortOrder), -1);

  this.components.push({
    componentId: component._id,
    componentKey: component.key,
    componentName: component.name,
    calculationType: overrides.calculationType || component.calculationType,
    value: overrides.value ?? component.defaultValue,
    percentageOf: overrides.percentageOf || component.percentageOf,
    metalPriceMode: overrides.metalPriceMode || component.metalPriceMode,
    manualMetalPrice: overrides.manualMetalPrice || null,
    isActive: overrides.isActive ?? component.isActive,
    isVisible: overrides.isVisible ?? component.isVisible,
    sortOrder: overrides.sortOrder ?? maxSortOrder + 1
  });

  return this;
};

/**
 * Instance method: Remove a component
 */
subcategoryPricingSchema.methods.removeComponent = function (componentKey) {
  const index = this.components.findIndex((c) => c.componentKey === componentKey);
  if (index === -1) {
    throw new Error(`Component not found: ${componentKey}`);
  }

  const component = this.components[index];

  // Check if it's a system component
  if (component.isSystemComponent) {
    throw new Error("Cannot remove system components");
  }

  this.components.splice(index, 1);
  return this;
};

/**
 * Instance method: Calculate price breakdown
 */
subcategoryPricingSchema.methods.calculateBreakdown = function (context) {
  const { netWeight, metalRate } = context;

  const breakdown = [];
  let subtotal = 0;
  let metalCost = 0;

  // Sort components by sortOrder
  const sortedComponents = [...this.components].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  for (const component of sortedComponents) {
    if (!component.isActive) continue;

    let value;

    if (component.isFrozen) {
      // Use frozen value
      value = component.frozenValue;
    } else {
      // Special handling for metal_cost component
      if (component.componentKey === "metal_cost") {
        if (component.metalPriceMode === "MANUAL" && component.manualMetalPrice) {
          value = component.manualMetalPrice * netWeight;
        } else {
          value = netWeight * metalRate; // AUTO mode
        }
        metalCost = value; // Store metalCost for percentage calculations
      } else {
        // Calculate based on type
        switch (component.calculationType) {
          case "PER_GRAM":
            value = netWeight * (component.value || 1);
            break;

          case "PERCENTAGE":
            // subtotal = running total of all previous components
            const base = component.percentageOf === "subtotal" ? subtotal : metalCost;
            value = (base * component.value) / 100;
            break;

          case "FIXED":
            value = component.value;
            break;

          default:
            value = 0;
        }
      }
    }

    // Round to 2 decimal places
    value = Math.round(value * 100) / 100;

    breakdown.push({
      componentId: component.componentId,
      componentKey: component.componentKey,
      componentName: component.componentName,
      calculationType: component.calculationType,
      value,
      isFrozen: component.isFrozen,
      frozenValue: component.frozenValue,
      isVisible: component.isVisible
    });

    subtotal += value;
  }

  // Merge hidden components into metal_cost for user view consistency
  let hiddenValueTotal = 0;
  let metalCostIndex = -1;

  for (let i = 0; i < breakdown.length; i++) {
    if (breakdown[i].componentKey === "metal_cost") {
      metalCostIndex = i;
    } else if (!breakdown[i].isVisible) {
      hiddenValueTotal += breakdown[i].value;
      breakdown[i].value = 0; // Set to 0 so total remains same and it's essentially hidden
    }
  }

  if (hiddenValueTotal > 0 && metalCostIndex !== -1) {
    breakdown[metalCostIndex].value =
      Math.round((breakdown[metalCostIndex].value + hiddenValueTotal) * 100) / 100;
    // Update the top-level metalCost in the return object
    metalCost = breakdown[metalCostIndex].value;
  }

  return {
    components: breakdown,
    subtotal: Math.round(subtotal * 100) / 100,
    metalRate,
    metalCost: Math.round(metalCost * 100) / 100
  };
};

/**
 * Instance method: Clone configuration (for product customization)
 */
subcategoryPricingSchema.methods.cloneConfig = function () {
  return {
    components: this.components.map((c) => ({
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
    clonedFrom: this.subcategoryId,
    clonedAt: new Date()
  };
};

/**
 * Static: Update affected products count
 */
subcategoryPricingSchema.statics.updateAffectedCount = async function (
  subcategoryId
) {
  const Subcategory = mongoose.model("Subcategory");
  const Product = mongoose.model("Product");

  // Get all subcategories that inherit from this one
  const subcategory = await Subcategory.findById(subcategoryId);
  if (!subcategory) return;

  // Find all subcategories in this pricing inheritance chain
  const inheritingSubcategories = await Subcategory.find({
    $or: [
      { _id: subcategoryId },
      {
        ancestorPath: subcategoryId,
        hasPricingConfig: false
      }
    ]
  });

  const subcategoryIds = inheritingSubcategories.map((s) => s._id);

  // Count products using SUBCATEGORY_DYNAMIC mode
  const count = await Product.countDocuments({
    subcategoryId: { $in: subcategoryIds },
    pricingMode: "SUBCATEGORY_DYNAMIC"
  });

  await this.updateOne({ subcategoryId }, { affectedProductsCount: count });

  return count;
};

const SubcategoryPricing = mongoose.model(
  "SubcategoryPricing",
  subcategoryPricingSchema
);
module.exports = SubcategoryPricing;
