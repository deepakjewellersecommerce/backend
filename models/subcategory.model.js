const mongoose = require("mongoose");

/**
 * Subcategory Model (Level 5+ of Category Hierarchy)
 * Supports unlimited recursive nesting below Level 4 (Category)
 *
 * Key Features:
 * - parentSubcategoryId: null = Level 5, populated = Level 6+
 * - ancestorPath: Array of all ancestor subcategory IDs for fast queries
 * - hasPricingConfig: Determines if this subcategory has its own pricing
 * - Pricing inheritance: Products inherit from nearest ancestor with pricing
 */
const subcategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Subcategory name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true
    },
    idAttribute: {
      type: String,
      required: [true, "ID attribute is required"],
      trim: true,
      maxlength: [10, "ID attribute cannot exceed 10 characters"],
      validate: {
        validator: function (v) {
          return !/[-]/.test(v);
        },
        message: "ID attribute cannot contain hyphens"
      }
    },
    // Auto-generated full category ID with delimiters
    // Format: G22-F-N-T-SI or G22-F-N-T-SI-ANT-VIN for nested
    fullCategoryId: {
      type: String,
      unique: true,
      sparse: true
    },

    // Fixed hierarchy references (Levels 1-4)
    materialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Material",
      required: [true, "Material is required"]
    },
    genderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Gender",
      required: [true, "Gender is required"]
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: [true, "Item is required"]
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"]
    },

    // Recursive parent reference (for nesting)
    // null = Level 5 (direct child of Category)
    // populated = Level 6+ (child of another Subcategory)
    parentSubcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      default: null
    },

    // Hierarchy metadata
    level: {
      type: Number,
      default: 5,
      min: [5, "Level must be at least 5"]
    },
    // Array of all ancestor subcategory IDs (for fast descendant queries)
    // Does NOT include Levels 1-4, only subcategory ancestors
    ancestorPath: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Subcategory"
      }
    ],
    // Depth within subcategory tree (0 for Level 5, 1 for Level 6, etc.)
    depth: {
      type: Number,
      default: 0,
      min: 0
    },

    // Pricing configuration
    hasPricingConfig: {
      type: Boolean,
      default: false
    },
    pricingConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubcategoryPricing",
      default: null
    },

    // Metadata
    description: {
      type: String,
      maxlength: [500, "Description cannot exceed 500 characters"]
    },
    imageUrl: {
      type: String,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    sortOrder: {
      type: Number,
      default: 0
    },
    // Cache for product count (updated async)
    productCount: {
      type: Number,
      default: 0
    },
    // SEO fields
    seoTitle: {
      type: String,
      maxlength: [60, "SEO title cannot exceed 60 characters"]
    },
    seoDescription: {
      type: String,
      maxlength: [160, "SEO description cannot exceed 160 characters"]
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for performance
subcategorySchema.index({ fullCategoryId: 1 }, { unique: true, sparse: true });
subcategorySchema.index({ categoryId: 1, parentSubcategoryId: 1 });
subcategorySchema.index({ parentSubcategoryId: 1 });
subcategorySchema.index({ ancestorPath: 1 });
subcategorySchema.index({ materialId: 1 });
subcategorySchema.index({ level: 1 });
subcategorySchema.index({ isActive: 1 });
subcategorySchema.index({ hasPricingConfig: 1 });
// Compound index for slug uniqueness within parent
subcategorySchema.index(
  { parentSubcategoryId: 1, categoryId: 1, slug: 1 },
  { unique: true }
);

// Virtual: Children subcategories
subcategorySchema.virtual("children", {
  ref: "Subcategory",
  localField: "_id",
  foreignField: "parentSubcategoryId"
});

// Virtual: Products in this subcategory
subcategorySchema.virtual("products", {
  ref: "Product",
  localField: "_id",
  foreignField: "subcategoryId"
});

// Pre-save middleware
subcategorySchema.pre("save", async function (next) {
  // Auto-generate slug if not provided
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Calculate level, depth, ancestorPath, and fullCategoryId
  if (this.isNew || this.isModified("parentSubcategoryId") || this.isModified("idAttribute")) {
    try {
      const Category = mongoose.model("Category");
      const category = await Category.findById(this.categoryId).populate([
        { path: "materialId", select: "idAttribute" },
        { path: "genderId", select: "idAttribute" },
        { path: "itemId", select: "idAttribute" }
      ]);

      if (!category) {
        return next(new Error("Invalid category reference"));
      }

      // Build base category ID path (Levels 1-4)
      const basePath = `${category.materialId.idAttribute}-${category.genderId.idAttribute}-${category.itemId.idAttribute}-${category.idAttribute}`;

      if (this.parentSubcategoryId) {
        // Nested subcategory (Level 6+)
        const parent = await this.constructor.findById(this.parentSubcategoryId);
        if (!parent) {
          return next(new Error("Invalid parent subcategory reference"));
        }

        // Check for circular reference
        if (parent.ancestorPath.includes(this._id)) {
          return next(new Error("Circular reference detected"));
        }

        this.level = parent.level + 1;
        this.depth = parent.depth + 1;
        this.ancestorPath = [...parent.ancestorPath, parent._id];
        this.fullCategoryId = `${parent.fullCategoryId}-${this.idAttribute}`;
      } else {
        // Direct child of Category (Level 5)
        this.level = 5;
        this.depth = 0;
        this.ancestorPath = [];
        this.fullCategoryId = `${basePath}-${this.idAttribute}`;
      }
    } catch (error) {
      return next(error);
    }
  }

  next();
});

/**
 * Static: Get subcategory tree for a category
 * Returns hierarchical structure with all descendants
 */
subcategorySchema.statics.getTree = async function (categoryId, includeInactive = true) {
  if (!categoryId) return [];

  // Build query for subcategories in this category
  const query = { categoryId: new mongoose.Types.ObjectId(categoryId) };

  // If includeInactive is explicitly false (or the string 'false'), only include active
  if (includeInactive === false || includeInactive === "false") {
    query.isActive = true;
  }

  // Get all subcategories for this category (optionally including inactive ones)
  const subcategories = await this.find(query)
    .sort({ level: 1, sortOrder: 1, name: 1 })
    .lean();

  // Build tree structure
  const buildTree = (parentId = null) => {
    return subcategories
      .filter((s) =>
        parentId === null
          ? s.parentSubcategoryId === null
          : s.parentSubcategoryId?.toString() === parentId.toString()
      )
      .map((s) => ({
        ...s,
        children: buildTree(s._id)
      }));
  };

  return buildTree();
};

/**
 * Static: Get all descendants of a subcategory
 */
subcategorySchema.statics.getDescendants = async function (subcategoryId) {
  return this.find({
    ancestorPath: subcategoryId,
    isActive: true
  }).sort({ level: 1, sortOrder: 1 });
};

/**
 * Static: Get ancestors of a subcategory
 */
subcategorySchema.statics.getAncestors = async function (subcategoryId) {
  const subcategory = await this.findById(subcategoryId);
  if (!subcategory) return [];

  return this.find({
    _id: { $in: subcategory.ancestorPath }
  }).sort({ level: 1 });
};

/**
 * Instance method: Get pricing config (with inheritance)
 * Walks up the tree to find nearest ancestor with pricing config
 */
subcategorySchema.methods.getPricingConfig = async function () {
  if (this.hasPricingConfig && this.pricingConfigId) {
    const SubcategoryPricing = mongoose.model("SubcategoryPricing");
    return SubcategoryPricing.findById(this.pricingConfigId);
  }

  // Walk up the ancestor tree
  if (this.ancestorPath.length > 0) {
    // Get ancestors in reverse order (nearest first)
    const ancestors = await this.constructor
      .find({
        _id: { $in: this.ancestorPath },
        hasPricingConfig: true
      })
      .sort({ level: -1 })
      .limit(1);

    if (ancestors.length > 0) {
      const SubcategoryPricing = mongoose.model("SubcategoryPricing");
      return SubcategoryPricing.findById(ancestors[0].pricingConfigId);
    }
  }

  // No pricing found in hierarchy - return null (should use system defaults)
  return null;
};

/**
 * Instance method: Get pricing source (which subcategory provides pricing)
 */
subcategorySchema.methods.getPricingSource = async function () {
  if (this.hasPricingConfig) {
    return { source: "self", subcategory: this };
  }

  if (this.ancestorPath.length > 0) {
    const ancestors = await this.constructor
      .find({
        _id: { $in: this.ancestorPath },
        hasPricingConfig: true
      })
      .sort({ level: -1 })
      .limit(1);

    if (ancestors.length > 0) {
      return { source: "inherited", subcategory: ancestors[0] };
    }
  }

  return { source: "none", subcategory: null };
};

/**
 * Instance method: Get full breadcrumb path
 */
subcategorySchema.methods.getBreadcrumb = async function () {
  await this.populate([
    { path: "materialId", select: "name idAttribute" },
    { path: "genderId", select: "name idAttribute" },
    { path: "itemId", select: "name idAttribute" },
    { path: "categoryId", select: "name idAttribute" }
  ]);

  const breadcrumb = [
    { level: 1, type: "material", name: this.materialId.name, id: this.materialId._id },
    { level: 2, type: "gender", name: this.genderId.name, id: this.genderId._id },
    { level: 3, type: "item", name: this.itemId.name, id: this.itemId._id },
    { level: 4, type: "category", name: this.categoryId.name, id: this.categoryId._id }
  ];

  // Add subcategory ancestors
  if (this.ancestorPath.length > 0) {
    const ancestors = await this.constructor
      .find({ _id: { $in: this.ancestorPath } })
      .sort({ level: 1 })
      .select("name idAttribute level");

    ancestors.forEach((ancestor) => {
      breadcrumb.push({
        level: ancestor.level,
        type: "subcategory",
        name: ancestor.name,
        id: ancestor._id
      });
    });
  }

  // Add self
  breadcrumb.push({
    level: this.level,
    type: "subcategory",
    name: this.name,
    id: this._id
  });

  return breadcrumb;
};

/**
 * Instance method: Update product count
 */
subcategorySchema.methods.updateProductCount = async function () {
  const Product = mongoose.model("Product");
  this.productCount = await Product.countDocuments({
    subcategoryId: this._id,
    isActive: true
  });
  return this.save();
};

/**
 * Static: Search subcategories by name
 */
subcategorySchema.statics.search = async function (query, options = {}) {
  const { limit = 20, categoryId = null } = options;

  const filter = {
    isActive: true,
    name: { $regex: query, $options: "i" }
  };

  if (categoryId) {
    filter.categoryId = categoryId;
  }

  return this.find(filter)
    .populate("categoryId", "name fullCategoryId")
    .populate("materialId", "name idAttribute")
    .sort({ level: 1, name: 1 })
    .limit(limit);
};

const Subcategory = mongoose.model("Subcategory", subcategorySchema);
module.exports = Subcategory;
