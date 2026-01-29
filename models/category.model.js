const mongoose = require("mongoose");

/**
 * Category Model (Level 4 of Category Hierarchy)
 * Represents style/design categories (Temple, Bridal, Modern, etc.)
 * Parent of Subcategories (Level 5+)
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true
      // Not required - auto-generated in pre-save hook
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
    // Parent references (Levels 1-3)
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
    // Auto-generated full category ID with delimiters
    // Format: G22-F-N-T (Material-Gender-Item-Category)
    fullCategoryId: {
      type: String,
      unique: true
    },
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

// Compound unique index for slug within same hierarchy path
categorySchema.index(
  { materialId: 1, genderId: 1, itemId: 1, slug: 1 },
  { unique: true }
);
categorySchema.index({ fullCategoryId: 1 }, { unique: true });
categorySchema.index({ materialId: 1 });
categorySchema.index({ genderId: 1 });
categorySchema.index({ itemId: 1 });
categorySchema.index({ isActive: 1 });
categorySchema.index({ sortOrder: 1 });

// Virtual: Level indicator (always 4 for Category)
categorySchema.virtual("level").get(function () {
  return 4;
});

// Virtual: Subcategories
categorySchema.virtual("subcategories", {
  ref: "Subcategory",
  localField: "_id",
  foreignField: "categoryId"
});

// Pre-save: Auto-generate slug and fullCategoryId
categorySchema.pre("save", async function (next) {
  // Auto-generate slug
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  // Generate fullCategoryId from parent idAttributes
  if (this.isNew || this.isModified("idAttribute")) {
    try {
      const Material = mongoose.model("Material");
      const Gender = mongoose.model("Gender");
      const Item = mongoose.model("Item");

      const [material, gender, item] = await Promise.all([
        Material.findById(this.materialId),
        Gender.findById(this.genderId),
        Item.findById(this.itemId)
      ]);

      if (!material || !gender || !item) {
        return next(new Error("Invalid parent references"));
      }

      this.fullCategoryId = `${material.idAttribute}-${gender.idAttribute}-${item.idAttribute}-${this.idAttribute}`;
    } catch (error) {
      return next(error);
    }
  }

  next();
});

/**
 * Static: Get all active categories
 */
categorySchema.statics.getActiveCategories = async function () {
  return this.find({ isActive: true })
    .populate("materialId", "name idAttribute metalType")
    .populate("genderId", "name idAttribute")
    .populate("itemId", "name idAttribute")
    .sort({ sortOrder: 1, name: 1 });
};

/**
 * Static: Get categories by parent hierarchy
 */
categorySchema.statics.getByHierarchy = async function (
  materialId,
  genderId,
  itemId
) {
  const query = { isActive: true };
  if (materialId) query.materialId = materialId;
  if (genderId) query.genderId = genderId;
  if (itemId) query.itemId = itemId;

  return this.find(query)
    .populate("materialId", "name idAttribute metalType")
    .populate("genderId", "name idAttribute")
    .populate("itemId", "name idAttribute")
    .sort({ sortOrder: 1, name: 1 });
};

/**
 * Static: Get category with full hierarchy path
 */
categorySchema.statics.getWithHierarchy = async function (categoryId) {
  return this.findById(categoryId)
    .populate("materialId", "name idAttribute metalType imageUrl")
    .populate("genderId", "name idAttribute imageUrl")
    .populate("itemId", "name idAttribute imageUrl");
};

/**
 * Instance method: Get breadcrumb path
 */
categorySchema.methods.getBreadcrumb = async function () {
  await this.populate([
    { path: "materialId", select: "name idAttribute" },
    { path: "genderId", select: "name idAttribute" },
    { path: "itemId", select: "name idAttribute" }
  ]);

  return [
    { level: 1, name: this.materialId.name, id: this.materialId._id },
    { level: 2, name: this.genderId.name, id: this.genderId._id },
    { level: 3, name: this.itemId.name, id: this.itemId._id },
    { level: 4, name: this.name, id: this._id }
  ];
};

const Category = mongoose.model("Category", categorySchema);
module.exports = Category;
