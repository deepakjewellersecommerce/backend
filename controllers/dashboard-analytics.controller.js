const mongoose = require("mongoose");
const User_Order = mongoose.model("User_Order");
const Inventory = mongoose.model("Inventory");
const Product = mongoose.model("Product");
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
