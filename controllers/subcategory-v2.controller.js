/**
 * Subcategory Controller V2
 * Handles Level 5+ subcategories with recursive nesting and pricing
 * New model structure with unlimited nesting support
 */

const mongoose = require("mongoose");
const Subcategory = require("../models/subcategory.model.js");
const SubcategoryPricing = require("../models/subcategory-pricing.model");
const Category = require("../models/category.model");
const { Product } = require("../models/product.model");
const { MetalPrice } = require("../models/metal-price.model");
const pricingCalculationService = require("../services/pricing-calculation.service");
const { errorRes, successRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } = require("../models/audit-log.model");
const cacheService = require("../services/cache.service");

// ==================== CRUD OPERATIONS ====================

/**
 * Create subcategory
 * POST /api/admin/subcategories
 */
module.exports.createSubcategory = catchAsync(async (req, res) => {
  try {
    const {
      name,
      slug,
      idAttribute,
      categoryId,
      parentSubcategoryId,
      description,
      imageUrl,
      sortOrder,
      configurePricing,
      pricingConfig,
      seoTitle,
      seoDescription
    } = req.body;

    // Validation
    if (!name || !idAttribute || !categoryId) {
      return errorRes(res, 400, "Name, ID attribute, and category ID are required");
    }

    // Validate category exists
    const category = await Category.findById(categoryId).populate([
      { path: "materialId", select: "idAttribute" },
      { path: "genderId", select: "idAttribute" },
      { path: "itemId", select: "idAttribute" }
    ]);

    if (!category) {
      return errorRes(res, 400, "Category not found");
    }

    // Validate parent subcategory if provided
    if (parentSubcategoryId) {
      const parent = await Subcategory.findById(parentSubcategoryId);
      if (!parent) {
        return errorRes(res, 400, "Parent subcategory not found");
      }
      if (parent.categoryId.toString() !== categoryId) {
        return errorRes(res, 400, "Parent subcategory must be in the same category");
      }
    }

    // Pre-check for duplicate fullCategoryId to provide a clearer error message
    const idAttrUpper = idAttribute.toUpperCase();
    let computedFullCategoryId;
    if (parentSubcategoryId) {
      const parentSub = await Subcategory.findById(parentSubcategoryId);
      if (!parentSub) return errorRes(res, 400, "Parent subcategory not found");
      computedFullCategoryId = `${parentSub.fullCategoryId}-${idAttrUpper}`;
    } else {
      const basePath = `${category.materialId.idAttribute}-${category.genderId.idAttribute}-${category.itemId.idAttribute}-${category.idAttribute}`;
      computedFullCategoryId = `${basePath}-${idAttrUpper}`;
    }

    const conflict = await Subcategory.findOne({ fullCategoryId: computedFullCategoryId });
    if (conflict) {
      return res.status(409).json({
        status: "error",
        error: {
          code: 409,
          message: `Subcategory with this ID attribute already exists in this path (${conflict.name})`
        },
        conflict: {
          _id: conflict._id,
          name: conflict.name,
          parentSubcategoryId: conflict.parentSubcategoryId || null,
          fullCategoryId: conflict.fullCategoryId
        }
      });
    }

    // Create subcategory
    const subcategoryData = {
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, ""),
      idAttribute: idAttrUpper,
      materialId: category.materialId._id,
      genderId: category.genderId._id,
      itemId: category.itemId._id,
      categoryId,
      parentSubcategoryId: parentSubcategoryId || null,
      description,
      imageUrl,
      sortOrder: sortOrder || 0,
      seoTitle,
      seoDescription,
      fullCategoryId: computedFullCategoryId
    };

    console.log("Subcategory Create Data:", JSON.stringify(subcategoryData, null, 2));

    const subcategory = await Subcategory.create(subcategoryData);

    // Create pricing config if requested
    if (configurePricing && pricingConfig) {
      // Look up PriceComponent IDs by componentKey
      const { PriceComponent } = require("../models/price-component.model");
      const allComponents = await PriceComponent.find({});
      const componentMap = new Map(allComponents.map(c => [c.key, c._id]));

      const componentsWithIds = pricingConfig.components.map(comp => {
        const componentId = componentMap.get(comp.componentKey);
        if (!componentId) {
          console.warn(`PriceComponent not found for key: ${comp.componentKey}`);
        }
        return {
          ...comp,
          componentId: componentId || null
        };
      }).filter(comp => comp.componentId); // Only include components that have valid IDs

      if (componentsWithIds.length === 0) {
        console.warn("No valid pricing components found, skipping pricing config creation");
      } else {
        const pricing = await SubcategoryPricing.create({
          subcategoryId: subcategory._id,
          components: componentsWithIds,
          lastUpdatedBy: req.admin?.name || "Admin"
        });

        subcategory.hasPricingConfig = true;
        subcategory.pricingConfigId = pricing._id;
        await subcategory.save();
      }
    } else if (configurePricing) {
      // If configurePricing is true but no pricingConfig provided, create default
      const pricing = await SubcategoryPricing.createDefault(subcategory._id, req.admin?.name || "Admin");

      subcategory.hasPricingConfig = true;
      subcategory.pricingConfigId = pricing._id;
      await subcategory.save();
    }

    // Populate and return
    await subcategory.populate([
      { path: "categoryId", select: "name fullCategoryId" },
      { path: "materialId", select: "name idAttribute metalType" }
    ]);

    successRes(res, {
      subcategory,
      message: "Subcategory created successfully"
    });
  } catch (error) {
    console.error("Error creating subcategory:", error);
    if (error.code === 11000) {
      return errorRes(res, 400, "Subcategory with this ID already exists in this path");
    }
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Get all subcategories (flat list)
 * GET /api/admin/subcategories
 */
module.exports.getAllSubcategories = catchAsync(async (req, res) => {
  try {
    const {
      categoryId,
      materialId,
      parentSubcategoryId,
      hasPricingConfig,
      includeInactive = false,
      search,
      limit = 50,
      offset = 0
    } = req.query;

    const query = {};

    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }
    if (categoryId) query.categoryId = categoryId;
    if (materialId) query.materialId = materialId;
    if (parentSubcategoryId === "null") {
      query.parentSubcategoryId = null;
    } else if (parentSubcategoryId) {
      query.parentSubcategoryId = parentSubcategoryId;
    }
    if (hasPricingConfig !== undefined) {
      query.hasPricingConfig = hasPricingConfig === "true";
    }
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const [subcategories, total] = await Promise.all([
      Subcategory.find(query)
        .populate("categoryId", "name fullCategoryId")
        .populate("materialId", "name idAttribute metalType")
        .populate("parentSubcategoryId", "name idAttribute")
        .sort({ level: 1, sortOrder: 1, name: 1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      Subcategory.countDocuments(query)
    ]);

    successRes(res, {
      subcategories,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      message: "Subcategories retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting subcategories:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get subcategory tree for a category
 * GET /api/admin/subcategories/tree/:categoryId
 */
module.exports.getSubcategoryTree = catchAsync(async (req, res) => {
  try {
    const { categoryId } = req.params;
    // includeInactive query param: 'true' (default) or 'false'
    const includeInactive = req.query.includeInactive === 'false' ? false : true;

    console.log("GET SUBCATEGORY TREE FOR:", categoryId, "includeInactive:", includeInactive);

    const tree = await Subcategory.getTree(categoryId, includeInactive);
    console.log("TREE RESULTS COUNT:", tree.length);

    successRes(res, {
      tree,
      categoryId,
      message: "Subcategory tree retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting subcategory tree:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single subcategory
 * GET /api/admin/subcategories/:id
 */
module.exports.getSubcategory = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id)
      .populate("categoryId", "name fullCategoryId")
      .populate("materialId", "name idAttribute metalType")
      .populate("genderId", "name idAttribute")
      .populate("itemId", "name idAttribute")
      .populate("parentSubcategoryId", "name idAttribute level")
      .populate("pricingConfigId");

    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    // Get breadcrumb
    const breadcrumb = await subcategory.getBreadcrumb();

    // Get pricing source
    const pricingSource = await subcategory.getPricingSource();

    // Get children count
    const childrenCount = await Subcategory.countDocuments({
      parentSubcategoryId: id
    });

    // Get products count
    const productsCount = await Product.countDocuments({
      subcategoryId: id
    });

    successRes(res, {
      subcategory,
      breadcrumb,
      pricingSource: {
        source: pricingSource.source,
        subcategoryName: pricingSource.subcategory?.name || null,
        subcategoryId: pricingSource.subcategory?._id || null
      },
      childrenCount,
      productsCount,
      message: "Subcategory retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting subcategory:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get subcategory impact (affected products/child subcategories)
 * GET /api/admin/subcategories/:id/impact
 */
module.exports.getSubcategoryImpact = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    const productsCount = await Product.countDocuments({ subcategoryId: id });
    const childSubcategoriesCount = await Subcategory.countDocuments({ parentSubcategoryId: id });

    successRes(res, {
      impact: {
        productsCount,
        childSubcategoriesCount
      },
      message: "Subcategory impact retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting subcategory impact:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Update subcategory
 * PUT /api/admin/subcategories/:id
 */
module.exports.updateSubcategory = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      description,
      imageUrl,
      isActive,
      sortOrder,
      seoTitle,
      seoDescription
    } = req.body;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    // Cannot change idAttribute, categoryId, or parentSubcategoryId (would break hierarchy)
    if (name) subcategory.name = name;
    if (slug) subcategory.slug = slug;
    if (description !== undefined) subcategory.description = description;
    if (imageUrl !== undefined) subcategory.imageUrl = imageUrl;
    if (isActive !== undefined) subcategory.isActive = isActive;
    if (sortOrder !== undefined) subcategory.sortOrder = sortOrder;
    if (seoTitle !== undefined) subcategory.seoTitle = seoTitle;
    if (seoDescription !== undefined) subcategory.seoDescription = seoDescription;

    await subcategory.save();

    await subcategory.populate([
      { path: "categoryId", select: "name fullCategoryId" },
      { path: "materialId", select: "name idAttribute metalType" }
    ]);

    successRes(res, {
      subcategory,
      message: "Subcategory updated successfully"
    });
  } catch (error) {
    console.error("Error updating subcategory:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Delete subcategory
 * DELETE /api/admin/subcategories/:id
 */
module.exports.deleteSubcategory = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { force = false } = req.query;

  const subcategory = await Subcategory.findById(id);
  if (!subcategory) {
    return errorRes(res, 404, "Subcategory not found");
  }

  // Check for children
  const childrenCount = await Subcategory.countDocuments({
    parentSubcategoryId: id
  });

  // Check for products (direct + descendant)
  const productsCount = await Product.countDocuments({ subcategoryId: id });

  if ((childrenCount > 0 || productsCount > 0) && force !== "true") {
    return errorRes(
      res,
      400,
      `Cannot delete subcategory. It has ${childrenCount} nested subcategories and ${productsCount} products. Use force=true to cascade delete everything.`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ProductVariant = require("../models/product_varient");
    const { RfidTag } = require("../models/rfid-tag.model");
    const Inventory = require("../models/inventory.model");

    if (force === "true") {
      // Collect all subcategory IDs to delete (this one + descendants)
      const descendantSubs = await Subcategory.find({ ancestorPath: id }).distinct("_id").session(session);
      const allSubIds = [id, ...descendantSubs.map(s => s.toString())];

      // Find all products under this subtree
      const productIds = await Product.find({
        subcategoryId: { $in: allSubIds }
      }).distinct("_id").session(session);

      if (productIds.length > 0) {
        // Cascade delete all product-related data
        await Promise.all([
          ProductVariant.deleteMany({ productId: { $in: productIds } }).session(session),
          RfidTag.deleteMany({ product: { $in: productIds } }).session(session),
          Inventory.deleteMany({ product: { $in: productIds } }).session(session),
        ]);
        // Delete products
        await Product.deleteMany({ subcategoryId: { $in: allSubIds } }).session(session);
      }

      // Delete pricing configs for all affected subcategories
      const pricingIds = await Subcategory.find({
        _id: { $in: allSubIds },
        pricingConfigId: { $ne: null }
      }).distinct("pricingConfigId").session(session);

      if (pricingIds.length > 0) {
        await SubcategoryPricing.deleteMany({ _id: { $in: pricingIds } }).session(session);
      }

      // Delete descendant subcategories
      await Subcategory.deleteMany({ ancestorPath: id }).session(session);
    }

    // Delete pricing config for this subcategory
    if (subcategory.pricingConfigId) {
      await SubcategoryPricing.findByIdAndDelete(subcategory.pricingConfigId).session(session);
    }

    // Delete the subcategory itself
    await Subcategory.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    successRes(res, {
      message: "Subcategory deleted successfully",
      deletedDescendants: force === "true" ? childrenCount : 0,
      deletedProducts: force === "true" ? productsCount : 0,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting subcategory:", error);
    internalServerError(res, error.message);
  }
});

// ==================== PRICING OPERATIONS ====================

/**
 * Get pricing config for subcategory
 * GET /api/admin/subcategories/:id/pricing
 */
module.exports.getPricingConfig = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    // Get pricing config (with inheritance)
    const pricingConfig = await subcategory.getPricingConfig();
    const pricingSource = await subcategory.getPricingSource();

    successRes(res, {
      pricingConfig,
      pricingSource: {
        source: pricingSource.source,
        subcategoryName: pricingSource.subcategory?.name || null,
        subcategoryId: pricingSource.subcategory?._id || null
      },
      hasOwnConfig: subcategory.hasPricingConfig,
      message: "Pricing config retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting pricing config:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create/Update pricing config for subcategory
 * PUT /api/admin/subcategories/:id/pricing
 */
module.exports.updatePricingConfig = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { components } = req.body;
    const adminName = req.admin?.name || "Admin";

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    if (!components || !Array.isArray(components)) {
      return errorRes(res, 400, "Components array is required");
    }

    let pricingConfig;

    if (subcategory.hasPricingConfig && subcategory.pricingConfigId) {
      // Update existing
      pricingConfig = await SubcategoryPricing.findById(subcategory.pricingConfigId);
      if (pricingConfig) {
        pricingConfig.components = components;
        pricingConfig.lastUpdatedBy = adminName;
        await pricingConfig.save();
      }
    } else {
      // Create new
      pricingConfig = await SubcategoryPricing.create({
        subcategoryId: id,
        components,
        lastUpdatedBy: adminName
      });

      subcategory.hasPricingConfig = true;
      subcategory.pricingConfigId = pricingConfig._id;
      await subcategory.save();
    }

    // Update affected products count
    await SubcategoryPricing.updateAffectedCount(id);

    // Invalidate pricing config cache for this subcategory and all descendants
    await cacheService.clearPattern(`pricingConfig:*`);
    await cacheService.clearPattern(`pricingSource:*`);

    logAudit({
      entityType: AUDIT_ENTITIES.PRICING_CONFIG,
      entityId: pricingConfig._id,
      action: AUDIT_ACTIONS.UPDATE,
      actorId: req.admin?._id,
      actorName: adminName,
      summary: `Updated pricing config for subcategory "${subcategory.name}"`,
      changes: { after: { components: components.length } },
      metadata: { subcategoryId: id, subcategoryName: subcategory.name }
    });

    successRes(res, {
      pricingConfig,
      message: "Pricing config updated successfully"
    });
  } catch (error) {
    console.error("Error updating pricing config:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create default pricing config for subcategory
 * POST /api/admin/subcategories/:id/pricing/default
 */
module.exports.createDefaultPricingConfig = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const adminName = req.admin?.name || "Admin";

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    if (subcategory.hasPricingConfig) {
      return errorRes(res, 400, "Subcategory already has a pricing config");
    }

    const pricingConfig = await SubcategoryPricing.createDefault(id, adminName);

    subcategory.hasPricingConfig = true;
    subcategory.pricingConfigId = pricingConfig._id;
    await subcategory.save();

    // Invalidate pricing config cache
    await cacheService.clearPattern(`pricingConfig:*`);
    await cacheService.clearPattern(`pricingSource:*`);

    successRes(res, {
      pricingConfig,
      message: "Default pricing config created successfully"
    });
  } catch (error) {
    console.error("Error creating default pricing config:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Remove pricing config (inherit from parent)
 * DELETE /api/admin/subcategories/:id/pricing
 */
module.exports.removePricingConfig = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    if (!subcategory.hasPricingConfig) {
      return errorRes(res, 400, "Subcategory does not have its own pricing config");
    }

    // Delete pricing config
    if (subcategory.pricingConfigId) {
      await SubcategoryPricing.findByIdAndDelete(subcategory.pricingConfigId);
    }

    subcategory.hasPricingConfig = false;
    subcategory.pricingConfigId = null;
    await subcategory.save();

    // Invalidate pricing config cache
    await cacheService.clearPattern(`pricingConfig:*`);
    await cacheService.clearPattern(`pricingSource:*`);

    // Get new inherited source
    const pricingSource = await subcategory.getPricingSource();

    successRes(res, {
      pricingSource: {
        source: pricingSource.source,
        subcategoryName: pricingSource.subcategory?.name || null,
        subcategoryId: pricingSource.subcategory?._id || null
      },
      message: "Pricing config removed. Subcategory will now inherit from ancestor."
    });
  } catch (error) {
    console.error("Error removing pricing config:", error);
    internalServerError(res, error.message);
  }
});

// ==================== FREEZE OPERATIONS ====================

/**
 * Freeze a component in pricing config
 * PATCH /api/admin/subcategories/:id/pricing/components/:componentKey/freeze
 */
module.exports.freezeComponent = catchAsync(async (req, res) => {
  try {
    const { id, componentKey } = req.params;
    const { reason } = req.body;
    const adminName = req.admin?.name || "Admin";
    const adminId = req.admin?._id;

    if (!reason) {
      return errorRes(res, 400, "Freeze reason is required for subcategory-level freeze");
    }

    const subcategory = await Subcategory.findById(id).populate("materialId");
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    if (!subcategory.hasPricingConfig) {
      return errorRes(res, 400, "Subcategory does not have its own pricing config");
    }

    // Get current metal rate
    const metalPrice = await MetalPrice.getCurrentPrice(
      subcategory.materialId.metalType
    );

    const pricingConfig = await SubcategoryPricing.findById(
      subcategory.pricingConfigId
    );

    if (!pricingConfig) {
      return errorRes(res, 404, "Pricing config not found");
    }

    // Calculate frozen value
    const component = pricingConfig.components.find(
      (c) => c.componentKey === componentKey
    );

    if (!component) {
      return errorRes(res, 404, `Component "${componentKey}" not found`);
    }

    // Calculate current value to freeze
    const frozenValue = pricingCalculationService.calculateComponentValue(
      component,
      {
        grossWeight: 10, // Sample values for calculation
        netWeight: 9.5,
        metalRate: metalPrice.pricePerGram,
        metalCost: 9.5 * metalPrice.pricePerGram,
        subtotal: 0
      }
    );

    await pricingConfig.freezeComponent(
      componentKey,
      frozenValue,
      metalPrice.pricePerGram,
      reason,
      adminId,
      adminName
    );

    successRes(res, {
      component: pricingConfig.components.find((c) => c.componentKey === componentKey),
      frozenValue,
      metalRateAtFreeze: metalPrice.pricePerGram,
      message: `Component "${componentKey}" frozen successfully`
    });
  } catch (error) {
    console.error("Error freezing component:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Unfreeze a component in pricing config
 * PATCH /api/admin/subcategories/:id/pricing/components/:componentKey/unfreeze
 */
module.exports.unfreezeComponent = catchAsync(async (req, res) => {
  try {
    const { id, componentKey } = req.params;
    const adminName = req.admin?.name || "Admin";
    const adminId = req.admin?._id;

    const subcategory = await Subcategory.findById(id).populate("materialId");
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    if (!subcategory.hasPricingConfig) {
      return errorRes(res, 400, "Subcategory does not have its own pricing config");
    }

    // Get current metal rate
    const metalPrice = await MetalPrice.getCurrentPrice(
      subcategory.materialId.metalType
    );

    const pricingConfig = await SubcategoryPricing.findById(
      subcategory.pricingConfigId
    );

    if (!pricingConfig) {
      return errorRes(res, 404, "Pricing config not found");
    }

    const component = pricingConfig.components.find(
      (c) => c.componentKey === componentKey
    );

    if (!component) {
      return errorRes(res, 404, `Component "${componentKey}" not found`);
    }

    const previousFrozenValue = component.frozenValue;

    await pricingConfig.unfreezeComponent(
      componentKey,
      metalPrice.pricePerGram,
      adminId,
      adminName
    );

    // Calculate new value after unfreeze
    const updatedComponent = pricingConfig.components.find(
      (c) => c.componentKey === componentKey
    );

    const newValue = pricingCalculationService.calculateComponentValue(
      updatedComponent,
      {
        grossWeight: 10,
        netWeight: 9.5,
        metalRate: metalPrice.pricePerGram,
        metalCost: 9.5 * metalPrice.pricePerGram,
        subtotal: 0
      }
    );

    successRes(res, {
      component: updatedComponent,
      previousFrozenValue,
      newCalculatedValue: Math.round(newValue * 100) / 100,
      currentMetalRate: metalPrice.pricePerGram,
      message: `Component "${componentKey}" unfrozen. Price updated from ₹${previousFrozenValue} to ₹${Math.round(newValue * 100) / 100} based on current metal rate.`
    });
  } catch (error) {
    console.error("Error unfreezing component:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get freeze history for pricing config
 * GET /api/admin/subcategories/:id/pricing/freeze-history
 */
module.exports.getFreezeHistory = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    if (!subcategory.hasPricingConfig) {
      return errorRes(res, 400, "Subcategory does not have its own pricing config");
    }

    const pricingConfig = await SubcategoryPricing.findById(
      subcategory.pricingConfigId
    );

    successRes(res, {
      freezeHistory: pricingConfig?.freezeHistory || [],
      message: "Freeze history retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting freeze history:", error);
    internalServerError(res, error.message);
  }
});

// ==================== AFFECTED PRODUCTS ====================

/**
 * Get products affected by this subcategory's pricing
 * GET /api/admin/subcategories/:id/affected-products
 */
module.exports.getAffectedProducts = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const subcategory = await Subcategory.findById(id);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    // Get all subcategories that inherit from this one
    const inheritingSubcategories = await Subcategory.find({
      $or: [
        { _id: id },
        {
          ancestorPath: id,
          hasPricingConfig: false
        }
      ]
    });

    const subcategoryIds = inheritingSubcategories.map((s) => s._id);

    const [products, total] = await Promise.all([
      Product.find({
        subcategoryId: { $in: subcategoryIds },
        pricingMode: "SUBCATEGORY_DYNAMIC"
      })
        .select("productTitle skuNo calculatedPrice pricingMode subcategoryId")
        .populate("subcategoryId", "name fullCategoryId")
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      Product.countDocuments({
        subcategoryId: { $in: subcategoryIds },
        pricingMode: "SUBCATEGORY_DYNAMIC"
      })
    ]);

    successRes(res, {
      products,
      total,
      inheritingSubcategories: inheritingSubcategories.length,
      limit: parseInt(limit),
      offset: parseInt(offset),
      message: "Affected products retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting affected products:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Preview pricing changes
 * POST /api/admin/subcategories/:id/pricing/preview
 */
module.exports.previewPricingChanges = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { components } = req.body;

    if (!components || !Array.isArray(components)) {
      return errorRes(res, 400, "Components array is required");
    }

    const preview = await pricingCalculationService.previewPriceChange(
      id,
      { components },
      { limit: 10 }
    );

    successRes(res, {
      ...preview,
      message: "Price change preview generated"
    });
  } catch (error) {
    console.error("Error previewing pricing changes:", error);
    internalServerError(res, error.message);
  }
});

// ==================== SEARCH & NAVIGATION ====================

/**
 * Search subcategories
 * GET /api/admin/subcategories/search
 */
module.exports.searchSubcategories = catchAsync(async (req, res) => {
  try {
    const { q, categoryId, limit = 20 } = req.query;

    if (!q || q.length < 2) {
      return errorRes(res, 400, "Search query must be at least 2 characters");
    }

    const results = await Subcategory.search(q, {
      limit: parseInt(limit),
      categoryId
    });

    successRes(res, {
      results,
      query: q,
      message: "Search completed"
    });
  } catch (error) {
    console.error("Error searching subcategories:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Check subcategory availability for a given idAttribute in a category path
 * GET /api/admin/subcategories/check-availability?categoryId=&parentSubcategoryId=&idAttribute=
 */
module.exports.checkAvailability = catchAsync(async (req, res) => {
  try {
    const { categoryId, parentSubcategoryId, idAttribute } = req.query;

    // Debug logs to help diagnose false-positive conflicts
    console.debug("checkAvailability called with:", { categoryId, parentSubcategoryId, idAttribute });
    if (parentSubcategoryId === 'null') {
      console.warn("checkAvailability: parentSubcategoryId is string 'null' (likely from axios param serialization)");
    }

    if (!categoryId || !idAttribute) {
      return errorRes(res, 400, "categoryId and idAttribute are required");
    }

    const Category = mongoose.model("Category");
    const category = await Category.findById(categoryId).populate([
      { path: "materialId", select: "idAttribute" },
      { path: "genderId", select: "idAttribute" },
      { path: "itemId", select: "idAttribute" }
    ]);

    if (!category) return errorRes(res, 400, "Category not found");

    const idAttrUpper = idAttribute.toString().toUpperCase();
    let computedFullCategoryId;

    if (parentSubcategoryId) {
      const parentSub = await Subcategory.findById(parentSubcategoryId);
      if (!parentSub) {
        console.warn("checkAvailability: parentSubcategoryId provided but parent subcategory not found", parentSubcategoryId);
        return errorRes(res, 400, "Parent subcategory not found");
      }
      computedFullCategoryId = `${parentSub.fullCategoryId}-${idAttrUpper}`;
    } else {
      const basePath = `${category.materialId.idAttribute}-${category.genderId.idAttribute}-${category.itemId.idAttribute}-${category.idAttribute}`;
      computedFullCategoryId = `${basePath}-${idAttrUpper}`;
    }

    console.debug("checkAvailability: computedFullCategoryId=", computedFullCategoryId);

    const conflict = await Subcategory.findOne({ fullCategoryId: computedFullCategoryId }).select(
      "_id name parentSubcategoryId fullCategoryId"
    );

    console.debug("checkAvailability: conflict found=", !!conflict, conflict ? { _id: conflict._id, fullCategoryId: conflict.fullCategoryId } : null);

    successRes(res, {
      available: !conflict,
      conflict: conflict || null,
      fullCategoryId: computedFullCategoryId
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get ancestors of a subcategory
 * GET /api/admin/subcategories/:id/ancestors
 */
module.exports.getAncestors = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const ancestors = await Subcategory.getAncestors(id);

    successRes(res, {
      ancestors,
      message: "Ancestors retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting ancestors:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get descendants of a subcategory
 * GET /api/admin/subcategories/:id/descendants
 */
module.exports.getDescendants = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const descendants = await Subcategory.getDescendants(id);

    successRes(res, {
      descendants,
      count: descendants.length,
      message: "Descendants retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting descendants:", error);
    internalServerError(res, error.message);
  }
});
