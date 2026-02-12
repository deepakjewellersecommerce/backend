/**
 * Master Seed Script V2
 * Runs all seed scripts in correct order for new Metal Group structure
 *
 * Order:
 * 1. Metal Groups (base metals with MCX pricing)
 * 2. Categories V2 (materials with purity formulas, genders, items, categories)
 * 3. Price Components (pricing configuration)
 *
 * Run: node seeds/seed-all-v2.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const { runSeeds: seedMetalGroups } = require("./seed-metal-groups");
const { runSeeds: seedCategories } = require("./seed-categories-v2");
const { runSeeds: seedPriceComponents } = require("./seed-price-components");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
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

const runAllSeeds = async () => {
  console.log("\n".repeat(2));
  console.log("═".repeat(60));
  console.log("  MASTER SEED SCRIPT V2 - NEW METAL GROUP STRUCTURE  ");
  console.log("═".repeat(60));
  console.log("\n");

  let isConnected = false;

  try {
    // Step 1: Seed Metal Groups
    console.log("STEP 1/3: Seeding Metal Groups (MCX Pricing)");
    console.log("─".repeat(60));
    await seedMetalGroups();
    console.log("\n");

    // Step 2: Seed Categories (Materials, Genders, Items, Categories)
    console.log("STEP 2/3: Seeding Category Hierarchy V2");
    console.log("─".repeat(60));
    await seedCategories();
    console.log("\n");

    // Step 3: Seed Price Components
    console.log("STEP 3/3: Seeding Price Components");
    console.log("─".repeat(60));
    await seedPriceComponents();
    console.log("\n");

    console.log("═".repeat(60));
    console.log("  ALL SEEDS COMPLETED SUCCESSFULLY!  ");
    console.log("═".repeat(60));
    console.log("\n");

    // Reconnect for final summary (since each seed disconnects)
    await connectDB();
    isConnected = true;

    // Final summary
    const MetalGroup = require("../models/metal-group.model");
    const Material = require("../models/material.model");
    const Gender = require("../models/gender.model");
    const Item = require("../models/item.model");
    const Category = require("../models/category.model");

    const summary = {
      metalGroups: await MetalGroup.countDocuments({}),
      materials: await Material.countDocuments({}),
      genders: await Gender.countDocuments({}),
      items: await Item.countDocuments({}),
      categories: await Category.countDocuments({})
    };

    console.log("📊 FINAL DATABASE SUMMARY:");
    console.log("─".repeat(60));
    console.log(`  Metal Groups:     ${summary.metalGroups}`);
    console.log(`  Materials:        ${summary.materials}`);
    console.log(`  Genders:          ${summary.genders}`);
    console.log(`  Items:            ${summary.items}`);
    console.log(`  Categories:       ${summary.categories}`);
    console.log("─".repeat(60));
    console.log("\n");

    console.log("✅ Database is ready for use!");
    console.log("💡 Next: Set up cron job to fetch MCX prices");
    console.log("\n");
  } catch (error) {
    console.error("\n❌ SEEDING FAILED:");
    console.error(error);
    console.error("\n");
    process.exit(1);
  } finally {
    if (isConnected) {
      await mongoose.disconnect();
      console.log("MongoDB disconnected\n");
    }
  }
};

// Run if executed directly
if (require.main === module) {
  (async () => {
    await connectDB();
    await runAllSeeds();
    process.exit(0);
  })();
}

module.exports = { runAllSeeds };
