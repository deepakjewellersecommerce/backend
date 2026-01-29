/**
 * Metal Price Routes
 * API endpoints for metal price management
 */

const express = require("express");
const router = express.Router();
const metalPriceController = require("../controllers/metal-price.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

// ==================== PUBLIC ROUTES ====================

// Get all metal types (public for display purposes)
router.get("/metal-prices/types", metalPriceController.getMetalTypes);

// ==================== ADMIN ROUTES ====================

// Get all metal prices
router.get(
  "/admin/metal-prices",
  requireAdminLogin,
  metalPriceController.getAllMetalPrices
);

// Get all price history
router.get(
  "/admin/metal-prices/history",
  requireAdminLogin,
  metalPriceController.getAllPriceHistory
);

// Initialize default metal prices (one-time setup)
router.post(
  "/admin/metal-prices/initialize",
  requireAdminLogin,
  metalPriceController.initializeMetalPrices
);

// Bulk fetch from API
router.post(
  "/admin/metal-prices/bulk-fetch",
  requireAdminLogin,
  metalPriceController.bulkFetchMetalPrices
);

// Bulk recalculation preview
router.post(
  "/admin/metal-prices/bulk-recalculate/preview",
  requireAdminLogin,
  metalPriceController.previewBulkRecalculation
);

// Bulk recalculation confirm
router.post(
  "/admin/metal-prices/bulk-recalculate/confirm",
  requireAdminLogin,
  metalPriceController.confirmBulkRecalculation
);

// Get single metal price
router.get(
  "/admin/metal-prices/:metalType",
  requireAdminLogin,
  metalPriceController.getMetalPrice
);

// Update metal price manually
router.put(
  "/admin/metal-prices/:metalType",
  requireAdminLogin,
  metalPriceController.updateMetalPrice
);

// Fetch price from API for single metal
router.post(
  "/admin/metal-prices/:metalType/fetch",
  requireAdminLogin,
  metalPriceController.fetchMetalPrice
);

// Get price history for single metal
router.get(
  "/admin/metal-prices/:metalType/history",
  requireAdminLogin,
  metalPriceController.getMetalPriceHistory
);

// Get affected products for metal type
router.get(
  "/admin/metal-prices/:metalType/affected-products",
  requireAdminLogin,
  metalPriceController.getAffectedProducts
);

module.exports = router;
