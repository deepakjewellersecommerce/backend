/**
 * Metal Price Controller
 * Handles all metal price related API endpoints
 */

const metalPriceService = require("../services/metal-price.service");
const {
  MetalPrice,
  MetalPriceHistory,
  METAL_TYPES,
  PRICE_SOURCES
} = require("../models/metal-price.model");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } = require("../models/audit-log.model");

/**
 * Get all current metal prices
 * GET /api/admin/metal-prices
 */
module.exports.getAllMetalPrices = catchAsync(async (req, res) => {
  try {
    const prices = await metalPriceService.getAllPrices();

    successRes(res, {
      prices,
      metalTypes: Object.values(METAL_TYPES),
      message: "Metal prices retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting metal prices:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get single metal price
 * GET /api/admin/metal-prices/:metalType
 */
module.exports.getMetalPrice = catchAsync(async (req, res) => {
  try {
    const { metalType } = req.params;

    if (!Object.values(METAL_TYPES).includes(metalType)) {
      return errorRes(res, 400, `Invalid metal type: ${metalType}`);
    }

    const price = await metalPriceService.getCurrentPrice(metalType);
    const affectedCount = await metalPriceService.getAffectedProductsCount(
      metalType
    );

    successRes(res, {
      price: {
        ...price.toObject(),
        affectedProductsCount: affectedCount
      },
      message: "Metal price retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting metal price:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Manual update metal price
 * PUT /api/admin/metal-prices/:metalType
 *
 * After updating the price, auto-triggers product price recalculation
 * for all affected products (non-static, non-frozen).
 */
module.exports.updateMetalPrice = catchAsync(async (req, res) => {
  try {
    const { metalType } = req.params;
    const { pricePerGram } = req.body;
    const adminName = req.admin?.name || "Admin";

    if (!Object.values(METAL_TYPES).includes(metalType)) {
      return errorRes(res, 400, `Invalid metal type: ${metalType}`);
    }

    if (!pricePerGram || pricePerGram <= 0) {
      return errorRes(res, 400, "Valid price per gram is required");
    }

    const updatedPrice = await metalPriceService.manualUpdate(
      metalType,
      pricePerGram,
      adminName
    );

    const affectedCount = await metalPriceService.getAffectedProductsCount(
      metalType
    );

    // Auto-trigger product price recalculation
    let recalcResult = null;
    if (affectedCount > 0) {
      try {
        recalcResult = await metalPriceService.executeBulkRecalculation(
          [metalType],
          { triggeredBy: adminName }
        );
      } catch (recalcError) {
        console.error("Price recalculation failed (non-blocking):", recalcError);
        recalcResult = { error: recalcError.message };
      }
    }

    logAudit({
      entityType: AUDIT_ENTITIES.METAL_PRICE,
      entityId: updatedPrice._id,
      action: AUDIT_ACTIONS.PRICE_CHANGE,
      actorId: req.admin?._id,
      actorName: adminName,
      summary: `Updated ${metalType} price to ₹${pricePerGram}/g`,
      changes: { after: { metalType, pricePerGram } },
      metadata: { affectedProducts: affectedCount, recalculated: recalcResult?.updated || 0 }
    });

    successRes(res, {
      price: {
        ...updatedPrice.toObject(),
        affectedProductsCount: affectedCount
      },
      recalculation: recalcResult,
      message: `${metalType} price updated successfully${affectedCount > 0 ? ` and ${recalcResult?.updated || 0} product prices recalculated` : ""}`
    });
  } catch (error) {
    console.error("Error updating metal price:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Fetch latest price from API for single metal
 * POST /api/admin/metal-prices/:metalType/fetch
 */
module.exports.fetchMetalPrice = catchAsync(async (req, res) => {
  try {
    const { metalType } = req.params;
    const adminName = req.admin?.name || "API Fetch";

    if (!Object.values(METAL_TYPES).includes(metalType)) {
      return errorRes(res, 400, `Invalid metal type: ${metalType}`);
    }

    const updatedPrice = await metalPriceService.fetchAndUpdateSingle(
      metalType,
      adminName
    );

    successRes(res, {
      price: updatedPrice,
      message: `${metalType} price fetched and updated successfully`
    });
  } catch (error) {
    console.error("Error fetching metal price:", error);
    errorRes(res, 500, error.message);
  }
});

/**
 * Fetch all metal prices from API
 * POST /api/admin/metal-prices/bulk-fetch
 */
module.exports.bulkFetchMetalPrices = catchAsync(async (req, res) => {
  try {
    const { metalTypes } = req.body;
    const adminName = req.admin?.name || "Bulk API Fetch";

    // If specific metal types provided, validate them
    if (metalTypes && metalTypes.length > 0) {
      for (const type of metalTypes) {
        if (!Object.values(METAL_TYPES).includes(type)) {
          return errorRes(res, 400, `Invalid metal type: ${type}`);
        }
      }
    }

    const result = await metalPriceService.fetchAndUpdateAll(adminName);

    successRes(res, {
      ...result,
      message: "Metal prices fetched successfully"
    });
  } catch (error) {
    console.error("Error bulk fetching metal prices:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Preview bulk recalculation
 * POST /api/admin/metal-prices/bulk-recalculate/preview
 */
module.exports.previewBulkRecalculation = catchAsync(async (req, res) => {
  try {
    const { metalTypes } = req.body;

    if (!metalTypes || metalTypes.length === 0) {
      return errorRes(res, 400, "At least one metal type is required");
    }

    // Validate metal types
    for (const type of metalTypes) {
      if (!Object.values(METAL_TYPES).includes(type)) {
        return errorRes(res, 400, `Invalid metal type: ${type}`);
      }
    }

    const preview = await metalPriceService.previewBulkRecalculation(metalTypes);

    successRes(res, {
      ...preview,
      dryRun: true,
      message: "Bulk recalculation preview generated"
    });
  } catch (error) {
    console.error("Error previewing bulk recalculation:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Execute bulk recalculation
 * POST /api/admin/metal-prices/bulk-recalculate/confirm
 */
module.exports.confirmBulkRecalculation = catchAsync(async (req, res) => {
  try {
    const { metalTypes } = req.body;

    if (!metalTypes || metalTypes.length === 0) {
      return errorRes(res, 400, "At least one metal type is required");
    }

    // Validate metal types
    for (const type of metalTypes) {
      if (!Object.values(METAL_TYPES).includes(type)) {
        return errorRes(res, 400, `Invalid metal type: ${type}`);
      }
    }

    const result = await metalPriceService.executeBulkRecalculation(metalTypes);

    successRes(res, {
      ...result,
      message: "Bulk recalculation completed"
    });
  } catch (error) {
    console.error("Error executing bulk recalculation:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get price history for a metal type
 * GET /api/admin/metal-prices/:metalType/history
 */
module.exports.getMetalPriceHistory = catchAsync(async (req, res) => {
  try {
    const { metalType } = req.params;
    const { limit = 50, offset = 0, startDate, endDate, source } = req.query;

    if (!Object.values(METAL_TYPES).includes(metalType)) {
      return errorRes(res, 400, `Invalid metal type: ${metalType}`);
    }

    const result = await metalPriceService.getPriceHistory(metalType, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate,
      source
    });

    successRes(res, {
      ...result,
      message: "Price history retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting price history:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get all price history (across all metals)
 * GET /api/admin/metal-prices/history
 */
module.exports.getAllPriceHistory = catchAsync(async (req, res) => {
  try {
    const {
      limit = 50,
      offset = 0,
      startDate,
      endDate,
      source,
      metalTypes
    } = req.query;

    // Parse metalTypes if provided as comma-separated string
    let parsedMetalTypes = null;
    if (metalTypes) {
      parsedMetalTypes = metalTypes.split(",").filter((t) => t.trim());
      for (const type of parsedMetalTypes) {
        if (!Object.values(METAL_TYPES).includes(type)) {
          return errorRes(res, 400, `Invalid metal type: ${type}`);
        }
      }
    }

    const result = await metalPriceService.getAllPriceHistory({
      limit: parseInt(limit),
      offset: parseInt(offset),
      startDate,
      endDate,
      source,
      metalTypes: parsedMetalTypes
    });

    successRes(res, {
      ...result,
      message: "Price history retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting all price history:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get affected products count for a metal type
 * GET /api/admin/metal-prices/:metalType/affected-products
 */
module.exports.getAffectedProducts = catchAsync(async (req, res) => {
  try {
    const { metalType } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    if (!Object.values(METAL_TYPES).includes(metalType)) {
      return errorRes(res, 400, `Invalid metal type: ${metalType}`);
    }

    const { Product } = require("../models/product.model");

    const [products, total] = await Promise.all([
      Product.find({
        metalType,
        isActive: true,
        pricingMode: { $ne: "STATIC_PRICE" },
        allComponentsFrozen: { $ne: true }
      })
        .select("productTitle skuNo calculatedPrice pricingMode subcategoryId")
        .populate("subcategoryId", "name fullCategoryId")
        .skip(parseInt(offset))
        .limit(parseInt(limit)),
      Product.countDocuments({
        metalType,
        isActive: true,
        pricingMode: { $ne: "STATIC_PRICE" },
        allComponentsFrozen: { $ne: true }
      })
    ]);

    successRes(res, {
      products,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      message: "Affected products retrieved successfully"
    });
  } catch (error) {
    console.error("Error getting affected products:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Initialize default metal prices (one-time setup)
 * POST /api/admin/metal-prices/initialize
 */
module.exports.initializeMetalPrices = catchAsync(async (req, res) => {
  try {
    await metalPriceService.initializeDefaultPrices();

    const prices = await metalPriceService.getAllPrices();

    successRes(res, {
      prices,
      message: "Metal prices initialized successfully"
    });
  } catch (error) {
    console.error("Error initializing metal prices:", error);
    internalServerError(res, error.message);
  }
});

/**
 * Get metal types enum
 * GET /api/admin/metal-prices/types
 */
module.exports.getMetalTypes = catchAsync(async (req, res) => {
  const types = Object.entries(METAL_TYPES).map(([key, value]) => ({
    key,
    value,
    displayName: value
      .replace(/_/g, " ")
      .replace(/(\d+)K/g, " $1K")
      .trim()
  }));

  successRes(res, {
    types,
    message: "Metal types retrieved successfully"
  });
});

/**
 * Get batch jobs (recalculation history)
 * GET /api/admin/metal-prices/batch-jobs
 */
module.exports.getBatchJobs = catchAsync(async (req, res) => {
  const { BatchJob } = require("../models/batch-job.model");
  const { status, limit = 20, offset = 0 } = req.query;

  const filter = {};
  if (status) filter.status = status;

  const [jobs, total] = await Promise.all([
    BatchJob.find(filter)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(Math.min(parseInt(limit), 50))
      .lean(),
    BatchJob.countDocuments(filter)
  ]);

  successRes(res, { jobs, total });
});

/**
 * Get single batch job details
 * GET /api/admin/metal-prices/batch-jobs/:jobId
 */
module.exports.getBatchJob = catchAsync(async (req, res) => {
  const { BatchJob } = require("../models/batch-job.model");
  const { jobId } = req.params;

  const job = await BatchJob.findById(jobId).lean();
  if (!job) {
    return errorRes(res, 404, "Batch job not found");
  }

  successRes(res, { job });
});

/**
 * Retry a failed batch job
 * POST /api/admin/metal-prices/batch-jobs/:jobId/retry
 */
module.exports.retryBatchJob = catchAsync(async (req, res) => {
  const { BatchJob, BATCH_JOB_STATUS } = require("../models/batch-job.model");
  const { jobId } = req.params;

  const job = await BatchJob.findById(jobId);
  if (!job) {
    return errorRes(res, 404, "Batch job not found");
  }

  if (![BATCH_JOB_STATUS.FAILED, BATCH_JOB_STATUS.PARTIAL].includes(job.status)) {
    return errorRes(res, 400, "Only failed or partial jobs can be retried");
  }

  if (job.attempts >= job.maxAttempts) {
    return errorRes(res, 400, `Job has exceeded maximum retry attempts (${job.maxAttempts})`);
  }

  // Re-execute the recalculation
  const result = await metalPriceService.executeBulkRecalculation(
    job.params.metalTypes,
    { triggeredBy: req.admin?.name || "Admin (retry)" }
  );

  successRes(res, {
    ...result,
    message: "Batch job retried successfully"
  });
});
