const mongoose = require("mongoose");

/**
 * Product Sequence Model
 * Tracks the next product number for each subcategory and box combination
 * Format: G22FNGBOX1-1, G22FNGBOX1-2, G22FNGBOX2-1, etc.
 */
const productSequenceSchema = new mongoose.Schema(
  {
    // References the subcategory
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subcategory",
      required: [true, "Subcategory ID is required"],
    },

    // Box number for physical storage location
    boxNumber: {
      type: Number,
      required: [true, "Box number is required"],
      min: [1, "Box number must be at least 1"],
    },

    // The category hierarchy code (e.g., "G22FNG" from fullCategoryId)
    // Stored for quick SKU generation without querying subcategory
    categoryCode: {
      type: String,
      required: [true, "Category code is required"],
    },

    // Next product number to assign (e.g., 1, 2, 3, ..., 11, 12, etc.)
    nextProductNumber: {
      type: Number,
      default: 1,
      min: [1, "Next product number must be at least 1"],
    },

    // Timestamp of last assignment
    lastAssignedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Create compound unique index on subcategoryId and boxNumber
    indexes: [
      {
        fields: { subcategoryId: 1, boxNumber: 1 },
        options: { unique: true },
      },
    ],
  }
);

// Add compound unique index
productSequenceSchema.index({ subcategoryId: 1, boxNumber: 1 }, { unique: true });

/**
 * Static method: Get next SKU for a subcategory and box
 * Returns the SKU and increments the counter
 */
productSequenceSchema.statics.getAndIncrementSequence = async function (
  subcategoryId,
  boxNumber,
  categoryCode
) {
  try {
    // Find or create the sequence document
    let sequence = await this.findOne({ subcategoryId, boxNumber });

    if (!sequence) {
      // Create new sequence if it doesn't exist
      sequence = new this({
        subcategoryId,
        boxNumber,
        categoryCode,
        nextProductNumber: 1,
      });
      await sequence.save();
    }

    // Generate SKU: categoryCodeBOX{boxNumber}{productNumber}
    const sku = `${categoryCode}BOX${boxNumber}${sequence.nextProductNumber}`;

    // Increment for next call
    sequence.nextProductNumber += 1;
    sequence.lastAssignedAt = new Date();
    await sequence.save();

    return {
      sku,
      productNumber: sequence.nextProductNumber - 1, // Return the number we just assigned
    };
  } catch (error) {
    throw new Error(`Failed to get next sequence: ${error.message}`);
  }
};

/**
 * Static method: Get next product number without incrementing
 * Used for preview/display in frontend
 */
productSequenceSchema.statics.getNextProductNumber = async function (
  subcategoryId,
  boxNumber
) {
  try {
    const sequence = await this.findOne({ subcategoryId, boxNumber });
    return sequence ? sequence.nextProductNumber : 1;
  } catch (error) {
    throw new Error(`Failed to get next product number: ${error.message}`);
  }
};

/**
 * Static method: Generate SKU preview without incrementing
 */
productSequenceSchema.statics.generateSKUPreview = async function (
  subcategoryId,
  boxNumber,
  categoryCode
) {
  try {
    const nextProductNumber = await this.getNextProductNumber(
      subcategoryId,
      boxNumber
    );
    return `${categoryCode}BOX${boxNumber}${nextProductNumber}`;
  } catch (error) {
    throw new Error(`Failed to generate SKU preview: ${error.message}`);
  }
};

const ProductSequence = mongoose.model("ProductSequence", productSequenceSchema);

module.exports = ProductSequence;
