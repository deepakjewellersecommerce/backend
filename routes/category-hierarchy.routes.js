/**
 * Category Hierarchy Routes
 * API endpoints for Metal Groups and Levels 1-4: Material, Gender, Item, Category
 */

const express = require("express");
const router = express.Router();
const categoryHierarchyController = require("../controllers/category-hierarchy.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId } = require("../middlewares/validation");

// ==================== METAL GROUPS (Base Metals) ====================

// Get all metal groups
router.get(
  "/admin/categories/metal-groups",
  requireAdminLogin,
  categoryHierarchyController.getAllMetalGroups
);

// Get single metal group
router.get(
  "/admin/categories/metal-groups/:id",
  requireAdminLogin,
  validateObjectId,
  categoryHierarchyController.getMetalGroup
);

// Update metal group (MCX price, premium, etc.)
router.put(
  "/admin/categories/metal-groups/:id",
  requireAdminLogin,
  validateObjectId,
  categoryHierarchyController.updateMetalGroup
);

// Update premium specifically (triggers recalculation)
router.put(
  "/admin/categories/metal-groups/:id/premium",
  requireAdminLogin,
  validateObjectId,
  categoryHierarchyController.updateMetalGroupPremium
);

// ==================== SUBCATEGORIES FLAT LIST ====================

// Get all subcategories with full hierarchy path (for flat dropdown)
router.get(
  "/admin/categories/subcategories/flat",
  requireAdminLogin,
  categoryHierarchyController.getAllSubcategoriesFlat
);

// ==================== HIERARCHY HELPERS ====================

// Get full hierarchy tree
router.get(
  "/admin/categories/hierarchy",
  requireAdminLogin,
  categoryHierarchyController.getFullHierarchy
);

// Get cascading options for category form
router.get(
  "/admin/categories/cascade",
  requireAdminLogin,
  categoryHierarchyController.getCascadeOptions
);

// Quick create - any level from one endpoint
router.post(
  "/admin/categories/quick-create",
  requireAdminLogin,
  categoryHierarchyController.quickCreate
);

// ==================== MATERIALS (Level 1) ====================

router.get(
  "/admin/categories/materials",
  requireAdminLogin,
  categoryHierarchyController.getAllMaterials
);

router.post(
  "/admin/categories/materials",
  requireAdminLogin,
  categoryHierarchyController.createMaterial
);

router.get(
  "/admin/categories/materials/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getMaterial
);

router.put(
  "/admin/categories/materials/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.updateMaterial
);

// ==================== GENDERS (Level 2) ====================

router.get(
  "/admin/categories/genders",
  requireAdminLogin,
  categoryHierarchyController.getAllGenders
);

router.post(
  "/admin/categories/genders",
  requireAdminLogin,
  categoryHierarchyController.createGender
);

router.get(
  "/admin/categories/genders/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getGender
);

router.put(
  "/admin/categories/genders/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.updateGender
);

// ==================== ITEMS (Level 3) ====================

router.get(
  "/admin/categories/items",
  requireAdminLogin,
  categoryHierarchyController.getAllItems
);

router.post(
  "/admin/categories/items",
  requireAdminLogin,
  categoryHierarchyController.createItem
);

router.get(
  "/admin/categories/items/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getItem
);

router.put(
  "/admin/categories/items/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.updateItem
);

// ==================== CATEGORIES (Level 4) ====================

router.get(
  "/admin/categories/categories",
  requireAdminLogin,
  categoryHierarchyController.getAllCategories
);

router.post(
  "/admin/categories/categories",
  requireAdminLogin,
  categoryHierarchyController.createCategory
);

router.get(
  "/admin/categories/categories/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getCategory
);

router.get(
  "/admin/categories/categories/:id/impact",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getCategoryImpact
);

router.put(
  "/admin/categories/categories/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.updateCategory
);

module.exports = router;
