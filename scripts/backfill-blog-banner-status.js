/**
 * Backfill Script: Populate explicit status fields on legacy blogs and banners
 *
 * Blogs created before the status field was introduced should be stored as DRAFT.
 * Banners created before isActive existed should be stored as active.
 *
 * Usage:
 *   node scripts/backfill-blog-banner-status.js
 *   node scripts/backfill-blog-banner-status.js --execute
 */

"use strict";

const mongoose = require("mongoose");
require("dotenv").config();

require("../models/blog.model");
const Banner = require("../models/banner.model");

const Blog = mongoose.model("Blog");

const args = process.argv.slice(2);
const isDryRun = !args.includes("--execute");

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    console.error("MONGO_URI not found in environment variables");
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected for blog/banner status backfill");
};

const disconnectDB = async () => {
  await mongoose.disconnect();
  console.log("MongoDB disconnected");
};

const backfillCollection = async ({
  label,
  model,
  filter,
  update,
  previewFields,
}) => {
  const docs = await model.find(filter).select(previewFields.join(" "));

  console.log(`\n${label}: found ${docs.length} documents needing backfill`);

  if (docs.length === 0) {
    return { matched: 0, updated: 0 };
  }

  docs.slice(0, 5).forEach((doc) => {
    const preview = previewFields
      .map((field) => `${field}=${JSON.stringify(doc[field])}`)
      .join(", ");
    console.log(`  - ${doc._id}: ${preview}`);
  });

  if (docs.length > 5) {
    console.log(`  ...and ${docs.length - 5} more`);
  }

  if (isDryRun) {
    console.log(`  [DRY RUN] Would apply update ${JSON.stringify(update.$set)} to ${docs.length} ${label.toLowerCase()}.`);
    return { matched: docs.length, updated: docs.length };
  }

  const result = await model.updateMany(filter, update);
  console.log(`  [OK] Updated ${result.modifiedCount} ${label.toLowerCase()}.`);
  return { matched: result.matchedCount, updated: result.modifiedCount };
};

const backfill = async () => {
  await connectDB();

  console.log(`\nMode: ${isDryRun ? "DRY RUN (pass --execute to write)" : "EXECUTE"}`);

  const blogResult = await backfillCollection({
    label: "Blogs",
    model: Blog,
    filter: { status: { $exists: false } },
    update: { $set: { status: "DRAFT" } },
    previewFields: ["title", "slug", "status"],
  });

  const bannerResult = await backfillCollection({
    label: "Banners",
    model: Banner,
    filter: { isActive: { $exists: false } },
    update: { $set: { isActive: true } },
    previewFields: ["title", "slug", "isActive"],
  });

  console.log("\n-- Summary ------------------------------");
  console.log(`Blogs matched:   ${blogResult.matched}`);
  console.log(`${isDryRun ? "Blogs pending" : "Blogs updated"}:   ${blogResult.updated}`);
  console.log(`Banners matched: ${bannerResult.matched}`);
  console.log(`${isDryRun ? "Banners pending" : "Banners updated"}: ${bannerResult.updated}`);

  if (isDryRun) {
    console.log("\nRun again with --execute to persist changes.");
  }

  await disconnectDB();
};

backfill().catch(async (err) => {
  console.error("Backfill failed:", err);
  try {
    await disconnectDB();
  } catch (disconnectError) {
    console.error("Failed to disconnect cleanly:", disconnectError);
  }
  process.exit(1);
});