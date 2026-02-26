const mongoose = require("mongoose");

const variantGemstoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      enum: [
        "Diamond", "Ruby", "Emerald", "Sapphire", "Pearl",
        "Topaz", "Amethyst", "Garnet", "Opal", "Turquoise",
        "Aquamarine", "Peridot", "Citrine", "Tanzanite", "Custom"
      ]
    },
    customName: { type: String, maxlength: 50 },
    weight: {
      type: Number,
      required: true,
      min: [0.001, "Gemstone weight must be positive"],
    },
    pricePerCarat: {
      type: Number,
      required: true,
      min: [0, "Price per carat cannot be negative"],
    },
    totalCost: { type: Number, default: 0 },
  },
  { _id: true }
);

variantGemstoneSchema.pre("validate", function () {
  this.totalCost = Math.round(this.weight * this.pricePerCarat * 100) / 100;
});

const productVariantSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  size: { type: String, required: true },
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  salePrice: { type: Number },
  stock: { type: Number, required: true },
  imageUrls: [{ type: String }],
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product_Color",
  },
  weight: { type: Number, min: 0 },
  gemstones: {
    type: [variantGemstoneSchema],
    default: [],
    validate: [arr => arr.length <= 50, "Maximum 50 gemstones allowed"],
  },
});

const ProductVariant = mongoose.model("ProductVarient", productVariantSchema);
module.exports = ProductVariant;
