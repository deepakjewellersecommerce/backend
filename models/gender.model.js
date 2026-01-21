const mongoose = require("mongoose");

/**
 * Gender Model (Level 2 of Category Hierarchy)
 * Represents target audience/gender (Male, Female, Child, Other)
 */
const genderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Gender name is required"],
      trim: true,
      maxlength: [50, "Name cannot exceed 50 characters"]
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
genderSchema.index({ slug: 1 }, { unique: true });
genderSchema.index({ idAttribute: 1 }, { unique: true });
genderSchema.index({ isActive: 1 });
genderSchema.index({ sortOrder: 1 });

// Pre-save: Auto-generate slug from name if not provided
genderSchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }
  next();
});

// Virtual: Level indicator (always 2 for Gender)
genderSchema.virtual("level").get(function () {
  return 2;
});

/**
 * Static: Get all active genders
 */
genderSchema.statics.getActiveGenders = async function () {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

const Gender = mongoose.model("Gender", genderSchema);
module.exports = Gender;
