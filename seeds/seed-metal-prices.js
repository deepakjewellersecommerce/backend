/**
 * Seed Script: Default Metal Prices
 * Seeds initial metal prices for all supported metal types
 *
 * Run: node seeds/seed-metal-prices.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const {
  MetalPrice,
  METAL_TYPES,
  PRICE_SOURCES
} = require("../models/metal-price.model");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MongoDB URI not found in environment variables");
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected for seeding");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};

// Default Metal Prices (in INR per gram)
// These are approximate market rates - will be updated by API or manual entry
const defaultMetalPrices = [
  {
    metalType: METAL_TYPES.GOLD_24K,
    pricePerGram: 6500, // ~₹6,500/gram for 24K gold
    displayName: "Gold (24K)"
  },
  {
    metalType: METAL_TYPES.GOLD_22K,
    pricePerGram: 5960, // ~₹5,960/gram for 22K gold (91.67% of 24K)
    displayName: "Gold (22K)"
  },
  {
    metalType: METAL_TYPES.SILVER_999,
    pricePerGram: 85, // ~₹85/gram for pure silver
    displayName: "Silver (999)"
  },
  {
    metalType: METAL_TYPES.SILVER_925,
    pricePerGram: 79, // ~₹79/gram for sterling silver (92.5%)
    displayName: "Silver (925)"
  },
  {
    metalType: METAL_TYPES.PLATINUM,
    pricePerGram: 3200, // ~₹3,200/gram for platinum
    displayName: "Platinum"
  }
];

const seedMetalPrices = async () => {
  console.log("Seeding Metal Prices...");

  for (const metalPrice of defaultMetalPrices) {
    const existing = await MetalPrice.findOne({
      metalType: metalPrice.metalType
    });

    if (existing) {
      console.log(
        `  Price exists: ${metalPrice.displayName} - ₹${existing.pricePerGram}/gram`
      );
      continue;
    }

    await MetalPrice.create({
      metalType: metalPrice.metalType,
      pricePerGram: metalPrice.pricePerGram,
      currency: "INR",
      source: PRICE_SOURCES.MANUAL,
      updatedBy: "System Initialization",
      lastUpdated: new Date(),
      isActive: true
    });

    console.log(
      `  Created: ${metalPrice.displayName} - ₹${metalPrice.pricePerGram}/gram`
    );
  }

  console.log("Metal Prices seeded successfully\n");
};

const runSeeds = async () => {
  await connectDB();

  console.log("\n========================================");
  console.log("Starting Metal Prices Seeding");
  console.log("========================================\n");

  try {
    await seedMetalPrices();

    console.log("========================================");
    console.log("Metal Prices Seeding Complete!");
    console.log("========================================\n");

    // Display all prices
    const prices = await MetalPrice.find().sort({ metalType: 1 });
    console.log("Current Metal Prices:");
    console.log("─".repeat(50));

    for (const price of prices) {
      console.log(
        `  ${price.displayName || price.metalType}: ₹${price.pricePerGram}/gram`
      );
    }

    console.log("─".repeat(50));
  } catch (error) {
    console.error("Seeding error:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB disconnected");
  }
};

// Run if executed directly
if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds, defaultMetalPrices };
