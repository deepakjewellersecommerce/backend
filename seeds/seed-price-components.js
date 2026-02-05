/**
 * Seed Script: Default Price Components
 * Seeds system price components (Metal Cost, Making Charges, GST, etc.)
 *
 * Run: node seeds/seed-price-components.js
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const {
  PriceComponent,
  CALCULATION_TYPES
} = require("../models/price-component.model");

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

// Default System Price Components
const systemComponents = [
  {
    name: "Metal Cost",
    key: "metal_cost",
    description: "Base metal cost calculated from net weight and metal rate",
    calculationType: CALCULATION_TYPES.PER_GRAM,
    defaultValue: 1, // Multiplier (1 = netWeight × metalRate)
    metalPriceMode: "AUTO", // AUTO uses system rate, MANUAL allows admin override
    isSystemComponent: true,
    allowsFreeze: false, // Metal cost cannot be frozen (always uses live rate)
    isActive: true,
    isVisible: true,
    sortOrder: 1
  },
  {
    name: "Making Charges",
    key: "making_charges",
    description: "Craftmanship and labor charges",
    calculationType: CALCULATION_TYPES.PERCENTAGE,
    defaultValue: 15, // 15% of metal cost
    percentageOf: "metalCost",
    isSystemComponent: true,
    allowsFreeze: true,
    isActive: true,
    isVisible: true,
    sortOrder: 2
  },
  {
    name: "Wastage Charges",
    key: "wastage_charges",
    description: "Material wastage during manufacturing",
    calculationType: CALCULATION_TYPES.PERCENTAGE,
    defaultValue: 5, // 5% of metalCost
    percentageOf: "metalCost",
    isSystemComponent: true,
    allowsFreeze: true,
    isActive: true,
    isVisible: true,
    sortOrder: 3
  },
  {
    name: "Hallmarking Charges",
    key: "hallmarking",
    description: "BIS Hallmarking certification charges",
    calculationType: CALCULATION_TYPES.FIXED,
    defaultValue: 45, // ₹45 per piece
    isSystemComponent: true,
    allowsFreeze: true,
    isActive: true,
    isVisible: true,
    sortOrder: 4
  },
  {
    name: "Packaging",
    key: "packaging",
    description: "Gift packaging and presentation",
    calculationType: CALCULATION_TYPES.FIXED,
    defaultValue: 50, // ₹50 per piece
    isSystemComponent: true,
    allowsFreeze: true,
    isActive: true,
    isVisible: true,
    sortOrder: 5
  },
  {
    name: "GST",
    key: "gst",
    description: "Goods and Services Tax (3% for gold/silver jewelry)",
    calculationType: CALCULATION_TYPES.PERCENTAGE,
    defaultValue: 3, // 3% GST for gold/silver jewelry
    percentageOf: "subtotal",
    isSystemComponent: true,
    allowsFreeze: false, // Tax cannot be frozen
    isActive: true,
    isVisible: true,
    sortOrder: 100 // Always last
  }
];

// Optional custom components (examples)
const customComponentExamples = [
  {
    name: "Stone Setting",
    key: "stone_setting",
    description: "Charges for setting gemstones",
    calculationType: CALCULATION_TYPES.FIXED,
    defaultValue: 200, // ₹200 per stone
    isSystemComponent: false,
    allowsFreeze: true,
    isActive: false, // Not active by default
    isVisible: true,
    sortOrder: 6
  },
  {
    name: "Rhodium Plating",
    key: "rhodium_plating",
    description: "Anti-tarnish rhodium plating for silver",
    calculationType: CALCULATION_TYPES.PERCENTAGE,
    defaultValue: 5, // 5% of metal cost
    percentageOf: "metalCost",
    isSystemComponent: false,
    allowsFreeze: true,
    isActive: false,
    isVisible: true,
    sortOrder: 7
  },
  {
    name: "Polishing",
    key: "polishing",
    description: "Mirror polishing finish charges",
    calculationType: CALCULATION_TYPES.FIXED,
    defaultValue: 100, // ₹100
    isSystemComponent: false,
    allowsFreeze: true,
    isActive: false,
    isVisible: true,
    sortOrder: 8
  },
  {
    name: "Custom Engraving",
    key: "custom_engraving",
    description: "Personalized engraving charges",
    calculationType: CALCULATION_TYPES.FIXED,
    defaultValue: 250, // ₹250
    isSystemComponent: false,
    allowsFreeze: true,
    isActive: false,
    isVisible: true,
    sortOrder: 9
  }
];

const seedSystemComponents = async () => {
  console.log("Seeding System Price Components...");

  for (const component of systemComponents) {
    const existing = await PriceComponent.findOne({ key: component.key });
    if (existing) {
      console.log(`  Component exists: ${component.name}`);
      continue;
    }

    await PriceComponent.create(component);
    console.log(`  Created: ${component.name} [${component.key}]`);
  }

  console.log("System Components seeded successfully\n");
};

const seedCustomComponentExamples = async () => {
  console.log("Seeding Custom Component Examples (inactive by default)...");

  for (const component of customComponentExamples) {
    const existing = await PriceComponent.findOne({ key: component.key });
    if (existing) {
      console.log(`  Component exists: ${component.name}`);
      continue;
    }

    await PriceComponent.create(component);
    console.log(`  Created (inactive): ${component.name} [${component.key}]`);
  }

  console.log("Custom Component Examples seeded successfully\n");
};

const runSeeds = async () => {
  await connectDB();

  console.log("\n========================================");
  console.log("Starting Price Components Seeding");
  console.log("========================================\n");

  try {
    await seedSystemComponents();
    await seedCustomComponentExamples();

    console.log("========================================");
    console.log("Price Components Seeding Complete!");
    console.log("========================================\n");

    // Summary
    const systemCount = await PriceComponent.countDocuments({
      isSystemComponent: true
    });
    const customCount = await PriceComponent.countDocuments({
      isSystemComponent: false
    });
    const activeCount = await PriceComponent.countDocuments({ isActive: true });

    console.log("Summary:");
    console.log(`  System Components: ${systemCount}`);
    console.log(`  Custom Components: ${customCount}`);
    console.log(`  Active Components: ${activeCount}`);
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

module.exports = {
  runSeeds,
  systemComponents,
  customComponentExamples
};
