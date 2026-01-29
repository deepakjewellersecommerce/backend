/**
 * Master Seed Script
 * Runs all seed scripts in the correct order
 *
 * Run: node seeds/index.js
 * Run specific: node seeds/index.js --only=categories
 */

const mongoose = require("mongoose");
require("dotenv").config();

const { runSeeds: seedCategories } = require("./seed-categories");
const { runSeeds: seedPriceComponents } = require("./seed-price-components");
const { runSeeds: seedMetalPrices } = require("./seed-metal-prices");

// Connect to MongoDB
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MongoDB URI not found in environment variables");
    }
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected for seeding");
    return true;
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    return false;
  }
};

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    only: null,
    skip: []
  };

  for (const arg of args) {
    if (arg.startsWith("--only=")) {
      options.only = arg.split("=")[1];
    }
    if (arg.startsWith("--skip=")) {
      options.skip = arg.split("=")[1].split(",");
    }
  }

  return options;
};

// Available seed scripts
const seeds = {
  categories: {
    name: "Category Hierarchy",
    run: seedCategories,
    order: 1
  },
  "price-components": {
    name: "Price Components",
    run: seedPriceComponents,
    order: 2
  },
  "metal-prices": {
    name: "Metal Prices",
    run: seedMetalPrices,
    order: 3
  }
};

const runAllSeeds = async () => {
  const options = parseArgs();

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║       DJ Jewelry E-Commerce - Database Seeding         ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // Connect to database
  const connected = await connectDB();
  if (!connected) {
    console.error("Failed to connect to database. Exiting.");
    process.exit(1);
  }

  try {
    // Determine which seeds to run
    let seedsToRun = Object.entries(seeds)
      .sort((a, b) => a[1].order - b[1].order)
      .filter(([key]) => {
        if (options.only) {
          return key === options.only;
        }
        if (options.skip.includes(key)) {
          return false;
        }
        return true;
      });

    if (seedsToRun.length === 0) {
      console.log("No seeds to run. Check your --only or --skip options.");
      return;
    }

    console.log(`Running ${seedsToRun.length} seed script(s):\n`);

    for (const [key, seed] of seedsToRun) {
      console.log(`\n┌${"─".repeat(56)}┐`);
      console.log(`│ Running: ${seed.name.padEnd(45)}│`);
      console.log(`└${"─".repeat(56)}┘\n`);

      // Note: Individual seed scripts handle their own connection
      // but we've already connected, so they'll use the existing connection
      try {
        // Import and run the seed function directly
        // (not calling runSeeds which would disconnect)
        if (key === "categories") {
          const Material = require("../models/material.model");
          const Gender = require("../models/gender.model");
          const Item = require("../models/item.model");
          const Category = require("../models/category.model");
          const { materials, genders, items, sampleCategories } = require("./seed-categories");

          // Seed materials
          for (const material of materials) {
            const existing = await Material.findOne({ metalType: material.metalType });
            if (!existing) {
              await Material.create(material);
              console.log(`  Created Material: ${material.name}`);
            }
          }

          // Seed genders
          for (const gender of genders) {
            const existing = await Gender.findOne({ idAttribute: gender.idAttribute });
            if (!existing) {
              await Gender.create(gender);
              console.log(`  Created Gender: ${gender.name}`);
            }
          }

          // Seed items
          for (const item of items) {
            const existing = await Item.findOne({ idAttribute: item.idAttribute });
            if (!existing) {
              await Item.create(item);
              console.log(`  Created Item: ${item.name}`);
            }
          }

          console.log(`  ✓ Category Hierarchy seeded`);
        }

        if (key === "price-components") {
          const { PriceComponent } = require("../models/price-component.model");
          const { systemComponents, customComponentExamples } = require("./seed-price-components");

          for (const component of [...systemComponents, ...customComponentExamples]) {
            const existing = await PriceComponent.findOne({ key: component.key });
            if (!existing) {
              await PriceComponent.create(component);
              console.log(`  Created Component: ${component.name}`);
            }
          }

          console.log(`  ✓ Price Components seeded`);
        }

        if (key === "metal-prices") {
          const { MetalPrice, PRICE_SOURCES } = require("../models/metal-price.model");
          const { defaultMetalPrices } = require("./seed-metal-prices");

          for (const metalPrice of defaultMetalPrices) {
            const existing = await MetalPrice.findOne({ metalType: metalPrice.metalType });
            if (!existing) {
              await MetalPrice.create({
                metalType: metalPrice.metalType,
                pricePerGram: metalPrice.pricePerGram,
                currency: "INR",
                source: PRICE_SOURCES.MANUAL,
                updatedBy: "System Initialization",
                lastUpdated: new Date(),
                isActive: true
              });
              console.log(`  Created Metal Price: ${metalPrice.displayName} - ₹${metalPrice.pricePerGram}/gram`);
            }
          }

          console.log(`  ✓ Metal Prices seeded`);
        }

      } catch (seedError) {
        console.error(`  ✗ Error in ${seed.name}:`, seedError.message);
      }
    }

    // Print summary
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║                    Seeding Complete!                    ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Count documents
    const Material = require("../models/material.model");
    const Gender = require("../models/gender.model");
    const Item = require("../models/item.model");
    const Category = require("../models/category.model");
    const { PriceComponent } = require("../models/price-component.model");
    const { MetalPrice } = require("../models/metal-price.model");

    console.log("Database Summary:");
    console.log("─".repeat(40));
    console.log(`  Materials:        ${await Material.countDocuments()}`);
    console.log(`  Genders:          ${await Gender.countDocuments()}`);
    console.log(`  Items:            ${await Item.countDocuments()}`);
    console.log(`  Categories:       ${await Category.countDocuments()}`);
    console.log(`  Price Components: ${await PriceComponent.countDocuments()}`);
    console.log(`  Metal Prices:     ${await MetalPrice.countDocuments()}`);
    console.log("─".repeat(40));

  } catch (error) {
    console.error("Seeding failed:", error);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB disconnected");
  }
};

// Run
runAllSeeds();
