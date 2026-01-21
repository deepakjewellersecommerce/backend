/**
 * Category Hierarchy Controller
 * Handles CRUD for Levels 1-4: Material, Gender, Item, Category
 */

const Material = require("../models/material.model");
const Gender = require("../models/gender.model");
const Item = require("../models/item.model");
const Category = require("../models/category.model");
const { Product } = require("../models/product.model");
const Subcategory = require("../models/subcategory.model.js");
const { METAL_TYPES } = require("../models/metal-price.model");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

// ==================== MATERIALS (Level 1) ====================

/**
 * Get all materials
 * GET /api/admin/categories/materials
 */
module.exports.getAllMaterials = catchAsync(async (req, res) => {
  try {
    const { includeInactive = false } = req.query;

    const query = {};
    if (!includeInactive || includeInactive === "false") {
      query.isActive = true;
    }

    const materials = await Material.find(query).sort({ sortOrder: 1, name: 1 });

    successRes(res, {
      materials,
      metalTypes: Object.values(METAL_TYPES),
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
    const material = await Material.findById(id);

    if (!material) {
      return errorRes(res, 404, "Material not found");
    }

    successRes(res, {
      material,
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
    const { name, idAttribute, metalType, imageUrl, sortOrder } = req.body;

    if (!name || !idAttribute || !metalType) {
      return errorRes(res, 400, "Name, ID attribute, and metal type are required");
    }

    if (!Object.values(METAL_TYPES).includes(metalType)) {
      return errorRes(res, 400, `Invalid metal type: ${metalType}`);
    }

    // Check for duplicates
    const existingMetal = await Material.findOne({ metalType });
    if (existingMetal) {
      return errorRes(res, 400, `Material for ${metalType} already exists`);
    }

    const existingId = await Material.findOne({ idAttribute: idAttribute.toUpperCase() });
    if (existingId) {
      return errorRes(res, 400, `ID attribute "${idAttribute}" already exists`);
    }

    const material = await Material.create({
      name,
      idAttribute: idAttribute.toUpperCase(),
      metalType,
      imageUrl,
      sortOrder: sortOrder || 0
    });

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
    const { name, imageUrl, isActive, sortOrder } = req.body;

    const material = await Material.findById(id);
    if (!material) {
      return errorRes(res, 404, "Material not found");
    }

    // Cannot change idAttribute or metalType (would break references)
    if (name) material.name = name;
    if (imageUrl !== undefined) material.imageUrl = imageUrl;
    if (isActive !== undefined) material.isActive = isActive;
    if (sortOrder !== undefined) material.sortOrder = sortOrder;

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
