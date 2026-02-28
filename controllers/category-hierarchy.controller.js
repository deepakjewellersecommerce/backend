/**
 * Category Hierarchy Controller
 * Handles CRUD for Metal Groups and Levels 1-4: Material, Gender, Item, Category
 */

const MetalGroup = require("../models/metal-group.model");
const Material = require("../models/material.model");
const Gender = require("../models/gender.model");
const Item = require("../models/item.model");
const Category = require("../models/category.model");
const { Product } = require("../models/product.model");
const Subcategory = require("../models/subcategory.model.js");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } = require("../models/audit-log.model");
const metalPriceService = require("../services/metal-price.service");

// ==================== METAL GROUPS (Base Metals) ====================

/**
 * Get all metal groups
 * GET /api/admin/categories/metal-groups
 */
module.exports.getAllMetalGroups = catchAsync(async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }

    const metalGroups = await MetalGroup.find(query).sort({ sortOrder: 1, name: 1 });

    successRes(res, {
      metalGroups,
      message: "Metal groups retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting metal groups:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single metal group
 * GET /api/admin/categories/metal-groups/:id
 */
module.exports.getMetalGroup = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const metalGroup = await MetalGroup.findById(id);

    if (!metalGroup) {
      return errorRes(res, 404, "Metal group not found");
    }

    // Get materials for this metal group
    const materials = await Material.find({ metalGroup: id, isActive: true }).sort({
      sortOrder: 1
    });

    successRes(res, {
      metalGroup,
      materials,
      message: "Metal group retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting metal group:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Update metal group (MCX price or premium)
 * PUT /api/admin/categories/metal-groups/:id
 */
module.exports.updateMetalGroup = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { mcxPrice, premium, isActive, isAutoUpdate, sortOrder } = req.body;

    const metalGroup = await MetalGroup.findById(id);
    if (!metalGroup) {
      return errorRes(res, 404, "Metal group not found");
    }

    // Update allowed fields
    if (mcxPrice !== undefined) {
      metalGroup.mcxPrice = mcxPrice;
      metalGroup.lastFetched = new Date();
    }
    if (premium !== undefined) {
      metalGroup.premium = premium;
    }
    if (isActive !== undefined) {
      metalGroup.isActive = isActive;
    }
    if (isAutoUpdate !== undefined) {
      metalGroup.isAutoUpdate = isAutoUpdate;
    }
    if (sortOrder !== undefined) {
      metalGroup.sortOrder = sortOrder;
    }

    // Base price will be auto-calculated by pre-save hook
    await metalGroup.save();

    // Recalculate prices for all materials in this group
    if (mcxPrice !== undefined || premium !== undefined) {
      await Material.recalculatePricesForMetalGroup(id);
    }

    successRes(res, {
      metalGroup,
      message: "Metal group updated successfully"
    });
  } catch (error) {
    console.error("Error updating metal group:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Update premium for metal group
 * PUT /api/admin/categories/metal-groups/:id/premium
 */
module.exports.updateMetalGroupPremium = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { premium } = req.body;

    if (premium === undefined || premium < 0) {
      return errorRes(res, 400, "Valid premium value is required");
    }

    const metalGroup = await MetalGroup.findById(id);
    if (!metalGroup) {
      return errorRes(res, 404, "Metal group not found");
    }

    const oldPremium = metalGroup.premium;
    const oldBasePrice = metalGroup.basePrice;

    metalGroup.updatePremium(premium);
    await metalGroup.save();

    // Recalculate all material prices
    const updatedMaterials = await Material.recalculatePricesForMetalGroup(id);

    successRes(res, {
      metalGroup,
      affectedMaterials: updatedMaterials.length,
      changes: {
        premium: { old: oldPremium, new: metalGroup.premium },
        basePrice: { old: oldBasePrice, new: metalGroup.basePrice }
      },
      message: `Premium updated and ${updatedMaterials.length} material prices recalculated`
    });
  } catch (error) {
    console.error("Error updating premium:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Fetch live MCX prices and update all metal groups
 * POST /api/admin/categories/metal-groups/fetch-live-prices
 */
module.exports.fetchLiveMCXPrices = catchAsync(async (req, res) => {
  try {
    // Fetch and update MetalPrice records from external API
    const fetchResult = await metalPriceService.fetchAndUpdateAll(
      req.admin?.name || "Admin"
    );

    if (fetchResult.errors && fetchResult.errors.some((e) => e.general)) {
      return internalServerError(res, fetchResult.errors[0].general);
    }

    // After update, read the saved prices and sync to MetalGroup records
    // metals.dev mcx_gold → Gold group, mcx_silver → Silver group, platinum → Platinum group
    const metalGroupMap = {
      Gold: "GOLD_24K",
      Silver: "SILVER_999",
      Platinum: "PLATINUM",
    };

    const updated = [];
    for (const [groupName, metalType] of Object.entries(metalGroupMap)) {
      const priceRecord = await metalPriceService.getCurrentPrice(metalType);
      if (!priceRecord) continue;

      const group = await MetalGroup.findOne({ name: groupName });
      if (!group) continue;

      group.updateMCXPrice(priceRecord.pricePerGram);
      await group.save();
      await Material.recalculatePricesForMetalGroup(group._id);
      updated.push({ name: groupName, mcxPrice: priceRecord.pricePerGram });
    }

    successRes(res, {
      updated,
      message: `Live prices fetched and ${updated.length} metal group(s) updated`,
    });
  } catch (error) {
    console.error("Error fetching live MCX prices:", error);
    internalServerError(res, error.message);
  }
});

// ==================== MATERIALS (Level 1) ====================

/**
 * Get all materials
 * GET /api/admin/categories/materials
 */
module.exports.getAllMaterials = catchAsync(async (req, res) => {
  try {
    const { includeInactive = false, metalGroupId } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }
    if (metalGroupId) {
      query.metalGroup = metalGroupId;
    }

    const materials = await Material.find(query)
      .populate("metalGroup", "name symbol mcxPrice premium basePrice")
      .sort({ sortOrder: 1, name: 1 });

    // Get all metal groups for dropdown
    const metalGroups = await MetalGroup.find({ isActive: true }).sort({
      sortOrder: 1
    });

    successRes(res, {
      materials,
      metalGroups, // Replace metalTypes with metalGroups
      message: "Materials retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting materials:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single material
 * GET /api/admin/categories/materials/:id
 */
module.exports.getMaterial = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id).populate(
      "metalGroup",
      "name symbol mcxPrice premium basePrice"
    );

    if (!material) {
      return errorRes(res, 404, "Material not found");
    }

    successRes(res, {
      material,
      effectivePrice: material.effectivePrice, // Include effective price (considers override)
      message: "Material retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting material:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create material
 * POST /api/admin/categories/materials
 */
module.exports.createMaterial = catchAsync(async (req, res) => {
  try {
    const {
      name,
      displayName,
      idAttribute,
      metalGroupId,
      purityType,
      purityNumerator,
      purityDenominator,
      imageUrl,
      sortOrder,
      description
    } = req.body;

    // Validation
    if (!name || !idAttribute || !metalGroupId) {
      return errorRes(res, 400, "Name, ID attribute, and metal group are required");
    }

    if (!purityType || (purityType !== "BASE" && purityType !== "DERIVED")) {
      return errorRes(res, 400, "Purity type must be BASE or DERIVED");
    }

    if (purityNumerator === undefined || purityDenominator === undefined) {
      return errorRes(res, 400, "Purity numerator and denominator are required");
    }

    // Validate metal group exists
    const metalGroup = await MetalGroup.findById(metalGroupId);
    if (!metalGroup) {
      return errorRes(res, 400, "Invalid metal group ID");
    }

    // Check for duplicate ID attribute
    const existingId = await Material.findOne({
      idAttribute: idAttribute.toUpperCase()
    });
    if (existingId) {
      return errorRes(res, 400, `ID attribute "${idAttribute}" already exists`);
    }

    // Calculate initial price
    const purityMultiplier =
      purityType === "BASE" ? 1 : purityNumerator / purityDenominator;
    const calculatedPrice = metalGroup.basePrice * purityMultiplier;

    const material = await Material.create({
      name,
      displayName: displayName || name,
      idAttribute: idAttribute.toUpperCase(),
      metalGroup: metalGroupId,
      purityType,
      purityNumerator,
      purityDenominator,
      purityFormula: `${purityNumerator} / ${purityDenominator}`,
      purityPercentage: parseFloat(((purityNumerator / purityDenominator) * 100).toFixed(2)),
      pricePerGram: parseFloat(calculatedPrice.toFixed(2)),
      lastCalculated: new Date(),
      imageUrl,
      sortOrder: sortOrder || 0,
      description,
      isActive: true
    });

    // Populate metalGroup before returning
    await material.populate("metalGroup", "name symbol mcxPrice premium basePrice");

    successRes(res, {
      material,
      message: "Material created successfully"
    });
  } catch (error) {
    console.error("Error creating material:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Update material
 * PUT /api/admin/categories/materials/:id
 */
module.exports.updateMaterial = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      displayName,
      imageUrl,
      isActive,
      sortOrder,
      description,
      overridePrice,
      overrideReason,
      removeOverride
    } = req.body;

    const material = await Material.findById(id).populate("metalGroup");
    if (!material) {
      return errorRes(res, 404, "Material not found");
    }

    // Update basic fields
    // Cannot change idAttribute, metalGroup, or purity (would break references)
    if (name) material.name = name;
    if (displayName) material.displayName = displayName;
    if (imageUrl !== undefined) material.imageUrl = imageUrl;
    if (description !== undefined) material.description = description;
    if (isActive !== undefined) material.isActive = isActive;
    if (sortOrder !== undefined) material.sortOrder = sortOrder;

    // Handle price override
    if (removeOverride === true) {
      // Remove override and recalculate from metal group
      await material.removeOverridePrice();
    } else if (overridePrice !== undefined) {
      // Set price override
      material.setOverridePrice(overridePrice, overrideReason || "Manual override", "Admin");
    }

    await material.save();

    successRes(res, {
      material,
      message: "Material updated successfully"
    });
  } catch (error) {
    console.error("Error updating material:", error);
    internalServerError(res, error.message);
  }
});

// ==================== GENDERS (Level 2) ====================

/**
 * Get all genders
 * GET /api/admin/categories/genders
 */
module.exports.getAllGenders = catchAsync(async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }

    const genders = await Gender.find(query).sort({ sortOrder: 1, name: 1 });

    successRes(res, {
      genders,
      message: "Genders retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting genders:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single gender
 * GET /api/admin/categories/genders/:id
 */
module.exports.getGender = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const gender = await Gender.findById(id);

    if (!gender) {
      return errorRes(res, 404, "Gender not found");
    }

    successRes(res, {
      gender,
      message: "Gender retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting gender:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create gender
 * POST /api/admin/categories/genders
 */
module.exports.createGender = catchAsync(async (req, res) => {
  try {
    const { name, idAttribute, imageUrl, sortOrder } = req.body;

    if (!name || !idAttribute) {
      return errorRes(res, 400, "Name and ID attribute are required");
    }

    const existingId = await Gender.findOne({ idAttribute: idAttribute.toUpperCase() });
    if (existingId) {
      return errorRes(res, 400, `ID attribute "${idAttribute}" already exists`);
    }

    const gender = await Gender.create({
      name,
      idAttribute: idAttribute.toUpperCase(),
      imageUrl,
      sortOrder: sortOrder || 0
    });

    successRes(res, {
      gender,
      message: "Gender created successfully"
    });
  } catch (error) {
    console.error("Error creating gender:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Update gender
 * PUT /api/admin/categories/genders/:id
 */
module.exports.updateGender = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, imageUrl, isActive, sortOrder } = req.body;

    const gender = await Gender.findById(id);
    if (!gender) {
      return errorRes(res, 404, "Gender not found");
    }

    if (name) gender.name = name;
    if (imageUrl !== undefined) gender.imageUrl = imageUrl;
    if (isActive !== undefined) gender.isActive = isActive;
    if (sortOrder !== undefined) gender.sortOrder = sortOrder;

    await gender.save();

    successRes(res, {
      gender,
      message: "Gender updated successfully"
    });
  } catch (error) {
    console.error("Error updating gender:", error);
    internalServerError(res, error.message);
  }
});

// ==================== ITEMS (Level 3) ====================

/**
 * Get all items
 * GET /api/admin/categories/items
 */
module.exports.getAllItems = catchAsync(async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }

    const items = await Item.find(query).sort({ sortOrder: 1, name: 1 });

    successRes(res, {
      items,
      message: "Items retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting items:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single item
 * GET /api/admin/categories/items/:id
 */
module.exports.getItem = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);

    if (!item) {
      return errorRes(res, 404, "Item not found");
    }

    successRes(res, {
      item,
      message: "Item retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting item:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create item
 * POST /api/admin/categories/items
 */
module.exports.createItem = catchAsync(async (req, res) => {
  try {
    const { name, idAttribute, description, imageUrl, sortOrder } = req.body;

    if (!name || !idAttribute) {
      return errorRes(res, 400, "Name and ID attribute are required");
    }

    const existingId = await Item.findOne({ idAttribute: idAttribute.toUpperCase() });
    if (existingId) {
      return errorRes(res, 400, `ID attribute "${idAttribute}" already exists`);
    }

    const item = await Item.create({
      name,
      idAttribute: idAttribute.toUpperCase(),
      description,
      imageUrl,
      sortOrder: sortOrder || 0
    });

    successRes(res, {
      item,
      message: "Item created successfully"
    });
  } catch (error) {
    console.error("Error creating item:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Update item
 * PUT /api/admin/categories/items/:id
 */
module.exports.updateItem = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, imageUrl, isActive, sortOrder } = req.body;

    const item = await Item.findById(id);
    if (!item) {
      return errorRes(res, 404, "Item not found");
    }

    if (name) item.name = name;
    if (description !== undefined) item.description = description;
    if (imageUrl !== undefined) item.imageUrl = imageUrl;
    if (isActive !== undefined) item.isActive = isActive;
    if (sortOrder !== undefined) item.sortOrder = sortOrder;

    await item.save();

    successRes(res, {
      item,
      message: "Item updated successfully"
    });
  } catch (error) {
    console.error("Error updating item:", error);
    internalServerError(res, error.message);
  }
});

// ==================== CATEGORIES (Level 4) ====================

/**
 * Get all categories
 * GET /api/admin/categories/categories
 */
module.exports.getAllCategories = catchAsync(async (req, res) => {
  try {
    const { materialId, genderId, itemId, includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }
    if (materialId) query.materialId = materialId;
    if (genderId) query.genderId = genderId;
    if (itemId) query.itemId = itemId;

    const categories = await Category.find(query)
      .populate("materialId", "name idAttribute metalType")
      .populate("genderId", "name idAttribute")
      .populate("itemId", "name idAttribute")
      .sort({ sortOrder: 1, name: 1 });

    successRes(res, {
      categories,
      message: "Categories retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting categories:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single category
 * GET /api/admin/categories/categories/:id
 */
module.exports.getCategory = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.getWithHierarchy(id);

    if (!category) {
      return errorRes(res, 404, "Category not found");
    }

    // Get breadcrumb
    const breadcrumb = await category.getBreadcrumb();

    successRes(res, {
      category,
      breadcrumb,
      message: "Category retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting category:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Create category
 * POST /api/admin/categories/categories
 */
module.exports.createCategory = catchAsync(async (req, res) => {
  try {
    const {
      name,
      idAttribute,
      materialId,
      genderId,
      itemId,
      description,
      imageUrl,
      sortOrder,
      seoTitle,
      seoDescription
    } = req.body;

    if (!name || !idAttribute || !materialId || !genderId || !itemId) {
      return errorRes(
        res,
        400,
        "Name, ID attribute, materialId, genderId, and itemId are required"
      );
    }

    // Validate parent references
    const [material, gender, item] = await Promise.all([
      Material.findById(materialId),
      Gender.findById(genderId),
      Item.findById(itemId)
    ]);

    if (!material) return errorRes(res, 400, "Invalid material ID");
    if (!gender) return errorRes(res, 400, "Invalid gender ID");
    if (!item) return errorRes(res, 400, "Invalid item ID");

    // Check for duplicate within same hierarchy path
    const existing = await Category.findOne({
      materialId,
      genderId,
      itemId,
      idAttribute: idAttribute.toUpperCase()
    });

    if (existing) {
      return errorRes(
        res,
        400,
        `Category with ID attribute "${idAttribute}" already exists in this path`
      );
    }

    const category = await Category.create({
      name,
      idAttribute: idAttribute.toUpperCase(),
      materialId,
      genderId,
      itemId,
      description,
      imageUrl,
      sortOrder: sortOrder || 0,
      seoTitle,
      seoDescription
    });

    // Populate and return
    await category.populate([
      { path: "materialId", select: "name idAttribute metalType" },
      { path: "genderId", select: "name idAttribute" },
      { path: "itemId", select: "name idAttribute" }
    ]);

    successRes(res, {
      category,
      message: "Category created successfully"
    });
  } catch (error) {
    console.error("Error creating category:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});

/**
 * Get category impact (affected products/subcategories)
 * GET /api/admin/categories/categories/:id/impact
 */
module.exports.getCategoryImpact = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id);
    if (!category) {
      return errorRes(res, 404, "Category not found");
    }

    const productsCount = await Product.countDocuments({ categoryId: id });
    const subcategoriesCount = await Subcategory.countDocuments({ categoryId: id });

    successRes(res, {
      impact: {
        productsCount,
        subcategoriesCount
      },
      message: "Category impact retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting category impact:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Update category
 * PUT /api/admin/categories/categories/:id
 */
module.exports.updateCategory = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      imageUrl,
      isActive,
      sortOrder,
      seoTitle,
      seoDescription
    } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return errorRes(res, 404, "Category not found");
    }

    // Cannot change idAttribute or parent references (would break fullCategoryId)
    if (name) category.name = name;
    if (description !== undefined) category.description = description;
    if (imageUrl !== undefined) category.imageUrl = imageUrl;
    if (isActive !== undefined) category.isActive = isActive;
    if (sortOrder !== undefined) category.sortOrder = sortOrder;
    if (seoTitle !== undefined) category.seoTitle = seoTitle;
    if (seoDescription !== undefined) category.seoDescription = seoDescription;

    await category.save();

    await category.populate([
      { path: "materialId", select: "name idAttribute metalType" },
      { path: "genderId", select: "name idAttribute" },
      { path: "itemId", select: "name idAttribute" }
    ]);

    successRes(res, {
      category,
      message: "Category updated successfully"
    });
  } catch (error) {
    console.error("Error updating category:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Delete category
 * DELETE /api/admin/categories/categories/:id
 */
module.exports.deleteCategory = catchAsync(async (req, res) => {
  const mongoose = require("mongoose");
  const { id } = req.params;
  const { force = false } = req.query;

  const category = await Category.findById(id);
  if (!category) {
    return errorRes(res, 404, "Category not found");
  }

  // Check for subcategories
  const subcategoriesCount = await Subcategory.countDocuments({ categoryId: id });
  // Check for direct products
  const productsCount = await Product.countDocuments({ categoryId: id });

  if ((subcategoriesCount > 0 || productsCount > 0) && force !== "true") {
    return errorRes(
      res,
      400,
      `Cannot delete category. It has ${subcategoriesCount} subcategories and ${productsCount} products. Use force=true to cascade delete everything.`
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const ProductVariant = require("../models/product_varient");
    const { RfidTag } = require("../models/rfid-tag.model");
    const Inventory = require("../models/inventory.model");
    const SubcategoryPricing = require("../models/subcategory-pricing.model");

    if (force === "true") {
      // Find all products under this category
      const productIds = await Product.find({ categoryId: id }).distinct("_id").session(session);

      if (productIds.length > 0) {
        // Cascade delete all product-related data
        await Promise.all([
          ProductVariant.deleteMany({ productId: { $in: productIds } }).session(session),
          RfidTag.deleteMany({ product: { $in: productIds } }).session(session),
          Inventory.deleteMany({ product: { $in: productIds } }).session(session),
        ]);
        // Delete products
        await Product.deleteMany({ categoryId: id }).session(session);
      }

      // Delete subcategory pricing configs
      const subcategoryIds = await Subcategory.find({ categoryId: id }).distinct("_id").session(session);
      if (subcategoryIds.length > 0) {
        await SubcategoryPricing.deleteMany({ subcategoryId: { $in: subcategoryIds } }).session(session);
      }

      // Delete all subcategories
      await Subcategory.deleteMany({ categoryId: id }).session(session);
    }

    // Delete the category itself
    await Category.findByIdAndDelete(id).session(session);

    await session.commitTransaction();
    session.endSession();

    logAudit({
      entityType: AUDIT_ENTITIES.CATEGORY,
      entityId: category._id,
      action: AUDIT_ACTIONS.DELETE,
      actorId: req.admin?._id,
      actorName: req.admin?.name || "Admin",
      summary: `Deleted category "${category.name}" (${category.fullCategoryId || category.idAttribute})`,
      changes: { before: { name: category.name, idAttribute: category.idAttribute } },
      metadata: { force: force === "true", subcategoriesDeleted: subcategoriesCount, productsDeleted: productsCount }
    });

    successRes(res, {
      message: "Category deleted successfully",
      deleted: {
        subcategories: force === "true" ? subcategoriesCount : 0,
        products: force === "true" ? productsCount : 0,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting category:", error);
    internalServerError(res, error.message);
  }
});

// ==================== IMPACT & DELETE — Level 1 (Material) ====================

/**
 * Get material impact
 * GET /api/admin/categories/materials/:id/impact
 */
module.exports.getMaterialImpact = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const material = await Material.findById(id);
    if (!material) return errorRes(res, 404, "Material not found");

    const [categoriesCount, subcategoriesCount, productsCount] = await Promise.all([
      Category.countDocuments({ materialId: id }),
      Subcategory.countDocuments({ materialId: id }),
      Product.countDocuments({ materialId: id }),
    ]);

    successRes(res, {
      impact: { categoriesCount, subcategoriesCount, productsCount },
      message: "Material impact retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting material impact:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Delete material
 * DELETE /api/admin/categories/materials/:id
 */
module.exports.deleteMaterial = catchAsync(async (req, res) => {
  const { id } = req.params;

  const material = await Material.findById(id);
  if (!material) return errorRes(res, 404, "Material not found");

  const categoriesCount = await Category.countDocuments({ materialId: id });
  if (categoriesCount > 0) {
    return errorRes(
      res,
      400,
      `Cannot delete material. It is used by ${categoriesCount} categories. Delete or reassign those categories first.`
    );
  }

  await Material.findByIdAndDelete(id);
  logAudit({ entityType: AUDIT_ENTITIES.MATERIAL, entityId: material._id, action: AUDIT_ACTIONS.DELETE, actorId: req.admin?._id, actorName: req.admin?.name || "Admin", summary: `Deleted material "${material.name}"`, changes: { before: { name: material.name, idAttribute: material.idAttribute } } });
  successRes(res, { message: "Material deleted successfully" });
});

// ==================== IMPACT & DELETE — Level 2 (Gender) ====================

/**
 * Get gender impact
 * GET /api/admin/categories/genders/:id/impact
 */
module.exports.getGenderImpact = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const gender = await Gender.findById(id);
    if (!gender) return errorRes(res, 404, "Gender not found");

    const [categoriesCount, subcategoriesCount, productsCount] = await Promise.all([
      Category.countDocuments({ genderId: id }),
      Subcategory.countDocuments({ genderId: id }),
      Product.countDocuments({ genderId: id }),
    ]);

    successRes(res, {
      impact: { categoriesCount, subcategoriesCount, productsCount },
      message: "Gender impact retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting gender impact:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Delete gender
 * DELETE /api/admin/categories/genders/:id
 */
module.exports.deleteGender = catchAsync(async (req, res) => {
  const { id } = req.params;

  const gender = await Gender.findById(id);
  if (!gender) return errorRes(res, 404, "Gender not found");

  const categoriesCount = await Category.countDocuments({ genderId: id });
  if (categoriesCount > 0) {
    return errorRes(
      res,
      400,
      `Cannot delete gender. It is used by ${categoriesCount} categories. Delete or reassign those categories first.`
    );
  }

  await Gender.findByIdAndDelete(id);
  logAudit({ entityType: AUDIT_ENTITIES.GENDER, entityId: gender._id, action: AUDIT_ACTIONS.DELETE, actorId: req.admin?._id, actorName: req.admin?.name || "Admin", summary: `Deleted gender "${gender.name}"`, changes: { before: { name: gender.name, idAttribute: gender.idAttribute } } });
  successRes(res, { message: "Gender deleted successfully" });
});

// ==================== IMPACT & DELETE — Level 3 (Item) ====================

/**
 * Get item impact
 * GET /api/admin/categories/items/:id/impact
 */
module.exports.getItemImpact = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Item.findById(id);
    if (!item) return errorRes(res, 404, "Item not found");

    const [categoriesCount, subcategoriesCount, productsCount] = await Promise.all([
      Category.countDocuments({ itemId: id }),
      Subcategory.countDocuments({ itemId: id }),
      Product.countDocuments({ itemId: id }),
    ]);

    successRes(res, {
      impact: { categoriesCount, subcategoriesCount, productsCount },
      message: "Item impact retrieved successfully",
    });
  } catch (error) {
    console.error("Error getting item impact:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Delete item
 * DELETE /api/admin/categories/items/:id
 */
module.exports.deleteItem = catchAsync(async (req, res) => {
  const { id } = req.params;

  const item = await Item.findById(id);
  if (!item) return errorRes(res, 404, "Item not found");

  const categoriesCount = await Category.countDocuments({ itemId: id });
  if (categoriesCount > 0) {
    return errorRes(
      res,
      400,
      `Cannot delete item. It is used by ${categoriesCount} categories. Delete or reassign those categories first.`
    );
  }

  await Item.findByIdAndDelete(id);
  logAudit({ entityType: AUDIT_ENTITIES.ITEM, entityId: item._id, action: AUDIT_ACTIONS.DELETE, actorId: req.admin?._id, actorName: req.admin?.name || "Admin", summary: `Deleted item "${item.name}"`, changes: { before: { name: item.name, idAttribute: item.idAttribute } } });
  successRes(res, { message: "Item deleted successfully" });
});

// ==================== SUBCATEGORIES FLAT LIST ====================

/**
 * Get all subcategories with full hierarchy path (for flat dropdown)
 * GET /api/admin/categories/subcategories/flat
 */
module.exports.getAllSubcategoriesFlat = catchAsync(async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }

    const subcategories = await Subcategory.find(query)
      .populate("materialId", "name idAttribute metalType")
      .populate("genderId", "name idAttribute")
      .populate("itemId", "name idAttribute")
      .populate("categoryId", "name idAttribute")
      .sort({ fullCategoryId: 1 });

    // Transform to flat list with display labels
    const flatList = subcategories.map((sub) => {
      const material = sub.materialId;
      const gender = sub.genderId;
      const item = sub.itemId;
      const category = sub.categoryId;

      // Build display label: "Material > Gender > Item > Category > Subcategory"
      const displayLabel = [
        material?.name,
        gender?.name,
        item?.name,
        category?.name,
        sub.name
      ]
        .filter(Boolean)
        .join(" > ");

      return {
        _id: sub._id,
        name: sub.name,
        fullCategoryId: sub.fullCategoryId,
        displayLabel,
        material: material
          ? { _id: material._id, name: material.name, metalType: material.metalType }
          : null,
        gender: gender ? { _id: gender._id, name: gender.name } : null,
        item: item ? { _id: item._id, name: item.name } : null,
        category: category ? { _id: category._id, name: category.name } : null,
        materialId: sub.materialId?._id,
        genderId: sub.genderId?._id,
        itemId: sub.itemId?._id,
        categoryId: sub.categoryId?._id,
        hasPricingConfig: sub.hasPricingConfig,
        isActive: sub.isActive
      };
    });

    successRes(res, {
      subcategories: flatList,
      message: "Subcategories retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting flat subcategories:", error);
    internalServerError(res, error.message);
  }
});

// ==================== HIERARCHY HELPERS ====================

/**
 * Get full hierarchy tree
 * GET /api/admin/categories/hierarchy
 */
module.exports.getFullHierarchy = catchAsync(async (req, res) => {
  try {
    const materials = await Material.find({ isActive: true }).sort({ sortOrder: 1 });
    const genders = await Gender.find({ isActive: true }).sort({ sortOrder: 1 });
    const items = await Item.find({ isActive: true }).sort({ sortOrder: 1 });
    const categories = await Category.find({ isActive: true })
      .populate("materialId", "name idAttribute")
      .populate("genderId", "name idAttribute")
      .populate("itemId", "name idAttribute")
      .sort({ sortOrder: 1 });

    successRes(res, {
      hierarchy: {
        materials,
        genders,
        items,
        categories
      },
      message: "Hierarchy retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting hierarchy:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get cascading options for category form
 * GET /api/admin/categories/cascade
 */
module.exports.getCascadeOptions = catchAsync(async (req, res) => {
  try {
    const { materialId, genderId, itemId } = req.query;

    const result = {
      materials: await Material.find({ isActive: true }).sort({ sortOrder: 1 }),
      genders: [],
      items: [],
      categories: []
    };

    // Genders are independent of materials
    result.genders = await Gender.find({ isActive: true }).sort({ sortOrder: 1 });

    // Items are independent of materials/genders
    result.items = await Item.find({ isActive: true }).sort({ sortOrder: 1 });

    // Categories depend on all three
    if (materialId && genderId && itemId) {
      result.categories = await Category.find({
        materialId,
        genderId,
        itemId,
        isActive: true
      }).sort({ sortOrder: 1 });
    }

    successRes(res, {
      ...result,
      message: "Cascade options retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting cascade options:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Quick create - create any level from one endpoint
 * POST /api/admin/categories/quick-create
 */
module.exports.quickCreate = catchAsync(async (req, res) => {
  try {
    const { level, data } = req.body;

    if (!level || !data) {
      return errorRes(res, 400, "Level and data are required");
    }

    let created;

    switch (level) {
      case 1:
      case "material":
        created = await Material.create(data);
        break;
      case 2:
      case "gender":
        created = await Gender.create(data);
        break;
      case 3:
      case "item":
        created = await Item.create(data);
        break;
      case 4:
      case "category":
        created = await Category.create(data);
        await created.populate([
          { path: "materialId", select: "name idAttribute" },
          { path: "genderId", select: "name idAttribute" },
          { path: "itemId", select: "name idAttribute" }
        ]);
        break;
      default:
        return errorRes(res, 400, "Invalid level. Use 1-4 or material/gender/item/category");
    }

    successRes(res, {
      created,
      level,
      message: `${level} created successfully`
    });
  } catch (error) {
    console.error("Error in quick create:", error);
    if (error.name === "ValidationError") {
      return errorRes(res, 400, error.message);
    }
    internalServerError(res, error.message);
  }
});
