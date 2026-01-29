/**
 * Price Component Controller
 * Handles CRUD operations for price components and formula validation
 */

const {
  PriceComponent,
  CALCULATION_TYPES,
  FORMULA_VARIABLES
} = require("../models/price-component.model");
const pricingCalculationService = require("../services/pricing-calculation.service");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

/**
 * Get all price components
 * GET /api/admin/price-components
 */
module.exports.getAllComponents = catchAsync(async (req, res) => {
  try {
    const { includeDeleted = false, includeInactive = true } = req.query;

    const query = {};
    if (!includeDeleted || includeDeleted === "false") {
      query.isDeleted = false;
    }
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }

    const components = await PriceComponent.find(query).sort({
      sortOrder: 1,
      name: 1
    });

    successRes(res, {
      components,
      calculationTypes: CALCULATION_TYPES,
      message: "Price components retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting price components:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get system components only
 * GET /api/admin/price-components/system
 */
module.exports.getSystemComponents = catchAsync(async (req, res) => {
  try {
    const components = await PriceComponent.getSystemComponents();

    successRes(res, {
      components,
      message: "System components retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting system components:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single component by ID or key
 * GET /api/admin/price-components/:idOrKey
 */
module.exports.getComponent = catchAsync(async (req, res) => {
  try {
    const { idOrKey } = req.params;

    let component;

    // Check if it's a MongoDB ObjectId
    if (idOrKey.match(/^[0-9a-fA-F]{24}$/)) {
      component = await PriceComponent.findById(idOrKey);
    } else {
      component = await PriceComponent.getByKey(idOrKey);
    }

    if (!component) {
      return errorRes(res, 404, "Component not found");
    }

    successRes(res, {
      component,
      message: "Component retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting component:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create new price component
 * POST /api/admin/price-components
 */
module.exports.createComponent = catchAsync(async (req, res) => {
  try {
    const {
      name,
      key,
      description,
      calculationType,
      defaultValue,
      formula,
      formulaChips,
      percentageOf,
      allowsFreeze,
      isActive,
      isVisible,
      sortOrder
    } = req.body;

    // Validation
    if (!name || !key) {
      return errorRes(res, 400, "Name and key are required");
    }

    if (!calculationType || !Object.values(CALCULATION_TYPES).includes(calculationType)) {
      return errorRes(res, 400, "Valid calculation type is required");
    }

    // Check if key already exists
    const existing = await PriceComponent.findOne({ key: key.toLowerCase() });
    if (existing) {
      return errorRes(res, 400, `Component with key "${key}" already exists`);
    }

    // Validate formula if provided
    if (calculationType === CALCULATION_TYPES.FORMULA) {
      if (!formula) {
        return errorRes(res, 400, "Formula is required for FORMULA calculation type");
      }

      const validation = pricingCalculationService.validateFormula(formula);
      if (!validation.valid) {
        return errorRes(res, 400, `Invalid formula: ${validation.errors.join(", ")}`);
      }
    }

    const component = await PriceComponent.create({
      name,
      key: key.toLowerCase(),
      description,
      calculationType,
      defaultValue: defaultValue || 0,
      formula: calculationType === CALCULATION_TYPES.FORMULA ? formula : null,
      formulaChips: formulaChips || [],
      percentageOf: percentageOf || "metalCost",
      isSystemComponent: false, // Custom components are never system components
      allowsFreeze: allowsFreeze !== false,
      isActive: isActive !== false,
      isVisible: isVisible !== false,
      sortOrder: sortOrder || 0
    });

    successRes(res, {
      component,
      message: "Component created successfully"
    });
  } catch (error) {
    console.error("Error creating component:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Update price component
 * PUT /api/admin/price-components/:id
 */
module.exports.updateComponent = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const component = await PriceComponent.findById(id);
    if (!component) {
      return errorRes(res, 404, "Component not found");
    }

    // System components have restrictions
    if (component.isSystemComponent) {
      // Can only update certain fields for system components
      const allowedUpdates = ["defaultValue", "isActive", "isVisible", "sortOrder"];
      const attemptedUpdates = Object.keys(updates);

      for (const key of attemptedUpdates) {
        if (!allowedUpdates.includes(key)) {
          return errorRes(
            res,
            400,
            `Cannot update "${key}" on system components`
          );
        }
      }
    }

    // Validate formula if updating
    if (updates.calculationType === CALCULATION_TYPES.FORMULA ||
        (component.calculationType === CALCULATION_TYPES.FORMULA && updates.formula)) {
      const formulaToValidate = updates.formula || component.formula;
      const validation = pricingCalculationService.validateFormula(formulaToValidate);
      if (!validation.valid) {
        return errorRes(res, 400, `Invalid formula: ${validation.errors.join(", ")}`);
      }
    }

    // Prevent changing key
    if (updates.key && updates.key !== component.key) {
      return errorRes(res, 400, "Cannot change component key");
    }

    // Apply updates
    Object.assign(component, updates);
    await component.save();

    successRes(res, {
      component,
      message: "Component updated successfully"
    });
  } catch (error) {
    console.error("Error updating component:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Delete price component
 * DELETE /api/admin/price-components/:id
 */
module.exports.deleteComponent = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false } = req.query;

    const component = await PriceComponent.findById(id);
    if (!component) {
      return errorRes(res, 404, "Component not found");
    }

    // Check if can be deleted
    const canDeleteResult = await component.canDelete();

    if (!canDeleteResult.canDelete) {
      if (canDeleteResult.softDeleteOnly && force === "true") {
        // Soft delete
        await component.softDelete();
        return successRes(res, {
          component,
          softDeleted: true,
          message: "Component soft-deleted (hidden but preserved for historical orders)"
        });
      }

      return errorRes(res, 400, canDeleteResult.reason);
    }

    // Hard delete
    await PriceComponent.findByIdAndDelete(id);

    successRes(res, {
      message: "Component deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting component:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Validate formula
 * POST /api/admin/price-components/validate-formula
 */
module.exports.validateFormula = catchAsync(async (req, res) => {
  try {
    const { formula, testValues } = req.body;

    if (!formula) {
      return errorRes(res, 400, "Formula is required");
    }

    const validation = pricingCalculationService.validateFormula(
      formula,
      testValues || {}
    );

    successRes(res, {
      ...validation,
      message: validation.valid ? "Formula is valid" : "Formula validation failed"
    });
  } catch (error) {
    console.error("Error validating formula:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get formula variables
 * GET /api/admin/price-components/formula-variables
 */
module.exports.getFormulaVariables = catchAsync(async (req, res) => {
  const variables = pricingCalculationService.getFormulaVariables();

  successRes(res, {
    variables,
    operators: ["+", "-", "×", "÷", "(", ")"],
    message: "Formula variables retrieved successfully"
  });
});

/**
 * Calculate component value (preview)
 * POST /api/admin/price-components/:id/calculate
 */
module.exports.calculateComponentValue = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { grossWeight, netWeight, metalRate, subtotal = 0 } = req.body;

    const component = await PriceComponent.findById(id);
    if (!component) {
      return errorRes(res, 404, "Component not found");
    }

    if (!grossWeight || !netWeight || !metalRate) {
      return errorRes(res, 400, "grossWeight, netWeight, and metalRate are required");
    }

    const context = {
      grossWeight: parseFloat(grossWeight),
      netWeight: parseFloat(netWeight),
      metalRate: parseFloat(metalRate),
      subtotal: parseFloat(subtotal)
    };

    const value = component.calculate(context);

    successRes(res, {
      component: {
        id: component._id,
        key: component.key,
        name: component.name,
        calculationType: component.calculationType
      },
      context,
      calculatedValue: Math.round(value * 100) / 100,
      message: "Component value calculated successfully"
    });
  } catch (error) {
    console.error("Error calculating component value:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Reorder components
 * PUT /api/admin/price-components/reorder
 */
module.exports.reorderComponents = catchAsync(async (req, res) => {
  try {
    const { order } = req.body;

    if (!order || !Array.isArray(order)) {
      return errorRes(res, 400, "Order array is required");
    }

    // Update sort order for each component
    const updates = order.map((item, index) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { sortOrder: index }
      }
    }));

    await PriceComponent.bulkWrite(updates);

    const components = await PriceComponent.find({ isDeleted: false }).sort({
      sortOrder: 1
    });

    successRes(res, {
      components,
      message: "Components reordered successfully"
    });
  } catch (error) {
    console.error("Error reordering components:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get calculation types enum
 * GET /api/admin/price-components/calculation-types
 */
module.exports.getCalculationTypes = catchAsync(async (req, res) => {
  const types = Object.entries(CALCULATION_TYPES).map(([key, value]) => ({
    key,
    value,
    description: getCalculationTypeDescription(value)
  }));

  successRes(res, {
    types,
    message: "Calculation types retrieved successfully"
  });
});

// Helper function
function getCalculationTypeDescription(type) {
  const descriptions = {
    PER_GRAM: "Calculated as: netWeight × metalRate × value",
    PERCENTAGE: "Calculated as: referenceValue × (value / 100)",
    FIXED: "Fixed amount in rupees",
    FORMULA: "Custom formula using available variables"
  };
  return descriptions[type] || "";
}
