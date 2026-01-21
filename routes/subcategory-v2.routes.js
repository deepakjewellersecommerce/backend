/**
 * Subcategory V2 Routes
 * API endpoints for Level 5+ subcategories with recursive nesting and pricing
 */

const express = require("express");
const router = express.Router();
const subcategoryController = require("../controllers/subcategory-v2.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId } = require("../middlewares/validation");

// ==================== SEARCH & TREE ====================

// Search subcategories
router.get(
  "/admin/subcategories/search",
  requireAdminLogin,
  subcategoryController.searchSubcategories
);

// Get subcategory tree for a category
router.get(
  "/admin/subcategories/tree/:categoryId",
  requireAdminLogin,
  validateObjectId("categoryId"),
  subcategoryController.getSubcategoryTree
);

// Check availability for idAttribute/fullCategoryId
router.get(
  "/admin/subcategories/check-availability",
  requireAdminLogin,
  subcategoryController.checkAvailability
);

// ==================== CRUD OPERATIONS ====================

// Get all subcategories (flat list)
router.get(
  "/admin/subcategories",
  requireAdminLogin,
  subcategoryController.getAllSubcategories
);

// Create subcategory
router.post(
  "/admin/subcategories",
  requireAdminLogin,
  subcategoryController.createSubcategory
);

// Get single subcategory
router.get(
  "/admin/subcategories/:id",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getSubcategory
);

// Get subcategory impact
router.get(
  "/admin/subcategories/:id/impact",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getSubcategoryImpact
);

// Update subcategory
router.put(
  "/admin/subcategories/:id",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.updateSubcategory
);

// Delete subcategory
router.delete(
  "/admin/subcategories/:id",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.deleteSubcategory
);

// ==================== HIERARCHY NAVIGATION ====================

// Get ancestors
router.get(
  "/admin/subcategories/:id/ancestors",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getAncestors
);

// Get descendants
router.get(
  "/admin/subcategories/:id/descendants",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getDescendants
);

// ==================== PRICING OPERATIONS ====================

// Get pricing config
router.get(
  "/admin/subcategories/:id/pricing",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getPricingConfig
);

// Create/Update pricing config
router.put(
  "/admin/subcategories/:id/pricing",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.updatePricingConfig
);

// Create default pricing config
router.post(
  "/admin/subcategories/:id/pricing/default",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.createDefaultPricingConfig
);

// Remove pricing config (inherit from parent)
router.delete(
  "/admin/subcategories/:id/pricing",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.removePricingConfig
);

// Preview pricing changes
router.post(
  "/admin/subcategories/:id/pricing/preview",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.previewPricingChanges
);

// Get freeze history
router.get(
  "/admin/subcategories/:id/pricing/freeze-history",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getFreezeHistory
);

// ==================== FREEZE OPERATIONS ====================

// Freeze component
router.patch(
  "/admin/subcategories/:id/pricing/components/:componentKey/freeze",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.freezeComponent
);

// Unfreeze component
router.patch(
  "/admin/subcategories/:id/pricing/components/:componentKey/unfreeze",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.unfreezeComponent
);

// ==================== AFFECTED PRODUCTS ====================

// Get affected products
router.get(
  "/admin/subcategories/:id/affected-products",
  requireAdminLogin,
  validateObjectId("id"),
  subcategoryController.getAffectedProducts
);

module.exports = router;
