/**
 * Seed Script: Metal Groups
 * Seeds base metal groups (Gold, Silver, Platinum) with MCX pricing structure
 *
 * Run: node seeds/seed-metal-groups.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const MetalGroup = require("../models/metal-group.model");

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

// Metal Groups with MCX pricing structure
// These are approximate MCX rates - will be updated by API cron job
const metalGroups = [
  {
    name: "Gold",
    symbol: "Au",
    apiKey: "mcx_gold",
    mcxPrice: 15526.80, // Latest MCX Gold price (₹/gram)
    premium: 500, // Retailer markup (₹/gram)
    basePrice: 16026.80, // mcxPrice + premium (auto-calculated)
    apiSource: "MCX",
    currency: "INR",
    unit: "g",
    isActive: true,
    isAutoUpdate: true,
    sortOrder: 1,
    description: "24K Gold base metal group for MCX pricing",
    imageUrl: null
  },
  {
    name: "Silver",
    symbol: "Ag",
    apiKey: "mcx_silver",
    mcxPrice: 250.00, // Latest MCX Silver price (₹/gram)
    premium: 50, // Retailer markup (₹/gram)
    basePrice: 300.00, // mcxPrice + premium (auto-calculated)
    apiSource: "MCX",
    currency: "INR",
    unit: "g",
    isActive: true,
    isAutoUpdate: true,
    sortOrder: 2,
    description: "999 Silver base metal group for MCX pricing",
    imageUrl: null
  },
  {
    name: "Platinum",
    symbol: "Pt",
    apiKey: "mcx_platinum",
    mcxPrice: 6114.10, // Latest MCX Platinum price (₹/gram)
    premium: 200, // Retailer markup (₹/gram)
    basePrice: 6314.10, // mcxPrice + premium (auto-calculated)
    apiSource: "MCX",
    currency: "INR",
    unit: "g",
    isActive: true,
    isAutoUpdate: true,
    sortOrder: 3,
    description: "Platinum base metal group for MCX pricing",
    imageUrl: null
  }
];

const seedMetalGroups = async () => {
  console.log("Seeding Metal Groups...");

  for (const metalGroup of metalGroups) {
    const existing = await MetalGroup.findOne({ apiKey: metalGroup.apiKey });

    if (existing) {
      console.log(
        `  Metal Group exists: ${metalGroup.name} - MCX: ₹${existing.mcxPrice}/g, Premium: ₹${existing.premium}/g, Base: ₹${existing.basePrice}/g`
      );
      continue;
    }

    const created = await MetalGroup.create(metalGroup);
    console.log(
      `  Created: ${created.name} [${created.symbol}] - MCX: ₹${created.mcxPrice}/g, Premium: ₹${created.premium}/g, Base: ₹${created.basePrice}/g`
    );
  }

  console.log("Metal Groups seeded successfully\n");
};

const runSeeds = async () => {
  await connectDB();

  console.log("\n========================================");
  console.log("Starting Metal Groups Seeding");
  console.log("========================================\n");

  try {
    await seedMetalGroups();

    console.log("========================================");
    console.log("Metal Groups Seeding Complete!");
    console.log("========================================\n");

    // Display all metal groups
    const groups = await MetalGroup.find().sort({ sortOrder: 1 });
    console.log("Current Metal Groups:");
    console.log("─".repeat(80));
    console.log(
      "Name".padEnd(12) +
        "MCX Price".padEnd(15) +
        "Premium".padEnd(15) +
        "Base Price".padEnd(15) +
        "Auto Update"
    );
    console.log("─".repeat(80));

    for (const group of groups) {
      console.log(
        `${group.name.padEnd(12)}` +
          `₹${group.mcxPrice.toFixed(2).padEnd(13)}` +
          `₹${group.premium.toFixed(2).padEnd(13)}` +
          `₹${group.basePrice.toFixed(2).padEnd(13)}` +
          `${group.isAutoUpdate ? "Yes" : "No"}`
      );
    }

    console.log("─".repeat(80));
    console.log("\nNote: MCX prices will be updated by cron job every 15 minutes");
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

module.exports = { runSeeds, metalGroups };
