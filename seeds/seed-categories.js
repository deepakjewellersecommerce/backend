/**
 * Seed Script: Category Hierarchy (Levels 1-4)
 * Seeds Materials, Genders, Items, and sample Categories
 *
 * Run: node seeds/seed-categories.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const Material = require("../models/material.model");
const Gender = require("../models/gender.model");
const Item = require("../models/item.model");
const Category = require("../models/category.model");
const { METAL_TYPES } = require("../models/metal-price.model");

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

// Materials (Level 1)
const materials = [
  {
    name: "Gold (24K)",
    slug: "gold-24k",
    idAttribute: "G24",
    metalType: METAL_TYPES.GOLD_24K,
    sortOrder: 1
  },
  {
    name: "Gold (22K)",
    slug: "gold-22k",
    idAttribute: "G22",
    metalType: METAL_TYPES.GOLD_22K,
    sortOrder: 2
  },
  {
    name: "Silver (999)",
    slug: "silver-999",
    idAttribute: "S999",
    metalType: METAL_TYPES.SILVER_999,
    sortOrder: 3
  },
  {
    name: "Silver (925)",
    slug: "silver-925",
    idAttribute: "S925",
    metalType: METAL_TYPES.SILVER_925,
    sortOrder: 4
  },
  {
    name: "Platinum",
    slug: "platinum",
    idAttribute: "PT",
    metalType: METAL_TYPES.PLATINUM,
    sortOrder: 5
  }
];

// Genders (Level 2)
const genders = [
  { name: "Female", slug: "female", idAttribute: "F", sortOrder: 1 },
  { name: "Male", slug: "male", idAttribute: "M", sortOrder: 2 },
  { name: "Unisex", slug: "unisex", idAttribute: "U", sortOrder: 3 },
  { name: "Kids", slug: "kids", idAttribute: "K", sortOrder: 4 }
];

// Items (Level 3)
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
  // Temple jewelry
  { name: "Temple", idAttribute: "T", description: "Traditional temple jewelry designs" },
  // Bridal
  { name: "Bridal", idAttribute: "BR", description: "Wedding and bridal jewelry" },
  // Daily Wear
  { name: "Daily Wear", idAttribute: "DW", description: "Everyday wear jewelry" },
  // Antique
  { name: "Antique", idAttribute: "AN", description: "Antique and vintage styles" },
  // Modern
  { name: "Modern", idAttribute: "MD", description: "Contemporary modern designs" },
  // Minimalist
  { name: "Minimalist", idAttribute: "MN", description: "Simple and minimalist designs" },
  // Traditional
  { name: "Traditional", idAttribute: "TR", description: "Traditional regional designs" },
  // Gemstone
  { name: "Gemstone", idAttribute: "GS", description: "Jewelry with gemstone accents" }
];

const seedMaterials = async () => {
  console.log("Seeding Materials...");

  for (const material of materials) {
    const existing = await Material.findOne({ metalType: material.metalType });
    if (existing) {
      console.log(`  Material exists: ${material.name}`);
      continue;
    }

    await Material.create(material);
    console.log(`  Created: ${material.name} [${material.idAttribute}]`);
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
  const male = await Gender.findOne({ idAttribute: "M" });
  const necklace = await Item.findOne({ idAttribute: "N" });
  const ring = await Item.findOne({ idAttribute: "R" });
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
  // Silver 999 - Female - Earring - Daily Wear
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
  console.log("Starting Category Hierarchy Seeding");
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
    console.log(`  Categories: ${categoryCount}`);
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

module.exports = { runSeeds, materials, genders, items, sampleCategories };
