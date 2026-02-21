const express = require("express");
const router = express.Router();
const {
  getNextSKU,
  incrementSequence,
  getSubcategorySequences,
} = require("../controllers/product-sequence.controller");

/**
 * GET /api/product-sequence/next-sku?subcategoryId=xxx&boxNumber=1
 * Get the next SKU preview for a given subcategory and box
 * No authentication required (used by frontend for preview)
 */
router.get("/next-sku", getNextSKU);

/**
 * POST /api/product-sequence/increment
 * Increment the product sequence for a subcategory and box
 * Called internally after successful product creation
 */
router.post("/increment", incrementSequence);

/**
 * GET /api/product-sequence/:subcategoryId
 * Get all product sequences for a subcategory
 * Shows the state of all boxes for a given subcategory
 */
router.get("/:subcategoryId", getSubcategorySequences);

module.exports = router;
