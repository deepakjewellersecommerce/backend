/**
 * Product Pricing Controller
 * Extends product functionality with new multi-metal pricing system
 * Handles pricing modes, price breakdown, customization, and freeze controls
 */

const mongoose = require("mongoose");
const { Product, PRICING_MODES } = require("../models/product.model");
const Subcategory = require("../models/subcategory.model.js");
const { MetalPrice } = require("../models/metal-price.model");
const pricingCalculationService = require("../services/pricing-calculation.service");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

/**
 * Calculate and update product price
 * POST /api/admin/products/:productId/calculate-price
 */
module.exports.calculateProductPrice = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    await product.calculatePrice();

    successRes(res, {
      product: {
        id: product._id,
        productTitle: product.productTitle,
        pricingMode: product.pricingMode,
        calculatedPrice: product.calculatedPrice,
        priceBreakdown: product.priceBreakdown,
        allComponentsFrozen: product.allComponentsFrozen
      },
      message: "Price calculated successfully"
    });
  } catch (error) {
    console.error("Error calculating product price:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get price breakdown preview (without saving)
 * POST /api/admin/products/:productId/price-preview
 */
module.exports.getPricePreview = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;
    const { grossWeight, netWeight, metalRate, pricingConfig } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    // Use provided values or product values
    const previewProduct = {
      ...product.toObject(),
      grossWeight: grossWeight ?? product.grossWeight,
      netWeight: netWeight ?? product.netWeight,
      pricingConfig: pricingConfig || product.pricingConfig
    };

    const breakdown = await pricingCalculationService.calculateProductPrice(
      previewProduct,
      { metalRate }
    );

    successRes(res, {
      breakdown,
      preview: true,
      message: "Price preview generated"
    });
  } catch (error) {
    console.error("Error getting price preview:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get product pricing summary
 * GET /api/admin/products/:productId/pricing-summary
 */
module.exports.getPricingSummary = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const summary = await pricingCalculationService.getProductPricingSummary(productId);

    successRes(res, {
      ...summary,
      message: "Pricing summary retrieved"
    });
  } catch (error) {
    console.error("Error getting pricing summary:", error);
    if (error.message === "Product not found") {
      return errorRes(res, 404, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Update pricing mode
 * PUT /api/admin/products/:productId/pricing-mode
 */
module.exports.updatePricingMode = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;
    const { pricingMode, staticPrice } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    if (!pricingMode || !Object.values(PRICING_MODES).includes(pricingMode)) {
      return errorRes(res, 400, `Invalid pricing mode. Use: ${Object.values(PRICING_MODES).join(", ")}`);
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    product.pricingMode = pricingMode;

    if (pricingMode === PRICING_MODES.STATIC_PRICE) {
      if (!staticPrice || staticPrice <= 0) {
        return errorRes(res, 400, "Static price is required for STATIC_PRICE mode");
      }
      product.staticPrice = staticPrice;
      product.pricingConfig = undefined;
    } else if (pricingMode === PRICING_MODES.SUBCATEGORY_DYNAMIC) {
      product.pricingConfig = undefined;
      product.staticPrice = undefined;
    }

    await product.save();
    await product.calculatePrice();

    successRes(res, {
      product: {
        id: product._id,
        pricingMode: product.pricingMode,
        calculatedPrice: product.calculatedPrice,
        priceBreakdown: product.priceBreakdown
      },
      message: "Pricing mode updated successfully"
    });
  } catch (error) {
    console.error("Error updating pricing mode:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Customize pricing (switch to CUSTOM_DYNAMIC)
 * POST /api/admin/products/:productId/customize-pricing
 */
module.exports.customizePricing = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    if (product.pricingMode === PRICING_MODES.CUSTOM_DYNAMIC) {
      return successRes(res, {
        product: {
          id: product._id,
          pricingMode: product.pricingMode,
          pricingConfig: product.pricingConfig
        },
        message: "Product already has custom pricing"
      });
    }

    await product.customizePricing();

    successRes(res, {
      product: {
        id: product._id,
        pricingMode: product.pricingMode,
        pricingConfig: product.pricingConfig
      },
      message: "Pricing customized successfully. Product now has its own pricing config."
    });
  } catch (error) {
    console.error("Error customizing pricing:", error);

    // Return 400 for validation errors, 500 for server errors
    if (error.message.includes("not found") ||
        error.message.includes("No pricing configuration") ||
        error.message.includes("must have pricing configured")) {
      return errorRes(res, 400, error.message);
    }

    internalServerError(res, error.message);
  }
});

/**
 * Revert to subcategory pricing
 * POST /api/admin/products/:productId/revert-pricing
 */
module.exports.revertToSubcategoryPricing = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    if (product.pricingMode === PRICING_MODES.SUBCATEGORY_DYNAMIC) {
      return successRes(res, {
        message: "Product already uses subcategory pricing"
      });
    }

    await product.revertToSubcategoryPricing();
    await product.calculatePrice();

    successRes(res, {
      product: {
        id: product._id,
        pricingMode: product.pricingMode,
        calculatedPrice: product.calculatedPrice,
        priceBreakdown: product.priceBreakdown
      },
      message: "Reverted to subcategory pricing successfully"
    });
  } catch (error) {
    console.error("Error reverting pricing:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Update custom pricing config
 * PUT /api/admin/products/:productId/pricing-config
 */
module.exports.updatePricingConfig = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;
    const { components } = req.body;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    if (product.pricingMode !== PRICING_MODES.CUSTOM_DYNAMIC) {
      return errorRes(
        res,
        400,
        "Can only update pricing config for products with CUSTOM_DYNAMIC mode"
      );
    }

    if (!components || !Array.isArray(components)) {
      return errorRes(res, 400, "Components array is required");
    }

    product.pricingConfig.components = components;
    await product.save();
    await product.calculatePrice();

    successRes(res, {
      product: {
        id: product._id,
        pricingConfig: product.pricingConfig,
        calculatedPrice: product.calculatedPrice,
        priceBreakdown: product.priceBreakdown
      },
      message: "Pricing config updated successfully"
    });
  } catch (error) {
    console.error("Error updating pricing config:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Freeze a component (product-level)
 * PATCH /api/admin/products/:productId/pricing/components/:componentKey/freeze
 */
module.exports.freezeComponent = catchAsync(async (req, res) => {
  try {
    const { productId, componentKey } = req.params;
    const { reason } = req.body; // Optional for product-level
    const adminName = req.admin?.name || "Admin";

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    if (product.pricingMode !== PRICING_MODES.CUSTOM_DYNAMIC) {
      return errorRes(
        res,
        400,
        "Can only freeze components for products with CUSTOM_DYNAMIC mode"
      );
    }

    const component = product.pricingConfig.components.find(
      (c) => c.componentKey === componentKey
    );

    if (!component) {
      return errorRes(res, 404, `Component "${componentKey}" not found`);
    }

    // Get current metal rate
    const metalPrice = await MetalPrice.getCurrentPrice(product.metalType);

    // Calculate current value to freeze
    const frozenValue = pricingCalculationService.calculateComponentValue(
      component,
      {
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        metalRate: metalPrice.pricePerGram,
        metalCost: product.netWeight * metalPrice.pricePerGram,
        subtotal: 0
      }
    );

    // Store original values
    component.originalCalculationType = component.calculationType;
    component.originalValue = component.value;
    component.originalFormula = component.formula;

    // Set frozen state
    component.isFrozen = true;
    component.frozenValue = Math.round(frozenValue * 100) / 100;
    component.frozenAt = new Date();
    component.metalRateAtFreeze = metalPrice.pricePerGram;
    component.freezeReason = reason || null;
    component.frozenBy = adminName;

    await product.save();
    await product.calculatePrice();

    successRes(res, {
      component: product.pricingConfig.components.find(
        (c) => c.componentKey === componentKey
      ),
      frozenValue: Math.round(frozenValue * 100) / 100,
      message: `Component "${componentKey}" frozen at ₹${Math.round(frozenValue * 100) / 100}`
    });
  } catch (error) {
    console.error("Error freezing component:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Unfreeze a component (product-level)
 * PATCH /api/admin/products/:productId/pricing/components/:componentKey/unfreeze
 */
module.exports.unfreezeComponent = catchAsync(async (req, res) => {
  try {
    const { productId, componentKey } = req.params;

    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product ID");
    }

    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    if (product.pricingMode !== PRICING_MODES.CUSTOM_DYNAMIC) {
      return errorRes(
        res,
        400,
        "Can only unfreeze components for products with CUSTOM_DYNAMIC mode"
      );
    }

    const component = product.pricingConfig.components.find(
      (c) => c.componentKey === componentKey
    );

    if (!component) {
      return errorRes(res, 404, `Component "${componentKey}" not found`);
    }

    if (!component.isFrozen) {
      return errorRes(res, 400, `Component "${componentKey}" is not frozen`);
    }

    const previousFrozenValue = component.frozenValue;

    // Restore original calculation
    component.calculationType = component.originalCalculationType;
    component.value = component.originalValue;
    component.formula = component.originalFormula;

    // Clear frozen state
    component.isFrozen = false;
    component.frozenValue = null;
    component.frozenAt = null;
    component.metalRateAtFreeze = null;
    component.freezeReason = null;
    component.frozenBy = null;
    component.originalCalculationType = null;
    component.originalValue = null;
    component.originalFormula = null;

    await product.save();
    await product.calculatePrice();

    // Calculate new value
    const metalPrice = await MetalPrice.getCurrentPrice(product.metalType);
    const updatedComponent = product.pricingConfig.components.find(
      (c) => c.componentKey === componentKey
    );

    const newValue = pricingCalculationService.calculateComponentValue(
      updatedComponent,
      {
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        metalRate: metalPrice.pricePerGram,
        metalCost: product.netWeight * metalPrice.pricePerGram,
        subtotal: 0
      }
    );

    successRes(res, {
      component: updatedComponent,
      previousFrozenValue,
      newCalculatedValue: Math.round(newValue * 100) / 100,
      currentMetalRate: metalPrice.pricePerGram,
      message: `Component "${componentKey}" unfrozen. Price updated from ₹${previousFrozenValue} to ₹${Math.round(newValue * 100) / 100}`
    });
  } catch (error) {
    console.error("Error unfreezing component:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Validate gemstones
 * POST /api/admin/products/:productId/validate-gemstones
 */
module.exports.validateGemstones = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;
    const { gemstones, grossWeight } = req.body;

    let productGrossWeight = grossWeight;

    // If productId provided, get product weight
    if (productId && mongoose.isValidObjectId(productId)) {
      const product = await Product.findById(productId);
      if (product) {
        productGrossWeight = product.grossWeight;
      }
    }

    if (!gemstones || !Array.isArray(gemstones)) {
      return errorRes(res, 400, "Gemstones array is required");
    }

    const validation = Product.validateGemstones(gemstones, productGrossWeight || 0);

    successRes(res, {
      ...validation,
      message: validation.valid ? "Gemstones are valid" : "Gemstone validation has issues"
    });
  } catch (error) {
    console.error("Error validating gemstones:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Bulk recalculate prices for products by metal type
 * POST /api/admin/products/bulk-recalculate
 */
module.exports.bulkRecalculatePrices = catchAsync(async (req, res) => {
  try {
    const { metalType } = req.body;

    if (!metalType) {
      return errorRes(res, 400, "Metal type is required");
    }

    const result = await Product.bulkRecalculate(metalType);

    successRes(res, {
      ...result,
      message: `Bulk recalculation completed. ${result.success} updated, ${result.failed} failed.`
    });
  } catch (error) {
    console.error("Error bulk recalculating prices:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get products by subcategory with pricing info
 * GET /api/admin/products/by-subcategory/:subcategoryId
 */
module.exports.getProductsBySubcategory = catchAsync(async (req, res) => {
  try {
    const { subcategoryId } = req.params;
    const { limit = 20, offset = 0, pricingMode } = req.query;

    if (!mongoose.isValidObjectId(subcategoryId)) {
      return errorRes(res, 400, "Invalid subcategory ID");
    }

    const query = { subcategoryId };
    if (pricingMode) {
      query.pricingMode = pricingMode;
    }

    const [products, total] = await Promise.all([
      Product.find(query)
        .select(
          "productTitle skuNo calculatedPrice pricingMode allComponentsFrozen grossWeight netWeight metalType"
        )
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      Product.countDocuments(query)
    ]);

    // Get pricing summary for each mode
    const modeCounts = await Product.aggregate([
      { $match: { subcategoryId: new mongoose.Types.ObjectId(subcategoryId) } },
      { $group: { _id: "$pricingMode", count: { $sum: 1 } } }
    ]);

    successRes(res, {
      products,
      total,
      modeCounts: modeCounts.reduce((acc, m) => {
        acc[m._id] = m.count;
        return acc;
      }, {}),
      limit: parseInt(limit),
      offset: parseInt(offset),
      message: "Products retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting products by subcategory:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get pricing modes enum
 * GET /api/admin/products/pricing-modes
 */
module.exports.getPricingModes = catchAsync(async (req, res) => {
  const modes = Object.entries(PRICING_MODES).map(([key, value]) => ({
    key,
    value,
    description: getPricingModeDescription(value)
  }));

  successRes(res, {
    modes,
    message: "Pricing modes retrieved successfully"
  });
});

// Helper function
function getPricingModeDescription(mode) {
  const descriptions = {
    SUBCATEGORY_DYNAMIC: "Inherits pricing from subcategory. Updates automatically with metal rate changes.",
    CUSTOM_DYNAMIC: "Product has its own pricing config. Still uses live metal rates for non-frozen components.",
    STATIC_PRICE: "Fixed price. Does not change with metal rates or category pricing."
  };
  return descriptions[mode] || "";
}
