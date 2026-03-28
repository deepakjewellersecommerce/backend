/**
 * sync-indexes.js
 *
 * Automatically drops stale MongoDB indexes that conflict with the current
 * Mongoose schema definitions (e.g. unique indexes that are missing sparse:true).
 *
 * Run once after DB connects. Safe to run on every startup — it only acts
 * when a mismatch is detected.
 */

const mongoose = require("mongoose");

/**
 * For each collection, describe which indexes need to be recreated with
 * corrected options. Format:
 *   { collection, name, drop, recreate? }
 *
 * - drop: always drop this index name if it exists
 * - recreate: if provided, immediately recreate with these options
 *   (otherwise Mongoose will recreate it on next model.syncIndexes / server start)
 */
const STALE_INDEXES = [
  // materials.metalType — legacy field, optional, must be sparse
  {
    collection: "materials",
    name: "metalType_1",
    drop: true,
    recreate: { key: { metalType: 1 }, options: { sparse: true, background: true } },
  },
  // materials.slug — auto-generated, optional, must be sparse
  {
    collection: "materials",
    name: "slug_1",
    drop: true,
    recreate: { key: { slug: 1 }, options: { unique: true, sparse: true, background: true } },
  },
];

async function syncIndexes() {
  const db = mongoose.connection.db;
  if (!db) return;

  for (const entry of STALE_INDEXES) {
    try {
      const col = db.collection(entry.collection);
      const existing = await col.indexes();
      const found = existing.find((i) => i.name === entry.name);

      if (!found) continue; // already gone or never existed

      // Check if it already has the right options — skip if already correct
      const needsSparse = entry.recreate?.options?.sparse;
      if (needsSparse && found.sparse) continue; // already sparse, nothing to do

      await col.dropIndex(entry.name);
      console.log(`[sync-indexes] Dropped stale index: ${entry.collection}.${entry.name}`);

      if (entry.recreate) {
        await col.createIndex(entry.recreate.key, {
          name: entry.name,
          ...entry.recreate.options,
        });
        console.log(`[sync-indexes] Recreated index: ${entry.collection}.${entry.name}`);
      }
    } catch (err) {
      // Non-fatal — log and continue. A missing index is better than a crashed server.
      console.warn(`[sync-indexes] Could not fix ${entry.collection}.${entry.name}:`, err.message);
    }
  }
}

module.exports = syncIndexes;
