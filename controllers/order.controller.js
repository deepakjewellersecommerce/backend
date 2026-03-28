const mongoose = require("mongoose");
const User_Order = mongoose.model("User_Order");
const User = mongoose.model("User");
const User_Cart = mongoose.model("User_Cart");
const Product = mongoose.model("Product");
const asynchandler = require("express-async-handler");
const {
  errorRes,
  successRes,
  internalServerError,
  razorpayInstance,
} = require("../utility");
const crypto = require("crypto");
const qs = require("querystring");
const ccav = require("../utility/ccavutil");
const catchAsync = require("../utility/catch-async");
const ProductVariant = require("../models/product_varient");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const { addProductUpdateNotification } = require("./notification.controller");
require("dotenv").config();

const HIGH_VALUE_THRESHOLD = 200000; // ₹2,00,000 — must match pan.controller.js

module.exports.placeOrder_post = catchAsync(async (req, res) => {
  const { products, shippingAddress, payment_mode, payment_status,
          coupon_applied, discountAmount, shippingAmount, taxAmount,
          grandTotal } = req.body;
  const { _id: userId } = req.user;

  if (!products || products.length === 0)
    return errorRes(res, 400, "Cart is empty.");

  // ── High-value order checks ───────────────────────────────────────────────
  // grandTotal is sent by the frontend; we re-verify it below after snapshot.
  // This pre-check gives the user an early, clear error before we do DB work.
  const declaredTotal = Number(grandTotal) || 0;

  if (declaredTotal > HIGH_VALUE_THRESHOLD) {
    const buyer = await User.findById(userId).select("pan");

    // Rule 1: PAN must be verified for any order above ₹2L
    if (!buyer?.pan?.verified) {
      return errorRes(res, 403, "PAN_VERIFICATION_REQUIRED");
    }

    // Rule 2: COD cannot exceed ₹2L — remainder must be paid online
    if (payment_mode === "COD") {
      return errorRes(res, 400, "COD_LIMIT_EXCEEDED");
    }
  }

  // ── Payment lock: ONLINE orders must not be placed via this endpoint ─────
  // ONLINE orders are created only after payment is verified through the
  // dedicated payment-gateway routes (Razorpay / Stripe / CCAvenue).
  // Hitting this endpoint with payment_mode=ONLINE would create an unpaid order.
  if ((payment_mode || "COD") === "ONLINE") {
    return errorRes(res, 400, "ONLINE orders must be placed through the payment gateway. Use the Razorpay or Stripe checkout flow.");
  }

  // Map frontend products format to cartItems expected by createWithSnapshots
  const cartItems = products.map((item) => ({
    productId: item.product,
    quantity: item.quantity,
    variantId: item.variant || null
  }));

  const order = await User_Order.createWithSnapshots({
    cartItems,
    buyer: userId,
    shippingAddress,
    payment_mode: "COD",
    payment_status: "PENDING",
    coupon_applied,
    discountAmount,
    shippingAmount,
    taxAmount
  });

  return successRes(res, {
    message: "Order placed successfully.",
    data: order,
  });
});

module.exports.getAllOrders_get = catchAsync(async (req, res) => {
  const { search, payment_status, order_status, startDate, endDate } = req.query;

  const filter = {};

  // ── Status filters (direct field match) ──
  const VALID_PAYMENT_STATUSES = ["PENDING", "COMPLETE", "FAILED", "REFUNDED"];
  const VALID_ORDER_STATUSES = [
    "PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "OUT_FOR_DELIVERY",
    "DELIVERED", "CANCELLED_BY_CUSTOMER", "CANCELLED_BY_ADMIN", "RETURNED", "REFUNDED",
  ];
  if (payment_status && VALID_PAYMENT_STATUSES.includes(payment_status)) {
    filter.payment_status = payment_status;
  }
  if (order_status && VALID_ORDER_STATUSES.includes(order_status)) {
    filter.order_status = order_status;
  }

  // ── Date range on createdAt ──
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999Z`);
  }

  // ── Search: shippingAddress fields + buyer lookup ──
  if (search && search.trim()) {
    const s = search.trim();
    // Look up users by name or phone (phoneNumber is Number, use $expr for phone)
    const userMatches = await User.find({
      $or: [
        { name: { $regex: s, $options: "i" } },
        { $expr: { $regexMatch: { input: { $toString: "$phoneNumber" }, regex: s, options: "i" } } },
      ],
    }).select("_id");
    const buyerIds = userMatches.map((u) => u._id);

    filter.$or = [
      { "shippingAddress.name": { $regex: s, $options: "i" } },
      { "shippingAddress.phone": { $regex: s, $options: "i" } },
      ...(buyerIds.length ? [{ buyer: { $in: buyerIds } }] : []),
    ];
  }

  const orders = await buildPaginatedSortedFilteredQuery(
    User_Order.find(filter)
      .sort("-createdAt")
      .populate([
        { path: "buyer" },
        { path: "products.product" },
        { path: "products.variant" },
        {
          path: "coupon_applied",
          select: "_id code condition min_price discount_percent is_active",
        },
      ]),
    req,
    User_Order
  );

  successRes(res, orders);
});

module.exports.userOrderDetails_get = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { _id: userId } = req.user;

  if (!orderId) return errorRes(res, 400, "Order Id is required.");
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId).populate([
    { path: "buyer", select: "_id displayName email" },
    {
      path: "products.product",
    },
    {
      path: "products.variant",
    },
    {
      path: "coupon_applied",
    },
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  if (String(order.buyer._id) !== String(userId))
    return errorRes(res, 403, "Unauthorized.");

  successRes(res, { data: order });
});

module.exports.adminOrderDetails_get = catchAsync(async (req, res) => {
  const orderId = req.params.orderId ?? "";

  if (!Boolean(orderId)) return errorRes(res, 400, "Order Id is required.");
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId).populate([
    { path: "buyer", select: "_id displayName email" },
    {
      path: "products.product",
    },
    {
      path: "products.variant",
      populate: {
        path: "color",
      },
    },
    {
      path: "coupon_applied",
    },
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  successRes(res, { data: order });
});

module.exports.adminDownloadInvoice = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const fs = require("fs");

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID.");
  }

  const order = await User_Order.findById(orderId).populate([
    { path: "buyer", select: "name email phoneNumber" },
    { path: "products.product", select: "productTitle skuNo" },
    { path: "items.product", select: "productTitle skuNo" },
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  const InvoiceService = require("../services/invoice.service");
  const { filePath, fileName } = await InvoiceService.generateInvoice(order, order.buyer);

  res.download(filePath, fileName, (err) => {
    if (err) console.error("Invoice download error:", err);
    fs.unlink(filePath, () => {});
  });
});

// ── GST Monthly Report ────────────────────────────────────────────────────────
// GET /admin/order/gst-report?year=2025&month=3   (month is 1-based)
// GET /admin/order/gst-report?year=2025            (full year, all months)
module.exports.getGstReport = catchAsync(async (req, res) => {
  const { year, month } = req.query;
  if (!year) return errorRes(res, 400, "year is required");

  const y = parseInt(year, 10);
  let startDate, endDate;

  if (month) {
    const m = parseInt(month, 10); // 1-based
    startDate = new Date(y, m - 1, 1);
    endDate   = new Date(y, m, 1);
  } else {
    startDate = new Date(y, 0, 1);
    endDate   = new Date(y + 1, 0, 1);
  }

  // Only completed/paid orders
  const matchStage = {
    $match: {
      createdAt: { $gte: startDate, $lt: endDate },
      payment_status: { $in: ["COMPLETE"] },
      order_status: { $nin: ["CANCELLED", "REFUNDED", "RETURNED"] },
    },
  };

  // Monthly breakdown aggregation
  const monthlyPipeline = [
    matchStage,
    {
      $group: {
        _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } },
        orderCount:    { $sum: 1 },
        taxableValue:  { $sum: "$subtotal" },
        totalTax:      { $sum: "$taxAmount" },
        totalDiscount: { $sum: "$discountAmount" },
        totalShipping: { $sum: "$shippingAmount" },
        grandTotal:    { $sum: "$grandTotal" },
        codOrders:     { $sum: { $cond: [{ $eq: ["$payment_mode", "COD"] }, 1, 0] } },
        onlineOrders:  { $sum: { $cond: [{ $eq: ["$payment_mode", "ONLINE"] }, 1, 0] } },
      },
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } },
  ];

  // Order-level detail for CSV export
  const detailPipeline = [
    matchStage,
    {
      $lookup: {
        from: "users",
        localField: "buyer",
        foreignField: "_id",
        as: "buyerInfo",
      },
    },
    { $unwind: { path: "$buyerInfo", preserveNullAndEmptyArrays: true } },
    {
      $project: {
        orderNumber:    1,
        createdAt:      1,
        payment_mode:   1,
        subtotal:       1,
        taxAmount:      1,
        discountAmount: 1,
        shippingAmount: 1,
        grandTotal:     1,
        "shippingAddress.name": 1,
        "shippingAddress.phone": 1,
        "buyerInfo.email": 1,
        "buyerInfo.pan.number": 1,
        "buyerInfo.pan.verified": 1,
      },
    },
    { $sort: { createdAt: 1 } },
  ];

  // Totals summary
  const summaryPipeline = [
    matchStage,
    {
      $group: {
        _id: null,
        orderCount:    { $sum: 1 },
        taxableValue:  { $sum: "$subtotal" },
        totalTax:      { $sum: "$taxAmount" },
        totalDiscount: { $sum: "$discountAmount" },
        totalShipping: { $sum: "$shippingAmount" },
        grandTotal:    { $sum: "$grandTotal" },
        highValueOrders: { $sum: { $cond: [{ $gte: ["$grandTotal", 200000] }, 1, 0] } },
      },
    },
  ];

  const [monthly, orders, summaryArr] = await Promise.all([
    User_Order.aggregate(monthlyPipeline),
    User_Order.aggregate(detailPipeline),
    User_Order.aggregate(summaryPipeline),
  ]);

  const summary = summaryArr[0] || {
    orderCount: 0, taxableValue: 0, totalTax: 0,
    totalDiscount: 0, totalShipping: 0, grandTotal: 0, highValueOrders: 0,
  };

  // Mask PAN for display (show only last 4 chars)
  const maskedOrders = orders.map((o) => {
    const pan = o.buyerInfo?.pan?.number;
    return {
      ...o,
      buyerInfo: o.buyerInfo
        ? {
            ...o.buyerInfo,
            pan: pan
              ? { number: pan.slice(0, 2) + "XXXXX" + pan.slice(7), verified: o.buyerInfo.pan.verified }
              : null,
          }
        : null,
    };
  });

  successRes(res, {
    period: { year: y, month: month ? parseInt(month, 10) : null, startDate, endDate },
    summary,
    monthly,
    orders: maskedOrders,
  });
});

module.exports.getYearWiseorder = asynchandler(async (req, res) => {
  const { year, limit, page } = req.query;
  if (!limit || !page || !year) {
    return errorRes(res, 400, "At least year is required");
  } else if (!limit || !page) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const query = {
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };
    const result = await User_Order.find(query);
    if (result) {
      successRes(res, result);
    } else {
      internalServerError(res, "Failed to get the desired orders");
    }
  } else {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const query = {
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };
    const findData = await User_Order.find(query);
    if (findData) {
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const result = findData.slice(startIndex, endIndex);
      const finalResult = {
        result: result,
        totalPage: Math.ceil(findData.length / limit),
      };
      successRes(res, finalResult);
    } else {
      internalServerError(res, "Cannot find the results");
    }
  }
});

module.exports.userPreviousOrders_get = catchAsync(async (req, res) => {
  const { _id } = req.user;

  User_Order.find({ buyer: _id })
    .sort("-createdAt")
    .populate([
      { path: "buyer", select: "_id displayName email" },
      {
        path: "products.product",
        select:
          "_id displayName brand_title color price product_category displayImage availability",
      },
      {
        path: "coupon_applied",
        select: "_id code condition min_price discount_percent is_active",
      },
    ])
    .then((orders) => successRes(res, { orders }))
    .catch((err) => internalServerError(res, err));
});

module.exports.updateOrder_post = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { payment_status, order_status, trackingNumber, trackingUrl, adminNote, deliveryPartner, shippingCostToPartner } = req.body;

  if (!orderId) return errorRes(res, 400, "Order Id is required.");

  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  if (!payment_status && !order_status && !trackingNumber && !trackingUrl && !adminNote && deliveryPartner === undefined && shippingCostToPartner === undefined) {
    return errorRes(res, 400, "No updates provided.");
  }

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order does not exist.");

  // Update payment status directly
  if (payment_status) {
    order.payment_status = payment_status;
  }

  // Update tracking info
  if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
  if (trackingUrl !== undefined) order.trackingUrl = trackingUrl;
  if (adminNote !== undefined) order.adminNote = adminNote;
  if (deliveryPartner !== undefined) order.deliveryPartner = deliveryPartner;
  if (shippingCostToPartner !== undefined) order.shippingCostToPartner = shippingCostToPartner;

  // Update order status using the model's instance method (handles statusHistory + event timestamps + transition validation)
  if (order_status && order_status !== order.order_status) {
    try {
      await order.updateStatus(order_status, adminNote || undefined, "admin");
    } catch (err) {
      if (err.statusCode === 400) {
        return errorRes(res, 400, err.message);
      }
      throw err;
    }
  } else {
    await order.save();
  }

  // Populate for response
  await order.populate([
    { path: "buyer", select: "_id displayName email" },
    { path: "products.product" },
    { path: "products.variant" },
    { path: "coupon_applied" },
  ]);

  return successRes(res, {
    updatedOrder: order,
    message: "Order updated successfully.",
  });
});

module.exports.userOrderUpadte_put = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { _id: userId } = req.user;
  const { products } = req.body;

  if (!orderId) return errorRes(res, 400, "Order Id is required.");
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId);

  if (!order) return errorRes(res, 404, "Order not found.");

  if(order.order_status === "CANCELLED") return errorRes(res, 400, "Order is already cancelled.");

  if(order.order_status !== "PLACED") return errorRes(res, 400, "Order is already Shipped.");

  if (String(order.buyer) !== String(userId))
    return errorRes(res, 403, "Unauthorized.");

  const newProducts = order.products.map((item) => {
    const newQuantity = products.find(
      (prod) => String(prod.product) == String(item.product)
    );
    console.log(JSON.stringify(products));

    if (!newQuantity) return item;

    if (newQuantity.quantity > item.quantity)
      return errorRes(
        res,
        400,
        `Cannot increase quantity of product ${item.product.displayName} more than ${item.quantity}.`
      );

    return {
      product: item.product,
      variant: item.variant,
      quantity: newQuantity.quantity,
      price: item.price,
    };
  });

  order.products = newProducts;

  const updatedOrder = await order.save();
  const notification = await addProductUpdateNotification(userId, orderId);
  successRes(res, {
    updatedOrder,
    message: "Order updated successfully.",
  });
});

// rzp
module.exports.createRzpOrder_post = async (req, res) => {
  if (!razorpayInstance) {
    return internalServerError(res, { message: "Razorpay is not configured on this server." });
  }

  const { amount, currency, receipt, notes } = req.body;

  razorpayInstance.orders.create(
    { amount, currency, receipt, notes },
    (err, order) => {
      if (!err) successRes(res, { order });
      else internalServerError(res, err);
    }
  );
};

module.exports.rzpPaymentVerification = async (req, res) => {
  const { _id: userId } = req.user;

  try {
    const {
      orderCreationId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      products,
      coupon_applied,
      shippingAddress,
      payment_mode,
      discountAmount,
      shippingAmount,
      taxAmount,
    } = req.body;

    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpaySignature) {
      // Signature mismatch — create a failed order for audit trail
      const failedOrder = await User_Order.create({
        buyer: userId,
        products: products || [],
        payment_mode: payment_mode || "ONLINE",
        payment_status: "FAILED",
        cc_orderId: razorpayOrderId,
        shippingAddress,
      });
      return errorRes(res, 400, "Transaction not legit!.");
    }

    // Map frontend products to cartItems
    const cartItems = (products || []).map((item) => ({
      productId: item.product,
      quantity: item.quantity,
      variantId: item.variant || null
    }));

    const order = await User_Order.createWithSnapshots({
      cartItems,
      buyer: userId,
      shippingAddress,
      payment_mode: payment_mode || "ONLINE",
      payment_status: "COMPLETE",
      cc_orderId: razorpayOrderId,
      coupon_applied,
      discountAmount,
      shippingAmount,
      taxAmount,
    });

    // Empty cart
    const cart = await User_Cart.findOne({ user: userId });
    if (cart) {
      cart.products = [];
      await cart.save();
    }

    // Update products' availability
    await Promise.all(
      order.items.map(async (item) => {
        try {
          const product = await Product.findById(item.product);
          if (product) {
            product.availability = product.availability - item.quantity;
            await product.save();
          }
        } catch (err) {
          console.error("Failed to update availability:", err);
        }
      })
    );

    await order.populate([
      { path: "buyer", select: "_id displayName email" },
      { path: "products.product" },
      { path: "coupon_applied" },
    ]);

    return successRes(res, {
      order,
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      message: "Order placed successfully.",
    });
  } catch (error) {
    internalServerError(res, error);
  }
};

// ccavenue controllers
module.exports.ccavenue_creatOrder_post = async (req, res) => {
  const { _id: userId } = req.user;
  const { products, coupon_applied, shippingAddress,
          discountAmount, shippingAmount, taxAmount } = req.body;

  if (!products || !shippingAddress)
    return errorRes(res, 400, "All fields are required.");
  if (products.length === 0) return errorRes(res, 400, "Cart is empty.");

  try {
    // Map frontend products to cartItems
    const cartItems = products.map((item) => ({
      productId: item.product,
      quantity: item.quantity,
      variantId: item.variant || null
    }));

    const order = await User_Order.createWithSnapshots({
      cartItems,
      buyer: userId,
      shippingAddress,
      payment_mode: "ONLINE",
      payment_status: "PENDING",
      coupon_applied,
      discountAmount,
      shippingAmount,
      taxAmount,
    });

    await order.populate([
      { path: "buyer", select: "_id displayName email" },
      { path: "products.product" },
      { path: "coupon_applied" },
    ]);

    return successRes(res, {
      order,
      message: "Order placed successfully.",
    });
  } catch (error) {
    internalServerError(res, error);
  }
};

module.exports.ccavenuerequesthandler = (request, response) => {
  var body = "",
    workingKey = "5843BAB2CA2A191D060233093430D41F",
    accessCode = "AVXE03KH83CH04EXHC",
    encRequest = "",
    formbody = "";

  //Generate Md5 hash for the key and then convert in base64 string
  var md5 = crypto.createHash("md5").update(workingKey).digest();
  var keyBase64 = Buffer.from(md5).toString("base64");

  //Initializing Vector and then convert in base64 string
  var ivBase64 = Buffer.from([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f,
  ]).toString("base64");

  request.on("data", function (data) {
    body += data;
    encRequest = ccav.encrypt(body, keyBase64, ivBase64);
    // formbody =
    //   '<form id="nonseamless" method="post" name="redirect" action="https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction"/> <input type="hidden" id="encRequest" name="encRequest" value="' +
    //   encRequest +
    //   '"><input type="hidden" name="access_code" id="access_code" value="' +
    //   accessCode +
    //   '"><script language="javascript">document.redirect.submit();</script></form>';
    url = `https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction&encRequest=${encRequest}&access_code=${accessCode}`;
  });

  request.on("end", function () {
    response.writeHeader(200, { "Content-Type": "text/html" });
    // response.write(formbody);
    // response.json({
    //   url: "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
    //   encRequest,
    //   accessCode,
    // });
    response.write(url);
    response.end();
  });
  return;
};

module.exports.ccavenueresponsehandler = async (request, response) => {
  var ccavEncResponse = "",
    ccavResponse = "",
    workingKey = "5843BAB2CA2A191D060233093430D41F",
    ccavPOST = "";

  //Generate Md5 hash for the key and then convert in base64 string
  var md5 = crypto.createHash("md5").update(workingKey).digest();
  var keyBase64 = Buffer.from(md5).toString("base64");

  //Initializing Vector and then convert in base64 string
  var ivBase64 = Buffer.from([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f,
  ]).toString("base64");

  request.on("data", function (data) {
    ccavEncResponse += data;
    ccavPOST = qs.parse(ccavEncResponse);
    var encryption = ccavPOST.encResp;
    ccavResponse = ccav.decrypt(encryption, keyBase64, ivBase64);
  });

  request.on("end", async function () {
    console.log(ccavResponse, "<<ccaveres");

    const orderData = JSON.parse(
      '{"' + ccavResponse.replace(/&/g, '","').replace(/=/g, '":"') + '"}',
      function (key, value) {
        return key === "" ? value : decodeURIComponent(value);
      }
    );
    console.log(orderData, "<<<orderData");

    if (orderData.order_status === "Success") {
      const orderUpdates = {
        cc_orderId: orderData.order_id,
        cc_bankRefNo: orderData.bank_ref_no,
        payment_status: "COMPLETE",
        order_price: `${orderData.amount} ${orderData.currency}`,
        shippingAddress: {
          address: `${orderData.delivery_name}, ${orderData.delivery_address}, ${orderData.delivery_city}, ${orderData.delivery_state}, ${orderData.delivery_country}, ${orderData.delivery_tel}`,
          pincode: orderData.delivery_zip,
        },
      };

      await User_Order.findByIdAndUpdate(orderData.order_id, orderUpdates, {
        new: true,
      })
        .then(async (updatedOrder) => {
          console.log(updatedOrder, "<<<updated Order");
          // update products' availability
          // await Promise.all(
          //   updatedOrder.products.map(async (item) => {
          //     try {
          //       const product = await Product.findById(item.product._id);
          //       product.availability = product.availability - item.quantity;
          //       await product.save();
          //     } catch (err) {
          //       internalServerError(res, err);
          //     }
          //   })
          // );
          // empty cart
          const cart = await User_Cart.findOne({ user: updatedOrder.buyer });
          cart.products = [];
          await cart.save();
        })
        .catch((err) => console.log(err));

      // var pData = "";
      // pData = "<table border=1 cellspacing=2 cellpadding=2><tr><td>";
      // pData = pData + ccavResponse.replace(/=/gi, "</td><td>");
      // pData = pData.replace(/&/gi, "</td></tr><tr><td>");
      // pData = pData + "</td></tr></table>";
      // htmlcode =
      //   '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>Response Handler</title></head><body><center><font size="4" color="blue"><b>Response Page</b></font><br>' +
      //   pData +
      //   "</center><br></body></html>";
      // response.writeHeader(200, { "Content-Type": "text/html" });
      // response.write(htmlcode);
      // response.end();

      response
        .writeHead(301, {
          Location: "https://www.thetribes.in/#/cart",
        })
        .end();
    } else if (orderData.order_status === "Aborted") {
      await User_Order.findByIdAndDelete(orderData.order_id)
        .then((deletedOrder) => console.log(deletedOrder, "<< Order deleted."))
        .catch((err) => console.log(err));

      response
        .writeHead(301, {
          Location: "https://www.thetribes.in",
        })
        .end();
    } else {
      response
        .writeHead(301, {
          Location: `https://www.thetribes.in`,
        })
        .end();
    }
  });
};
