const mongoose = require("mongoose");

/**
 * Metal Types Enum
 * Maps to Material categories (Level 1) in the hierarchy
 */
const METAL_TYPES = {
  GOLD_24K: "GOLD_24K",
  GOLD_22K: "GOLD_22K",
  SILVER_999: "SILVER_999",
  SILVER_925: "SILVER_925",
  PLATINUM: "PLATINUM"
};

/**
 * Price Source Enum
 * Tracks whether price was fetched from API or manually entered
 */
const PRICE_SOURCES = {
  API: "API",
  MANUAL: "MANUAL",
  CRON: "CRON"
};

/**
 * Metal Price Schema
 * Stores current metal prices per gram in INR for each metal type
 */
const metalPriceSchema = new mongoose.Schema(
  {
    metalType: {
      type: String,
      required: [true, "Metal type is required"],
      enum: {
        values: Object.values(METAL_TYPES),
        message: "{VALUE} is not a valid metal type"
      },
      unique: true
    },
    pricePerGram: {
      type: Number,
      required: [true, "Price per gram is required"],
      min: [0, "Price cannot be negative"]
    },
    currency: {
      type: String,
      default: "INR",
      enum: ["INR"]
    },
    source: {
      type: String,
      required: true,
      enum: {
        values: Object.values(PRICE_SOURCES),
        message: "{VALUE} is not a valid price source"
      },
      default: PRICE_SOURCES.MANUAL
    },
    updatedBy: {
      type: String,
      default: "System"
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

/**
 * Metal Price History Schema
 * Tracks all price changes for audit trail
 */
const metalPriceHistorySchema = new mongoose.Schema(
  {
    metalType: {
      type: String,
      required: true,
      enum: Object.values(METAL_TYPES)
    },
    oldPricePerGram: {
      type: Number,
      required: true
    },
    newPricePerGram: {
      type: Number,
      required: true
    },
    changePercent: {
      type: Number,
      required: true
    },
    source: {
      type: String,
      required: true,
      enum: Object.values(PRICE_SOURCES)
    },
    updatedBy: {
      type: String,
      required: true
    },
    affectedProductsCount: {
      type: Number,
      default: 0
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Indexes for MetalPrice
metalPriceSchema.index({ metalType: 1 }, { unique: true });
metalPriceSchema.index({ isActive: 1 });
metalPriceSchema.index({ lastUpdated: -1 });

// Indexes for MetalPriceHistory
metalPriceHistorySchema.index({ metalType: 1, timestamp: -1 });
metalPriceHistorySchema.index({ timestamp: -1 });
metalPriceHistorySchema.index({ source: 1 });

/**
 * Static method to get current price for a metal type
 */
metalPriceSchema.statics.getCurrentPrice = async function (metalType) {
  const price = await this.findOne({ metalType, isActive: true });
  if (!price) {
    throw new Error(`No active price found for metal type: ${metalType}`);
  }
  return price;
};

/**
 * Static method to get all active metal prices
 */
metalPriceSchema.statics.getAllActivePrices = async function () {
  return this.find({ isActive: true }).sort({ metalType: 1 });
};

/**
 * Static method to update price and create history record
 */
metalPriceSchema.statics.updatePrice = async function (
  metalType,
  newPricePerGram,
  source,
  updatedBy,
  affectedProductsCount = 0
) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Get current price
    let currentPrice = await this.findOne({ metalType });
    const oldPricePerGram = currentPrice ? currentPrice.pricePerGram : 0;

    // Calculate change percentage
    const changePercent =
      oldPricePerGram > 0
        ? ((newPricePerGram - oldPricePerGram) / oldPricePerGram) * 100
        : 100;

    // Update or create metal price
    if (currentPrice) {
      currentPrice.pricePerGram = newPricePerGram;
      currentPrice.source = source;
      currentPrice.updatedBy = updatedBy;
      currentPrice.lastUpdated = new Date();
      await currentPrice.save({ session });
    } else {
      currentPrice = await this.create(
        [
          {
            metalType,
            pricePerGram: newPricePerGram,
            source,
            updatedBy,
            lastUpdated: new Date()
          }
        ],
        { session }
      );
      currentPrice = currentPrice[0];
    }

    // Create history record
    await MetalPriceHistory.create(
      [
        {
          metalType,
          oldPricePerGram,
          newPricePerGram,
          changePercent: parseFloat(changePercent.toFixed(2)),
          source,
          updatedBy,
          affectedProductsCount,
          timestamp: new Date()
        }
      ],
      { session }
    );

    await session.commitTransaction();
    return currentPrice;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

/**
 * Instance method to format price for display
 */
metalPriceSchema.methods.formatPrice = function () {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2
  }).format(this.pricePerGram);
};

/**
 * Virtual for display name
 */
metalPriceSchema.virtual("displayName").get(function () {
  const names = {
    GOLD_24K: "Gold (24k)",
    GOLD_22K: "Gold (22k)",
    SILVER_999: "Silver (999)",
    SILVER_925: "Silver (925)",
    PLATINUM: "Platinum"
  };
  return names[this.metalType] || this.metalType;
});

// Enable virtuals in JSON
metalPriceSchema.set("toJSON", { virtuals: true });
metalPriceSchema.set("toObject", { virtuals: true });

const MetalPrice = mongoose.model("MetalPrice", metalPriceSchema);
const MetalPriceHistory = mongoose.model(
  "MetalPriceHistory",
  metalPriceHistorySchema
);

module.exports = {
  MetalPrice,
  MetalPriceHistory,
  METAL_TYPES,
  PRICE_SOURCES
};
