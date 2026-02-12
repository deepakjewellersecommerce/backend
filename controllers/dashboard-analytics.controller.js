const mongoose = require("mongoose");
const User_Order = mongoose.model("User_Order");
const Inventory = mongoose.model("Inventory");
const Product = mongoose.model("Product");
const User = mongoose.model("User");
const Item = mongoose.model("Item");
const Coupon = mongoose.model("Coupon");
const UserLoyalty = mongoose.model("UserLoyalty");
const LoyaltyProgram = mongoose.model("LoyaltyProgram");
const XLSX = require("xlsx");
const catchAsync = require("../utility/catch-async");
const { successRes, errorRes } = require("../utility");

/**
 * Revenue by Metal Type (with date range filter)
 * Returns: [{ metalType, revenue, orderCount }]
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
module.exports.revenueByMetalType_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {
    payment_status: "COMPLETE",
    order_status: { $ne: "CANCELLED BY ADMIN" }
  };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  // Unwind products to get metalType per product
  const data = await User_Order.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.metalType",
        revenue: { $sum: "$products.price" },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        metalType: "$_id",
        revenue: 1,
        orderCount: 1,
        _id: 0
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  successRes(res, { data });
});

/**
 * Category & Item Performance (Level 3 Hierarchy - "Item" like Ring, Necklace)
 * Returns: [{ itemName, revenue, salesCount }]
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
module.exports.performanceByItemType_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {
    payment_status: "COMPLETE",
    order_status: { $ne: "CANCELLED BY ADMIN" }
  };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const data = await User_Order.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: "$productDetails" },
    {
      $lookup: {
        from: "items",
        localField: "productDetails.itemId",
        foreignField: "_id",
        as: "itemDetails"
      }
    },
    { $unwind: "$itemDetails" },
    {
      $group: {
        _id: "$itemDetails.name",
        revenue: { $sum: "$products.price" },
        salesCount: { $sum: "$products.quantity" }
      }
    },
    {
      $project: {
        itemName: "$_id",
        revenue: 1,
        salesCount: 1,
        _id: 0
      }
    },
    { $sort: { revenue: -1 } }
  ]);

  successRes(res, { data });
});

/**
 * Discount Efficiency (Coupons vs Full Price)
 * Returns: { grossRevenue, totalDiscount, netRevenue, orderCounts: { withCoupon, withoutCoupon } }
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
module.exports.discountEfficiency_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {
    payment_status: "COMPLETE",
    order_status: { $ne: "CANCELLED BY ADMIN" }
  };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const [stats] = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        grossRevenue: { $sum: "$subtotal" },
        totalDiscount: { $sum: "$discountAmount" },
        netRevenue: { $sum: "$grandTotal" },
        withCoupon: {
          $sum: { $cond: [{ $ifNull: ["$couponCode", false] }, 1, 0] }
        },
        withoutCoupon: {
          $sum: { $cond: [{ $ifNull: ["$couponCode", false] }, 0, 1] }
        }
      }
    }
  ]);

  const data = stats || {
    grossRevenue: 0,
    totalDiscount: 0,
    netRevenue: 0,
    withCoupon: 0,
    withoutCoupon: 0
  };

  successRes(res, { data });
});

/**
 * Inventory Health (Stuck Stock & Valuation)
 * Returns: { totalValuation, stockCount, stuckItems: { count, items: [] } }
 * Stuck Stock = Items with stock > 0 not sold in last 90 days
 */
module.exports.inventoryHealth_get = catchAsync(async (req, res) => {
  // 1. Total Valuation
  const [valuationStats] = await Inventory.aggregate([
    {
      $group: {
        _id: null,
        totalValuation: { $sum: { $multiply: ["$availableStock", { $ifNull: ["$costPrice", 0] }] } },
        totalItems: { $sum: "$availableStock" }
      }
    }
  ]);

  // 2. Stuck Stock (Available > 0, Last Sale > 90 days or Never)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  // Get items sold in last 90 days
  const recentlySoldItems = await User_Order.distinct("products.product", {
    createdAt: { $gte: ninetyDaysAgo },
    payment_status: "COMPLETE"
  });

  // Find stock entries with stock > 0 but not in recentlySoldItems
  const stuckStockEntries = await Inventory.find({
    availableStock: { $gt: 0 },
    product: { $nin: recentlySoldItems }
  }).populate("product", "productTitle skuNo categoryHierarchyPath");

  const data = {
    valuation: valuationStats?.totalValuation || 0,
    totalStockCount: valuationStats?.totalItems || 0,
    stuckStock: {
      count: stuckStockEntries.length,
      items: stuckStockEntries.slice(0, 10).map(entry => ({
        productTitle: entry.product?.productTitle,
        skuNo: entry.product?.skuNo,
        availableStock: entry.availableStock,
        category: entry.product?.categoryHierarchyPath
      }))
    }
  };

  successRes(res, { data });
});

/**
 * Order Status Funnel (PLACED -> DELIVERED)
 * Returns: [{ status, count }]
 * Query: ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
module.exports.orderFunnel_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {};
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }

  const funnelStatuses = [
    "PLACED",
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED"
  ];

  const stats = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$order_status",
        count: { $sum: 1 }
      }
    }
  ]);

  // Ensure all funnel steps are present even with 0 count and in correct order
  const data = funnelStatuses.map(status => {
    const found = stats.find(s => s._id === status);
    return {
      status,
      count: found ? found.count : 0
    };
  });

  successRes(res, { data });
});

// Helper to build date match filter
function buildDateMatch(startDate, endDate) {
  const match = {
    payment_status: "COMPLETE",
    order_status: { $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_CUSTOMER", "CANCELLED BY ADMIN"] }
  };
  if (startDate || endDate) {
    match.createdAt = {};
    if (startDate) match.createdAt.$gte = new Date(startDate);
    if (endDate) match.createdAt.$lte = new Date(endDate);
  }
  return match;
}

// Helper to compute previous period dates
function getPreviousPeriod(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1); // day before current start
  const prevStart = new Date(prevEnd.getTime() - diff);
  return {
    startDate: prevStart.toISOString().split("T")[0],
    endDate: prevEnd.toISOString().split("T")[0]
  };
}

/**
 * Dashboard KPIs
 */
module.exports.dashboardKPIs_get = catchAsync(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [revenueResult] = await User_Order.aggregate([
    { $match: { payment_status: "COMPLETE", createdAt: { $gte: today, $lt: tomorrow } } },
    { $group: { _id: null, total: { $sum: "$grandTotal" } } }
  ]);

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const pendingOrders = await User_Order.countDocuments({
    order_status: "PLACED",
    createdAt: { $lt: twentyFourHoursAgo }
  });

  const stockOutProducts = await Inventory.distinct("product", { availableStock: { $lte: 0 } });
  const stockOutOrders = await User_Order.countDocuments({
    order_status: { $in: ["PLACED", "CONFIRMED", "PROCESSING"] },
    "products.product": { $in: stockOutProducts }
  });

  const pricingErrors = await Product.countDocuments({
    pricingMode: "SUBCATEGORY_DYNAMIC",
    $or: [{ subcategoryId: null }, { subcategoryId: { $exists: false } }]
  });

  const MetalPrice = mongoose.model("MetalPrice");
  const metalPrices = await MetalPrice.find({}).sort({ updatedAt: -1 }).limit(5).lean();
  const metalVolatility = metalPrices.map(m => ({
    metalType: m.metalType,
    pricePerGram: m.pricePerGram,
    change24h: m.change24h || 0
  }));

  successRes(res, {
    data: {
      todayRevenue: revenueResult?.total || 0,
      alerts: { pendingOrders, stockOutOrders, pricingErrors },
      metalVolatility
    }
  });
});

/**
 * Pending Orders Details
 */
module.exports.pendingOrdersDetails_get = catchAsync(async (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

  const data = await User_Order.find({
    order_status: "PLACED",
    createdAt: { $lt: cutoff }
  })
    .select("orderNumber buyer createdAt order_status grandTotal")
    .populate("buyer", "name email")
    .sort({ createdAt: 1 })
    .limit(50)
    .lean();

  successRes(res, { data });
});

/**
 * Stock Out Orders Details
 */
module.exports.stockOutOrdersDetails_get = catchAsync(async (req, res) => {
  const stockOutProducts = await Inventory.distinct("product", { availableStock: { $lte: 0 } });

  const orders = await User_Order.find({
    order_status: { $in: ["PLACED", "CONFIRMED", "PROCESSING"] },
    "products.product": { $in: stockOutProducts }
  })
    .select("orderNumber buyer products")
    .populate("buyer", "name email")
    .populate("products.product", "productTitle skuNo")
    .lean();

  const data = [];
  for (const order of orders) {
    for (const p of order.products) {
      if (stockOutProducts.some(sp => sp.toString() === p.product?._id?.toString())) {
        data.push({
          orderId: order.orderNumber || order._id,
          buyerName: order.buyer?.name || "N/A",
          productName: p.product?.productTitle || "N/A",
          skuNo: p.product?.skuNo,
          quantity: p.quantity
        });
      }
    }
  }

  successRes(res, { data });
});

/**
 * Pricing Errors Details
 */
module.exports.pricingErrorsDetails_get = catchAsync(async (req, res) => {
  const data = await Product.find({
    pricingMode: "SUBCATEGORY_DYNAMIC",
    $or: [{ subcategoryId: null }, { subcategoryId: { $exists: false } }]
  })
    .select("productTitle skuNo pricingMode metalType subcategoryId")
    .limit(50)
    .lean();

  successRes(res, {
    data: data.map(p => ({
      _id: p._id,
      name: p.productTitle,
      skuNo: p.skuNo,
      pricingMode: p.pricingMode,
      metalType: p.metalType,
      hasSubcategoryPricing: false
    }))
  });
});

/**
 * Top Products by Revenue
 */
module.exports.topProducts_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const data = await User_Order.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $group: {
        _id: "$products.product",
        revenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        name: { $ifNull: ["$product.productTitle", "Unknown Product"] },
        revenue: 1,
        orderCount: 1
      }
    }
  ]);

  successRes(res, { data });
});

/**
 * Top Categories by Revenue
 */
module.exports.topCategories_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const data = await User_Order.aggregate([
    { $match: match },
    { $unwind: "$products" },
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: "$productDetails" },
    {
      $lookup: {
        from: "items",
        localField: "productDetails.itemId",
        foreignField: "_id",
        as: "itemDetails"
      }
    },
    { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: "$itemDetails.name",
        revenue: { $sum: { $multiply: ["$products.price", "$products.quantity"] } },
        productCount: { $addToSet: "$products.product" }
      }
    },
    {
      $project: {
        _id: 0,
        name: { $ifNull: ["$_id", "Uncategorized"] },
        revenue: 1,
        productCount: { $size: "$productCount" }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 }
  ]);

  successRes(res, { data });
});

/**
 * Top Users by Spend
 */
module.exports.topUsers_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const data = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$buyer",
        totalSpent: { $sum: "$grandTotal" },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { totalSpent: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        name: { $ifNull: ["$user.name", "Unknown"] },
        email: { $ifNull: ["$user.email", "N/A"] },
        totalSpent: 1,
        orderCount: 1
      }
    }
  ]);

  successRes(res, { data });
});

/**
 * Top Locations by Revenue
 */
module.exports.topLocations_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const data = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          city: { $ifNull: ["$shippingAddress.city", "Unknown"] },
          state: { $ifNull: ["$shippingAddress.state", "Unknown"] }
        },
        revenue: { $sum: "$grandTotal" },
        orderCount: { $sum: 1 }
      }
    },
    { $sort: { revenue: -1 } },
    { $limit: 10 },
    {
      $project: {
        _id: 0,
        city: "$_id.city",
        state: "$_id.state",
        revenue: 1,
        orderCount: 1
      }
    }
  ]);

  successRes(res, { data });
});

/**
 * Revenue Trends
 * Query: ?startDate=&endDate=&groupBy=day|week|month
 */
module.exports.revenueTrends_get = catchAsync(async (req, res) => {
  const { startDate, endDate, groupBy = "day" } = req.query;
  const match = buildDateMatch(startDate, endDate);

  let dateFormat;
  switch (groupBy) {
    case "week":
      dateFormat = "%Y-W%V";
      break;
    case "month":
      dateFormat = "%Y-%m";
      break;
    default:
      dateFormat = "%Y-%m-%d";
  }

  const data = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
        revenue: { $sum: "$grandTotal" },
        orderCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        date: "$_id",
        revenue: 1,
        orderCount: 1,
        aov: { $cond: [{ $gt: ["$orderCount", 0] }, { $divide: ["$revenue", "$orderCount"] }, 0] }
      }
    },
    { $sort: { date: 1 } }
  ]);

  successRes(res, { data });
});

/**
 * Repeat Purchase Rate
 */
module.exports.repeatPurchaseRate_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const result = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$buyer",
        orderCount: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        totalCustomers: { $sum: 1 },
        repeatCustomers: { $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] } }
      }
    }
  ]);

  const stats = result[0] || { totalCustomers: 0, repeatCustomers: 0 };
  const rate = stats.totalCustomers > 0
    ? Math.round((stats.repeatCustomers / stats.totalCustomers) * 10000) / 100
    : 0;

  successRes(res, {
    data: {
      totalCustomers: stats.totalCustomers,
      repeatCustomers: stats.repeatCustomers,
      rate
    }
  });
});

/**
 * Stock Turnover by Category
 */
module.exports.stockTurnover_get = catchAsync(async (req, res) => {
  const data = await Inventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "items",
        localField: "productDetails.itemId",
        foreignField: "_id",
        as: "itemDetails"
      }
    },
    { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$itemDetails.name", "Uncategorized"] },
        turnoverRate: { $avg: { $ifNull: ["$metrics.turnoverRate", 0] } },
        avgDaysToSell: { $avg: { $ifNull: ["$metrics.daysOfStock", 0] } },
        totalSold: { $sum: { $ifNull: ["$metrics.totalSold", 0] } }
      }
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        turnoverRate: { $round: ["$turnoverRate", 2] },
        avgDaysToSell: { $round: ["$avgDaysToSell", 0] },
        totalSold: 1
      }
    },
    { $sort: { totalSold: -1 } }
  ]);

  successRes(res, { data });
});

/**
 * Category-wise Product Distribution
 */
module.exports.categoryDistribution_get = catchAsync(async (req, res) => {
  const { materialId, genderId, itemId, categoryId, groupBy } = req.query;

  // Build match filter from hierarchy params
  const matchFilter = {};
  if (materialId) matchFilter.materialId = new mongoose.Types.ObjectId(materialId);
  if (genderId) matchFilter.genderId = new mongoose.Types.ObjectId(genderId);
  if (itemId) matchFilter.itemId = new mongoose.Types.ObjectId(itemId);
  if (categoryId) matchFilter.categoryId = new mongoose.Types.ObjectId(categoryId);

  // Determine which level to group by (default: item)
  const groupByLevel = groupBy || "item";
  const lookupConfig = {
    material: { from: "materials", localField: "materialId", nameField: "$materialDetails.name" },
    gender: { from: "genders", localField: "genderId", nameField: "$genderDetails.name" },
    item: { from: "items", localField: "itemId", nameField: "$itemDetails.name" },
    category: { from: "categories", localField: "categoryId", nameField: "$categoryDetails.name" },
  };
  const config = lookupConfig[groupByLevel] || lookupConfig.item;
  const asField = `${groupByLevel}Details`;

  const pipeline = [];

  // Apply hierarchy filter first
  if (Object.keys(matchFilter).length > 0) {
    pipeline.push({ $match: matchFilter });
  }

  // Lookup the groupBy level
  pipeline.push(
    {
      $lookup: {
        from: config.from,
        localField: config.localField,
        foreignField: "_id",
        as: asField
      }
    },
    { $unwind: { path: `$${asField}`, preserveNullAndEmptyArrays: true } },
    // Lookup inventory for stock info
    {
      $lookup: {
        from: "inventories",
        localField: "_id",
        foreignField: "product",
        as: "inventory"
      }
    },
    { $unwind: { path: "$inventory", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: [config.nameField, "Uncategorized"] },
        total: { $sum: 1 },
        active: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        inactive: { $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] } },
        outOfStock: {
          $sum: {
            $cond: [
              { $and: [{ $eq: ["$isActive", true] }, { $lte: [{ $ifNull: ["$inventory.availableStock", 0] }, 0] }] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        _id: 0,
        name: "$_id",
        total: 1,
        active: 1,
        inactive: 1,
        outOfStock: 1
      }
    },
    { $sort: { total: -1 } }
  );

  const data = await Product.aggregate(pipeline);

  successRes(res, { data });
});

/**
 * Tax Summary
 * GET /admin/dashboard/analytics/tax-summary?startDate=&endDate=
 */
module.exports.taxSummary_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const taxGroupStage = {
    $group: {
      _id: null,
      totalTaxCollected: { $sum: { $ifNull: ["$taxAmount", 0] } },
      taxableAmount: { $sum: { $ifNull: ["$subtotal", 0] } },
      totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
      totalShipping: { $sum: { $ifNull: ["$shippingCharge", 0] } },
      netRevenueAfterTax: { $sum: { $ifNull: ["$grandTotal", 0] } },
      orderCount: { $sum: 1 }
    }
  };

  const prev = getPreviousPeriod(startDate, endDate);
  const prevMatch = prev ? buildDateMatch(prev.startDate, prev.endDate) : null;

  const [currentResult, prevResult] = await Promise.all([
    User_Order.aggregate([{ $match: match }, taxGroupStage]),
    prevMatch ? User_Order.aggregate([{ $match: prevMatch }, taxGroupStage]) : Promise.resolve([])
  ]);

  const [stats] = currentResult;
  const [prevStats] = prevResult;

  const data = stats || {
    totalTaxCollected: 0, taxableAmount: 0, totalDiscount: 0,
    totalShipping: 0, netRevenueAfterTax: 0, orderCount: 0
  };

  data.effectiveTaxRate = data.taxableAmount > 0
    ? Math.round((data.totalTaxCollected / data.taxableAmount) * 10000) / 100
    : 0;

  if (prevStats) {
    data.previousPeriod = {};
    for (const key of ["totalTaxCollected", "taxableAmount", "netRevenueAfterTax"]) {
      const curr = data[key] || 0;
      const prevVal = prevStats[key] || 0;
      data.previousPeriod[key] = prevVal > 0 ? Math.round(((curr - prevVal) / prevVal) * 10000) / 100 : curr > 0 ? 100 : 0;
    }
    const prevEffRate = prevStats.taxableAmount > 0
      ? Math.round((prevStats.totalTaxCollected / prevStats.taxableAmount) * 10000) / 100
      : 0;
    data.previousPeriod.effectiveTaxRate = data.effectiveTaxRate - prevEffRate;
  }

  delete data._id;
  successRes(res, { data });
});

/**
 * Coupon Analytics
 * GET /admin/dashboard/analytics/coupon-analytics?startDate=&endDate=
 */
module.exports.couponAnalytics_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);
  match.couponCode = { $exists: true, $ne: null, $ne: "" };

  const breakdown = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$couponCode",
        timesUsed: { $sum: 1 },
        totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
        revenueGenerated: { $sum: { $ifNull: ["$grandTotal", 0] } },
        avgOrderValue: { $avg: { $ifNull: ["$grandTotal", 0] } }
      }
    },
    {
      $lookup: {
        from: "coupons",
        localField: "_id",
        foreignField: "couponCode",
        as: "couponDetails"
      }
    },
    { $unwind: { path: "$couponDetails", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        _id: 0,
        couponCode: "$_id",
        timesUsed: 1,
        totalDiscount: { $round: ["$totalDiscount", 2] },
        revenueGenerated: { $round: ["$revenueGenerated", 2] },
        avgOrderValue: { $round: ["$avgOrderValue", 2] },
        couponType: { $ifNull: ["$couponDetails.couponType", "N/A"] },
        couponAmount: { $ifNull: ["$couponDetails.couponAmount", 0] },
        isActive: { $ifNull: ["$couponDetails.isActive", false] },
        expiryDate: "$couponDetails.expiryDate",
        couponQuantity: { $ifNull: ["$couponDetails.couponQuantity", 0] },
        usedQuantity: { $ifNull: ["$couponDetails.usedQuantity", 0] },
        maxDiscountAmount: "$couponDetails.maxDiscountAmount"
      }
    },
    { $sort: { timesUsed: -1 } }
  ]);

  const totalCouponsUsed = breakdown.reduce((s, c) => s + c.timesUsed, 0);
  const totalDiscountGiven = breakdown.reduce((s, c) => s + c.totalDiscount, 0);
  const totalRevenueFromCoupons = breakdown.reduce((s, c) => s + c.revenueGenerated, 0);
  const mostUsedCoupon = breakdown.length > 0 ? breakdown[0].couponCode : "N/A";
  const couponROI = totalDiscountGiven > 0
    ? Math.round(((totalRevenueFromCoupons - totalDiscountGiven) / totalDiscountGiven) * 10000) / 100
    : 0;

  // Previous period comparison
  const prev = getPreviousPeriod(startDate, endDate);
  let previousPeriod = null;
  if (prev) {
    const prevMatch = buildDateMatch(prev.startDate, prev.endDate);
    prevMatch.couponCode = { $exists: true, $ne: null, $ne: "" };
    const [prevAgg] = await User_Order.aggregate([
      { $match: prevMatch },
      { $group: { _id: null, count: { $sum: 1 }, discount: { $sum: { $ifNull: ["$discountAmount", 0] } } } }
    ]);
    if (prevAgg) {
      previousPeriod = {
        totalCouponsUsed: prevAgg.count > 0 ? Math.round(((totalCouponsUsed - prevAgg.count) / prevAgg.count) * 10000) / 100 : totalCouponsUsed > 0 ? 100 : 0,
        totalDiscountGiven: prevAgg.discount > 0 ? Math.round(((totalDiscountGiven - prevAgg.discount) / prevAgg.discount) * 10000) / 100 : totalDiscountGiven > 0 ? 100 : 0
      };
    }
  }

  successRes(res, {
    data: {
      summary: { totalCouponsUsed, totalDiscountGiven, mostUsedCoupon, couponROI, previousPeriod },
      breakdown
    }
  });
});

/**
 * Loyalty Liability
 * GET /admin/dashboard/analytics/loyalty-liability?startDate=&endDate=
 */
module.exports.loyaltyLiability_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;

  // Overall outstanding points
  const [overallStats] = await UserLoyalty.aggregate([
    {
      $group: {
        _id: null,
        totalOutstandingPoints: { $sum: { $ifNull: ["$availablePoints", 0] } },
        totalUsersWithPoints: { $sum: { $cond: [{ $gt: [{ $ifNull: ["$availablePoints", 0] }, 0] }, 1, 0] } }
      }
    }
  ]);

  // Get points-to-rupee ratio from LoyaltyProgram config
  let pointsToRupeeRatio = 10; // default: 10 pts = ₹1
  try {
    const config = await LoyaltyProgram.findOne({}).lean();
    if (config?.redemptionRules?.pointsToRupeeRatio) {
      pointsToRupeeRatio = config.redemptionRules.pointsToRupeeRatio;
    }
  } catch (e) {
    // Use default
  }

  const totalOutstandingPoints = overallStats?.totalOutstandingPoints || 0;
  const totalUsersWithPoints = overallStats?.totalUsersWithPoints || 0;
  const cashLiability = totalOutstandingPoints / pointsToRupeeRatio;

  // Period stats from pointsHistory
  let periodStats = { pointsEarned: 0, pointsRedeemed: 0, pointsExpired: 0 };
  const historyMatch = {};
  if (startDate || endDate) {
    historyMatch["pointsHistory.createdAt"] = {};
    if (startDate) historyMatch["pointsHistory.createdAt"].$gte = new Date(startDate);
    if (endDate) historyMatch["pointsHistory.createdAt"].$lte = new Date(endDate);
  }

  try {
    const periodData = await UserLoyalty.aggregate([
      { $unwind: "$pointsHistory" },
      ...(Object.keys(historyMatch).length > 0 ? [{ $match: historyMatch }] : []),
      {
        $group: {
          _id: "$pointsHistory.type",
          total: { $sum: { $ifNull: ["$pointsHistory.points", 0] } }
        }
      }
    ]);

    for (const entry of periodData) {
      if (entry._id === "earned" || entry._id === "EARNED") periodStats.pointsEarned = entry.total;
      else if (entry._id === "redeemed" || entry._id === "REDEEMED") periodStats.pointsRedeemed = Math.abs(entry.total);
      else if (entry._id === "expired" || entry._id === "EXPIRED") periodStats.pointsExpired = Math.abs(entry.total);
    }
  } catch (e) {
    // pointsHistory may not exist
  }

  // Previous period comparison for period stats
  let previousPeriod = null;
  const prev = getPreviousPeriod(startDate, endDate);
  if (prev) {
    try {
      const prevHistoryMatch = { "pointsHistory.createdAt": { $gte: new Date(prev.startDate), $lte: new Date(prev.endDate) } };
      const prevPeriodData = await UserLoyalty.aggregate([
        { $unwind: "$pointsHistory" },
        { $match: prevHistoryMatch },
        { $group: { _id: "$pointsHistory.type", total: { $sum: { $ifNull: ["$pointsHistory.points", 0] } } } }
      ]);
      let prevEarned = 0, prevRedeemed = 0;
      for (const entry of prevPeriodData) {
        if (entry._id === "earned" || entry._id === "EARNED") prevEarned = entry.total;
        else if (entry._id === "redeemed" || entry._id === "REDEEMED") prevRedeemed = Math.abs(entry.total);
      }
      previousPeriod = {
        pointsEarned: prevEarned > 0 ? Math.round(((periodStats.pointsEarned - prevEarned) / prevEarned) * 10000) / 100 : periodStats.pointsEarned > 0 ? 100 : 0,
        pointsRedeemed: prevRedeemed > 0 ? Math.round(((periodStats.pointsRedeemed - prevRedeemed) / prevRedeemed) * 10000) / 100 : periodStats.pointsRedeemed > 0 ? 100 : 0
      };
    } catch (e) { /* ignore */ }
  }

  successRes(res, {
    data: {
      totalOutstandingPoints,
      cashLiability: Math.round(cashLiability * 100) / 100,
      pointsToRupeeRatio,
      totalUsersWithPoints,
      period: periodStats,
      previousPeriod
    }
  });
});

/**
 * Financial Summary
 * GET /admin/dashboard/analytics/financial-summary?startDate=&endDate=
 */
module.exports.financialSummary_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  const financialGroupStage = {
    $group: {
      _id: null,
      grossRevenue: { $sum: { $ifNull: ["$subtotal", 0] } },
      discountsGiven: { $sum: { $ifNull: ["$discountAmount", 0] } },
      taxCollected: { $sum: { $ifNull: ["$taxAmount", 0] } },
      shippingRevenue: { $sum: { $ifNull: ["$shippingCharge", 0] } },
      netRevenue: { $sum: { $ifNull: ["$grandTotal", 0] } },
      orderCount: { $sum: 1 }
    }
  };

  // Run current + previous period in parallel
  const prev = getPreviousPeriod(startDate, endDate);
  const prevMatch = prev ? buildDateMatch(prev.startDate, prev.endDate) : null;

  const [currentResult, prevResult] = await Promise.all([
    User_Order.aggregate([{ $match: match }, financialGroupStage]),
    prevMatch ? User_Order.aggregate([{ $match: prevMatch }, financialGroupStage]) : Promise.resolve([])
  ]);

  const [stats] = currentResult;
  const [prevStats] = prevResult;

  // Get loyalty liability
  let loyaltyLiability = 0;
  try {
    const [loyaltyStats] = await UserLoyalty.aggregate([
      { $group: { _id: null, totalPoints: { $sum: { $ifNull: ["$availablePoints", 0] } } } }
    ]);
    let ratio = 10;
    const config = await LoyaltyProgram.findOne({}).lean();
    if (config?.redemptionRules?.pointsToRupeeRatio) ratio = config.redemptionRules.pointsToRupeeRatio;
    loyaltyLiability = (loyaltyStats?.totalPoints || 0) / ratio;
  } catch (e) {
    // Models may not exist yet
  }

  const defaults = { grossRevenue: 0, discountsGiven: 0, taxCollected: 0, shippingRevenue: 0, netRevenue: 0, orderCount: 0 };
  const data = {
    ...(stats || defaults),
    loyaltyLiability: Math.round(loyaltyLiability * 100) / 100
  };
  delete data._id;

  // Compute % change vs previous period
  if (prevStats) {
    data.previousPeriod = {};
    for (const key of ["grossRevenue", "discountsGiven", "taxCollected", "shippingRevenue", "netRevenue", "orderCount"]) {
      const curr = data[key] || 0;
      const prevVal = prevStats[key] || 0;
      data.previousPeriod[key] = prevVal > 0 ? Math.round(((curr - prevVal) / prevVal) * 10000) / 100 : curr > 0 ? 100 : 0;
    }
  }

  successRes(res, { data });
});

/**
 * Export Financial Data (Multi-sheet XLSX)
 * GET /admin/dashboard/export?startDate=&endDate=
 */
module.exports.exportFinancialData_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = buildDateMatch(startDate, endDate);

  // Sheet 1: Orders
  const orders = await User_Order.find(match)
    .populate("buyer", "name email")
    .sort({ createdAt: -1 })
    .lean();

  const ordersSheet = orders.map(o => ({
    "Order#": o.orderNumber || o._id?.toString(),
    "Date": o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN") : "",
    "Buyer": o.buyer?.name || "N/A",
    "Email": o.buyer?.email || "N/A",
    "Items": (o.products || []).length,
    "Subtotal": o.subtotal || 0,
    "Discount": o.discountAmount || 0,
    "Coupon": o.couponCode || "",
    "Tax": o.taxAmount || 0,
    "Shipping": o.shippingCharge || 0,
    "GrandTotal": o.grandTotal || 0,
    "PaymentMode": o.payment_mode || "",
    "PaymentStatus": o.payment_status || "",
    "OrderStatus": o.order_status || "",
    "City": o.shippingAddress?.city || "",
    "State": o.shippingAddress?.state || ""
  }));

  // Sheet 2: Revenue Summary (grouped by date)
  const revenueSummary = await User_Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        orders: { $sum: 1 },
        subtotal: { $sum: { $ifNull: ["$subtotal", 0] } },
        discounts: { $sum: { $ifNull: ["$discountAmount", 0] } },
        tax: { $sum: { $ifNull: ["$taxAmount", 0] } },
        shipping: { $sum: { $ifNull: ["$shippingCharge", 0] } },
        netRevenue: { $sum: { $ifNull: ["$grandTotal", 0] } }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  const revenueSheet = revenueSummary.map(r => ({
    "Period": r._id,
    "Orders": r.orders,
    "Subtotal": r.subtotal,
    "Discounts": r.discounts,
    "Tax": r.tax,
    "Shipping": r.shipping,
    "Net Revenue": r.netRevenue
  }));

  // Sheet 3: Inventory
  const inventoryItems = await Inventory.find({})
    .populate("product", "productTitle skuNo metalType")
    .lean();

  const inventorySheet = inventoryItems.map(inv => ({
    "Product": inv.product?.productTitle || "N/A",
    "SKU": inv.product?.skuNo || "",
    "Metal": inv.product?.metalType || "",
    "CurrentStock": inv.currentStock || 0,
    "Reserved": inv.reservedStock || 0,
    "Available": inv.availableStock || 0,
    "CostPrice": inv.costPrice || 0,
    "TotalValue": (inv.availableStock || 0) * (inv.costPrice || 0),
    "TotalSold": inv.metrics?.totalSold || 0,
    "TurnoverRate": inv.metrics?.turnoverRate || 0
  }));

  // Sheet 4: Coupon Usage
  const couponMatch = { ...match, couponCode: { $exists: true, $ne: null, $ne: "" } };
  const couponUsage = await User_Order.aggregate([
    { $match: couponMatch },
    {
      $group: {
        _id: "$couponCode",
        timesUsed: { $sum: 1 },
        totalDiscount: { $sum: { $ifNull: ["$discountAmount", 0] } },
        revenue: { $sum: { $ifNull: ["$grandTotal", 0] } }
      }
    },
    { $sort: { timesUsed: -1 } }
  ]);

  const couponSheet = couponUsage.map(c => ({
    "Code": c._id,
    "TimesUsed": c.timesUsed,
    "TotalDiscount": Math.round(c.totalDiscount * 100) / 100,
    "Revenue": Math.round(c.revenue * 100) / 100,
    "ROI%": c.totalDiscount > 0
      ? Math.round(((c.revenue - c.totalDiscount) / c.totalDiscount) * 10000) / 100
      : 0
  }));

  // Sheet 5: Loyalty
  let loyaltySheet = [];
  try {
    let ratio = 10;
    const config = await LoyaltyProgram.findOne({}).lean();
    if (config?.redemptionRules?.pointsToRupeeRatio) ratio = config.redemptionRules.pointsToRupeeRatio;

    const loyaltyData = await UserLoyalty.find({})
      .populate("user", "name email")
      .lean();

    loyaltySheet = loyaltyData.map(l => ({
      "User": l.user?.name || "N/A",
      "Email": l.user?.email || "N/A",
      "Tier": l.tier || "N/A",
      "TotalEarned": l.totalEarnedPoints || 0,
      "Available": l.availablePoints || 0,
      "CashLiability": Math.round(((l.availablePoints || 0) / ratio) * 100) / 100,
      "LifetimeSpent": l.lifetimeSpent || 0
    }));
  } catch (e) {
    // Model may not exist
  }

  // Build workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ordersSheet.length ? ordersSheet : [{}]), "Orders");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(revenueSheet.length ? revenueSheet : [{}]), "Revenue Summary");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inventorySheet.length ? inventorySheet : [{}]), "Inventory");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(couponSheet.length ? couponSheet : [{}]), "Coupon Usage");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(loyaltySheet.length ? loyaltySheet : [{}]), "Loyalty");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const dateSuffix = startDate && endDate ? `-${startDate}-to-${endDate}` : `-${new Date().toISOString().split("T")[0]}`;
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename=financial-data${dateSuffix}.xlsx`);
  res.send(buf);
});

/**
 * Payment Reconciliation
 * GET /admin/dashboard/analytics/payment-reconciliation?startDate=&endDate=
 */
module.exports.paymentReconciliation_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const dateFilter = {};
  if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
    if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
  }

  // Group by payment_mode + payment_status
  const breakdown = await User_Order.aggregate([
    { $match: { ...dateFilter } },
    {
      $group: {
        _id: { mode: "$payment_mode", status: "$payment_status" },
        count: { $sum: 1 },
        total: { $sum: { $ifNull: ["$grandTotal", 0] } }
      }
    },
    { $sort: { "_id.mode": 1, "_id.status": 1 } }
  ]);

  // Build summary
  let totalReceived = 0, totalPending = 0, totalFailed = 0, totalRefunded = 0;
  let codTotal = 0, codPending = 0, onlineTotal = 0, onlinePending = 0;
  const details = [];

  for (const b of breakdown) {
    const mode = b._id.mode || "UNKNOWN";
    const status = b._id.status || "UNKNOWN";
    details.push({ mode, status, count: b.count, total: Math.round(b.total * 100) / 100 });

    if (status === "COMPLETE") totalReceived += b.total;
    else if (status === "PENDING") totalPending += b.total;
    else if (status === "FAILED") totalFailed += b.total;
    else if (status === "REFUNDED") totalRefunded += b.total;

    if (mode === "COD") {
      codTotal += b.total;
      if (status === "PENDING") codPending += b.total;
    } else if (mode === "ONLINE") {
      onlineTotal += b.total;
      if (status === "PENDING") onlinePending += b.total;
    }
  }

  successRes(res, {
    data: {
      summary: {
        totalReceived: Math.round(totalReceived * 100) / 100,
        totalPending: Math.round(totalPending * 100) / 100,
        totalFailed: Math.round(totalFailed * 100) / 100,
        totalRefunded: Math.round(totalRefunded * 100) / 100
      },
      cod: { total: Math.round(codTotal * 100) / 100, pending: Math.round(codPending * 100) / 100 },
      online: { total: Math.round(onlineTotal * 100) / 100, pending: Math.round(onlinePending * 100) / 100 },
      breakdown: details
    }
  });
});

/**
 * Inventory Valuation Trend
 * GET /admin/dashboard/analytics/inventory-valuation-trend
 */
module.exports.inventoryValuationTrend_get = catchAsync(async (req, res) => {
  // Get current inventory valuation grouped by category
  const categoryValuation = await Inventory.aggregate([
    {
      $lookup: {
        from: "products",
        localField: "product",
        foreignField: "_id",
        as: "productDetails"
      }
    },
    { $unwind: { path: "$productDetails", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "items",
        localField: "productDetails.itemId",
        foreignField: "_id",
        as: "itemDetails"
      }
    },
    { $unwind: { path: "$itemDetails", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ["$itemDetails.name", "Uncategorized"] },
        totalStock: { $sum: { $ifNull: ["$availableStock", 0] } },
        totalValue: { $sum: { $multiply: [{ $ifNull: ["$availableStock", 0] }, { $ifNull: ["$costPrice", 0] }] } },
        totalSold: { $sum: { $ifNull: ["$metrics.totalSold", 0] } },
        avgTurnover: { $avg: { $ifNull: ["$metrics.turnoverRate", 0] } },
        productCount: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        category: "$_id",
        totalStock: 1,
        totalValue: { $round: ["$totalValue", 2] },
        totalSold: 1,
        avgTurnover: { $round: ["$avgTurnover", 2] },
        productCount: 1
      }
    },
    { $sort: { totalValue: -1 } }
  ]);

  // Sales velocity over recent months (how fast inventory is depleting)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const salesByMonth = await User_Order.aggregate([
    { $match: { payment_status: "COMPLETE", createdAt: { $gte: sixMonthsAgo } } },
    { $unwind: "$products" },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
        unitsSold: { $sum: { $ifNull: ["$products.quantity", 1] } },
        revenue: { $sum: { $ifNull: ["$products.price", 0] } }
      }
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, month: "$_id", unitsSold: 1, revenue: { $round: ["$revenue", 2] } } }
  ]);

  // Overall totals
  const [totals] = await Inventory.aggregate([
    {
      $group: {
        _id: null,
        totalValuation: { $sum: { $multiply: [{ $ifNull: ["$availableStock", 0] }, { $ifNull: ["$costPrice", 0] }] } },
        totalStock: { $sum: { $ifNull: ["$availableStock", 0] } },
        totalProducts: { $sum: 1 }
      }
    }
  ]);

  successRes(res, {
    data: {
      totalValuation: Math.round((totals?.totalValuation || 0) * 100) / 100,
      totalStock: totals?.totalStock || 0,
      totalProducts: totals?.totalProducts || 0,
      byCategory: categoryValuation,
      salesVelocity: salesByMonth
    }
  });
});

/**
 * Customer Cohort Analysis
 * GET /admin/dashboard/analytics/customer-cohorts
 */
module.exports.customerCohorts_get = catchAsync(async (req, res) => {
  // For each customer, find their first purchase month, then track repeat purchases
  const cohorts = await User_Order.aggregate([
    { $match: { payment_status: "COMPLETE" } },
    { $sort: { createdAt: 1 } },
    {
      $group: {
        _id: "$buyer",
        firstPurchase: { $first: "$createdAt" },
        orders: { $push: { date: "$createdAt", total: "$grandTotal" } },
        orderCount: { $sum: 1 },
        totalSpent: { $sum: { $ifNull: ["$grandTotal", 0] } }
      }
    },
    {
      $addFields: {
        cohort: { $dateToString: { format: "%Y-%m", date: "$firstPurchase" } }
      }
    },
    {
      $group: {
        _id: "$cohort",
        customers: { $sum: 1 },
        repeatCustomers: { $sum: { $cond: [{ $gt: ["$orderCount", 1] }, 1, 0] } },
        totalOrders: { $sum: "$orderCount" },
        totalRevenue: { $sum: "$totalSpent" },
        avgOrdersPerCustomer: { $avg: "$orderCount" },
        avgLTV: { $avg: "$totalSpent" }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 12 },
    {
      $project: {
        _id: 0,
        cohort: "$_id",
        customers: 1,
        repeatCustomers: 1,
        retentionRate: {
          $cond: [
            { $gt: ["$customers", 0] },
            { $round: [{ $multiply: [{ $divide: ["$repeatCustomers", "$customers"] }, 100] }, 1] },
            0
          ]
        },
        totalOrders: 1,
        totalRevenue: { $round: ["$totalRevenue", 2] },
        avgOrdersPerCustomer: { $round: ["$avgOrdersPerCustomer", 1] },
        avgLTV: { $round: ["$avgLTV", 2] }
      }
    }
  ]);

  successRes(res, { data: cohorts });
});
