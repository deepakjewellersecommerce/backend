/**
 * Price Component Routes
 * API endpoints for price component management
 */

const express = require("express");
const router = express.Router();
const priceComponentController = require("../controllers/price-component.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

// ==================== ADMIN ROUTES ====================

// Get calculation types enum
router.get(
  "/admin/price-components/calculation-types",
  requireAdminLogin,
  priceComponentController.getCalculationTypes
);

// Get formula variables
router.get(
  "/admin/price-components/formula-variables",
  requireAdminLogin,
  priceComponentController.getFormulaVariables
);

// Get system components only
router.get(
  "/admin/price-components/system",
  requireAdminLogin,
  priceComponentController.getSystemComponents
);

// Validate formula
router.post(
  "/admin/price-components/validate-formula",
  requireAdminLogin,
  priceComponentController.validateFormula
);

// Reorder components
router.put(
  "/admin/price-components/reorder",
  requireAdminLogin,
  priceComponentController.reorderComponents
);

// Get all components
router.get(
  "/admin/price-components",
  requireAdminLogin,
  priceComponentController.getAllComponents
);

// Create component
router.post(
  "/admin/price-components",
  requireAdminLogin,
  priceComponentController.createComponent
);

// Get single component by ID or key
router.get(
  "/admin/price-components/:idOrKey",
  requireAdminLogin,
  priceComponentController.getComponent
);

// Update component
router.put(
  "/admin/price-components/:id",
  requireAdminLogin,
  priceComponentController.updateComponent
);

// Delete component
router.delete(
  "/admin/price-components/:id",
  requireAdminLogin,
  priceComponentController.deleteComponent
);

// Calculate component value (preview)
router.post(
  "/admin/price-components/:id/calculate",
  requireAdminLogin,
  priceComponentController.calculateComponentValue
);

module.exports = router;
