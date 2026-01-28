const express = require("express");
const dashboardAnalyticsController = require("../controllers/dashboard-analytics.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

const router = express.Router();

// Revenue by metal type
router.get("/admin/dashboard/analytics/revenue-by-metal", requireAdminLogin, dashboardAnalyticsController.revenueByMetalType_get);

// Performance by item type (Category Level 3)
router.get("/admin/dashboard/analytics/performance-by-item", requireAdminLogin, dashboardAnalyticsController.performanceByItemType_get);

// Discount efficiency (Coupons vs Full Price)
router.get("/admin/dashboard/analytics/discount-efficiency", requireAdminLogin, dashboardAnalyticsController.discountEfficiency_get);

// Inventory health (Stuck Stock)
router.get("/admin/dashboard/analytics/inventory-health", requireAdminLogin, dashboardAnalyticsController.inventoryHealth_get);

// Order status funnel
router.get("/admin/dashboard/analytics/order-funnel", requireAdminLogin, dashboardAnalyticsController.orderFunnel_get);

module.exports = router;
