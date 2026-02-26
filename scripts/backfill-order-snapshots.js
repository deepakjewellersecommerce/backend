/**
 * Backfill Script: Populate priceBreakdownSnapshot on existing orders
 *
 * Finds orders where the `items` array is empty or items lack priceBreakdownSnapshot,
 * then rebuilds snapshots from current product data.
 *
 * Usage:
 *   node scripts/backfill-order-snapshots.js            # dry-run (default)
 *   node scripts/backfill-order-snapshots.js --execute   # actually write to DB
 */

"use strict";

const mongoose = require("mongoose");
require("dotenv").config();

// Model imports
const { User_Order: Order } = require("../models/order.model");
const { Product } = require("../models/product.model");

const args = process.argv.slice(2);
const isDryRun = !args.includes("--execute");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI not found in environment variables");
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected for backfill");
};

const backfill = async () => {
  await connectDB();

  console.log(`\nMode: ${isDryRun ? "DRY RUN (pass --execute to write)" : "EXECUTE"}\n`);

  // Find orders that need backfill:
  // 1. items array is empty (legacy orders that only have products)
  // 2. items exist but lack priceBreakdownSnapshot.metalCost
  const orders = await Order.find({
    $or: [
      { items: { $size: 0 } },
      { items: { $exists: false } },
      { "items.priceBreakdownSnapshot.metalCost": { $exists: false } }
    ]
  }).populate("products.product");

  console.log(`Found ${orders.length} orders needing backfill\n`);

  if (orders.length === 0) {
    console.log("Nothing to backfill.");
    await mongoose.disconnect();
    return;
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const order of orders) {
    const orderId = order.orderNumber || order._id;

    // If items already have snapshots, skip
    if (order.items.length > 0 && order.items[0]?.priceBreakdownSnapshot?.metalCost != null) {
      skipped++;
      continue;
    }

    // Build items from the legacy products array
    const sourceProducts = order.products || [];
    if (sourceProducts.length === 0) {
      console.log(`  [SKIP] Order ${orderId} — no products to backfill from`);
      skipped++;
      continue;
    }

    const newItems = [];
    let orderSubtotal = 0;
    let hasError = false;

    for (const legacyItem of sourceProducts) {
      const productId = legacyItem.product?._id || legacyItem.product;
      const product = await Product.findById(productId).populate("subcategoryId");

      if (!product) {
        console.log(`  [WARN] Order ${orderId} — product ${productId} not found in DB, skipping item`);
        continue;
      }

      try {
        // Calculate price to ensure priceBreakdown is populated
        if (!product.priceBreakdown || !product.priceBreakdown.lastCalculated) {
          await product.calculatePrice();
        }
      } catch (err) {
        console.log(`  [WARN] Order ${orderId} — calculatePrice failed for ${productId}: ${err.message}`);
        // Fall back to building a minimal snapshot from static price
      }

      const unitPrice = product.calculatedPrice || legacyItem.price || product.staticPrice || 0;
      const quantity = legacyItem.quantity || 1;
      const lineTotal = unitPrice * quantity;
      orderSubtotal += lineTotal;

      // Build snapshot
      const snapshot = {
        components: (product.priceBreakdown?.components || []).map((c) => ({
          componentKey: c.componentKey,
          componentName: c.componentName,
          value: c.value,
          isFrozen: c.isFrozen,
          isVisible: c.isVisible,
        })),
        metalType: product.metalType,
        metalRate: product.priceBreakdown?.metalRate || 0,
        metalCost: product.priceBreakdown?.metalCost || 0,
        gemstones: (product.gemstones || []).map((g) => ({
          name: g.customName || g.name,
          weight: g.weight,
          pricePerCarat: g.pricePerCarat,
          totalCost: g.totalCost,
        })),
        gemstoneCost: product.priceBreakdown?.gemstoneCost || 0,
        subtotal: product.priceBreakdown?.subtotal || unitPrice,
        totalPrice: product.priceBreakdown?.totalPrice || unitPrice,
        snapshotAt: order.createdAt || new Date(),
      };

      newItems.push({
        product: product._id,
        productTitle: product.productTitle,
        productSlug: product.productSlug,
        skuNo: product.skuNo,
        productImageUrl: product.productImageUrl?.[0] || null,
        quantity,
        price: unitPrice,
        lineTotal,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        metalType: product.metalType,
        pricingModeAtOrder: product.pricingMode,
        priceBreakdownSnapshot: snapshot,
        variant: legacyItem.variant || null,
        categoryHierarchyPath: product.categoryHierarchyPath,
      });
    }

    if (newItems.length === 0) {
      console.log(`  [SKIP] Order ${orderId} — no valid products found`);
      skipped++;
      continue;
    }

    if (isDryRun) {
      console.log(`  [DRY] Order ${orderId} — would set ${newItems.length} items, subtotal ₹${orderSubtotal}`);
      const firstSnapshot = newItems[0].priceBreakdownSnapshot;
      console.log(`         metalCost=₹${firstSnapshot.metalCost}, gemstoneCost=₹${firstSnapshot.gemstoneCost}`);
      updated++;
    } else {
      try {
        order.items = newItems;
        if (!order.subtotal || order.subtotal === 0) {
          order.subtotal = orderSubtotal;
        }
        if (!order.grandTotal || order.grandTotal === 0) {
          order.grandTotal = orderSubtotal - (order.discountAmount || 0)
            + (order.shippingAmount || 0) + (order.taxAmount || 0);
        }
        await order.save();
        console.log(`  [OK]  Order ${orderId} — backfilled ${newItems.length} items`);
        updated++;
      } catch (err) {
        console.error(`  [ERR] Order ${orderId} — save failed: ${err.message}`);
        errors++;
      }
    }
  }

  console.log(`\n── Summary ──────────────────────────────────`);
  console.log(`  Total orders found:  ${orders.length}`);
  console.log(`  ${isDryRun ? "Would update" : "Updated"}:       ${updated}`);
  console.log(`  Skipped:             ${skipped}`);
  console.log(`  Errors:              ${errors}`);
  if (isDryRun) {
    console.log(`\n  Run with --execute to apply changes.`);
  }

  await mongoose.disconnect();
  console.log("\nMongoDB disconnected");
};

backfill().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
