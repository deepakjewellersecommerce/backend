/**
 * Seed Script: Dummy Orders for Dashboard Testing
 * Creates realistic test orders covering all dashboard dimensions.
 *
 * Run:              node seeds/seed-dummy-orders.js
 * Run with clear:   node seeds/seed-dummy-orders.js --clear
 */

"use strict";

const mongoose = require("mongoose");
require("dotenv").config();

// ── Model Imports ──────────────────────────────────────────────────────────────
const { User }            = require("../models/user.model");
const { Product }         = require("../models/product.model");
const { User_Order: Order } = require("../models/order.model");
const Coupon              = require("../models/coupon.model");
const Material            = require("../models/material.model");
const Gender              = require("../models/gender.model");
const Item                = require("../models/item.model");
const Category            = require("../models/category.model");
const Inventory           = require("../models/inventory.model");
require("../models/admin.model"); // register Admin model without exporting

// ── DB Connection ──────────────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) throw new Error("MONGO_URI not found in environment variables");
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected for seeding");
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────────
/** Returns a Date for N days ago at 10:30 AM local time */
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 30, 0, 0);
  return d;
};

const newOid = () => new mongoose.Types.ObjectId();

// ── Customer Data ──────────────────────────────────────────────────────────────
const CUSTOMERS = [
  { name: "Priya Sharma",  email: "priya.sharma@test.dj",  phoneNumber: 9876543210 },
  { name: "Rahul Gupta",   email: "rahul.gupta@test.dj",   phoneNumber: 9876543211 },
  { name: "Meera Nair",    email: "meera.nair@test.dj",    phoneNumber: 9876543212 },
  { name: "Amit Patel",    email: "amit.patel@test.dj",    phoneNumber: 9876543213 },
  { name: "Sunita Reddy",  email: "sunita.reddy@test.dj",  phoneNumber: 9876543214 },
];

// ── Product Data ───────────────────────────────────────────────────────────────
// idx  Title                            SKU              Metal       Price
const PRODUCTS = [
  /* 0 */ { productTitle: "Gold 22K Diamond Ring",       skuNo: "SEED-G22-001",  metalType: "GOLD_22K",   staticPrice: 45000,  productSlug: "seed-gold-22k-diamond-ring"       },
  /* 1 */ { productTitle: "Gold 22K Bridal Necklace",    skuNo: "SEED-G22-002",  metalType: "GOLD_22K",   staticPrice: 120000, productSlug: "seed-gold-22k-bridal-necklace"    },
  /* 2 */ { productTitle: "Silver 999 Anklet Set",       skuNo: "SEED-S999-001", metalType: "SILVER_999", staticPrice: 3500,   productSlug: "seed-silver-999-anklet-set"        },
  /* 3 */ { productTitle: "Platinum Wedding Band",       skuNo: "SEED-PT-001",   metalType: "PLATINUM",   staticPrice: 85000,  productSlug: "seed-platinum-wedding-band"        },
  /* 4 */ { productTitle: "Gold 24K Foxtail Chain",      skuNo: "SEED-G24-001",  metalType: "GOLD_24K",   staticPrice: 65000,  productSlug: "seed-gold-24k-foxtail-chain"       },
  /* 5 */ { productTitle: "Silver 925 Jhumka Earrings",  skuNo: "SEED-S999-002", metalType: "SILVER_999", staticPrice: 2800,   productSlug: "seed-silver-925-jhumka-earrings"   },
  /* 6 */ { productTitle: "Gold 22K Ruby Bracelet",      skuNo: "SEED-G22-003",  metalType: "GOLD_22K",   staticPrice: 38000,  productSlug: "seed-gold-22k-ruby-bracelet"       },
  /* 7 */ { productTitle: "Gold 24K Mangalsutra",        skuNo: "SEED-G24-002",  metalType: "GOLD_24K",   staticPrice: 95000,  productSlug: "seed-gold-24k-mangalsutra"         },
];

// ── Product-to-Category Mapping ────────────────────────────────────────────────
// [skuNo, materialIdAttr, genderIdAttr, itemIdAttr, catIdAttr, catName, catDescription]
const PRODUCT_CATEGORIES = [
  ["SEED-G22-001",  "G22",  "F", "R",  "GS", "Gemstone",    "Jewelry with gemstone accents"],
  ["SEED-G22-002",  "G22",  "F", "N",  "BR", "Bridal",      "Wedding and bridal jewelry"],
  ["SEED-S999-001", "S999", "F", "A",  "DW", "Daily Wear",  "Everyday wear jewelry"],
  ["SEED-PT-001",   "PT",   "U", "R",  "MD", "Modern",      "Contemporary modern designs"],
  ["SEED-G24-001",  "G24",  "U", "C",  "DW", "Daily Wear",  "Everyday wear jewelry"],
  ["SEED-S999-002", "S999", "F", "E",  "DW", "Daily Wear",  "Everyday wear jewelry"],
  ["SEED-G22-003",  "G22",  "F", "B",  "GS", "Gemstone",    "Jewelry with gemstone accents"],
  ["SEED-G24-002",  "G24",  "F", "MS", "TR", "Traditional", "Traditional regional designs"],
];

// ── Inventory Specs ────────────────────────────────────────────────────────────
// [skuNo, currentStock, costPrice, totalSold]
const INVENTORY_SPECS = [
  ["SEED-G22-001",  15, 27000,  8],   // Gold 22K Diamond Ring
  ["SEED-G22-002",   8, 72000,  5],   // Gold 22K Bridal Necklace
  ["SEED-S999-001", 25,  2100, 12],   // Silver 999 Anklet Set
  ["SEED-PT-001",    5, 51000,  3],   // Platinum Wedding Band
  ["SEED-G24-001",  12, 39000,  7],   // Gold 24K Foxtail Chain
  ["SEED-S999-002", 30,  1680, 15],   // Silver 925 Jhumka Earrings
  ["SEED-G22-003",  10, 22800,  6],   // Gold 22K Ruby Bracelet
  ["SEED-G24-002",   7, 57000,  4],   // Gold 24K Mangalsutra
];

// ── Coupon Specs ───────────────────────────────────────────────────────────────
const oneYearFromNow = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d;
};

const COUPON_SPECS = [
  {
    couponCode:       "SAVE10",
    couponAmount:     10,
    couponType:       "PERCENTAGE",
    couponQuantity:   100,
    minCartAmount:    5000,
    maxDiscountAmount: 4000,
    expiryDate:       oneYearFromNow(),
    description:      "Save 10% on all orders (max ₹4,000)"
  },
  {
    couponCode:       "WELCOME500",
    couponAmount:     500,
    couponType:       "INR",
    couponQuantity:   100,
    minCartAmount:    2000,
    maxDiscountAmount: null,
    expiryDate:       oneYearFromNow(),
    description:      "Welcome gift: flat ₹500 off"
  },
  {
    couponCode:       "FEST20",
    couponAmount:     20,
    couponType:       "PERCENTAGE",
    couponQuantity:   50,
    minCartAmount:    10000,
    maxDiscountAmount: 5000,
    expiryDate:       oneYearFromNow(),
    description:      "Festival special: 20% off (max ₹5,000)"
  }
];

// ── City / State / Pincode Lookup ──────────────────────────────────────────────
const CITY_STATE = {
  Mumbai:    "Maharashtra",
  Delhi:     "Delhi",
  Bengaluru: "Karnataka",
  Hyderabad: "Telangana",
  Ahmedabad: "Gujarat",
  Chennai:   "Tamil Nadu",
  Kolkata:   "West Bengal",
  Pune:      "Maharashtra"
};

const CITY_PINCODE = {
  Mumbai:    400001,
  Delhi:     110001,
  Bengaluru: 560001,
  Hyderabad: 500001,
  Ahmedabad: 380001,
  Chennai:   600001,
  Kolkata:   700001,
  Pune:      411001
};

// ── Order Specification Table ──────────────────────────────────────────────────
// Each row: [orderIdx, status, payMode, payStatus, metalType, city, couponCode, daysAgo, custIdx, prodIdx]
// orderIdx is 0-based; orderNumber will be DJSEED-001 through DJSEED-030
const ORDER_SPECS = [
  /* #1  */ [0,  "DELIVERED",             "ONLINE", "COMPLETE", "GOLD_22K",   "Mumbai",    null,         60, 0, 0],
  /* #2  */ [1,  "DELIVERED",             "ONLINE", "COMPLETE", "GOLD_22K",   "Delhi",     "SAVE10",     55, 1, 0],
  /* #3  */ [2,  "DELIVERED",             "COD",    "COMPLETE", "SILVER_999", "Bengaluru", null,         50, 2, 2],
  /* #4  */ [3,  "DELIVERED",             "ONLINE", "COMPLETE", "GOLD_24K",   "Hyderabad", null,         45, 3, 4],
  /* #5  */ [4,  "DELIVERED",             "ONLINE", "COMPLETE", "PLATINUM",   "Mumbai",    "WELCOME500", 40, 0, 3],
  /* #6  */ [5,  "DELIVERED",             "COD",    "COMPLETE", "GOLD_22K",   "Ahmedabad", null,         35, 4, 6],
  /* #7  */ [6,  "DELIVERED",             "ONLINE", "COMPLETE", "GOLD_24K",   "Delhi",     "FEST20",     30, 1, 7],
  /* #8  */ [7,  "DELIVERED",             "ONLINE", "COMPLETE", "GOLD_22K",   "Chennai",   null,         28, 2, 1],
  /* #9  */ [8,  "DELIVERED",             "COD",    "COMPLETE", "SILVER_999", "Kolkata",   null,         25, 3, 5],
  /* #10 */ [9,  "DELIVERED",             "ONLINE", "COMPLETE", "GOLD_22K",   "Pune",      null,         22, 4, 0],
  /* #11 */ [10, "SHIPPED",               "ONLINE", "COMPLETE", "GOLD_22K",   "Mumbai",    null,         14, 0, 1],
  /* #12 */ [11, "SHIPPED",               "COD",    "PENDING",  "GOLD_24K",   "Delhi",     null,         12, 1, 4],
  /* #13 */ [12, "OUT_FOR_DELIVERY",      "COD",    "PENDING",  "GOLD_22K",   "Bengaluru", null,          7, 2, 6],
  /* #14 */ [13, "OUT_FOR_DELIVERY",      "ONLINE", "COMPLETE", "PLATINUM",   "Hyderabad", null,          6, 3, 3],
  /* #15 */ [14, "PROCESSING",            "ONLINE", "COMPLETE", "GOLD_22K",   "Mumbai",    "SAVE10",      5, 0, 0],
  /* #16 */ [15, "PROCESSING",            "ONLINE", "COMPLETE", "SILVER_999", "Ahmedabad", null,          4, 4, 2],
  /* #17 */ [16, "PROCESSING",            "COD",    "PENDING",  "GOLD_24K",   "Delhi",     null,          4, 1, 7],
  /* #18 */ [17, "CONFIRMED",             "ONLINE", "COMPLETE", "GOLD_22K",   "Chennai",   null,          3, 2, 6],
  /* #19 */ [18, "CONFIRMED",             "COD",    "PENDING",  "GOLD_22K",   "Kolkata",   null,          3, 3, 0],
  /* #20 */ [19, "PLACED",               "ONLINE", "PENDING",  "GOLD_24K",   "Mumbai",    null,          2, 0, 4],
  /* #21 */ [20, "PLACED",               "COD",    "PENDING",  "SILVER_999", "Delhi",     null,          2, 1, 5],
  /* #22 */ [21, "PLACED",               "ONLINE", "PENDING",  "GOLD_22K",   "Pune",      null,          2, 2, 0],
  /* #23 */ [22, "PLACED",               "ONLINE", "COMPLETE", "GOLD_22K",   "Mumbai",    null,          0, 3, 1],
  /* #24 */ [23, "PLACED",               "COD",    "PENDING",  "GOLD_24K",   "Bengaluru", null,          0, 4, 7],
  /* #25 */ [24, "CANCELLED_BY_CUSTOMER", "ONLINE", "REFUNDED", "GOLD_22K",   "Hyderabad", null,         20, 0, 6],
  /* #26 */ [25, "CANCELLED_BY_CUSTOMER", "ONLINE", "REFUNDED", "SILVER_999", "Mumbai",    "WELCOME500", 15, 1, 2],
  /* #27 */ [26, "CANCELLED_BY_ADMIN",    "ONLINE", "REFUNDED", "PLATINUM",   "Delhi",     null,         10, 2, 3],
  /* #28 */ [27, "RETURNED",              "ONLINE", "REFUNDED", "GOLD_22K",   "Bengaluru", null,          8, 3, 0],
  /* #29 */ [28, "REFUNDED",              "ONLINE", "REFUNDED", "GOLD_24K",   "Mumbai",    null,          5, 4, 4],
  /* #30 */ [29, "PLACED",               "ONLINE", "FAILED",   "GOLD_22K",   "Chennai",   null,          1, 0, 0],
];

// ── Coupon Discount Calculator ─────────────────────────────────────────────────
const calcDiscount = (couponCode, subtotal, couponMap) => {
  if (!couponCode || !couponMap[couponCode]) return 0;
  const c = couponMap[couponCode];
  if (subtotal < c.minCartAmount) return 0;
  if (c.couponType === "INR") return Math.min(c.couponAmount, subtotal);
  // PERCENTAGE
  const pct = (subtotal * c.couponAmount) / 100;
  return c.maxDiscountAmount ? Math.min(pct, c.maxDiscountAmount) : pct;
};

// ── Status History Builder ─────────────────────────────────────────────────────
const buildStatusHistory = (currentStatus, createdAt) => {
  const t = (offsetDays) => {
    const d = new Date(createdAt);
    d.setDate(d.getDate() + offsetDays);
    return d;
  };

  const flows = {
    PLACED: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" }
    ],
    CONFIRMED: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" }
    ],
    PROCESSING: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "PROCESSING",            timestamp: t(2),      note: "Order in processing" }
    ],
    SHIPPED: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "PROCESSING",            timestamp: t(2),      note: "Order in processing" },
      { status: "SHIPPED",               timestamp: t(5),      note: "Order shipped" }
    ],
    OUT_FOR_DELIVERY: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "PROCESSING",            timestamp: t(2),      note: "Order in processing" },
      { status: "SHIPPED",               timestamp: t(5),      note: "Order shipped" },
      { status: "OUT_FOR_DELIVERY",      timestamp: t(7),      note: "Out for delivery" }
    ],
    DELIVERED: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "PROCESSING",            timestamp: t(2),      note: "Order in processing" },
      { status: "SHIPPED",               timestamp: t(5),      note: "Order shipped" },
      { status: "OUT_FOR_DELIVERY",      timestamp: t(7),      note: "Out for delivery" },
      { status: "DELIVERED",             timestamp: t(10),     note: "Order delivered" }
    ],
    CANCELLED_BY_CUSTOMER: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CANCELLED_BY_CUSTOMER", timestamp: t(1),      note: "Cancelled by customer" }
    ],
    CANCELLED_BY_ADMIN: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "CANCELLED_BY_ADMIN",    timestamp: t(2),      note: "Cancelled by admin" }
    ],
    RETURNED: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "PROCESSING",            timestamp: t(2),      note: "Order in processing" },
      { status: "SHIPPED",               timestamp: t(5),      note: "Order shipped" },
      { status: "OUT_FOR_DELIVERY",      timestamp: t(7),      note: "Out for delivery" },
      { status: "DELIVERED",             timestamp: t(10),     note: "Order delivered" },
      { status: "RETURNED",              timestamp: t(12),     note: "Return initiated" }
    ],
    REFUNDED: [
      { status: "PLACED",                timestamp: createdAt, note: "Order placed" },
      { status: "CONFIRMED",             timestamp: t(1),      note: "Order confirmed" },
      { status: "PROCESSING",            timestamp: t(2),      note: "Order in processing" },
      { status: "SHIPPED",               timestamp: t(5),      note: "Order shipped" },
      { status: "OUT_FOR_DELIVERY",      timestamp: t(7),      note: "Out for delivery" },
      { status: "DELIVERED",             timestamp: t(10),     note: "Order delivered" },
      { status: "RETURNED",              timestamp: t(12),     note: "Return initiated" },
      { status: "REFUNDED",              timestamp: t(14),     note: "Refund processed" }
    ]
  };

  return flows[currentStatus] || [{ status: "PLACED", timestamp: createdAt, note: "Order placed" }];
};

// ── Event Timestamps Extractor ─────────────────────────────────────────────────
const getEventTimestamps = (statusHistory) => {
  const find = (status) => {
    const entry = statusHistory.find(h => h.status === status);
    return entry ? entry.timestamp : undefined;
  };
  return {
    confirmedAt:  find("CONFIRMED"),
    shippedAt:    find("SHIPPED"),
    deliveredAt:  find("DELIVERED"),
    cancelledAt:  find("CANCELLED_BY_CUSTOMER") || find("CANCELLED_BY_ADMIN")
  };
};

// ── Clear Existing Dummy Data ──────────────────────────────────────────────────
const clearDummyData = async () => {
  console.log("\nClearing existing dummy data...");

  const dummyUsers = await User.find({ email: /@test\.dj$/ }).select("_id").lean();
  const dummyUserIds = dummyUsers.map(u => u._id);

  const orderResult = await Order.deleteMany({
    $or: [
      { buyer: { $in: dummyUserIds } },
      { orderNumber: /^DJSEED-/ }
    ]
  });
  console.log(`  Deleted ${orderResult.deletedCount} orders`);

  const seedProductIds = (await Product.find({ skuNo: /^SEED-/ }).select("_id").lean()).map(p => p._id);
  const inventoryResult = await Inventory.deleteMany({ product: { $in: seedProductIds } });
  console.log(`  Deleted ${inventoryResult.deletedCount} inventory records`);

  const productResult = await Product.deleteMany({ skuNo: /^SEED-/ });
  console.log(`  Deleted ${productResult.deletedCount} products`);

  const userResult = await User.deleteMany({ email: /@test\.dj$/ });
  console.log(`  Deleted ${userResult.deletedCount} users`);

  const couponResult = await Coupon.deleteMany({
    couponCode: { $in: ["SAVE10", "WELCOME500", "FEST20"] }
  });
  console.log(`  Deleted ${couponResult.deletedCount} coupons\n`);
};

// ── Main Seed Function ─────────────────────────────────────────────────────────
const seedDummyOrders = async () => {
  // ── Step 1: Users ────────────────────────────────────────────────────────────
  console.log("\n── Step 1: Creating Customers ──────────────────────────────");
  const userMap = {};
  for (const customer of CUSTOMERS) {
    const user = await User.findOneAndUpdate(
      { email: customer.email },
      {
        $setOnInsert: {
          name:        customer.name,
          email:       customer.email,
          phoneNumber: customer.phoneNumber,
          firebaseUid: `seed-firebase-${customer.email.split("@")[0]}`,
          isBlocked:   false
        }
      },
      { upsert: true, new: true }
    );
    userMap[customer.email] = user;
    console.log(`  ✓ ${customer.name} (${user._id})`);
  }

  // ── Step 2: Products ─────────────────────────────────────────────────────────
  console.log("\n── Step 2: Creating Products ───────────────────────────────");
  const productMap = {};
  for (const p of PRODUCTS) {
    const product = await Product.findOneAndUpdate(
      { skuNo: p.skuNo },
      {
        $setOnInsert: {
          productTitle:    p.productTitle,
          productSlug:     p.productSlug,
          metalType:       p.metalType,
          staticPrice:     p.staticPrice,
          calculatedPrice: p.staticPrice,
          regularPrice:    p.staticPrice,
          salePrice:       p.staticPrice,
          pricingMode:     "STATIC_PRICE",
          grossWeight:     5,
          netWeight:       4,
          isActive:        true
        }
      },
      { upsert: true, new: true }
    );
    productMap[p.skuNo] = product;
    console.log(`  ✓ ${p.productTitle} @ ₹${p.staticPrice.toLocaleString("en-IN")} (${product._id})`);
  }

  // ── Step 2.5: Assign Categories to Products ──────────────────────────────────
  console.log("\n── Step 2.5: Assigning Categories to Products ──────────────");

  // Load hierarchy lookup documents once
  const [allMaterials, allGenders, allItems] = await Promise.all([
    Material.find({}).lean(),
    Gender.find({}).lean(),
    Item.find({}).lean(),
  ]);

  const matMap  = Object.fromEntries(allMaterials.map(m => [m.idAttribute, m]));
  const genMap  = Object.fromEntries(allGenders.map(g => [g.idAttribute, g]));
  const itemMap = Object.fromEntries(allItems.map(i => [i.idAttribute, i]));

  for (const [skuNo, matAttr, genAttr, itemAttr, catAttr, catName, catDesc] of PRODUCT_CATEGORIES) {
    const mat  = matMap[matAttr];
    const gen  = genMap[genAttr];
    const itm  = itemMap[itemAttr];

    if (!mat || !gen || !itm) {
      console.log(`  ⚠  Skipping ${skuNo} — hierarchy lookup missing (${matAttr}/${genAttr}/${itemAttr})`);
      continue;
    }

    // Find or create the Category (use .save() so pre-save generates fullCategoryId)
    let cat = await Category.findOne({
      materialId: mat._id,
      genderId:   gen._id,
      itemId:     itm._id,
      idAttribute: catAttr,
    });

    if (!cat) {
      cat = new Category({
        name:        catName,
        idAttribute: catAttr,
        description: catDesc,
        materialId:  mat._id,
        genderId:    gen._id,
        itemId:      itm._id,
        isActive:    true,
      });
      await cat.save(); // pre-save hook generates fullCategoryId
      console.log(`  ✓ Created category: ${cat.fullCategoryId} — ${catName}`);
    } else {
      console.log(`  ✓ Category exists: ${cat.fullCategoryId}`);
    }

    // Update the seed product with category fields (use $set on existing product)
    await Product.updateOne(
      { skuNo },
      {
        $set: {
          materialId:           mat._id,
          genderId:             gen._id,
          itemId:               itm._id,
          categoryId:           cat._id,
          categoryHierarchyPath: cat.fullCategoryId,
        }
      }
    );
    console.log(`    → ${skuNo} assigned to ${cat.fullCategoryId}`);
  }

  // ── Step 3: Coupons ──────────────────────────────────────────────────────────
  console.log("\n── Step 3: Creating Coupons ────────────────────────────────");
  // Use an existing admin _id for coupon.createdBy; fall back to a placeholder
  let adminId;
  try {
    const Admin = mongoose.model("Admin");
    const adminDoc = await Admin.findOne({}).lean();
    adminId = adminDoc ? adminDoc._id : new mongoose.Types.ObjectId();
  } catch {
    adminId = new mongoose.Types.ObjectId();
  }

  const couponMap = {};
  for (const spec of COUPON_SPECS) {
    const coupon = await Coupon.findOneAndUpdate(
      { couponCode: spec.couponCode },
      {
        $setOnInsert: {
          ...spec,
          createdBy:    adminId,
          isActive:     true,
          usedQuantity: 0
        }
      },
      { upsert: true, new: true }
    );
    couponMap[spec.couponCode] = coupon;
    console.log(`  ✓ ${spec.couponCode} — ${spec.description} (${coupon._id})`);
  }

  // ── Step 4: Orders ───────────────────────────────────────────────────────────
  console.log("\n── Step 4: Inserting Orders ────────────────────────────────");

  // Idempotency: skip order numbers that already exist
  const existingNums = new Set(
    (await Order.find({ orderNumber: /^DJSEED-/ }).select("orderNumber").lean())
      .map(o => o.orderNumber)
  );

  const ordersToInsert = [];
  let skippedCount = 0;

  for (const [idx, status, payMode, payStatus, , city, couponCode, days, custIdx, prodIdx] of ORDER_SPECS) {
    const orderNumber = `DJSEED-${String(idx + 1).padStart(3, "0")}`;
    if (existingNums.has(orderNumber)) {
      skippedCount++;
      continue;
    }

    const customer    = CUSTOMERS[custIdx];
    const productSpec = PRODUCTS[prodIdx];
    const buyerDoc    = userMap[customer.email];
    const productDoc  = productMap[productSpec.skuNo];
    const createdAt   = daysAgo(days);

    const price      = productSpec.staticPrice;
    const discount   = calcDiscount(couponCode, price, couponMap);
    const shipping   = price < 50000 ? 99 : 0;
    const tax        = Math.round(price * 0.03);
    const grandTotal = price - discount + shipping + tax;

    const statusHistory  = buildStatusHistory(status, createdAt);
    const { confirmedAt, shippedAt, deliveredAt, cancelledAt } = getEventTimestamps(statusHistory);
    const couponDoc = couponCode ? couponMap[couponCode] : null;

    const orderDoc = {
      _id:          newOid(),
      orderNumber,
      buyer:        buyerDoc._id,
      items: [{
        _id:               newOid(),
        product:           productDoc._id,
        productTitle:      productSpec.productTitle,
        skuNo:             productSpec.skuNo,
        quantity:          1,
        price,
        lineTotal:         price,
        metalType:         productSpec.metalType,
        pricingModeAtOrder:"STATIC_PRICE"
      }],
      products: [{
        product:  productDoc._id,
        quantity: 1,
        price,
        variant:  null
      }],
      subtotal:       price,
      discountAmount: discount,
      shippingAmount: shipping,
      taxAmount:      tax,
      grandTotal,
      coupon_applied: couponDoc ? couponDoc._id : null,
      couponCode:     couponCode || undefined,
      couponDiscount: discount > 0 ? discount : undefined,
      shippingAddress: {
        name:    customer.name,
        phone:   String(customer.phoneNumber),
        address: "123 Seed Test Lane",
        city,
        state:   CITY_STATE[city]   || "Unknown",
        pincode: CITY_PINCODE[city] || 500000,
        country: "India"
      },
      payment_mode:   payMode,
      payment_status: payStatus,
      order_status:   status,
      statusHistory,
      createdAt,
      updatedAt:      new Date()
    };

    // Attach event timestamps only when present
    if (confirmedAt) orderDoc.confirmedAt = confirmedAt;
    if (shippedAt)   orderDoc.shippedAt   = shippedAt;
    if (deliveredAt) orderDoc.deliveredAt = deliveredAt;
    if (cancelledAt) orderDoc.cancelledAt = cancelledAt;

    ordersToInsert.push(orderDoc);
  }

  if (skippedCount > 0) {
    console.log(`  (Skipped ${skippedCount} already-existing orders)`);
  }

  if (ordersToInsert.length > 0) {
    // insertMany directly on the collection to honour explicit createdAt
    // and bypass pre-save middleware (order numbers are set manually above)
    await Order.collection.insertMany(ordersToInsert, { ordered: false });
    console.log(`  ✓ Inserted ${ordersToInsert.length} orders`);
  } else {
    console.log("  All orders already exist — nothing to insert");
  }

  // ── Step 5: Inventory Records ────────────────────────────────────────────────
  console.log("\n── Step 5: Creating Inventory Records ──────────────────────");
  for (const [skuNo, currentStock, costPrice, totalSold] of INVENTORY_SPECS) {
    const productDoc = productMap[skuNo];
    if (!productDoc) continue;

    const avgSalesPerDay = parseFloat((totalSold / 180).toFixed(4));
    const daysOfStock    = avgSalesPerDay > 0 ? Math.floor(currentStock / avgSalesPerDay) : 0;
    const turnoverRate   = parseFloat((totalSold / ((currentStock + totalSold) / 2)).toFixed(2));

    await Inventory.findOneAndUpdate(
      { product: productDoc._id, variant: null },
      {
        $setOnInsert: {
          product:        productDoc._id,
          variant:        null,
          currentStock,
          reservedStock:  0,
          availableStock: currentStock,
          costPrice,
          reorderPoint:   5,
          maxStock:       50,
          lastRestocked:  new Date(),
          metrics: {
            totalSold,
            totalPurchased: currentStock + totalSold,
            averageSalesPerDay: avgSalesPerDay,
            daysOfStock,
            turnoverRate
          },
          movements: [{
            type:      "IN",
            quantity:  currentStock + totalSold,
            reason:    "Initial seed stock",
            timestamp: new Date()
          }]
        }
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ ${skuNo} → stock: ${currentStock}, costPrice: ₹${costPrice.toLocaleString("en-IN")}, sold: ${totalSold}, turnover: ${turnoverRate}`);
  }

  return ordersToInsert;
};

// ── Summary Printer ────────────────────────────────────────────────────────────
const printSummary = (orders) => {
  if (!orders || orders.length === 0) return;

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║              Seed Summary — Dummy Orders               ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  // By status
  const byStatus = {};
  for (const o of orders) byStatus[o.order_status] = (byStatus[o.order_status] || 0) + 1;
  console.log("\nOrders by Status:");
  console.log("─".repeat(42));
  for (const [status, count] of Object.entries(byStatus).sort())
    console.log(`  ${status.padEnd(28)} ${String(count).padStart(2)}`);

  // Revenue by payment mode
  const byMode = {};
  const revenueByMode = {};
  for (const o of orders) {
    byMode[o.payment_mode]        = (byMode[o.payment_mode]        || 0) + 1;
    revenueByMode[o.payment_mode] = (revenueByMode[o.payment_mode] || 0) + o.grandTotal;
  }
  console.log("\nRevenue by Payment Mode:");
  console.log("─".repeat(42));
  for (const [mode, rev] of Object.entries(revenueByMode).sort())
    console.log(`  ${mode.padEnd(8)} ${String(byMode[mode]).padStart(2)} orders   ₹${rev.toLocaleString("en-IN").padStart(12)}`);

  // By metal type
  const byMetal = {};
  for (const o of orders) {
    const metal = (o.items[0] && o.items[0].metalType) || "UNKNOWN";
    byMetal[metal] = (byMetal[metal] || 0) + 1;
  }
  console.log("\nOrders by Metal Type:");
  console.log("─".repeat(42));
  for (const [metal, count] of Object.entries(byMetal).sort())
    console.log(`  ${metal.padEnd(15)} ${String(count).padStart(2)} orders`);

  // Coupon usage
  const withCoupon = orders.filter(o => o.couponCode);
  console.log("\nCoupon Usage:");
  console.log("─".repeat(42));
  if (withCoupon.length === 0) {
    console.log("  None");
  } else {
    const couponCount = {};
    const couponDisc  = {};
    for (const o of withCoupon) {
      couponCount[o.couponCode] = (couponCount[o.couponCode] || 0) + 1;
      couponDisc[o.couponCode]  = (couponDisc[o.couponCode]  || 0) + (o.discountAmount || 0);
    }
    for (const [code, count] of Object.entries(couponCount).sort())
      console.log(`  ${code.padEnd(12)} ${String(count).padStart(2)} uses   ₹${couponDisc[code].toLocaleString("en-IN").padStart(8)} total discount`);
  }

  console.log("─".repeat(42));
  console.log(`  Total orders seeded: ${orders.length}`);
};

// ── Entry Point ────────────────────────────────────────────────────────────────
const runSeeds = async () => {
  await connectDB();

  const args        = process.argv.slice(2);
  const shouldClear = args.includes("--clear");

  console.log("\n╔════════════════════════════════════════════════════════╗");
  console.log("║     DJ Jewelry — Seed Dummy Orders for Dashboard       ║");
  console.log("╚════════════════════════════════════════════════════════╝");

  if (shouldClear) await clearDummyData();

  try {
    const inserted = await seedDummyOrders();
    printSummary(inserted);

    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║                  Seeding Complete!                    ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("\nVerification checklist:");
    console.log("  1. /dashboard/analytics/orders   → Revenue Trend (60-day span)");
    console.log("                                   → Order Funnel (all 10 statuses)");
    console.log("  2. /dashboard/analytics/financial → Payment Reconciliation");
    console.log("                                   → Coupon Analytics (SAVE10, WELCOME500, FEST20)");
    console.log('  3. /dashboard/kpis               → "Pending Orders (24h+)" = 3 orders');
    console.log("                                   → Today's Revenue (orders #23, #24)");
    console.log("  4. Top Locations                 → 8 cities (Mumbai, Delhi, Bengaluru,");
    console.log("                                     Hyderabad, Ahmedabad, Chennai,");
    console.log("                                     Kolkata, Pune)\n");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("MongoDB disconnected");
  }
};

if (require.main === module) {
  runSeeds();
}

module.exports = { runSeeds };
