const mongoose = require("mongoose");

/**
 * Calculation Types for Price Components
 */
const CALCULATION_TYPES = {
  PER_GRAM: "PER_GRAM", // netWeight × metalRate
  PERCENTAGE: "PERCENTAGE", // X% of reference value (metalCost or subtotal)
  FIXED: "FIXED" // Fixed rupee amount
};

/**
 * Price Component Model
 * Defines reusable pricing components (Metal Cost, Making Charges, GST, etc.)
 * Used in subcategory and product pricing configurations
 */
const priceComponentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Component name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    key: {
      type: String,
      required: [true, "Component key is required"],
      lowercase: true,
      trim: true,
      validate: {
        validator: function (v) {
          return /^[a-z][a-z0-9_]*$/.test(v);
        },
        message:
          "Key must start with a letter and contain only lowercase letters, numbers, and underscores"
      }
    },
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    calculationType: {
      type: String,
      required: true,
      enum: {
        values: Object.values(CALCULATION_TYPES),
        message: "{VALUE} is not a valid calculation type"
      }
    },
    // Default value based on calculation type
    // For PERCENTAGE: percentage value (e.g., 15 for 15%)
    // For FIXED: rupee amount
    // For PER_GRAM: usually 1 (multiplier)
    defaultValue: {
      type: Number,
      default: 0
    },
    // Reference for PERCENTAGE type (what the percentage is of)
    // Only "metalCost" or "subtotal" allowed
    percentageOf: {
      type: String,
      default: "metalCost",
      enum: ["metalCost", "subtotal"]
    },
    // Metal price mode (only for metal_cost component)
    // AUTO: uses system metal rate, MANUAL: admin enters price
    metalPriceMode: {
      type: String,
      enum: ["AUTO", "MANUAL", null],
      default: null
    },
    // System vs Custom
    isSystemComponent: {
      type: Boolean,
      default: false
    },
    // Can this component be frozen?
    allowsFreeze: {
      type: Boolean,
      default: true
    },
    // Is component active (included in calculations)?
    isActive: {
      type: Boolean,
      default: true
    },
    // Is component visible to customers?
    isVisible: {
      type: Boolean,
      default: true
    },
    // Display order in price breakdown
    sortOrder: {
      type: Number,
      default: 0
    },
    // Soft delete for historical preservation
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
priceComponentSchema.index({ key: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
priceComponentSchema.index({ isSystemComponent: 1 });
priceComponentSchema.index({ isActive: 1 });
priceComponentSchema.index({ isDeleted: 1 });
priceComponentSchema.index({ sortOrder: 1 });

/**
 * Static: Get all active components (excluding deleted)
 */
priceComponentSchema.statics.getActiveComponents = async function () {
  return this.find({ isActive: true, isDeleted: false }).sort({
    sortOrder: 1,
    name: 1
  });
};

/**
 * Static: Get system components
 */
priceComponentSchema.statics.getSystemComponents = async function () {
  return this.find({ isSystemComponent: true, isDeleted: false }).sort({
    sortOrder: 1
  });
};

/**
 * Static: Get component by key
 */
priceComponentSchema.statics.getByKey = async function (key) {
  return this.findOne({ key, isDeleted: false });
};


/**
 * Instance method: Calculate value
 */
priceComponentSchema.methods.calculate = function (context) {
  const { netWeight, metalRate, metalCost, subtotal = 0, manualMetalPrice } = context;
  const calculatedMetalCost = metalCost || netWeight * metalRate;

  // Special handling for metal_cost component
  if (this.key === "metal_cost") {
    if (this.metalPriceMode === "MANUAL" && manualMetalPrice) {
      return manualMetalPrice * netWeight;
    }
    return netWeight * metalRate; // AUTO mode
  }

  switch (this.calculationType) {
    case CALCULATION_TYPES.PER_GRAM:
      return netWeight * metalRate * (this.defaultValue || 1);

    case CALCULATION_TYPES.PERCENTAGE:
      const base = this.percentageOf === "subtotal" ? subtotal : calculatedMetalCost;
      return (base * this.defaultValue) / 100;

    case CALCULATION_TYPES.FIXED:
      return this.defaultValue;

    default:
      return 0;
  }
};

/**
 * Instance method: Check if component can be deleted
 */
priceComponentSchema.methods.canDelete = async function () {
  if (this.isSystemComponent) {
    return { canDelete: false, reason: "System components cannot be deleted" };
  }

  // Check if used in any subcategory pricing
  const SubcategoryPricing = mongoose.model("SubcategoryPricing");
  const usedInPricing = await SubcategoryPricing.countDocuments({
    "components.componentId": this._id
  });

  if (usedInPricing > 0) {
    return {
      canDelete: false,
      reason: `Component is used in ${usedInPricing} subcategory pricing configuration(s)`
    };
  }

  // Check if used in any product with CUSTOM_DYNAMIC mode
  const Product = mongoose.model("Product");
  const usedInProducts = await Product.countDocuments({
    pricingMode: "CUSTOM_DYNAMIC",
    "pricingConfig.components.componentId": this._id
  });

  if (usedInProducts > 0) {
    return {
      canDelete: false,
      reason: `Component is used in ${usedInProducts} product(s) with custom pricing`
    };
  }

  // Check if referenced in any orders
  const Order = mongoose.model("Order");
  const usedInOrders = await Order.countDocuments({
    "items.priceBreakdownSnapshot.components.componentId": this._id
  });

  if (usedInOrders > 0) {
    return {
      canDelete: false,
      softDeleteOnly: true,
      reason: `Component is referenced in ${usedInOrders} order(s) - can only soft delete`
    };
  }

  return { canDelete: true };
};

/**
 * Instance method: Soft delete
 */
priceComponentSchema.methods.softDelete = async function () {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.isActive = false;
  // Mangle key so the unique index won't block re-creation
  this.key = `${this.key}_deleted_${this._id}`;
  return this.save();
};

const PriceComponent = mongoose.model("PriceComponent", priceComponentSchema);

module.exports = {
  PriceComponent,
  CALCULATION_TYPES
};
