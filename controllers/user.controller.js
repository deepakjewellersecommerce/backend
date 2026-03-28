const mongoose = require("mongoose");
const User = mongoose.model("User");
const User_Cart = mongoose.model("User_Cart");
const User_Order = mongoose.model("User_Order");
const {
  errorRes,
  internalServerError,
  successRes,
  addressValidator,
} = require("../utility/index");
const asynchandler = require("express-async-handler");
const {
  uploadOnCloudinary,
  deleteFromCloudinary,
} = require("../middlewares/Cloudinary");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const InvoiceService = require("../services/invoice.service");
const UserLoyalty = require("../models/user-loyalty.model");
const fs = require("fs");

// Enhanced user dashboard with comprehensive data
module.exports.getUserDashboard = catchAsync(async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user basic info
    const user = await User.findById(userId)
      .select("-password -__v")
      .populate("cart");

    if (!user) {
      return errorRes(res, 404, "User not found");
    }

    // Get order statistics
    const User_Order = require("../models/order.model").User_Order;
    const orderStats = await User_Order.aggregate([
      { $match: { buyer: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: { $toDouble: "$order_price" } },
          pendingOrders: {
            $sum: {
              $cond: [
                { $ne: ["$order_status", "DELIVERED"] },
                1,
                0
              ]
            }
          },
          deliveredOrders: {
            $sum: {
              $cond: [
                { $eq: ["$order_status", "DELIVERED"] },
                1,
                0
              ]
            }
          }
        }
      }
    ]);

    // Get recent orders (last 5)
    const recentOrders = await User_Order.find({ buyer: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("products.product", "productTitle productImageUrl")
      .select("createdAt order_status order_price products");

    // Get loyalty information
    let loyaltyInfo = await UserLoyalty.findOne({ user: userId });
    
    if (!loyaltyInfo) {
      loyaltyInfo = new UserLoyalty({
        user: userId,
        totalPoints: 0,
        availablePoints: 0
      });
      await loyaltyInfo.save();
    }

    // Get wishlist count
    const Wishlist = require("../models/wishlist.Model");
    const wishlistCount = await Wishlist.countDocuments({ user: userId });

    // Get cart information
    const cartInfo = await User_Cart.findOne({ userId })
      .populate("products.productId", "productTitle productImageUrl salePrice")
      .populate("products.varientId");

    // Calculate cart total
    let cartTotal = 0;
    let cartItemCount = 0;
    if (cartInfo && cartInfo.products) {
      cartItemCount = cartInfo.products.length;
      cartTotal = cartInfo.products.reduce((total, item) => {
        const price = item.productId?.salePrice || 0;
        return total + (price * item.quantity);
      }, 0);
    }

    // Get saved addresses count
    const addressCount = user.shippingAddress ? user.shippingAddress.length : 0;

    // Prepare dashboard data
    const dashboardData = {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        displayImage: user.displayImage,
        accountType: user.accountType,
        memberSince: user.createdAt
      },
      orderSummary: {
        totalOrders: orderStats[0]?.totalOrders || 0,
        totalSpent: orderStats[0]?.totalSpent || 0,
        pendingOrders: orderStats[0]?.pendingOrders || 0,
        deliveredOrders: orderStats[0]?.deliveredOrders || 0
      },
      recentOrders: recentOrders,
      loyalty: {
        totalPoints: loyaltyInfo.totalPoints,
        availablePoints: loyaltyInfo.availablePoints,
        currentTier: loyaltyInfo.currentTier.name,
        tierBenefits: loyaltyInfo.currentTier.benefits,
        lifetimeSpent: loyaltyInfo.lifetimeSpent
      },
      cart: {
        itemCount: cartItemCount,
        total: cartTotal,
        items: cartInfo?.products || []
      },
      wishlistCount,
      addressCount,
      accountStats: {
        joinDate: user.createdAt,
        lastLogin: user.updatedAt,
        profileCompletion: calculateProfileCompletion(user)
      }
    };

    successRes(res, {
      dashboard: dashboardData,
      message: "Dashboard data retrieved successfully"
    });

  } catch (error) {
    console.error("Error getting user dashboard:", error);
    internalServerError(res, "Error retrieving dashboard data");
  }
});

// Helper function to calculate profile completion percentage
function calculateProfileCompletion(user) {
  let completionScore = 0;
  const maxScore = 100;
  
  // Basic info (40 points)
  if (user.name) completionScore += 10;
  if (user.email) completionScore += 10;
  if (user.phoneNumber) completionScore += 10;
  if (user.displayImage && user.displayImage !== "default") completionScore += 10;
  
  // Address info (30 points)
  if (user.shippingAddress && user.shippingAddress.length > 0) {
    const address = user.shippingAddress[0];
    if (address.firstName) completionScore += 5;
    if (address.lastName) completionScore += 5;
    if (address.street) completionScore += 5;
    if (address.city) completionScore += 5;
    if (address.state) completionScore += 5;
    if (address.zip) completionScore += 5;
  }
  
  // Account activity (30 points)
  if (user.coupon_applied && user.coupon_applied.length > 0) completionScore += 10;
  // Add 20 points if user has made at least one order (to be checked separately)
  
  return Math.min(completionScore, maxScore);
}

// Download invoice for an order
module.exports.downloadInvoice = catchAsync(async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user._id;

    // Get order details
    const User_Order = require("../models/order.model").User_Order;
    const order = await User_Order.findOne({ 
      _id: orderId, 
      buyer: userId 
    }).populate("products.product").populate("buyer", "name email");

    if (!order) {
      return errorRes(res, 404, "Order not found or access denied");
    }

    // Generate invoice PDF
    const filePath = await InvoiceService.generateInvoice(order, order.buyer);

    // Send file as download
    res.download(filePath, `invoice-${order._id}.pdf`, (err) => {
      if (err) {
        console.error("Error downloading invoice:", err);
        // Don't try to send another response if headers are already sent
      }
      
      // Clean up file after download
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error("Error deleting temporary invoice file:", unlinkErr);
        }
      });
    });

  } catch (error) {
    console.error("Error generating invoice:", error);
    internalServerError(res, "Error generating invoice");
  }
});

// Admin: Get a specific user's full profile with order stats, loyalty, wishlist, coupons, category affinity
module.exports.adminGetUserProfile = catchAsync(async (req, res) => {
  const { userId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return errorRes(res, 400, "Invalid user ID.");
  }

  const user = await User.findById(userId).select("-password -__v");
  if (!user) return errorRes(res, 404, "User not found.");

  const User_Order = require("../models/order.model").User_Order;
  const Wishlist = require("../models/wishlist.Model");
  const userObjectId = mongoose.Types.ObjectId.isValid(userId)
    ? new mongoose.Types.ObjectId(userId)
    : user._id;

  // ── Run all heavy queries in parallel ──
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [
    statsResult,
    orders,
    orderCount,
    loyaltyInfo,
    wishlistItems,
    paymentBreakdown,
    categoryAffinity,
    returnRefundStats,
    couponUsage,
  ] = await Promise.all([
    // 1. Core order stats
    User_Order.aggregate([
      { $match: { buyer: userObjectId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: "$grandTotal" },
          cancelledOrders: {
            $sum: {
              $cond: [
                { $in: ["$order_status", ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN"]] },
                1, 0,
              ],
            },
          },
          deliveredOrders: {
            $sum: { $cond: [{ $eq: ["$order_status", "DELIVERED"] }, 1, 0] },
          },
          activeOrders: {
            $sum: {
              $cond: [
                { $in: ["$order_status", ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY"]] },
                1, 0,
              ],
            },
          },
          returnedOrders: {
            $sum: { $cond: [{ $eq: ["$order_status", "RETURNED"] }, 1, 0] },
          },
          refundedOrders: {
            $sum: { $cond: [{ $eq: ["$order_status", "REFUNDED"] }, 1, 0] },
          },
          avgOrderValue: { $avg: "$grandTotal" },
          lastOrderDate: { $max: "$createdAt" },
          firstOrderDate: { $min: "$createdAt" },
        },
      },
    ]),

    // 2. Paginated orders
    User_Order.find({ buyer: userId })
      .sort("-createdAt")
      .skip(skip)
      .limit(limit)
      .populate("products.product", "productTitle productImageUrl")
      .select("orderNumber order_status payment_status payment_mode grandTotal createdAt items products couponCode couponDiscount"),

    // 3. Total order count
    User_Order.countDocuments({ buyer: userId }),

    // 4. Loyalty info
    UserLoyalty.findOne({ user: userId }).lean(),

    // 5. Wishlist with product details
    Wishlist.find({ user: userId })
      .populate("product", "productTitle productImageUrl salePrice calculatedPrice staticPrice")
      .sort("-createdAt")
      .limit(20)
      .lean(),

    // 6. Payment method breakdown (COD vs Online)
    User_Order.aggregate([
      { $match: { buyer: userObjectId } },
      { $group: { _id: "$payment_mode", count: { $sum: 1 }, total: { $sum: "$grandTotal" } } },
    ]),

    // 7. Category affinity — top subcategories by spend using denormalized categoryHierarchyPath
    User_Order.aggregate([
      { $match: { buyer: userObjectId, order_status: { $nin: ["CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "REFUNDED"] } } },
      { $unwind: { path: "$items", preserveNullAndEmptyArrays: false } },
      // Try items.categoryHierarchyPath first; fall back to product lookup for older orders
      { $lookup: { from: "products", localField: "items.product", foreignField: "_id", as: "prod" } },
      { $unwind: { path: "$prod", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "subcategories", localField: "prod.subcategoryId", foreignField: "_id", as: "subcat" } },
      { $unwind: { path: "$subcat", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          // Prefer subcategory name from lookup; fall back to last segment of categoryHierarchyPath
          resolvedCategory: {
            $cond: {
              if: { $gt: [{ $strLenCP: { $ifNull: ["$subcat.name", ""] } }, 0] },
              then: "$subcat.name",
              else: {
                $cond: {
                  if: { $gt: [{ $strLenCP: { $ifNull: ["$items.categoryHierarchyPath", ""] } }, 0] },
                  then: {
                    $let: {
                      vars: { parts: { $split: ["$items.categoryHierarchyPath", " > "] } },
                      in: { $arrayElemAt: ["$$parts", -1] },
                    },
                  },
                  else: null,
                },
              },
            },
          },
        },
      },
      { $match: { resolvedCategory: { $ne: null } } },
      {
        $group: {
          _id: "$resolvedCategory",
          orderCount: { $sum: 1 },
          totalSpent: { $sum: { $ifNull: ["$items.lineTotal", 0] } },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
      { $project: { _id: 0, category: "$_id", orderCount: 1, totalSpent: 1 } },
    ]),

    // 8. Return/refund history (last 5 events)
    User_Order.find({
      buyer: userId,
      order_status: { $in: ["RETURNED", "REFUNDED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN"] },
    })
      .sort("-updatedAt")
      .limit(5)
      .select("orderNumber order_status grandTotal createdAt cancelledAt couponCode")
      .lean(),

    // 9. Coupon usage — distinct coupons used across all orders
    User_Order.aggregate([
      { $match: { buyer: userObjectId, couponCode: { $exists: true, $nin: [null, ""] } } },
      {
        $group: {
          _id: "$couponCode",
          timesUsed: { $sum: 1 },
          totalDiscount: { $sum: { $ifNull: ["$couponDiscount", 0] } },
          lastUsed: { $max: "$createdAt" },
        },
      },
      { $sort: { lastUsed: -1 } },
      { $project: { _id: 0, couponCode: "$_id", timesUsed: 1, totalDiscount: 1, lastUsed: 1 } },
    ]),
  ]);

  const stats = statsResult[0] || {
    totalOrders: 0, totalSpent: 0, cancelledOrders: 0, deliveredOrders: 0,
    activeOrders: 0, returnedOrders: 0, refundedOrders: 0,
    avgOrderValue: 0, lastOrderDate: null, firstOrderDate: null,
  };

  // Mask PAN number before sending to admin (show ABCXX678X shape)
  const userObj = user.toObject();
  if (userObj.pan?.number) {
    const p = userObj.pan.number;
    userObj.pan.number = p.length === 10
      ? `${p.slice(0, 3)}XX${p.slice(5, 8)}X`
      : p;
  }

  successRes(res, {
    user: userObj,
    orderStats: stats,
    orders,
    orderCount,
    page,
    limit,
    loyalty: loyaltyInfo || null,
    wishlist: wishlistItems,
    paymentBreakdown,
    categoryAffinity,
    returnRefundHistory: returnRefundStats,
    couponUsage,
  });
});

module.exports.allusers_get = async (req, res) => {
  try {
    const search = req.query.search || "";
    const accountStatus = String(req.query.accountStatus || "").toLowerCase();
    const hasOrders = String(req.query.hasOrders || "").toLowerCase();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    if (accountStatus === "active") {
      filter.isBlocked = false;
    }

    if (accountStatus === "blocked") {
      filter.isBlocked = true;
    }

    if (hasOrders === "yes" || hasOrders === "no") {
      const orderedUserIds = await User_Order.distinct("buyer");
      filter._id = hasOrders === "yes" ? { $in: orderedUserIds } : { $nin: orderedUserIds };
    }

    const result = await buildPaginatedSortedFilteredQuery(
      User.find(filter).select("-password -__v").sort("name"),
      req,
      User
    );

    successRes(res, { users: result, total: result.total, limit: result.limit, page: result.page });
  } catch (err) {
    internalServerError(res, err);
  }
};

module.exports.blockUser_post = (req, res) => {
  const { userId, blockStatus } = req.params;
  if (!userId || !blockStatus) return errorRes(res, 400, "Invalid request.");

  User.findByIdAndUpdate(
    userId,
    { isBlocked: blockStatus },
    { new: true, runValidators: true }
  )
    .select("-password")
    .then((updatedUser) => {
      if (!updatedUser) return errorRes(res, 400, "User does not exist");

      if (updatedUser.isBlocked)
        return successRes(res, {
          updatedUser,
          message: "User blocked successfully.",
        });
      else
        return successRes(res, {
          updatedUser,
          message: "User unblocked successfully.",
        });
    })
    .catch((err) => internalServerError(res, err));
};

module.exports.updateUserAddress_post = (req, res) => {
  const { shippingAddress } = req.body;
  const { _id } = req.user;
  if (shippingAddress) {
    User.findByIdAndUpdate(
      _id,
      { shippingAddress },
      { new: true, runValidators: true }
    )
      .select("-password -__v -accountType -isBlocked")
      .then((updatedUser) => {
        if (updatedUser) {
          return res.json({
            status: "success",
            data: {
              user: updatedUser,
            },
            message: "Address updated.",
          });
        } else return errorRes(res, 400, "User does not exist.");
      })
      .catch((err) => internalServerError(res, err));
  } else {
    return errorRes(res, 400, "Address cannot be empty.");
  }
};

module.exports.deleteUser_delete = (req, res) => {
  const { userId } = req.params;

  User.findByIdAndDelete(userId)
    .then((deletedUser) => {
      if (!deletedUser) return errorRes(res, 404, "User does not exist");
      else {
        User_Cart.findByIdAndDelete(deletedUser.cart).then((deletedCart) => {
          if (!deletedCart)
            return successRes(res, {
              deletedUser,
              message: "User deleted successfully.",
            });
          else {
            return successRes(res, {
              deletedUser,
              deletedCart,
              message: "User and related data deleted successfully.",
            });
          }
        });
      }
    })
    .catch((err) => internalServerError(res, err));
};

module.exports.getUser = catchAsync(async (req, res) => {
  const id = req.user._id;
  const findUser = await User.findById({ _id: id }).select("-password -__v");
  if (findUser) {
    successRes(res, findUser);
  } else {
    errorRes(res, 404, "Cannot find the user");
  }
});

module.exports.updateUser = catchAsync(async (req, res) => {
  const id = req.user._id;
  const findUser = await User.findById({ _id: id }).select("-password -__v");
  if (findUser) {
    const { name, phoneNumber, profileImageUrl, shippingAddress } = req.body;
    const updateData = {};
    if (name) {
      updateData.name = name;
    }
    if (phoneNumber) {
      updateData.phoneNumber = phoneNumber;
    }
    if (profileImageUrl) {
      updateData.profileImageUrl = profileImageUrl;
    }

    if (shippingAddress) {
      updateData.shippingAddress = shippingAddress;
    }

    const updatedUser = await User.findByIdAndUpdate({ _id: id }, updateData, {
      new: true,
    });
    if (updatedUser) {
      successRes(res, updatedUser);
    } else {
      internalServerError(res, "Failed to update the user");
    }
  } else {
    errorRes(res, 404, "Cannot find the user");
  }
});

module.exports.deleteAddress_patch = asynchandler(async (req, res) => {
  try {
    const id = req.user._id;
    const { addressId } = req.body;
    // console.log(id, addressId)
    if (!id || !addressId) {
      return errorRes(res, 404, "Id id not Found.");
    }
    const user = await User.findById(id);
    if (!user) return errorRes(res, 404, "User is not Found.");
    const addressIndex = user?.shippingAddress?.findIndex(
      (address) => address._id.toString() === addressId.toString()
    );
    console.log(addressIndex);
    if (addressIndex === -1) {
      return errorRes(res, 400, "Address not found.");
    }
    user.shippingAddress.splice(addressIndex, 1);
    const update = await user.save();
    if (!update) {
      internalServerError(res, "Failed due to internal server error.");
    }
    successRes(res, update);
  } catch (error) {
    internalServerError(res, error.message);
  }
});

// Get enhanced user dashboard
module.exports.getEnhancedDashboard = catchAsync(async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get user details
    const user = await User.findById(userId).select("-password");
    
    // Get order statistics
    const User_Order = require("../models/order.model").User_Order;
    const orderStats = await User_Order.aggregate([
      { $match: { buyer: userId } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalSpent: { $sum: { $toDouble: "$order_price" } },
          recentOrders: { $push: "$$ROOT" }
        }
      }
    ]);

    // Get loyalty information
    let loyaltyInfo = await LoyaltyProgram.findOne({ user: userId });
    if (!loyaltyInfo) {
      loyaltyInfo = {
        totalPoints: 0,
        availablePoints: 0,
        tier: "BRONZE",
        tierBenefits: { discountPercentage: 0 }
      };
    }

    // Get recent orders
    const recentOrders = await User_Order.find({ buyer: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("products.product", "productTitle silverWeight");

    // Get wishlist count
    const Wishlist = require("../models/wishlist.Model");
    const wishlistCount = await Wishlist.countDocuments({ user: userId });

    successRes(res, {
      user,
      orderStats: orderStats[0] || { totalOrders: 0, totalSpent: 0 },
      loyaltyInfo,
      recentOrders,
      wishlistCount,
      message: "Enhanced dashboard data retrieved successfully"
    });

  } catch (error) {
    console.error("Error getting enhanced dashboard:", error);
    internalServerError(res, "Error retrieving dashboard data");
  }
});
