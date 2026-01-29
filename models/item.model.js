const mongoose = require("mongoose");

/**
 * Item Model (Level 3 of Category Hierarchy)
 * Represents jewelry item types (Ring, Necklace, Bracelet, Earring, etc.)
 */
const itemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Item name is required"],
      trim: true,
      maxlength: [100, "Name cannot exceed 100 characters"]
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
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
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
itemSchema.index({ slug: 1 }, { unique: true });
itemSchema.index({ idAttribute: 1 }, { unique: true });
itemSchema.index({ isActive: 1 });
itemSchema.index({ sortOrder: 1 });

// Pre-save: Auto-generate slug from name if not provided
itemSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  next();
});

// Virtual: Level indicator (always 3 for Item)
itemSchema.virtual("level").get(function () {
  return 3;
});

/**
 * Static: Get all active items
 */
itemSchema.statics.getActiveItems = async function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

const Item = mongoose.model("Item", itemSchema);
module.exports = Item;
