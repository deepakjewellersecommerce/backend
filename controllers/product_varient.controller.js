const ProductImage = require("../models/product_images");
const { Product } = require("../models/product.model");
const productVariation = require("../models/product_varient");
const { PRICING_MODES } = require("../models/product_varient");
const catchAsync = require("../utility/catch-async");
const { errorRes } = require("../utility");
const AppError = require("../utility/appError");

// Helper to upload variant image files to Cloudinary
async function uploadVariantImages(files) {
  const { uploadOnCloudinary } = require("../middlewares/Cloudinary");
  const urls = [];
  for (const file of files) {
    const data = await uploadOnCloudinary(file.path);
    if (data && data.secure_url) {
      urls.push(data.secure_url);
    }
  }
  return urls;
}

module.exports.addProductVariation = catchAsync(async (req, res, next) => {
  const existingVariation = await productVariation.findOne({
    productId: req.body.productId,
    size: req.body.size,
    color: req.body.color,
  });

  if (existingVariation) {
    console.log("This variation already exists");
    return res.status(400).json({
      status: "fail",
      message: "This variation already exists",
    });
  }

  // Parse FormData fields
  if (typeof req.body.isActive === "string") {
    req.body.isActive = req.body.isActive === "true";
  }

  // Parse gemstones from FormData (sent as JSON string)
  if (req.body.gemstones && typeof req.body.gemstones === "string") {
    try { req.body.gemstones = JSON.parse(req.body.gemstones); } catch { req.body.gemstones = []; }
  }

  // Parse pricingConfig from FormData (sent as JSON string)
  if (req.body.pricingConfig && typeof req.body.pricingConfig === "string") {
    try { req.body.pricingConfig = JSON.parse(req.body.pricingConfig); } catch { req.body.pricingConfig = undefined; }
  }

  // Upload images to Cloudinary if files were sent
  const files = req.files || [];
  if (files.length > 0) {
    const uploadedUrls = await uploadVariantImages(files);
    req.body.imageUrls = uploadedUrls;
  }

  const variant = await productVariation.create(req.body);

  // Calculate price for dynamic pricing variants
  if (variant.pricingMode !== PRICING_MODES.STATIC_PRICE) {
    try {
      await variant.calculatePrice();
    } catch (error) {
      console.error("Error calculating variant price:", error.message);
      // Continue without failing - price calculation can be retried
    }
  }

  res.status(201).json({
    status: "success",
    data: {
      variant,
    },
  });
});

module.exports.updateProductVariation = catchAsync(async (req, res, next) => {
  // Parse FormData fields
  if (typeof req.body.isActive === "string") {
    req.body.isActive = req.body.isActive === "true";
  }

  // Parse existing imageUrls from FormData (sent as JSON string)
  if (typeof req.body.imageUrls === "string") {
    try { req.body.imageUrls = JSON.parse(req.body.imageUrls); } catch { req.body.imageUrls = []; }
  }

  // Parse gemstones from FormData (sent as JSON string)
  if (req.body.gemstones && typeof req.body.gemstones === "string") {
    try { req.body.gemstones = JSON.parse(req.body.gemstones); } catch { req.body.gemstones = []; }
  }

  // Parse pricingConfig from FormData (sent as JSON string)
  if (req.body.pricingConfig && typeof req.body.pricingConfig === "string") {
    try { req.body.pricingConfig = JSON.parse(req.body.pricingConfig); } catch { delete req.body.pricingConfig; }
  }

  // Upload new images to Cloudinary if files were sent
  const files = req.files || [];
  if (files.length > 0) {
    const uploadedUrls = await uploadVariantImages(files);
    const existing = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : [];
    req.body.imageUrls = [...existing, ...uploadedUrls];
  }

  const variant = await productVariation
    .findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
    .populate("color");
  if (!variant) {
    return next(new AppError("No variant found with that ID", 404));
  }

  // Recalculate price if pricing-relevant fields changed
  const pricingFields = ["pricingMode", "pricingConfig", "staticPrice", "netWeight", "grossWeight", "gemstones"];
  const shouldRecalculate = pricingFields.some(field => req.body[field] !== undefined);

  if (shouldRecalculate && variant.pricingMode !== PRICING_MODES.STATIC_PRICE) {
    try {
      await variant.calculatePrice();
    } catch (error) {
      console.error("Error recalculating variant price:", error.message);
    }
  }

  res.status(200).json({
    status: "success",
    data: {
      variant,
    },
  });
});

module.exports.deleteProductVariation = catchAsync(async (req, res, next) => {
  const variant = await productVariation.findByIdAndDelete(req.params.id);
  if (!variant) {
    return next(new AppError("No product found with that ID", 404));
  }
  res.status(204).json({
    status: "success",
    data: null,
  });
});

module.exports.getAllProductVariation = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const isAdmin = !!req.admin;
  const filter = isAdmin ? {} : { isActive: true };
  
  filter.productId = id;
  console.log(filter);
  const variants = await productVariation.find(filter).populate("color");
  res.status(200).json({
    status: "success",
    results: variants.length,
    data: {
      variants,
    },
  });
});

module.exports.getProductVariation = catchAsync(async (req, res, next) => {
  const variant = await productVariation
    .findById(req.params.id)
    .populate("color");
  if (!variant) {
    return next(new AppError("No product found with that ID", 404));
  }
  res.status(200).json({
    status: "success",
    data: {
      variant,
    },
  });
});

module.exports.addProductImage = catchAsync(async (req, res, next) => {
  const { productId, colorId } = req.params;
  const { uploadOnCloudinary, deleteFromCloudinary } = require("../middlewares/Cloudinary");
  let productImage = await ProductImage.findOne({ productId, color: colorId });

  const files = req.files || [];
  let newImageUrls = [];
  let cloudinaryPublicIds = [];
  for (const file of files) {
    const data = await uploadOnCloudinary(file);
    if (data && data.secure_url) {
      newImageUrls.push(data.secure_url);
      cloudinaryPublicIds.push(data.public_id);
    }
  }

  if (productImage) {
    // Add new images to existing array
    productImage.imageUrls.push(...newImageUrls);
    await productImage.save();
    return res.status(200).json({
      status: "success",
      data: { productImage }
    });
  }

  // Try to create ProductImage document if not exists
  try {
    productImage = await ProductImage.create({
      productId,
      color: colorId,
      imageUrls: newImageUrls
    });
    res.status(200).json({
      status: "success",
      data: { productImage }
    });
  } catch (err) {
    for (const publicId of cloudinaryPublicIds) {
      await deleteFromCloudinary(publicId);
    }
    return res.status(500).json({
      status: "error",
      message: "Failed to save product image document. Cloudinary uploads cleaned up.",
      error: err.message
    });
  }
});

module.exports.getProductImages = catchAsync(async (req, res, next) => {
  const productImage = await ProductImage.findOne({
    productId: req.params.productId,
    color: req.params.colorId,
  });
  if (!productImage) {
    return res.status(200).json({
      status: "success",
      data: {
        productImage,
      },
    });
  }
  res.status(200).json({
    status: "success",
    data: {
      productImage,
    },
  });
});

module.exports.getAllProductImages = catchAsync(async (req, res, next) => {
  const productImage = await ProductImage.find({
    productId: req.params.productId,
  });
  if (!productImage) {
    return res.status(200).json({
      status: "success",
      data: {
        productImage,
      },
    });
  }
  res.status(200).json({
    status: "success",
    data: {
      productImage,
    },
  });
});

/**
 * Preview variant price calculation
 * Returns calculated price without saving
 */
module.exports.previewVariantPrice = catchAsync(async (req, res, next) => {
  const { productId, netWeight, grossWeight, gemstones, pricingMode, pricingConfig } = req.body;

  if (!productId) {
    return res.status(400).json({
      status: "fail",
      message: "productId is required"
    });
  }

  const Product = require("../models/product.model");
  const { MetalPrice } = require("../models/metal-price.model");
  const Subcategory = require("../models/subcategory.model");
  const { calculateBreakdown, createPriceBreakdownData } = require("../utils/price-calculator");

  const product = await Product.findById(productId).populate("subcategoryId");
  if (!product) {
    return res.status(404).json({
      status: "fail",
      message: "Product not found"
    });
  }

  const metalType = product.metalType;

  // If STATIC_PRICE mode, return the static price
  if (pricingMode === PRICING_MODES.STATIC_PRICE) {
    return res.status(200).json({
      status: "success",
      data: {
        preview: {
          calculatedPrice: req.body.staticPrice || 0,
          priceBreakdown: {
            metalType,
            metalRate: 0,
            metalCost: 0,
            gemstoneCost: 0,
            subtotal: req.body.staticPrice || 0,
            totalPrice: req.body.staticPrice || 0
          }
        }
      }
    });
  }

  // Get current metal rate
  const metalPrice = await MetalPrice.getCurrentPrice(metalType);
  const metalRate = metalPrice.pricePerGram;

  // Use variant-specific weight or fallback to product weight
  const effectiveNetWeight = netWeight || product.netWeight;
  const effectiveGrossWeight = grossWeight || product.grossWeight;

  // Calculate gemstone cost
  let gemstoneCost = 0;
  if (gemstones && Array.isArray(gemstones)) {
    gemstoneCost = gemstones.reduce((sum, g) => sum + ((g.weight || 0) * (g.pricePerCarat || 0)), 0);
  }

  // Determine pricing config
  let effectivePricingConfig;
  if (pricingMode === PRICING_MODES.CUSTOM_DYNAMIC && pricingConfig) {
    effectivePricingConfig = pricingConfig;
  } else if (product.pricingMode === "CUSTOM_DYNAMIC" && product.pricingConfig) {
    effectivePricingConfig = product.pricingConfig;
  } else {
    const subcategory = await Subcategory.findById(product.subcategoryId);
    if (!subcategory) {
      return res.status(400).json({
        status: "fail",
        message: "Product subcategory not found"
      });
    }
    effectivePricingConfig = await subcategory.getPricingConfig();
    if (!effectivePricingConfig) {
      return res.status(400).json({
        status: "fail",
        message: "No pricing configuration found"
      });
    }
  }

  // Calculate breakdown
  const context = { netWeight: effectiveNetWeight, metalRate };
  const breakdown = effectivePricingConfig.calculateBreakdown
    ? effectivePricingConfig.calculateBreakdown(context)
    : calculateBreakdown(effectivePricingConfig, context);

  const priceBreakdown = createPriceBreakdownData(breakdown, metalType, gemstoneCost);

  res.status(200).json({
    status: "success",
    data: {
      preview: {
        calculatedPrice: priceBreakdown.totalPrice,
        priceBreakdown,
        effectiveWeight: {
          netWeight: effectiveNetWeight,
          grossWeight: effectiveGrossWeight
        }
      }
    }
  });
});

/**
 * Customize variant pricing (switch to CUSTOM_DYNAMIC)
 */
module.exports.customizeVariantPricing = catchAsync(async (req, res, next) => {
  const variant = await productVariation.findById(req.params.id);
  if (!variant) {
    return next(new AppError("No variant found with that ID", 404));
  }

  await variant.customizePricing();

  res.status(200).json({
    status: "success",
    data: {
      variant
    }
  });
});

/**
 * Reset variant pricing to inherited
 */
module.exports.resetVariantPricing = catchAsync(async (req, res, next) => {
  const variant = await productVariation.findById(req.params.id);
  if (!variant) {
    return next(new AppError("No variant found with that ID", 404));
  }

  await variant.resetPricing();

  res.status(200).json({
    status: "success",
    data: {
      variant
    }
  });
});
