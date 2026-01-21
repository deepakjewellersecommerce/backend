const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const { METAL_TYPES } = require("./metal-price.model");
const { PRICING_MODES } = require("./product.model");

/**
 * Price Breakdown Snapshot Schema
 * Stores complete pricing information at the time of order
 * Preserves historical pricing even if metal rates or configs change
 */
const priceBreakdownSnapshotSchema = new mongoose.Schema(
  {
    // Component breakdown at order time
    components: [
      {
        componentKey: {
          type: String,
          required: true
        },
        componentName: {
          type: String,
          required: true
        },
        calculationType: String,
        value: {
          type: Number,
          required: true
        },
        isFrozen: Boolean,
        isVisible: Boolean
      }
    ],
    // Metal information at order time
    metalType: {
      type: String,
      enum: Object.values(METAL_TYPES)
    },
    metalRate: {
      type: Number,
      required: true
    },
    metalCost: {
      type: Number,
      required: true
    },
    // Gemstone information at order time
    gemstones: [
      {
        name: String,
        weight: Number,
        pricePerCarat: Number,
        totalCost: Number
      }
    ],
    gemstoneCost: {
      type: Number,
      default: 0
    },
    // Totals
    subtotal: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    },
    // Snapshot metadata
    snapshotAt: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

/**
 * Order Item Schema (enhanced products array)
 */
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: ObjectId,
      ref: "Product",
      required: true
    },
    // Product info at order time (denormalized for historical reference)
    productTitle: {
      type: String,
      required: true
    },
    productSlug: String,
    skuNo: String,
    productImageUrl: String,
    // Quantity and pricing
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    // Unit price at order time
    price: {
      type: Number,
      required: true
    },
    // Line total (price × quantity)
    lineTotal: {
      type: Number,
      required: true
    },
    // Weight information at order time
    grossWeight: Number,
    netWeight: Number,
    // Metal type at order time
    metalType: {
      type: String,
      enum: Object.values(METAL_TYPES)
    },
    // Pricing mode at order time
    pricingModeAtOrder: {
      type: String,
      enum: Object.values(PRICING_MODES)
    },
    // Complete price breakdown snapshot
    priceBreakdownSnapshot: priceBreakdownSnapshotSchema,
    // Variant (if applicable)
    variant: {
      type: ObjectId,
      ref: "ProductVarient",
      default: null
    },
    // Category path at order time
    categoryHierarchyPath: String
  },
  { _id: true }
);

/**
 * Order Schema
 */
const OrderSchema = new mongoose.Schema(
  {
    // Order identifier
    orderNumber: {
      type: String,
      unique: true,
      sparse: true
    },
    // Buyer
    buyer: {
      type: ObjectId,
      ref: "User",
      required: true
    },
    // Order items (enhanced from products)
    items: [orderItemSchema],
    // Legacy field - keep for backward compatibility
    products: [
      {
        product: {
          type: ObjectId,
          ref: "Product",
          required: true
        },
        quantity: {
          type: Number,
          required: true
        },
        price: {
          type: Number,
          required: true
        },
        variant: {
          type: ObjectId,
          ref: "ProductVarient",
          default: null
        }
      }
    ],
    // Order totals
    subtotal: {
      type: Number,
      default: 0
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    shippingAmount: {
      type: Number,
      default: 0
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    grandTotal: {
      type: Number,
      default: 0
    },
    // Coupon
    coupon_applied: {
      type: ObjectId,
      ref: "Coupon",
      default: null
    },
    couponCode: String,
    couponDiscount: Number,
    // Shipping
    shippingAddress: {
      name: String,
      phone: String,
      address: String,
      city: String,
      state: String,
      pincode: Number,
      country: {
        type: String,
        default: "India"
      }
    },
    // Payment
    payment_mode: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true
    },
    payment_status: {
      type: String,
      enum: ["PENDING", "COMPLETE", "FAILED", "REFUNDED"],
      required: true
    },
    // Order status
    order_status: {
      type: String,
      enum: [
        "PLACED",
        "CONFIRMED",
        "PROCESSING",
        "SHIPPED",
        "OUT_FOR_DELIVERY",
        "DELIVERED",
        "CANCELLED_BY_CUSTOMER",
        "CANCELLED_BY_ADMIN",
        "RETURNED",
        "REFUNDED"
      ],
      required: true,
      default: "PLACED"
    },
    // Status history
    statusHistory: [
      {
        status: String,
        timestamp: {
          type: Date,
          default: Date.now
        },
        note: String,
        updatedBy: String
      }
    ],
    // Payment gateway references
    cc_orderId: String,
    cc_bankRefNo: String,
    paymentGatewayResponse: {
      type: mongoose.Schema.Types.Mixed
    },
    // Tracking
    trackingNumber: String,
    trackingUrl: String,
    // Notes
    customerNote: String,
    adminNote: String,
    // Timestamps for key events
    confirmedAt: Date,
    shippedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
OrderSchema.index({ orderNumber: 1 }, { unique: true, sparse: true });
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ order_status: 1 });
OrderSchema.index({ payment_status: 1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ "items.product": 1 });
OrderSchema.index({ "items.metalType": 1 });

// Virtual: Total item count
OrderSchema.virtual("totalItems").get(function () {
  return this.items.reduce((sum, item) => sum + item.quantity, 0);
});

// Pre-save: Generate order number
OrderSchema.pre("save", async function (next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const prefix = `DJ${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
    const count = await this.constructor.countDocuments({
      orderNumber: { $regex: `^${prefix}` }
    });
    this.orderNumber = `${prefix}${String(count + 1).padStart(6, "0")}`;
  }

  // Add status to history if changed
  if (this.isModified("order_status")) {
    this.statusHistory.push({
      status: this.order_status,
      timestamp: new Date()
    });
  }

  next();
});

/**
 * Static: Create order with price snapshots
 * Takes cart items and creates order with complete pricing snapshots
 */
OrderSchema.statics.createWithSnapshots = async function (orderData) {
  const { Product } = require("./product.model");

  const items = [];
  let subtotal = 0;

  for (const cartItem of orderData.cartItems) {
    const product = await Product.findById(cartItem.productId).populate(
      "subcategoryId"
    );

    if (!product) {
      throw new Error(`Product not found: ${cartItem.productId}`);
    }

    // Calculate price if needed
    if (!product.priceBreakdown || !product.priceBreakdown.lastCalculated) {
      await product.calculatePrice();
    }

    const unitPrice = product.calculatedPrice;
    const lineTotal = unitPrice * cartItem.quantity;
    subtotal += lineTotal;

    // Create snapshot from current product state
    const snapshot = {
      components: product.priceBreakdown.components.map((c) => ({
        componentKey: c.componentKey,
        componentName: c.componentName,
        value: c.value,
        isFrozen: c.isFrozen,
        isVisible: c.isVisible
      })),
      metalType: product.metalType,
      metalRate: product.priceBreakdown.metalRate,
      metalCost: product.priceBreakdown.metalCost,
      gemstones: product.gemstones.map((g) => ({
        name: g.customName || g.name,
        weight: g.weight,
        pricePerCarat: g.pricePerCarat,
        totalCost: g.totalCost
      })),
      gemstoneCost: product.priceBreakdown.gemstoneCost,
      subtotal: product.priceBreakdown.subtotal,
      totalPrice: product.priceBreakdown.totalPrice,
      snapshotAt: new Date()
    };

    items.push({
      product: product._id,
      productTitle: product.productTitle,
      productSlug: product.productSlug,
      skuNo: product.skuNo,
      productImageUrl: product.productImageUrl?.[0] || null,
      quantity: cartItem.quantity,
      price: unitPrice,
      lineTotal,
      grossWeight: product.grossWeight,
      netWeight: product.netWeight,
      metalType: product.metalType,
      pricingModeAtOrder: product.pricingMode,
      priceBreakdownSnapshot: snapshot,
      variant: cartItem.variantId || null,
      categoryHierarchyPath: product.categoryHierarchyPath
    });
  }

  // Calculate totals
  const discountAmount = orderData.discountAmount || 0;
  const shippingAmount = orderData.shippingAmount || 0;
  const taxAmount = orderData.taxAmount || 0;
  const grandTotal = subtotal - discountAmount + shippingAmount + taxAmount;

  return this.create({
    ...orderData,
    items,
    subtotal,
    discountAmount,
    shippingAmount,
    taxAmount,
    grandTotal,
    statusHistory: [
      {
        status: "PLACED",
        timestamp: new Date()
      }
    ]
  });
};

/**
 * Instance method: Get order summary
 */
OrderSchema.methods.getSummary = function () {
  return {
    orderNumber: this.orderNumber,
    status: this.order_status,
    paymentStatus: this.payment_status,
    totalItems: this.totalItems,
    subtotal: this.subtotal,
    discountAmount: this.discountAmount,
    shippingAmount: this.shippingAmount,
    taxAmount: this.taxAmount,
    grandTotal: this.grandTotal,
    createdAt: this.createdAt
  };
};

/**
 * Instance method: Update status with note
 */
OrderSchema.methods.updateStatus = async function (newStatus, note, updatedBy) {
  this.order_status = newStatus;
  this.statusHistory.push({
    status: newStatus,
    timestamp: new Date(),
    note,
    updatedBy
  });

  // Set timestamp for key events
  switch (newStatus) {
    case "CONFIRMED":
      this.confirmedAt = new Date();
      break;
    case "SHIPPED":
      this.shippedAt = new Date();
      break;
    case "DELIVERED":
      this.deliveredAt = new Date();
      break;
    case "CANCELLED_BY_CUSTOMER":
    case "CANCELLED_BY_ADMIN":
      this.cancelledAt = new Date();
      break;
  }

  return this.save();
};

mongoose.model("User_Order", OrderSchema);

module.exports.User_Order = mongoose.model("User_Order");
module.exports.OrderSchema = OrderSchema;
