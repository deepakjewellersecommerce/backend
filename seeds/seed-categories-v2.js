/**
 * Seed Script: Category Hierarchy V2 (New Metal Group Structure)
 * Seeds Materials with purity formulas, Genders, Items, and sample Categories
 *
 * IMPORTANT: Run seed-metal-groups.js FIRST before running this
 * Run: node seeds/seed-categories-v2.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const MetalGroup = require("../models/metal-group.model");
const Material = require("../models/material.model");
const Gender = require("../models/gender.model");
const Item = require("../models/item.model");
const Category = require("../models/category.model");

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

// Materials (Level 1) - Now with metalGroup references and purity formulas
const getMaterialsData = async () => {
  // Get metal group references
  const goldGroup = await MetalGroup.findOne({ apiKey: "mcx_gold" });
  const silverGroup = await MetalGroup.findOne({ apiKey: "mcx_silver" });
  const platinumGroup = await MetalGroup.findOne({ apiKey: "mcx_platinum" });

  if (!goldGroup || !silverGroup || !platinumGroup) {
    throw new Error(
      "Metal Groups not found. Please run seed-metal-groups.js first!"
    );
  }

  return [
    // GOLD MATERIALS
    {
      name: "Gold 24K",
      displayName: "Gold (24K)",
      slug: "gold-24k",
      idAttribute: "G24",
      metalGroup: goldGroup._id,
      purityType: "BASE",
      purityNumerator: 99.995, // 24K is base purity
      purityDenominator: 99.995,
      purityFormula: "99.995 / 99.995",
      purityPercentage: 100.0,
      pricePerGram: goldGroup.basePrice * 1, // 100% of base price
      lastCalculated: new Date(),
      priceOverride: {
        isActive: false,
        overridePrice: null,
        reason: null,
        setBy: null,
        setAt: null
      },
      sortOrder: 1,
      isActive: true,
      description: "24 Karat pure gold",
      metalType: "GOLD_24K" // Legacy field for migration
    },
    {
      name: "Gold 22K",
      displayName: "Gold (22K)",
      slug: "gold-22k",
      idAttribute: "G22",
      metalGroup: goldGroup._id,
      purityType: "DERIVED",
      purityNumerator: 91.6667, // 22K purity
      purityDenominator: 99.995,
      purityFormula: "91.6667 / 99.995",
      purityPercentage: 91.67,
      pricePerGram: goldGroup.basePrice * (91.6667 / 99.995),
      lastCalculated: new Date(),
      priceOverride: {
        isActive: false,
        overridePrice: null,
        reason: null,
        setBy: null,
        setAt: null
      },
      sortOrder: 2,
      isActive: true,
      description: "22 Karat gold - most common for jewelry",
      metalType: "GOLD_22K" // Legacy field
    },
    {
      name: "Gold 18K",
      displayName: "Gold (18K)",
      slug: "gold-18k",
      idAttribute: "G18",
      metalGroup: goldGroup._id,
      purityType: "DERIVED",
      purityNumerator: 75.0, // 18K purity
      purityDenominator: 99.995,
      purityFormula: "75.0 / 99.995",
      purityPercentage: 75.0,
      pricePerGram: goldGroup.basePrice * (75.0 / 99.995),
      lastCalculated: new Date(),
      priceOverride: {
        isActive: false,
        overridePrice: null,
        reason: null,
        setBy: null,
        setAt: null
      },
      sortOrder: 3,
      isActive: true,
      description: "18 Karat gold - durable for everyday wear"
    },

    // SILVER MATERIALS
    {
      name: "Silver 999",
      displayName: "Silver (999)",
      slug: "silver-999",
      idAttribute: "S999",
      metalGroup: silverGroup._id,
      purityType: "BASE",
      purityNumerator: 99.9, // Pure silver
      purityDenominator: 99.9,
      purityFormula: "99.9 / 99.9",
      purityPercentage: 100.0,
      pricePerGram: silverGroup.basePrice * 1,
      lastCalculated: new Date(),
      priceOverride: {
        isActive: false,
        overridePrice: null,
        reason: null,
        setBy: null,
        setAt: null
      },
      sortOrder: 4,
      isActive: true,
      description: "Fine silver - 99.9% purity",
      metalType: "SILVER_999" // Legacy field
    },
    {
      name: "Silver 925",
      displayName: "Silver (925)",
      slug: "silver-925",
      idAttribute: "S925",
      metalGroup: silverGroup._id,
      purityType: "DERIVED",
      purityNumerator: 92.5, // Sterling silver
      purityDenominator: 99.9,
      purityFormula: "92.5 / 99.9",
      purityPercentage: 92.59,
      pricePerGram: silverGroup.basePrice * (92.5 / 99.9),
      lastCalculated: new Date(),
      priceOverride: {
        isActive: false,
        overridePrice: null,
        reason: null,
        setBy: null,
        setAt: null
      },
      sortOrder: 5,
      isActive: true,
      description: "Sterling silver - 92.5% purity",
      metalType: "SILVER_925" // Legacy field
    },

    // PLATINUM MATERIALS
    {
      name: "Platinum",
      displayName: "Platinum",
      slug: "platinum",
      idAttribute: "PT",
      metalGroup: platinumGroup._id,
      purityType: "BASE",
      purityNumerator: 95.0, // Platinum purity
      purityDenominator: 95.0,
      purityFormula: "95.0 / 95.0",
      purityPercentage: 100.0,
      pricePerGram: platinumGroup.basePrice * 1,
      lastCalculated: new Date(),
      priceOverride: {
        isActive: false,
        overridePrice: null,
        reason: null,
        setBy: null,
        setAt: null
      },
      sortOrder: 6,
      isActive: true,
      description: "Platinum - precious white metal",
      metalType: "PLATINUM" // Legacy field
    }
  ];
};

// Genders (Level 2) - No changes
const genders = [
  { name: "Female", slug: "female", idAttribute: "F", sortOrder: 1 },
  { name: "Male", slug: "male", idAttribute: "M", sortOrder: 2 },
  { name: "Unisex", slug: "unisex", idAttribute: "U", sortOrder: 3 },
  { name: "Kids", slug: "kids", idAttribute: "K", sortOrder: 4 }
];

// Items (Level 3) - No changes
const items = [
  {
    name: "Necklace",
    slug: "necklace",
    idAttribute: "N",
    description: "Neck jewelry including chains and pendants",
    sortOrder: 1
  },
  {
    name: "Ring",
    slug: "ring",
    idAttribute: "R",
    description: "Finger rings for all occasions",
    sortOrder: 2
  },
  {
    name: "Earring",
    slug: "earring",
    idAttribute: "E",
    description: "Ear jewelry including studs, hoops, and drops",
    sortOrder: 3
  },
  {
    name: "Bracelet",
    slug: "bracelet",
    idAttribute: "B",
    description: "Wrist jewelry including bangles and chains",
    sortOrder: 4
  },
  {
    name: "Bangle",
    slug: "bangle",
    idAttribute: "BG",
    description: "Traditional bangles and kadas",
    sortOrder: 5
  },
  {
    name: "Pendant",
    slug: "pendant",
    idAttribute: "P",
    description: "Pendants without chains",
    sortOrder: 6
  },
  {
    name: "Chain",
    slug: "chain",
    idAttribute: "C",
    description: "Chains for neck and waist",
    sortOrder: 7
  },
  {
    name: "Anklet",
    slug: "anklet",
    idAttribute: "A",
    description: "Ankle jewelry and payals",
    sortOrder: 8
  },
  {
    name: "Nose Pin",
    slug: "nose-pin",
    idAttribute: "NP",
    description: "Nose rings and studs",
    sortOrder: 9
  },
  {
    name: "Mangalsutra",
    slug: "mangalsutra",
    idAttribute: "MS",
    description: "Traditional mangalsutra designs",
    sortOrder: 10
  }
];

// Sample Categories (Level 4)
const sampleCategories = [
  { name: "Temple", idAttribute: "T", description: "Traditional temple jewelry designs" },
  { name: "Bridal", idAttribute: "BR", description: "Wedding and bridal jewelry" },
  { name: "Daily Wear", idAttribute: "DW", description: "Everyday wear jewelry" },
  { name: "Antique", idAttribute: "AN", description: "Antique and vintage styles" },
  { name: "Modern", idAttribute: "MD", description: "Contemporary modern designs" },
  { name: "Minimalist", idAttribute: "MN", description: "Simple and minimalist designs" },
  { name: "Traditional", idAttribute: "TR", description: "Traditional regional designs" },
  { name: "Gemstone", idAttribute: "GS", description: "Jewelry with gemstone accents" }
];

const seedMaterials = async () => {
  console.log("Seeding Materials with Purity Formulas...");

  const materials = await getMaterialsData();

  for (const material of materials) {
    const existing = await Material.findOne({ idAttribute: material.idAttribute });

    if (existing) {
      // Check if existing material has metalGroup (new structure)
      if (!existing.metalGroup) {
        // Old material without metalGroup - update it
        console.log(`  Updating legacy material: ${material.name} [${material.idAttribute}]`);

        existing.metalGroup = material.metalGroup;
        existing.purityType = material.purityType;
        existing.purityNumerator = material.purityNumerator;
        existing.purityDenominator = material.purityDenominator;
        existing.purityFormula = material.purityFormula;
        existing.purityPercentage = material.purityPercentage;
        existing.pricePerGram = material.pricePerGram;
        existing.lastCalculated = material.lastCalculated;
        existing.displayName = material.displayName || material.name;
        existing.description = material.description;

        await existing.save();
        console.log(`  ✓ Updated: ${existing.name} - ${existing.purityPercentage}% purity - ₹${existing.pricePerGram.toFixed(2)}/g`);
      } else {
        console.log(`  Material exists: ${material.name} [${material.idAttribute}]`);
      }
      continue;
    }

    const created = await Material.create(material);
    console.log(
      `  Created: ${created.name} [${created.idAttribute}] - ${created.purityPercentage}% purity - ₹${created.pricePerGram.toFixed(2)}/g`
    );
  }

  console.log("Materials seeded successfully\n");
};

const seedGenders = async () => {
  console.log("Seeding Genders...");

  for (const gender of genders) {
    const existing = await Gender.findOne({ idAttribute: gender.idAttribute });
    if (existing) {
      console.log(`  Gender exists: ${gender.name}`);
      continue;
    }

    await Gender.create(gender);
    console.log(`  Created: ${gender.name} [${gender.idAttribute}]`);
  }

  console.log("Genders seeded successfully\n");
};

const seedItems = async () => {
  console.log("Seeding Items...");

  for (const item of items) {
    const existing = await Item.findOne({ idAttribute: item.idAttribute });
    if (existing) {
      console.log(`  Item exists: ${item.name}`);
      continue;
    }

    await Item.create(item);
    console.log(`  Created: ${item.name} [${item.idAttribute}]`);
  }

  console.log("Items seeded successfully\n");
};

const seedSampleCategories = async () => {
  console.log("Seeding Sample Categories...");

  // Get references
  const gold22k = await Material.findOne({ idAttribute: "G22" });
  const silver999 = await Material.findOne({ idAttribute: "S999" });
  const female = await Gender.findOne({ idAttribute: "F" });
  const necklace = await Item.findOne({ idAttribute: "N" });
  const earring = await Item.findOne({ idAttribute: "E" });

  if (!gold22k || !silver999 || !female || !necklace) {
    console.log("  Prerequisite data missing, skipping sample categories");
    return;
  }

  // Create sample categories for Gold 22K - Female - Necklace
  for (const cat of sampleCategories.slice(0, 4)) {
    const existing = await Category.findOne({
      materialId: gold22k._id,
      genderId: female._id,
      itemId: necklace._id,
      idAttribute: cat.idAttribute
    });

    if (existing) {
      console.log(`  Category exists: ${cat.name}`);
      continue;
    }

    await Category.create({
      ...cat,
      slug: cat.name.toLowerCase().replace(/\s+/g, "-"),
      materialId: gold22k._id,
      genderId: female._id,
      itemId: necklace._id
    });
    console.log(`  Created: Gold 22K > Female > Necklace > ${cat.name}`);
  }

  // Create a few more sample categories for variety
  const silverFemaleEarring = {
    name: "Daily Wear",
    idAttribute: "DW",
    description: "Everyday silver earrings",
    slug: "daily-wear-silver-earrings",
    materialId: silver999._id,
    genderId: female._id,
    itemId: earring._id
  };

  const existingSilver = await Category.findOne({
    materialId: silver999._id,
    genderId: female._id,
    itemId: earring._id,
    idAttribute: "DW"
  });

  if (!existingSilver) {
    await Category.create(silverFemaleEarring);
    console.log(`  Created: Silver 999 > Female > Earring > Daily Wear`);
  }

  console.log("Sample Categories seeded successfully\n");
};

const runSeeds = async () => {
  await connectDB();

  console.log("\n========================================");
  console.log("Starting Category Hierarchy V2 Seeding");
  console.log("========================================\n");

  try {
    await seedMaterials();
    await seedGenders();
    await seedItems();
    await seedSampleCategories();

    console.log("========================================");
    console.log("Category Seeding Complete!");
    console.log("========================================\n");

    // Summary
    const materialCount = await Material.countDocuments({});
    const genderCount = await Gender.countDocuments({});
    const itemCount = await Item.countDocuments({});
    const categoryCount = await Category.countDocuments({});

    console.log("Summary:");
    console.log(`  Materials: ${materialCount}`);
    console.log(`  Genders: ${genderCount}`);
    console.log(`  Items: ${itemCount}`);
    console.log(`  Categories: ${categoryCount}\n`);

    // Display materials with pricing
    const materials = await Material.find()
      .populate("metalGroup", "name mcxPrice premium basePrice")
      .sort({ sortOrder: 1 });

    console.log("Materials with Pricing:");
    console.log("─".repeat(90));
    console.log(
      "Material".padEnd(20) +
        "Purity".padEnd(12) +
        "Metal Group".padEnd(15) +
        "Base Price".padEnd(15) +
        "Material Price"
    );
    console.log("─".repeat(90));

    for (const mat of materials) {
      const basePrice = mat.metalGroup?.basePrice || 0;
      const purity = mat.purityPercentage || 0;
      const price = mat.pricePerGram || 0;
      const metalGroupName = mat.metalGroup?.name || "N/A";

      console.log(
        `${mat.name.padEnd(20)}` +
          `${purity.toFixed(2)}%`.padEnd(12) +
          `${metalGroupName.padEnd(15)}` +
          `₹${basePrice.toFixed(2).padEnd(13)}` +
          `₹${price.toFixed(2)}/g`
      );
    }

    console.log("─".repeat(90));
  } catch (error) {
    console.error("Seeding error:", error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log("\nMongoDB disconnected");
  }
};

// Run if executed directly
if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds, genders, items, sampleCategories };
