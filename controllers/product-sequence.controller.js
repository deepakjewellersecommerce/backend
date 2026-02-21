const catchAsync = require("../utility/catch-async");
const { errorRes, successRes, internalServerError } = require("../utility");
const ProductSequence = require("../models/product-sequence.model");
const Subcategory = require("../models/subcategory.model.js");

/**
 * Get the next SKU for a given subcategory and box
 * Also returns the next product number for preview
 * Query params: subcategoryId, boxNumber
 */
module.exports.getNextSKU = catchAsync(async (req, res) => {
  const { subcategoryId, boxNumber } = req.query;

  // Validate input
  if (!subcategoryId || !boxNumber) {
    return errorRes(
      res,
      400,
      "Both subcategoryId and boxNumber are required"
    );
  }

  if (isNaN(boxNumber) || boxNumber < 1) {
    return errorRes(res, 400, "Box number must be a positive number");
  }

  try {
    // Fetch the subcategory to get the category code
    const subcategory = await Subcategory.findById(subcategoryId);
    if (!subcategory) {
      return errorRes(res, 404, "Subcategory not found");
    }

    // Extract category code from fullCategoryId (remove hyphens)
    // e.g., "G22-F-N-T-SI" becomes "G22FNTSI"
    const categoryCode = subcategory.fullCategoryId
      ? subcategory.fullCategoryId.replace(/-/g, "")
      : "";

    if (!categoryCode) {
      return errorRes(res, 400, "Subcategory does not have a valid category code");
    }

    // Get the next product number without incrementing
    const nextProductNumber = await ProductSequence.getNextProductNumber(
      subcategoryId,
      parseInt(boxNumber)
    );

    // Generate SKU preview
    const skuPreview = `${categoryCode}BOX${boxNumber}${nextProductNumber}`;

    return successRes(res, {
      subcategoryId,
      boxNumber: parseInt(boxNumber),
      categoryCode,
      nextProductNumber,
      skuPreview,
      message: "SKU preview generated successfully",
    });
  } catch (error) {
    return internalServerError(res, error);
  }
});

/**
 * Increment the product sequence counter after a product is created
 * This should be called internally after successful product creation
 * Body: { subcategoryId, boxNumber, categoryCode }
 */
module.exports.incrementSequence = catchAsync(async (req, res) => {
  const { subcategoryId, boxNumber, categoryCode } = req.body;

  // Validate input
  if (!subcategoryId || !boxNumber || !categoryCode) {
    return errorRes(
      res,
      400,
      "subcategoryId, boxNumber, and categoryCode are required"
    );
  }

  try {
    // Increment the sequence
    let sequence = await ProductSequence.findOne({
      subcategoryId,
      boxNumber: parseInt(boxNumber),
    });

    if (!sequence) {
      // Create new sequence if it doesn't exist
      sequence = new ProductSequence({
        subcategoryId,
        boxNumber: parseInt(boxNumber),
        categoryCode,
        nextProductNumber: 2, // Next will be 2 since we're incrementing from 1
      });
    } else {
      sequence.nextProductNumber += 1;
    }

    sequence.lastAssignedAt = new Date();
    await sequence.save();

    return successRes(res, {
      message: "Sequence incremented successfully",
      nextProductNumber: sequence.nextProductNumber,
    });
  } catch (error) {
    return internalServerError(res, error);
  }
});

/**
 * Get all sequences for a subcategory
 * Shows all box sequences for a given subcategory
 */
module.exports.getSubcategorySequences = catchAsync(async (req, res) => {
  const { subcategoryId } = req.params;

  if (!subcategoryId) {
    return errorRes(res, 400, "Subcategory ID is required");
  }

  try {
    const sequences = await ProductSequence.find({
      subcategoryId,
    }).select("boxNumber nextProductNumber lastAssignedAt categoryCode");

    return successRes(res, {
      subcategoryId,
      sequences,
      message: "Subcategory sequences retrieved successfully",
    });
  } catch (error) {
    return internalServerError(res, error);
  }
});
