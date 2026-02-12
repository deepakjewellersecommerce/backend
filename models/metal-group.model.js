const mongoose = require("mongoose");

/**
 * Metal Group Schema
 * Represents base metals (Gold, Silver, Platinum) with MCX pricing
 *
 * Pricing Formula: Base Price = MCX Price + Premium
 * Materials (purity variants) calculate their prices from this base price
 */
const metalGroupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Metal group name is required"],
      unique: true,
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"]
    },

    symbol: {
      type: String,
      required: [true, "Chemical symbol is required"],
      trim: true,
      maxlength: [5, "Symbol cannot exceed 5 characters"],
      // E.g., "Au" for Gold, "Ag" for Silver, "Pt" for Platinum
    },

    apiKey: {
      type: String,
      required: [true, "API key is required"],
      unique: true,
      trim: true,
      // E.g., "mcx_gold", "mcx_silver", "mcx_platinum"
      // Maps to API response keys
    },

    // MCX PRICING
    mcxPrice: {
      type: Number,
      required: [true, "MCX price is required"],
      min: [0, "MCX price cannot be negative"],
      default: 0,
      // Latest price from MCX India API (₹/gram)
    },

    premium: {
      type: Number,
      required: [true, "Premium is required"],
      min: [0, "Premium cannot be negative"],
      default: 0,
      // Retailer markup on MCX price (₹/gram)
      // Admin can change this anytime
    },

    basePrice: {
      type: Number,
      required: [true, "Base price is required"],
      min: [0, "Base price cannot be negative"],
      default: 0,
      // Computed: mcxPrice + premium
      // This is what materials use for purity calculations
    },

    // API SOURCE TRACKING
    apiSource: {
      type: String,
      enum: ["MCX", "LBMA", "IBJA", "LME", "MANUAL"],
      default: "MCX",
      // Which API/source is this price from
    },

    lastFetched: {
      type: Date,
      default: null,
      // When was the MCX price last updated from API
    },

    currency: {
      type: String,
      default: "INR",
      enum: ["INR", "USD"],
      // Price currency
    },

    unit: {
      type: String,
      default: "g",
      enum: ["g", "kg", "oz"],
      // Price unit (per gram, per kg, per ounce)
    },

    // ADMIN CONTROLS
    isActive: {
      type: Boolean,
      default: true,
      // Can be used in material creation
    },

    isAutoUpdate: {
      type: Boolean,
      default: true,
      // Should cron job update this metal's price?
      // If false, admin must manually update
    },

    sortOrder: {
      type: Number,
      default: 0,
      // For UI display ordering
    },

    // OPTIONAL METADATA
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },

    imageUrl: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// INDEXES
metalGroupSchema.index({ apiKey: 1 });
metalGroupSchema.index({ isActive: 1, sortOrder: 1 });

// METHODS

/**
 * Update base price from MCX price + premium
 * Call this whenever mcxPrice or premium changes
 */
metalGroupSchema.methods.updateBasePrice = function () {
  this.basePrice = this.mcxPrice + this.premium;
  return this;
};

/**
 * Update MCX price from API and recalculate base price
 */
metalGroupSchema.methods.updateMCXPrice = function (newMcxPrice) {
  this.mcxPrice = newMcxPrice;
  this.basePrice = this.mcxPrice + this.premium;
  this.lastFetched = new Date();
  return this;
};

/**
 * Update premium and recalculate base price
 */
metalGroupSchema.methods.updatePremium = function (newPremium) {
  this.premium = newPremium;
  this.basePrice = this.mcxPrice + this.premium;
  return this;
};

// STATICS

/**
 * Get all active metal groups
 */
metalGroupSchema.statics.getActive = function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

/**
 * Get metal group by API key
 */
metalGroupSchema.statics.getByApiKey = function (apiKey) {
  return this.findOne({ apiKey });
};

// PRE-SAVE HOOKS

/**
 * Ensure base price is always calculated before save
 */
metalGroupSchema.pre("save", function (next) {
  // Auto-calculate basePrice if mcxPrice or premium changed
  if (this.isModified("mcxPrice") || this.isModified("premium")) {
    this.basePrice = this.mcxPrice + this.premium;
  }
  next();
});

const MetalGroup = mongoose.model("MetalGroup", metalGroupSchema);

module.exports = MetalGroup;
