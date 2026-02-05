/**
 * Migration: Simplify Pricing System
 *
 * This migration performs the following:
 * 1. Convert ALL FORMULA components to PERCENTAGE with default 5%
 * 2. Add metalPriceMode: "AUTO" to metal_cost components
 * 3. Remove formula/formulaChips fields from all documents
 * 4. Update SubcategoryPricing documents
 * 5. Update Product pricingConfig for CUSTOM_DYNAMIC products
 *
 * Usage: MONGO_URI="mongodb://..." node migrations/simplify-pricing-system.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const { PriceComponent } = require("../models/price-component.model");
const SubcategoryPricing = require("../models/subcategory-pricing.model");
const { Product } = require("../models/product.model");

const fs = require("fs");
const path = require("path");

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is required in environment");
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { connectTimeoutMS: 10000 });
  console.log("Connected to MongoDB");

  // Prepare backup directory
  const backupDir = path.join(__dirname, "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  const stats = {
    priceComponents: { updated: 0, metalCostUpdated: 0 },
    subcategoryPricing: { updated: 0 },
    products: { updated: 0 },
  };

  try {
    // =========================================================================
    // 1. Update PriceComponents
    // =========================================================================
    console.log("\n=== Phase 1: Update PriceComponents ===");

    const allPriceComponents = await PriceComponent.find({});
    console.log(`Found ${allPriceComponents.length} PriceComponents`);

    // Backup all price components
    fs.writeFileSync(
      path.join(backupDir, `price-components-${ts}.json`),
      JSON.stringify(allPriceComponents.map((pc) => pc.toObject()), null, 2)
    );
    console.log("PriceComponents backup saved");

    for (const pc of allPriceComponents) {
      let changed = false;
      const notes = [];

      // Convert FORMULA to PERCENTAGE
      if (pc.calculationType === "FORMULA") {
        notes.push(`Converted from FORMULA to PERCENTAGE; original formula: ${pc.formula || "none"}`);
        pc.calculationType = "PERCENTAGE";
        pc.defaultValue = pc.defaultValue || 5;
        pc.percentageOf = pc.percentageOf || "subtotal";
        changed = true;
      }

      // Add metalPriceMode to metal_cost component
      if (pc.key === "metal_cost" && !pc.metalPriceMode) {
        pc.metalPriceMode = "AUTO";
        notes.push("Added metalPriceMode: AUTO");
        changed = true;
        stats.priceComponents.metalCostUpdated++;
      }

      // Remove formula fields
      if (pc.formula !== undefined || pc.formulaChips !== undefined) {
        pc.formula = undefined;
        pc.formulaChips = undefined;
        changed = true;
      }

      if (changed) {
        if (notes.length > 0) {
          const migrationNote = `\n[MIGRATION ${ts}] ${notes.join("; ")}`;
          pc.description = (pc.description || "") + migrationNote;
        }
        await pc.save();
        stats.priceComponents.updated++;
        console.log(`  Updated PriceComponent: ${pc.key}`);
      }
    }

    console.log(`Updated ${stats.priceComponents.updated} PriceComponents`);

    // =========================================================================
    // 2. Update SubcategoryPricing documents
    // =========================================================================
    console.log("\n=== Phase 2: Update SubcategoryPricing ===");

    const allSubcategoryPricing = await SubcategoryPricing.find({});
    console.log(`Found ${allSubcategoryPricing.length} SubcategoryPricing documents`);

    // Backup
    fs.writeFileSync(
      path.join(backupDir, `subcategory-pricing-${ts}.json`),
      JSON.stringify(allSubcategoryPricing.map((sp) => sp.toObject()), null, 2)
    );
    console.log("SubcategoryPricing backup saved");

    for (const sp of allSubcategoryPricing) {
      let changed = false;

      for (const comp of sp.components) {
        // Convert FORMULA to PERCENTAGE
        if (comp.calculationType === "FORMULA") {
          comp.originalCalculationType = comp.calculationType;
          comp.originalFormula = comp.formula;
          comp.calculationType = "PERCENTAGE";
          comp.value = comp.value || 5;
          comp.percentageOf = comp.percentageOf || "subtotal";
          changed = true;
        }

        // Add metalPriceMode to metal_cost component
        if (comp.componentKey === "metal_cost" && !comp.metalPriceMode) {
          comp.metalPriceMode = "AUTO";
          changed = true;
        }

        // Remove formula fields
        if (comp.formula !== undefined) {
          comp.formula = undefined;
          changed = true;
        }
        if (comp.formulaChips !== undefined) {
          comp.formulaChips = undefined;
          changed = true;
        }
      }

      if (changed) {
        await sp.save();
        stats.subcategoryPricing.updated++;
      }
    }

    console.log(`Updated ${stats.subcategoryPricing.updated} SubcategoryPricing documents`);

    // =========================================================================
    // 3. Update Products with CUSTOM_DYNAMIC pricing
    // =========================================================================
    console.log("\n=== Phase 3: Update Products ===");

    const productsWithPricing = await Product.find({
      pricingMode: "CUSTOM_DYNAMIC",
      "pricingConfig.components": { $exists: true, $ne: [] },
    });
    console.log(`Found ${productsWithPricing.length} Products with CUSTOM_DYNAMIC pricing`);

    // Backup
    fs.writeFileSync(
      path.join(backupDir, `products-custom-pricing-${ts}.json`),
      JSON.stringify(productsWithPricing.map((p) => p.toObject()), null, 2)
    );
    console.log("Products backup saved");

    for (const product of productsWithPricing) {
      let changed = false;
      const comps = (product.pricingConfig && product.pricingConfig.components) || [];

      for (const comp of comps) {
        // Convert FORMULA to PERCENTAGE
        if (comp.calculationType === "FORMULA") {
          comp.originalCalculationType = comp.calculationType;
          comp.originalFormula = comp.formula;
          comp.calculationType = "PERCENTAGE";
          comp.value = comp.value || 5;
          comp.percentageOf = comp.percentageOf || "subtotal";
          changed = true;
        }

        // Add metalPriceMode to metal_cost component
        if (comp.componentKey === "metal_cost" && !comp.metalPriceMode) {
          comp.metalPriceMode = "AUTO";
          changed = true;
        }

        // Remove formula fields
        if (comp.formula !== undefined) {
          comp.formula = undefined;
          changed = true;
        }
        if (comp.formulaChips !== undefined) {
          comp.formulaChips = undefined;
          changed = true;
        }
      }

      if (changed) {
        await product.save();
        stats.products.updated++;
      }
    }

    console.log(`Updated ${stats.products.updated} Products`);

    // =========================================================================
    // Summary
    // =========================================================================
    console.log("\n=== Migration Summary ===");
    console.log(`PriceComponents updated: ${stats.priceComponents.updated}`);
    console.log(`  - Metal cost with metalPriceMode: ${stats.priceComponents.metalCostUpdated}`);
    console.log(`SubcategoryPricing updated: ${stats.subcategoryPricing.updated}`);
    console.log(`Products updated: ${stats.products.updated}`);
    console.log(`\nBackups saved to: ${backupDir}`);
    console.log("\nMigration completed successfully!");

  } catch (err) {
    console.error("\nMigration failed:", err);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
