/**
 * Product Pricing Routes
 * API endpoints for product pricing management
 */

const express = require("express");
const router = express.Router();
const productPricingController = require("../controllers/product-pricing.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId } = require("../middlewares/validation");

// ==================== ENUMS & HELPERS ====================

// Get pricing modes enum
router.get(
  "/admin/products/pricing-modes",
  requireAdminLogin,
  productPricingController.getPricingModes
);

// ==================== BULK OPERATIONS ====================

// Bulk recalculate prices
router.post(
  "/admin/products/bulk-recalculate",
  requireAdminLogin,
  productPricingController.bulkRecalculatePrices
);

// ==================== PRODUCT PRICING OPERATIONS ====================

// Get products by subcategory with pricing info
router.get(
  "/admin/products/by-subcategory/:subcategoryId",
  requireAdminLogin,
  validateObjectId("subcategoryId"),
  productPricingController.getProductsBySubcategory
);

// Calculate and update product price
router.post(
  "/admin/products/:productId/calculate-price",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.calculateProductPrice
);

// Get price breakdown preview
router.post(
  "/admin/products/:productId/price-preview",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.getPricePreview
);

// Get pricing summary
router.get(
  "/admin/products/:productId/pricing-summary",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.getPricingSummary
);

// Update pricing mode
router.put(
  "/admin/products/:productId/pricing-mode",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.updatePricingMode
);

// Customize pricing (switch to CUSTOM_DYNAMIC)
router.post(
  "/admin/products/:productId/customize-pricing",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.customizePricing
);

// Revert to subcategory pricing
router.post(
  "/admin/products/:productId/revert-pricing",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.revertToSubcategoryPricing
);

// Update pricing config (for CUSTOM_DYNAMIC)
router.put(
  "/admin/products/:productId/pricing-config",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.updatePricingConfig
);

// Validate gemstones
router.post(
  "/admin/products/:productId/validate-gemstones",
  requireAdminLogin,
  productPricingController.validateGemstones
);

// ==================== FREEZE OPERATIONS ====================

// Freeze component
router.patch(
  "/admin/products/:productId/pricing/components/:componentKey/freeze",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.freezeComponent
);

// Unfreeze component
router.patch(
  "/admin/products/:productId/pricing/components/:componentKey/unfreeze",
  requireAdminLogin,
  validateObjectId("productId"),
  productPricingController.unfreezeComponent
);

module.exports = router;
