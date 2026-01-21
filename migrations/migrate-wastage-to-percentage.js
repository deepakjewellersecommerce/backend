/**
 * One-off Migration:
 * Convert Wastage Charges from FORMULA --> PERCENTAGE (5% of subtotal)
 * - Updates system PriceComponent with key 'wastage_charges'
 * - Updates existing SubcategoryPricing components that used FORMULA for wastage
 * - Updates Product (CUSTOM_DYNAMIC) pricing configs that used FORMULA for wastage
 *
 * Usage: MONGO_URI="mongodb://..." node migrations/migrate-wastage-to-percentage.js
 */

const mongoose = require("mongoose");
require("dotenv").config();

const { PriceComponent } = require("../models/price-component.model");
const SubcategoryPricing = require("../models/subcategory-pricing.model");
const { Product } = require("../models/product.model");

async function run() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is required in environment");
    process.exit(1);
  }

  await mongoose.connect(mongoUri, { connectTimeoutMS: 10000 });
  console.log("Connected to MongoDB");

  try {
    const key = "wastage_charges";

    // Prepare backup directory
    const fs = require("fs");
    const path = require("path");
    const backupDir = path.join(__dirname, "backups");
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");

    // 1) Update PriceComponent
    const pc = await PriceComponent.findOne({ key });
    if (!pc) {
      console.warn(`PriceComponent not found: ${key}. Skipping component migration.`);
    } else {
      // backup price component
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      fs.writeFileSync(path.join(backupDir, `price-component-${key}-${ts}.json`), JSON.stringify(pc.toObject(), null, 2));

      const needsUpdate = pc.calculationType !== "PERCENTAGE" || pc.defaultValue !== 5 || pc.percentageOf !== "subtotal";

      if (!needsUpdate) {
        console.log("PriceComponent already updated. Skipping.");
      } else {
        const prevCalc = pc.calculationType;
        const prevFormula = pc.formula;
        const note = `\n[MIGRATION] Converted to PERCENTAGE 5% from ${prevCalc}${prevFormula ? `; legacy formula: ${prevFormula}` : ""} on ${new Date().toISOString()}`;

        pc.calculationType = "PERCENTAGE";
        pc.defaultValue = 5;
        pc.percentageOf = "subtotal";
        pc.formula = null;
        pc.formulaChips = [];
        pc.description = (pc.description || "") + note;

        await pc.save();
        console.log(`Updated PriceComponent '${key}' -> PERCENTAGE 5% and preserved note in description.`);
      }
    }

    // 2) Update SubcategoryPricing documents
    const subpricingMatches = await SubcategoryPricing.find({ 'components.componentKey': key, 'components.calculationType': 'FORMULA' });
    console.log(`Found ${subpricingMatches.length} SubcategoryPricing documents with legacy FORMULA for '${key}'.`);

    // backup matches
    try {
      fs.writeFileSync(path.join(backupDir, `subcategory-pricing-${key}-matches-${ts}.json`), JSON.stringify(subpricingMatches.map(s => s.toObject && s.toObject() || s), null, 2));
      console.log('SubcategoryPricing backup saved');
    } catch (e) {
      console.warn('Failed to write SubcategoryPricing backup:', e.message);
    }

    let subUpdatedCount = 0;
    for (const sp of subpricingMatches) {
      let changed = false;
      for (const comp of sp.components) {
        if (comp.componentKey === key && comp.calculationType === 'FORMULA') {
          const prevCalc = comp.calculationType;
          const prevFormula = comp.formula;

          comp.originalCalculationType = prevCalc;
          comp.originalFormula = prevFormula;

          comp.calculationType = 'PERCENTAGE';
          comp.value = 5;
          comp.percentageOf = 'subtotal';
          comp.formula = null;
          comp.formulaChips = [];

          changed = true;
        }
      }

      if (changed) {
        await sp.save();
        subUpdatedCount++;
      }
    }

    console.log(`Updated ${subUpdatedCount} SubcategoryPricing documents.`);

    // 3) Update Products with CUSTOM_DYNAMIC pricing configs
    const productMatches = await Product.find({ pricingMode: 'CUSTOM_DYNAMIC', 'pricingConfig.components.componentKey': key, 'pricingConfig.components.calculationType': 'FORMULA' });
    console.log(`Found ${productMatches.length} Products with legacy FORMULA for '${key}'.`);

    // backup products
    try {
      fs.writeFileSync(path.join(backupDir, `products-${key}-matches-${ts}.json`), JSON.stringify(productMatches.map(p => p.toObject && p.toObject() || p), null, 2));
      console.log('Products backup saved');
    } catch (e) {
      console.warn('Failed to write Products backup:', e.message);
    }

    let prodUpdatedCount = 0;
    for (const p of productMatches) {
      let changed = false;
      const comps = (p.pricingConfig && p.pricingConfig.components) || [];
      for (const comp of comps) {
        if (comp.componentKey === key && comp.calculationType === 'FORMULA') {
          comp.originalCalculationType = comp.calculationType;
          comp.originalFormula = comp.formula;

          comp.calculationType = 'PERCENTAGE';
          comp.value = 5;
          comp.percentageOf = 'subtotal';
          comp.formula = null;
          comp.formulaChips = [];

          changed = true;
        }
      }

      if (changed) {
        await p.save();
        prodUpdatedCount++;
      }
    }

    console.log(`Updated ${prodUpdatedCount} Products.`);

    console.log("Migration completed successfully.");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
