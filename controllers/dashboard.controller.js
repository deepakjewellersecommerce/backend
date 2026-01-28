const mongoose = require("mongoose");
const User_Order = mongoose.model("User_Order");
const Product = mongoose.model("Product");
const ProductVariant = mongoose.model("ProductVarient");
const MetalPrice = mongoose.model("MetalPrice");
const SubcategoryPricing = mongoose.model("SubcategoryPricing");
const catchAsync = require("../utility/catch-async");
const { successRes, errorRes } = require("../utility");

/**
 * Get critical dashboard KPIs for Phase 1
 * Focus on alerts that prevent revenue loss
 */
module.exports.getDashboardKPIs_get = catchAsync(async (req, res) => {
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // 1. Orders pending processing (PLACED status, older than 24h)
  const pendingOrders = await User_Order.aggregate([
    {
      $match: {
        order_status: "PLACED",
        createdAt: { $lt: oneDayAgo }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        over24h: {
          $sum: {
            $cond: [
              { $lt: ["$createdAt", new Date(now.getTime() - 24 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        },
        over48h: {
          $sum: {
            $cond: [
              { $lt: ["$createdAt", new Date(now.getTime() - 48 * 60 * 60 * 1000)] },
              1,
              0
            ]
          }
        }
      }
    }
  ]);

  // 2. Stock-outs with pending orders
  const stockOutOrders = await User_Order.aggregate([
    {
      $match: {
        order_status: { $in: ["PLACED", "SHIPPED"] }
      }
    },
    {
      $unwind: "$products"
    },
    {
      $lookup: {
        from: "productvarients",
        localField: "products.variant",
        foreignField: "_id",
        as: "variant"
      }
    },
    {
      $unwind: "$variant"
    },
    {
      $match: {
        "variant.stock": 0
      }
    },
    {
      $group: {
        _id: "$products.product",
        productName: { $first: "$products.product" },
        variantId: { $first: "$products.variant" },
        pendingQuantity: { $sum: "$products.quantity" },
        orderCount: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "_id",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $unwind: "$product"
    },
    {
      $project: {
        _id: 1,
        productName: "$product.productTitle",
        variantId: 1,
        pendingQuantity: 1,
        orderCount: 1
      }
    },
    {
      $sort: { pendingQuantity: -1 }
    }
  ]);

  // 3. Pricing errors (products with invalid configurations)
  const pricingErrors = await Product.aggregate([
    {
      $lookup: {
        from: "subcategorypricings",
        localField: "subcategoryId",
        foreignField: "subcategoryId",
        as: "subcategoryPricing"
      }
    },
    {
      $match: {
        $or: [
          // Products with SUBCATEGORY_DYNAMIC but no subcategory pricing
          {
            pricingMode: "SUBCATEGORY_DYNAMIC",
            $or: [
              { subcategoryPricing: { $size: 0 } },
              { "subcategoryPricing.isActive": false }
            ]
          },
          // Products with missing required fields for pricing
          {
            $or: [
              { metalType: { $exists: false } },
              { grossWeight: { $exists: false } },
              { netWeight: { $exists: false } }
            ]
          }
        ]
      }
    },
    {
      $project: {
        _id: 1,
        name: "$productTitle",
        pricingMode: 1,
        metalType: 1,
        subcategoryId: 1,
        hasSubcategoryPricing: { $gt: [{ $size: "$subcategoryPricing" }, 0] }
      }
    }
  ]);

  // 4. Metal rate volatility (24h and 7d changes)
  const metalRates = await MetalPrice.find()
    .sort({ createdAt: -1 })
    .limit(100); // Get recent rates

  const volatilityData = {};
  const metalTypes = ["GOLD_24K", "GOLD_22K", "SILVER_999", "SILVER_925", "PLATINUM"];

  metalTypes.forEach(metalType => {
    const rates = metalRates.filter(rate => rate.metalType === metalType);
    if (rates.length >= 2) {
      const latest = rates[0];
      const previous24h = rates.find(rate => rate.createdAt < oneDayAgo) || rates[1];
      const previous7d = rates.find(rate => rate.createdAt < sevenDaysAgo) || rates[rates.length - 1];

      const change24h = previous24h ? ((latest.price - previous24h.price) / previous24h.price * 100) : 0;
      const change7d = previous7d ? ((latest.price - previous7d.price) / previous7d.price * 100) : 0;

      volatilityData[metalType] = {
        current: latest.price,
        change24h: Math.round(change24h * 100) / 100,
        change7d: Math.round(change7d * 100) / 100,
        lastUpdated: latest.createdAt
      };
    }
  });

  // 5. Today's revenue
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayRevenue = await User_Order.aggregate([
    {
      $match: {
        createdAt: { $gte: todayStart },
        payment_status: "COMPLETE",
        order_status: { $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_CUSTOMER", "RETURNED"] }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: "$grandTotal" },
        count: { $sum: 1 }
      }
    }
  ]);

  const response = {
    alerts: {
      pendingOrders: {
        total: pendingOrders[0]?.total || 0,
        over24h: pendingOrders[0]?.over24h || 0,
        over48h: pendingOrders[0]?.over48h || 0
      },
      stockOutOrders: stockOutOrders.length,
      stockOutDetails: stockOutOrders.slice(0, 5), // Top 5
      pricingErrors: pricingErrors.length,
      pricingErrorDetails: pricingErrors.slice(0, 5) // Top 5
    },
    metalVolatility: volatilityData,
    todayRevenue: {
      amount: todayRevenue[0]?.total || 0,
      orderCount: todayRevenue[0]?.count || 0
    },
    timestamp: now
  };

  successRes(res, { data: response });
});

/**
 * Get detailed pending orders for admin action
 */
module.exports.getPendingOrdersDetails_get = catchAsync(async (req, res) => {
  const { hours = 24 } = req.query;
  const cutoffDate = new Date(Date.now() - hours * 60 * 60 * 1000);

  const orders = await User_Order.find({
    order_status: "PLACED",
    createdAt: { $lt: cutoffDate }
  })
  .populate("buyer", "displayName email phone")
  .populate("products.product", "productTitle")
  .populate("products.variant", "size color")
  .sort({ createdAt: 1 }) // Oldest first
  .limit(50);

  successRes(res, { data: orders });
});

/**
 * Get detailed stock-out orders
 */
module.exports.getStockOutOrdersDetails_get = catchAsync(async (req, res) => {
  const stockOutOrders = await User_Order.aggregate([
    {
      $match: {
        order_status: { $in: ["PLACED", "SHIPPED"] }
      }
    },
    {
      $unwind: "$products"
    },
    {
      $lookup: {
        from: "productvarients",
        localField: "products.variant",
        foreignField: "_id",
        as: "variant"
      }
    },
    {
      $unwind: "$variant"
    },
    {
      $match: {
        "variant.stock": 0
      }
    },
    {
      $lookup: {
        from: "products",
        localField: "products.product",
        foreignField: "_id",
        as: "product"
      }
    },
    {
      $unwind: "$product"
    },
    {
      $lookup: {
        from: "users",
        localField: "buyer",
        foreignField: "_id",
        as: "buyer"
      }
    },
    {
      $unwind: "$buyer"
    },
    {
      $project: {
        _id: 1,
        orderId: "$_id",
        buyerName: "$buyer.displayName",
        buyerEmail: "$buyer.email",
        productName: "$product.productTitle",
        variantSize: "$variant.size",
        quantity: "$products.quantity",
        orderDate: "$createdAt",
        orderStatus: "$order_status"
      }
    },
    {
      $sort: { orderDate: 1 }
    }
  ]);

  successRes(res, { data: stockOutOrders });
});

/**
 * Get pricing error details
 */
module.exports.getPricingErrorsDetails_get = catchAsync(async (req, res) => {
  const errors = await Product.aggregate([
    {
      $lookup: {
        from: "subcategorypricings",
        localField: "subcategory",
        foreignField: "subcategory",
        as: "subcategoryPricing"
      }
    },
    {
      $match: {
        $or: [
          {
            pricingMode: "SUBCATEGORY_DYNAMIC",
            $or: [
              { subcategoryPricing: { $size: 0 } },
              { "subcategoryPricing.isActive": false }
            ]
          },
          {
            $or: [
              { metalType: { $exists: false } },
              { grossWeight: { $exists: false } },
              { netWeight: { $exists: false } }
            ]
          }
        ]
      }
    },
    {
      $lookup: {
        from: "subcategories",
        localField: "subcategory",
        foreignField: "_id",
        as: "subcategory"
      }
    },
    {
      $unwind: { path: "$subcategory", preserveNullAndEmptyArrays: true }
    },
    {
      $project: {
        _id: 1,
        name: 1,
        pricingMode: 1,
        metalType: 1,
        subcategoryName: "$subcategory.name",
        hasSubcategoryPricing: { $gt: [{ $size: "$subcategoryPricing" }, 0] },
        missingFields: {
          metalType: { $cond: [{ $eq: ["$metalType", null] }, true, false] },
          grossWeight: { $cond: [{ $eq: ["$grossWeight", null] }, true, false] },
          netWeight: { $cond: [{ $eq: ["$netWeight", null] }, true, false] }
        }
      }
    },
    {
      $sort: { name: 1 }
    }
  ]);

  successRes(res, { data: errors });
});

/**
 * Get revenue breakdown by metal type
 */
module.exports.getRevenueByMetal_get = catchAsync(async (req, res) => {
  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(new Date().getDate() - 30));
  const end = endDate ? new Date(endDate) : new Date();

  // Ensure end date includes the full day
  if (endDate) {
    end.setHours(23, 59, 59, 999);
  }

  const revenueByMetal = await User_Order.aggregate([
    {
      $match: {
        createdAt: { $gte: start, $lte: end },
        payment_status: "COMPLETE",
        order_status: { $nin: ["CANCELLED_BY_ADMIN", "CANCELLED_BY_CUSTOMER", "RETURNED"] }
      }
    },
    {
      $unwind: "$items"
    },
    {
      $group: {
        _id: "$items.metalType",
        revenue: { $sum: "$items.lineTotal" }
      }
    },
    {
      $project: {
        _id: 0,
        metalType: "$_id",
        revenue: 1
      }
    },
    {
      $sort: { revenue: -1 }
    }
  ]);

  // Map null/undefined metal types to 'OTHER'
  const formattedRevenue = revenueByMetal.map(item => ({
    ...item,
    metalType: item.metalType || "OTHER"
  }));

  successRes(res, { data: formattedRevenue });
});