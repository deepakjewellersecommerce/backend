const mongoose = require("mongoose");

/**
 * Calculation Types for Price Components
 */
const CALCULATION_TYPES = {
  PER_GRAM: "PER_GRAM", // netWeight × metalRate
  PERCENTAGE: "PERCENTAGE", // X% of reference value (usually metal cost)
  FIXED: "FIXED", // Fixed rupee amount
  FORMULA: "FORMULA" // Custom formula using variables
};

/**
 * Available Variables for Formula Building
 */
const FORMULA_VARIABLES = {
  grossWeight: "Gross weight in grams",
  netWeight: "Net weight in grams",
  metalRate: "Current metal price per gram",
  metalCost: "Auto-calculated: netWeight × metalRate",
  subtotal: "Sum of components before this one (by sortOrder)"
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
      unique: true,
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
    // For FORMULA: null (formula stored separately)
    // For PER_GRAM: usually 1 (multiplier)
    defaultValue: {
      type: Number,
      default: 0
    },
    // Formula expression (only for FORMULA type)
    // Stored as a parseable expression string
    // Example: "(grossWeight - netWeight) × metalRate × 0.05"
    formula: {
      type: String,
      default: null,
      validate: {
        validator: function (v) {
          if (this.calculationType !== CALCULATION_TYPES.FORMULA) {
            return true;
          }
          return v && v.length > 0;
        },
        message: "Formula is required for FORMULA calculation type"
      }
    },
    // Formula chips for UI reconstruction
    // Example: ["grossWeight", "-", "netWeight", "×", "metalRate", "×", "0.05"]
    formulaChips: [
      {
        type: String
      }
    ],
    // Reference for PERCENTAGE type (what the percentage is of)
    // Default: "metalCost"
    percentageOf: {
      type: String,
      default: "metalCost",
      enum: ["metalCost", "subtotal", "grossWeight", "netWeight"]
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
priceComponentSchema.index({ key: 1 }, { unique: true });
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
 * Static: Validate formula
 * Checks for valid syntax and variables
 */
priceComponentSchema.statics.validateFormula = function (
  formula,
  testValues = {}
) {
  const validVariables = Object.keys(FORMULA_VARIABLES);
  const errors = [];

  // Check for unknown variables
  const variablePattern = /[a-zA-Z]+/g;
  const usedVariables = formula.match(variablePattern) || [];

  for (const variable of usedVariables) {
    if (!validVariables.includes(variable) && isNaN(parseFloat(variable))) {
      errors.push(`Unknown variable: ${variable}`);
    }
  }

  // Test calculation with sample values
  const defaultTestValues = {
    grossWeight: testValues.grossWeight || 10,
    netWeight: testValues.netWeight || 9.5,
    metalRate: testValues.metalRate || 5000,
    metalCost:
      testValues.metalCost || (testValues.netWeight || 9.5) * (testValues.metalRate || 5000),
    subtotal: testValues.subtotal || 50000
  };

  try {
    // Convert formula to JavaScript expression
    let jsFormula = formula
      .replace(/×/g, "*")
      .replace(/÷/g, "/");

    // Replace variables with values
    for (const [variable, value] of Object.entries(defaultTestValues)) {
      jsFormula = jsFormula.replace(new RegExp(variable, "g"), value);
    }

    // Evaluate
    const result = eval(jsFormula);

    if (isNaN(result) || !isFinite(result)) {
      errors.push("Formula produces invalid result (NaN or Infinity)");
    }

    // Test edge case: zero values
    const zeroTestFormula = formula
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/grossWeight/g, "0")
      .replace(/netWeight/g, "0")
      .replace(/metalRate/g, "0")
      .replace(/metalCost/g, "0")
      .replace(/subtotal/g, "0");

    try {
      const zeroResult = eval(zeroTestFormula);
      if (!isFinite(zeroResult)) {
        errors.push("Formula causes division by zero with zero inputs");
      }
    } catch (e) {
      // Division by zero is caught here
      errors.push("Formula may cause division by zero");
    }

    return {
      valid: errors.length === 0,
      errors,
      testResult: errors.length === 0 ? result : null,
      testValues: defaultTestValues
    };
  } catch (error) {
    return {
      valid: false,
      errors: [`Invalid formula syntax: ${error.message}`],
      testResult: null,
      testValues: defaultTestValues
    };
  }
};

/**
 * Instance method: Calculate value
 */
priceComponentSchema.methods.calculate = function (context) {
  const { netWeight, grossWeight, metalRate, subtotal = 0 } = context;
  const metalCost = netWeight * metalRate;

  switch (this.calculationType) {
    case CALCULATION_TYPES.PER_GRAM:
      return netWeight * metalRate * (this.defaultValue || 1);

    case CALCULATION_TYPES.PERCENTAGE:
      let base;
      switch (this.percentageOf) {
        case "subtotal":
          base = subtotal;
          break;
        case "grossWeight":
          base = grossWeight * metalRate;
          break;
        case "netWeight":
          base = netWeight * metalRate;
          break;
        case "metalCost":
        default:
          base = metalCost;
      }
      return (base * this.defaultValue) / 100;

    case CALCULATION_TYPES.FIXED:
      return this.defaultValue;

    case CALCULATION_TYPES.FORMULA:
      if (!this.formula) return 0;
      try {
        let jsFormula = this.formula
          .replace(/×/g, "*")
          .replace(/÷/g, "/")
          .replace(/grossWeight/g, grossWeight)
          .replace(/netWeight/g, netWeight)
          .replace(/metalRate/g, metalRate)
          .replace(/metalCost/g, metalCost)
          .replace(/subtotal/g, subtotal);

        const result = eval(jsFormula);
        return isFinite(result) ? result : 0;
      } catch (error) {
        console.error(`Formula calculation error: ${error.message}`);
        return 0;
      }

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
  return this.save();
};

const PriceComponent = mongoose.model("PriceComponent", priceComponentSchema);

module.exports = {
  PriceComponent,
  CALCULATION_TYPES,
  FORMULA_VARIABLES
};
