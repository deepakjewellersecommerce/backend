/**
 * Category Hierarchy Routes
 * API endpoints for Metal Groups and Levels 1-4: Material, Gender, Item, Category
 */

const express = require("express");
const router = express.Router();
const categoryHierarchyController = require("../controllers/category-hierarchy.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId } = require("../middlewares/validation");
const {
  validateCreateMaterial,
  validateUpdateMaterial,
  validateCreateGender,
  validateUpdateGender,
  validateCreateItem,
  validateUpdateItem,
  validateCreateCategory,
  validateUpdateCategory,
  validateUpdateMetalGroup,
  validateUpdateMetalGroupPremium,
} = require("../validation/category-hierarchy.validation");

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

// Fetch live MCX prices from API and update all metal groups
router.post(
  "/admin/categories/metal-groups/fetch-live-prices",
  requireAdminLogin,
  categoryHierarchyController.fetchLiveMCXPrices
);

// Update metal group (MCX price, premium, etc.)
router.put(
  "/admin/categories/metal-groups/:id",
  requireAdminLogin,
  validateObjectId,
  validateUpdateMetalGroup,
  categoryHierarchyController.updateMetalGroup
);

// Update premium specifically (triggers recalculation)
router.put(
  "/admin/categories/metal-groups/:id/premium",
  requireAdminLogin,
  validateObjectId,
  validateUpdateMetalGroupPremium,
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
  validateCreateMaterial,
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
  validateUpdateMaterial,
  categoryHierarchyController.updateMaterial
);

router.get(
  "/admin/categories/materials/:id/impact",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getMaterialImpact
);

router.delete(
  "/admin/categories/materials/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.deleteMaterial
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
  validateCreateGender,
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
  validateUpdateGender,
  categoryHierarchyController.updateGender
);

router.get(
  "/admin/categories/genders/:id/impact",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getGenderImpact
);

router.delete(
  "/admin/categories/genders/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.deleteGender
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
  validateCreateItem,
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
  validateUpdateItem,
  categoryHierarchyController.updateItem
);

router.get(
  "/admin/categories/items/:id/impact",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.getItemImpact
);

router.delete(
  "/admin/categories/items/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.deleteItem
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
  validateCreateCategory,
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
  validateUpdateCategory,
  categoryHierarchyController.updateCategory
);

router.delete(
  "/admin/categories/categories/:id",
  requireAdminLogin,
  validateObjectId("id"),
  categoryHierarchyController.deleteCategory
);

module.exports = router;
