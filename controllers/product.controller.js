const mongoose = require("mongoose");
const asynchandler = require("express-async-handler");
const {
  errorRes,
  internalServerError,
  successRes,
  shortIdChar,
} = require("../utility");
const shortid = require("shortid");
const { deleteFromCloudinary } = require("../middlewares/Cloudinary");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const { Product } = require("../models/product.model");
const getAllNestedSubcategories = require("../utility/utils");
const ProductVariant = require("../models/product_varient");
const { Product_Color } = require("../models/product_color.model");
const namedColors = require("color-name-list");
const ProductImage = require("../models/product_images");
const silverPriceService = require("../services/silver-price.service");
const cacheService = require("../services/cache.service");
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } = require("../models/audit-log.model");
const Inventory = require("../models/inventory.model");
const ProductSequence = require("../models/product-sequence.model");
const Subcategory = require("../models/subcategory.model.js");

module.exports.addProduct_post = catchAsync(async (req, res) => {
  // Parse product data from form-data
  let productData;
  if (req.body.product) {
    try {
      productData = JSON.parse(req.body.product);
    } catch (err) {
      return errorRes(res, 400, "Invalid product data JSON.");
    }
  } else {
    productData = req.body;
  }

  if (!productData) return errorRes(res, 400, "Product details are required.");

  // Handle SKU auto-generation if boxNumber is provided and skuNo is not provided
  if (productData.boxNumber && !productData.skuNo) {
    const subcategoryId = productData.subcategoryId;
    const boxNumber = productData.boxNumber;

    if (!subcategoryId) {
      return errorRes(res, 400, "Subcategory is required for SKU generation");
    }

    try {
      // Fetch subcategory to get category code
      const subcategory = await Subcategory.findById(subcategoryId);
      if (!subcategory) {
        return errorRes(res, 404, "Subcategory not found");
      }

      // Extract category code from fullCategoryId (remove hyphens)
      const categoryCode = subcategory.fullCategoryId
        ? subcategory.fullCategoryId.replace(/-/g, "")
        : "";

      if (!categoryCode) {
        return errorRes(res, 400, "Subcategory does not have a valid category code");
      }

      // Get and increment the sequence
      const { sku } = await ProductSequence.getAndIncrementSequence(
        subcategoryId,
        boxNumber,
        categoryCode
      );

      productData.skuNo = sku;
    } catch (error) {
      return errorRes(res, 400, `SKU generation failed: ${error.message}`);
    }
  }

  if (productData.productSlug) {
    const findSlug = await Product.findOne({
      productSlug: productData.productSlug,
    });
    if (findSlug) {
      return errorRes(res, 400, "Product slug already exist");
    }
  }
  if (productData.skuNo) {
    const findSku = await Product.findOne({ skuNo: productData.skuNo });
    if (findSku) {
      return errorRes(res, 400, "Product sku already exist");
    }
  }

  // If metalType is not provided, fetch it from the Material
  if (!productData.metalType || productData.metalType === "") {
    if (productData.materialId) {
      try {
        const Material = require("../models/material.model");
        const material = await Material.findById(productData.materialId);
        if (material && material.metalType) {
          productData.metalType = material.metalType;
          console.log("Auto-populated metalType from material:", productData.metalType);
        }
      } catch (error) {
        console.error("Error fetching material:", error);
      }
    }
  }

  // Handle image uploads
  const files = req.files || [];
  const { uploadOnCloudinary, deleteFromCloudinary } = require("../middlewares/Cloudinary");
  let imageUrls = [];
  let cloudinaryPublicIds = [];
  for (const file of files) {
    const data = await uploadOnCloudinary(file.path);
    if (data && data.secure_url) {
      imageUrls.push(data.secure_url);
      cloudinaryPublicIds.push(data.public_id);
    }
  }
  // Only overwrite productImageUrl when actual files were uploaded;
  // otherwise keep any URL(s) that came in the JSON payload.
  if (imageUrls.length > 0) {
    productData.productImageUrl = imageUrls;
  } else if (!Array.isArray(productData.productImageUrl)) {
    // Normalise to array when no file upload and a URL string was passed
    productData.productImageUrl = productData.productImageUrl
      ? [productData.productImageUrl]
      : [];
  }

  const product = new Product(productData);

  try {
    const savedProd = await product.save();
    if (!savedProd) {
      // Cleanup images if product not saved
      for (const publicId of cloudinaryPublicIds) {
        await deleteFromCloudinary(publicId);
      }
      return errorRes(res, 400, "Internal server error. Please try again.");
    } else {
      // Calculate and set price based on pricing mode
      await savedProd.calculatePrice();

      const result = await Product.findById(savedProd._id).select("-__v");
      return successRes(res, {
        product: result,
        message: "Product added successfully.",
      });
    }
  } catch (err) {
    console.error("Product save error:", err);

    // Cleanup images if product creation fails
    for (const publicId of cloudinaryPublicIds) {
      await deleteFromCloudinary(publicId);
    }

    // Extract and format validation errors
    if (err.name === "ValidationError") {
      const errorDetails = {};
      Object.keys(err.errors).forEach((key) => {
        errorDetails[key] = err.errors[key].message;
      });

      // Format error message with field details
      const fieldErrors = Object.entries(errorDetails)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join("; ");

      return res.status(400).json({
        status: "error",
        error: {
          code: 400,
          message: "Product validation failed",
          fields: errorDetails,
          details: fieldErrors,
        },
      });
    }

    return internalServerError(res, err);
  }
});

const bulkAddProducts = catchAsync(async function (products) {
  const product = products[0];
  const colorsPresent = await Product_Color.find();
  const colorsInVarients = new Set();

  Array.from(product.varients).forEach((element) => {
    colorsInVarients.add(element.color);
  });

  const colors = Array.from(colorsInVarients);

  const notAvailableColors = colors.filter((color) => {
    return !colorsPresent.find((e) => e.slug === color);
  });

  const colorsToInsert = notAvailableColors.map((color) => {
    return {
      color_name: String(color).toLocaleLowerCase(),
      hexcode:
        namedColors.find((e) =>
          e.name.toLowerCase().match(new RegExp(`^${color.toLowerCase()}`))
        )?.hex || "#ffffff",
      slug: String(color).toUpperCase(),
    };
  });

  await Product_Color.insertMany(colorsToInsert);

  const savedProduct = await Product.create(product);

  const newColors = await Product_Color.find();

  const bulkVarients = product.varients.map((variant) => ({
    productId: savedProduct._id,
    size: variant.size,
    price: variant.price,
    salePrice: variant.salePrice,
    stock: variant.stock,
    color: newColors.find((e) => e.slug === variant.color)._id,
    imageUrls: variant.imageUrls,
  }));

  await ProductVariant.insertMany(bulkVarients);
    const { uploadOnCloudinary } = require("../middlewares/Cloudinary");
    for (const product of products) {
      // Handle product images
      if (product.images && Array.isArray(product.images)) {
        let imageUrls = [];
        for (const file of product.images) {
          const url = await uploadOnCloudinary(file);
          if (url) imageUrls.push(url);
        }
        product.productImageUrl = imageUrls;
      }
      // Handle variant images
      if (product.varients && Array.isArray(product.varients)) {
        for (const variant of product.varients) {
          if (variant.images && Array.isArray(variant.images)) {
            let variantImageUrls = [];
            for (const file of variant.images) {
              const url = await uploadOnCloudinary(file);
              if (url) variantImageUrls.push(url);
            }
            variant.imageUrls = variantImageUrls;
          }
        }
      }
    }
});

module.exports.uploadProductBulk = catchAsync(async (req, res) => {
  const { products } = req.body;

  if (!products || products.length === 0)
    return errorRes(res, 400, "Products are required.");

  try {
    const insertedProducts = await bulkAddProducts(products);
    successRes(
      res,
      { products: insertedProducts },
      "Products added successfully."
    );
  } catch (error) {
    console.error(error);
    errorRes(res, 500, "Error while adding products: " + error.message);
  }
});

module.exports.editProduct_post = catchAsync(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) {
    return errorRes(res, 400, "Invalid product id");
  }
  const { product: productData } = req.body;

  if (!productData) return errorRes(res, 400, "Product details are required.");

  if (productData.productSlug) {
    const findSlug = await Product.findOne({
      productSlug: productData.productSlug,
      _id: { $ne: productId },
    });
    if (findSlug) {
      return errorRes(res, 400, "Product slug already exist");
    }
  }
  if (productData.skuNo) {
    const findSku = await Product.findOne({
      skuNo: productData.skuNo,
      _id: { $ne: productId },
    });
    if (findSku) {
      return errorRes(res, 400, "Product sku already exist");
    }
  }

  const product = await Product.findById(productId);
  if (!product) return errorRes(res, 400, "Product not found.");

  // Only allow updating safe fields — never overwrite identity/hierarchy fields
  const allowedEditFields = [
    'productTitle', 'productSlug', 'productDescription', 'careHandling',
    'grossWeight', 'netWeight',
    'pricingMode', 'staticPrice', 'salePrice',
    'isActive', 'isFeatured',
    'productImageUrl', 'seoTitle', 'seoDescription',
  ];
  const safeData = {};
  for (const key of allowedEditFields) {
    if (productData[key] !== undefined) {
      safeData[key] = productData[key];
    }
  }
  Object.assign(product, safeData);
  const updatedProduct = await product.save();

  // Recalculate price if pricing-related or weight/gemstone fields were updated
  const needsRecalculation =
    productData.staticPrice !== undefined ||
    productData.pricingMode !== undefined ||
    productData.grossWeight !== undefined ||
    productData.netWeight !== undefined;

  if (needsRecalculation) {
    await updatedProduct.calculatePrice();
  }

  successRes(res, { product: updatedProduct }, "Product updated successfully.");
});

module.exports.allProducts_get = catchAsync(async (req, res) => {
  const search = req.query.search;
  const categoryId = req.query.categoryId;
  const subcategoryId = req.query.subcategoryId;
  const isAdmin = req?.user?.role == "admin";
  const filter = {};

  if (search) {
    filter.productTitle = { $regex: search, $options: "i" };
  }

  if (!isAdmin) {
    filter.isActive = true;
  }

  // subcategoryId takes priority; fall back to categoryId (which also covers nested subcategories)
  if (subcategoryId && mongoose.isValidObjectId(subcategoryId)) {
    filter.subcategoryId = subcategoryId;
  } else if (categoryId && mongoose.isValidObjectId(categoryId)) {
    const nested = await getAllNestedSubcategories(categoryId);
    const categoryIds = nested.map((c) => c._id.toString());
    categoryIds.push(categoryId);
    filter.categoryId = { $in: categoryIds };
  }

  const products = await buildPaginatedSortedFilteredQuery(
    Product.find(filter)
      .sort("-createdAt")
      .populate("categoryId", "_id name description displayImage"),
    req,
    Product
  );

  successRes(res, {
    products: products,
    totalPage: Math.ceil(products.total / products.limit),
    currentPage: products.page,
    limit: products.limit,
  });
});

module.exports.getParticularProduct_get = catchAsync(async (req, res) => {
  const { productId } = req.params;
  // Defensive validation: ensure productId is a valid ObjectId to avoid CastError if a string like 'low-stock' is passed
  if (!mongoose.isValidObjectId(productId)) {
    return errorRes(res, 400, 'Invalid product id');
  }
  const isAdmin = req.user?.role !== "admin" ? false : true;
  const filter = { _id: productId };
  if (!isAdmin) {
    filter.isActive = true;
  }
  const productPromise = Product.find(filter).populate(
    "categoryId",
    "_id name description displayImage"
  );
  const variantPromise = ProductVariant.find(filter).populate(
    "color",
    "_id color_name hexcode"
  );

  const productImagePromise = ProductImage.find({ productId });

  const [product, variants, images] = await Promise.all([
    productPromise,
    variantPromise,
    productImagePromise,
  ]);

  if (!product[0]) return errorRes(res, 404, "Product not found.");

  successRes(res, { product: product[0], variants, images });
});

module.exports.deleteProduct_delete = catchAsync(async (req, res) => {
  const { productId } = req.params;
  if (!mongoose.isValidObjectId(productId)) {
    return errorRes(res, 400, "Invalid product id");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find product and delete associated images from Cloudinary
    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      session.endSession();
      return errorRes(res, 404, "Product not found");
    }

    // Delete images from Cloudinary (best-effort, outside transaction)
    const imageUrls = product.productImageUrl || [];

    // Cascade delete: variants, RFID tags, inventory
    const { RfidTag } = require("../models/rfid-tag.model");

    const [variantsDeleted, rfidDeleted, inventoryDeleted] = await Promise.all([
      ProductVariant.deleteMany({ productId }).session(session),
      RfidTag.deleteMany({ product: productId }).session(session),
      Inventory.deleteMany({ product: productId }).session(session),
    ]);

    // Delete the product itself
    await Product.findByIdAndDelete(productId).session(session);

    await session.commitTransaction();
    session.endSession();

    // Cleanup Cloudinary images after successful transaction (best-effort)
    for (const imageUrl of imageUrls) {
      try {
        await deleteFromCloudinary(imageUrl);
      } catch (err) {
        console.error("Error deleting image from Cloudinary:", err);
      }
    }

    // Audit log (fire-and-forget)
    logAudit({
      entityType: AUDIT_ENTITIES.PRODUCT,
      entityId: product._id,
      action: AUDIT_ACTIONS.DELETE,
      actorId: req.admin?._id || req.user?._id,
      actorName: req.admin?.name || "Admin",
      summary: `Deleted product "${product.productTitle}" (${product.skuNo})`,
      changes: { before: { title: product.productTitle, skuNo: product.skuNo, metalType: product.metalType } },
      metadata: { variants: variantsDeleted.deletedCount, rfidTags: rfidDeleted.deletedCount, inventory: inventoryDeleted.deletedCount }
    });

    return successRes(res, {
      message: "Product and all related data deleted successfully.",
      deleted: {
        variants: variantsDeleted.deletedCount,
        rfidTags: rfidDeleted.deletedCount,
        inventory: inventoryDeleted.deletedCount,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting product:", error);
    return internalServerError(res, error);
  }
});

module.exports.filterProducts_post = async (req, res) => {
  const {
    categories,
    product_subCategory,
    minPrice,
    maxPrice,
    colors,
    sortBy,
  } = req.body;

  let query = {};
  let query1 = {};

  if (minPrice && maxPrice) {
    query.price = { $gte: minPrice, $lte: maxPrice };
    query1.price = { $gte: minPrice, $lte: maxPrice };
  } else if (minPrice) {
    query.price = { $gte: minPrice };
    query1.price = { $gte: minPrice };
  } else if (maxPrice) {
    query.price = { $lte: maxPrice };
    query1.price = { $lte: maxPrice };
  }

  if (colors && colors.length != 0) {
    query.color = { $in: colors };
    query1.color = { $in: colors };
  }

  // let subCategoryQuery = {};

  if (product_subCategory && product_subCategory.length != 0) {
    query1.product_subCategory = { $in: product_subCategory };
  }

  if (categories && categories.length != 0) {
    query.product_category = { $in: categories };
  }

  let combinedQuery =
    categories?.length > 0 && product_subCategory?.length > 0
      ? [query, query1]
      : categories?.length > 0
      ? [query]
      : [query1];

  let sortQuery = {};

  if (sortBy === "price-high-to-low") sortQuery.price = -1;
  else if (sortBy === "price-low-to-high") sortQuery.price = 1;
  else if (sortBy === "latest") sortQuery.createdAt = -1;

  // console.log({ query, subCategoryQuery, sortQuery });
  try {
    const products = await Product.find({
      $or: combinedQuery,
    })
      .populate("color category")
      .sort(sortQuery);
    return successRes(res, { products });
  } catch (err) {
    return internalServerError(res, err);
  }
};

module.exports.randomProducts_get = async (req, res) => {
  const limit = Number(req.params.limit); // Convert to number
  if (isNaN(limit) || limit <= 0) {
    return errorRes(res, 400, "Invalid limit parameter.");
  }

  Product.find()
    .populate("categoryId color")
    .limit(limit)
    .then((products) => successRes(res, { products }))
    .catch((err) => internalServerError(res, err));
};
module.exports.paginatedSearch = asynchandler(async (req, res) => {
  const { page, limit } = req.query;
  console.log(req.query);
  const getAllProducts = await Product.find();
  if (getAllProducts) {
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const result = getAllProducts.slice(startIndex, endIndex);
    const finalResult = {
      result: result,
      totalPage: Math.ceil(getAllProducts.length / limit),
    };
    successRes(res, finalResult);
  } else {
    internalServerError(res, "Unable to fetch the products");
  }
});

module.exports.availabilityUpdate_put = async (req, res) => {
  try {
    const { variantId } = req.params;
    const { isAvailable } = req.body;
    if (!variantId || !isAvailable) {
      return errorRes(res, 400, "Please provide variantId and isAvailable.");
    }
    const updatedProduct = await Product.findOneAndUpdate(
      { "priceVarient._id": variantId },
      { $set: { "priceVarient.$.isAvailable": isAvailable } },
      { new: true }
    );
    if (!updatedProduct) {
      return internalServerError(res, "Internal Server Error.");
    }
    successRes(res, { updatedProduct }, "Product update Successfully.");
  } catch (error) {
    internalServerError(res, "error in finding the product");
  }
};

module.exports.searchProduct = async (req, res) => {
  const { query } = req.query;
  const queryObject = {};
  console.log(query);
  if (query) {
    queryObject.displayName = { $regex: query, $options: "i" };
    queryObject.product_subCategory = { $regex: query, $options: "i" };
  }
  try {
    const findProduct = await Product.find(queryObject);
    if (findProduct) {
      successRes(res, findProduct);
    } else {
      errorRes(res, 400, "Cannot find the product");
    }
  } catch (error) {
    internalServerError(res, "Error in searching product");
  }
};

module.exports.prodct_search_get = async (req, res) => {
  try {
    const { query } = req.query;
    const queryObject = {};
    if (query) {
      queryObject.displayName = { $regex: query, $options: "i" };
    }
    const findProduct = await Product.find(queryObject).limit(5);
    if (findProduct) {
      successRes(res, findProduct);
    } else {
      errorRes(res, 400, "Cannot find the product");
    }
  } catch (error) {
    internalServerError(res, "Error in searching product");
  }
};

module.exports.updateFeatured = async (req, res) => {
  try {
    const { productId } = req.params;
    const { isFeatured } = req.body;

    if (!productId || !isFeatured) {
      return errorRes(res, 400, "All details mandatory.");
    }

    const find = await Product.findByIdAndUpdate(
      productId,
      { isFeatured },
      { new: true }
    );

    if (!find) {
      return errorRes(res, 500, "Update Product Failed.");
    }

    successRes(res, find, "Update Product is Done.");
  } catch (error) {
    internalServerError(res, "Internal server error.");
  }
};

module.exports.getFeaturedProducts = async (req, res) => {
  try {
    // Use $match to filter only featured products and $sample to get random products
    const featuredProducts = await Product.aggregate([
      { $match: { isFeatured: true } },
      { $sample: { size: 8 } },
    ]);

    successRes(
      res,
      { products: featuredProducts },
      "Featured products retrieved successfully."
    );
  } catch (error) {
    internalServerError(res, "Internal server error.");
  }
};

// Add method to calculate and update product prices
module.exports.updateProductPricing = catchAsync(async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.isValidObjectId(productId)) {
      return errorRes(res, 400, "Invalid product id");
    }
    
    const product = await Product.findById(productId);
    if (!product) {
      return errorRes(res, 404, "Product not found");
    }

    if (product.isDynamicPricing && product.silverWeight > 0) {
      const priceCalculation = await silverPriceService.calculateDynamicPrice(
        product.silverWeight,
        product.laborPercentage,
        product.gst
      );

      // Update product with new price breakdown
      product.priceBreakdown = {
        ...priceCalculation.breakdown,
        lastCalculated: new Date()
      };
      
      // Update the sale price with calculated price
      product.salePrice = priceCalculation.finalPrice;
      
      await product.save();

      successRes(res, {
        product,
        priceCalculation,
        message: "Product pricing updated successfully"
      });
    } else {
      successRes(res, {
        product,
        message: "Product uses static pricing"
      });
    }
  } catch (error) {
    console.error("Error updating product pricing:", error);
    internalServerError(res, "Error updating product pricing");
  }
});

// Bulk update all products with dynamic pricing
module.exports.bulkUpdatePricing = catchAsync(async (req, res) => {
  try {
    const products = await Product.find({ 
      isDynamicPricing: true,
      silverWeight: { $gt: 0 }
    });

    let updatedCount = 0;
    const errors = [];

    for (const product of products) {
      try {
        const priceCalculation = await silverPriceService.calculateDynamicPrice(
          product.silverWeight,
          product.laborPercentage,
          product.gst
        );

        product.priceBreakdown = {
          ...priceCalculation.breakdown,
          lastCalculated: new Date()
        };
        
        product.salePrice = priceCalculation.finalPrice;
        await product.save();
        updatedCount++;
      } catch (error) {
        errors.push({ productId: product._id, error: error.message });
      }
    }

    successRes(res, {
      updatedCount,
      totalProducts: products.length,
      errors,
      message: `Successfully updated ${updatedCount} products`
    });
  } catch (error) {
    console.error("Error bulk updating pricing:", error);
    internalServerError(res, "Error bulk updating pricing");
  }
});
