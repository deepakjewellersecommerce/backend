const { RfidTag, RFID_STATUS } = require("../models/rfid-tag.model");
const { Product } = require("../models/product.model");
const productVariation = require("../models/product_varient");
const { generateRfidCodes } = require("../utility/rfid-generator");
const { successRes, errorRes } = require("../utility");
const catchAsync = require("../utility/catch-async");
const { logAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } = require("../models/audit-log.model");

// POST /admin/rfid-tags/generate
module.exports.generateTags = catchAsync(async (req, res) => {
  const { productId, variantId, quantity } = req.body;

  if (!productId || !quantity || quantity < 1 || quantity > 500) {
    return errorRes(res, 400, "productId and quantity (1-500) are required.");
  }

  const product = await Product.findById(productId);
  if (!product) {
    return errorRes(res, 404, "Product not found.");
  }

  let variantSize = null;
  if (variantId) {
    const variant = await productVariation.findOne({
      _id: variantId,
      productId: productId,
    });
    if (!variant) {
      return errorRes(res, 404, "Variant not found for this product.");
    }
    variantSize = variant.size;
  }

  // Find current max serial for this product
  const lastTag = await RfidTag.findOne({ product: productId }).sort({
    serialNumber: -1,
  });
  const startSerial = (lastTag?.serialNumber || 0) + 1;

  // Generate RFID codes
  const codes = generateRfidCodes(product.skuNo, startSerial, quantity);

  // Build tag documents with denormalized product fields
  const tagDocs = codes.map((code) => ({
    ...code,
    product: productId,
    variant: variantId || null,
    skuNo: product.skuNo,
    status: RFID_STATUS.ACTIVE,
    productTitle: product.productTitle,
    metalType: product.metalType,
    grossWeight: product.grossWeight,
    netWeight: product.netWeight,
    calculatedPrice: product.calculatedPrice,
    variantSize,
    generatedBy: req.user?._id,
  }));

  const tags = await RfidTag.insertMany(tagDocs);

  logAudit({
    entityType: AUDIT_ENTITIES.RFID_TAG,
    entityId: product._id,
    action: AUDIT_ACTIONS.RFID_GENERATE,
    actorId: req.user?._id || req.admin?._id,
    actorName: req.admin?.name || "Admin",
    summary: `Generated ${tags.length} RFID tags for "${product.productTitle}" (${product.skuNo})`,
    metadata: { quantity: tags.length, from: codes[0].rfidCode, to: codes[codes.length - 1].rfidCode }
  });

  successRes(res, {
    message: `${tags.length} RFID tags generated.`,
    tags,
    range: {
      from: codes[0].rfidCode,
      to: codes[codes.length - 1].rfidCode,
    },
  });
});

// GET /admin/rfid-tags/:productId
module.exports.getTagsByProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const {
    variantId,
    status,
    search,
    page = 1,
    limit = 50,
  } = req.query;

  const filter = { product: productId };
  if (variantId) filter.variant = variantId;
  if (status) filter.status = status;
  if (search) filter.rfidCode = { $regex: search, $options: "i" };

  const pageNum = parseInt(page);
  const limitNum = Math.min(parseInt(limit) || 50, 100);
  const skip = (pageNum - 1) * limitNum;

  const [tags, total] = await Promise.all([
    RfidTag.find(filter)
      .sort({ serialNumber: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    RfidTag.countDocuments(filter),
  ]);

  successRes(res, {
    tags,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  });
});

// GET /admin/rfid-tags/:productId/download
module.exports.downloadTagsCsv = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { variantId, status } = req.query;

  const filter = { product: productId };
  if (variantId) filter.variant = variantId;
  if (status) filter.status = status;

  const tags = await RfidTag.find(filter)
    .sort({ serialNumber: 1 })
    .lean();

  if (!tags.length) {
    return errorRes(res, 404, "No RFID tags found for this product.");
  }

  // Build CSV
  const headers = [
    "RFID Code",
    "SKU",
    "Serial",
    "Product Title",
    "Metal Type",
    "Gross Weight (g)",
    "Net Weight (g)",
    "Price",
    "Variant Size",
    "Status",
  ];

  const rows = tags.map((t) =>
    [
      t.rfidCode,
      t.skuNo,
      t.serialNumber,
      `"${(t.productTitle || "").replace(/"/g, '""')}"`,
      t.metalType || "",
      t.grossWeight ?? "",
      t.netWeight ?? "",
      t.calculatedPrice ?? "",
      t.variantSize || "",
      t.status,
    ].join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const skuNo = tags[0].skuNo || "rfid";

  res.setHeader("Content-Type", "text/csv");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="rfid-tags-${skuNo}.csv"`
  );
  res.send(csv);
});

// GET /admin/rfid-tags/:productId/summary
module.exports.getTagsSummary = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const mongoose = require("mongoose");
  const productObjId = mongoose.Types.ObjectId.createFromHexString(productId);

  // Overall status counts
  const statusResult = await RfidTag.aggregate([
    { $match: { product: productObjId } },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const summary = { total: 0, active: 0, sold: 0, returned: 0, deactivated: 0 };
  for (const r of statusResult) {
    summary[r._id.toLowerCase()] = r.count;
    summary.total += r.count;
  }

  // Per-variant RFID counts (only ACTIVE tags)
  const variantTagCounts = await RfidTag.aggregate([
    { $match: { product: productObjId, status: "ACTIVE" } },
    { $group: { _id: "$variant", count: { $sum: 1 } } },
  ]);

  // Fetch all variants for this product with their stock
  const variants = await productVariation
    .find({ productId })
    .populate("color")
    .lean();

  // Build per-variant breakdown: stock vs RFID tag count
  const tagCountMap = {};
  for (const vc of variantTagCounts) {
    tagCountMap[String(vc._id)] = vc.count;
  }
  // Count tags not assigned to any variant
  const unassignedTags = tagCountMap["null"] || tagCountMap["undefined"] || 0;

  const variantBreakdown = variants.map((v) => ({
    variantId: v._id,
    size: v.size,
    color: v.color?.name || v.color?.slug || null,
    stock: v.stock || 0,
    rfidCount: tagCountMap[String(v._id)] || 0,
    gap: (v.stock || 0) - (tagCountMap[String(v._id)] || 0),
  }));

  successRes(res, {
    ...summary,
    unassignedTags,
    variants: variantBreakdown,
  });
});

// DELETE /admin/rfid-tags/:tagId
module.exports.deleteTag = catchAsync(async (req, res) => {
  const { tagId } = req.params;

  const tag = await RfidTag.findById(tagId);
  if (!tag) {
    return errorRes(res, 404, "RFID tag not found.");
  }

  // Only allow deleting ACTIVE or DEACTIVATED tags — not SOLD ones
  if (tag.status === RFID_STATUS.SOLD) {
    return errorRes(res, 400, "Cannot delete a sold RFID tag.");
  }

  await RfidTag.findByIdAndDelete(tagId);

  logAudit({
    entityType: AUDIT_ENTITIES.RFID_TAG,
    entityId: tag._id,
    action: AUDIT_ACTIONS.DELETE,
    actorId: req.admin?._id,
    actorName: req.admin?.name || "Admin",
    summary: `Deleted RFID tag ${tag.rfidCode} (${tag.skuNo})`,
    changes: { before: { rfidCode: tag.rfidCode, status: tag.status } }
  });

  successRes(res, { message: "RFID tag deleted successfully." });
});

// DELETE /admin/rfid-tags/product/:productId
module.exports.deleteTagsByProduct = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { status } = req.query;

  const filter = { product: productId };
  // If status is specified, only delete tags with that status
  if (status && Object.values(RFID_STATUS).includes(status)) {
    filter.status = status;
  } else {
    // By default, don't delete SOLD tags
    filter.status = { $ne: RFID_STATUS.SOLD };
  }

  const result = await RfidTag.deleteMany(filter);

  logAudit({
    entityType: AUDIT_ENTITIES.RFID_TAG,
    entityId: productId,
    action: AUDIT_ACTIONS.DELETE,
    actorId: req.admin?._id,
    actorName: req.admin?.name || "Admin",
    summary: `Bulk deleted ${result.deletedCount} RFID tags for product ${productId}`,
    metadata: { deletedCount: result.deletedCount, filter: status || "non-sold" }
  });

  successRes(res, {
    message: `${result.deletedCount} RFID tags deleted.`,
    deletedCount: result.deletedCount,
  });
});

// PUT /admin/rfid-tags/:tagId/status
module.exports.updateTagStatus = catchAsync(async (req, res) => {
  const { tagId } = req.params;
  const { status } = req.body;

  if (!status || !Object.values(RFID_STATUS).includes(status)) {
    return errorRes(
      res,
      400,
      `Invalid status. Must be one of: ${Object.values(RFID_STATUS).join(", ")}`
    );
  }

  const tag = await RfidTag.findById(tagId);
  if (!tag) {
    return errorRes(res, 404, "RFID tag not found.");
  }

  tag.status = status;
  if (status === RFID_STATUS.DEACTIVATED) {
    tag.deactivatedAt = new Date();
    tag.deactivatedBy = req.user?._id;
  }

  await tag.save();

  successRes(res, { message: "RFID tag status updated.", tag });
});
