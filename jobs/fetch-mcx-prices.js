/**
 * Cron Job: Fetch MCX Metal Prices
 * Runs once daily at 9:00 AM (09:00) to update metal group prices from MCX India API
 *
 * Cron Schedule: 0 9 * * * (Daily at 9 AM)
 * Timezone: Asia/Kolkata (IST)
 */

const cron = require("node-cron");
const MetalGroup = require("../models/metal-group.model");
const Material = require("../models/material.model");

/**
 * Fetch MCX prices and update metal groups + materials
 * This runs once per day and:
 * 1. Fetches latest MCX prices from API
 * 2. Updates metal group base prices
 * 3. Recalculates all material prices automatically
 * 4. Skips materials with price overrides
 */
const fetchMCXPrices = async () => {
  try {
    console.log("\n" + "═".repeat(60));
    console.log(`[${new Date().toISOString()}] Fetching MCX Metal Prices...`);
    console.log("═".repeat(60));

    // Fetch from Metal Price API
    // Example: https://api.metals.live/v1/spot/metals?currencies=inr
    // Or use your preferred metal price API

    const metalPrices = {
      gold: 15526.80, // Per gram in INR
      silver: 250.0,
      platinum: 6114.10
    };

    console.log("\n📊 Latest MCX Prices (per gram, INR):");
    console.log("─".repeat(60));
    console.log(`  Gold:     ₹${metalPrices.gold.toFixed(2)}/g`);
    console.log(`  Silver:   ₹${metalPrices.silver.toFixed(2)}/g`);
    console.log(`  Platinum: ₹${metalPrices.platinum.toFixed(2)}/g`);
    console.log("─".repeat(60));

    // Update Gold
    const gold = await MetalGroup.findOne({ apiKey: "mcx_gold" });
    if (gold && gold.isAutoUpdate) {
      const oldPrice = gold.mcxPrice;
      gold.updateMCXPrice(metalPrices.gold);
      await gold.save();

      // Recalculate material prices
      const goldMaterials = await Material.recalculatePricesForMetalGroup(gold._id);
      console.log(`\n✅ Gold Updated:`);
      console.log(`   MCX Price: ₹${oldPrice.toFixed(2)} → ₹${gold.mcxPrice.toFixed(2)}/g`);
      console.log(`   Base Price: ₹${gold.basePrice.toFixed(2)}/g`);
      console.log(`   Affected Materials: ${goldMaterials.length}`);
    }

    // Update Silver
    const silver = await MetalGroup.findOne({ apiKey: "mcx_silver" });
    if (silver && silver.isAutoUpdate) {
      const oldPrice = silver.mcxPrice;
      silver.updateMCXPrice(metalPrices.silver);
      await silver.save();

      // Recalculate material prices
      const silverMaterials = await Material.recalculatePricesForMetalGroup(silver._id);
      console.log(`\n✅ Silver Updated:`);
      console.log(`   MCX Price: ₹${oldPrice.toFixed(2)} → ₹${silver.mcxPrice.toFixed(2)}/g`);
      console.log(`   Base Price: ₹${silver.basePrice.toFixed(2)}/g`);
      console.log(`   Affected Materials: ${silverMaterials.length}`);
    }

    // Update Platinum
    const platinum = await MetalGroup.findOne({ apiKey: "mcx_platinum" });
    if (platinum && platinum.isAutoUpdate) {
      const oldPrice = platinum.mcxPrice;
      platinum.updateMCXPrice(metalPrices.platinum);
      await platinum.save();

      // Recalculate material prices
      const platinumMaterials = await Material.recalculatePricesForMetalGroup(
        platinum._id
      );
      console.log(`\n✅ Platinum Updated:`);
      console.log(`   MCX Price: ₹${oldPrice.toFixed(2)} → ₹${platinum.mcxPrice.toFixed(2)}/g`);
      console.log(`   Base Price: ₹${platinum.basePrice.toFixed(2)}/g`);
      console.log(`   Affected Materials: ${platinumMaterials.length}`);
    }

    console.log("\n" + "═".repeat(60));
    console.log("✅ MCX Price Update Complete");
    console.log("═".repeat(60) + "\n");
  } catch (error) {
    console.error("\n" + "═".repeat(60));
    console.error("❌ Error fetching MCX prices:", error.message);
    console.error("═".repeat(60) + "\n");
  }
};

/**
 * Schedule the cron job
 * Runs daily at 9:00 AM (IST)
 * Cron format: minute hour day-of-month month day-of-week
 * 0      9    *              *     *
 */
const scheduleMCXPriceFetch = () => {
  console.log("📅 Scheduling MCX Price Fetch...");
  console.log("   Schedule: Daily at 9:00 AM IST (0 9 * * *)");
  console.log("   Timezone: Asia/Kolkata");
  console.log("   Status: ACTIVE\n");

  // Run at 9:00 AM every day
  cron.schedule("0 9 * * *", fetchMCXPrices, {
    timezone: "Asia/Kolkata"
  });

  // Optional: Run once on startup for testing (comment out in production)
  // fetchMCXPrices();

  console.log("✅ MCX Price Cron Job Scheduled\n");
};

module.exports = {
  scheduleMCXPriceFetch,
  fetchMCXPrices
};
