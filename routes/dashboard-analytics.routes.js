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

// Dashboard KPIs
router.get("/admin/dashboard/kpis", requireAdminLogin, dashboardAnalyticsController.dashboardKPIs_get);

// Alert detail endpoints
router.get("/admin/dashboard/pending-orders", requireAdminLogin, dashboardAnalyticsController.pendingOrdersDetails_get);
router.get("/admin/dashboard/stock-out-orders", requireAdminLogin, dashboardAnalyticsController.stockOutOrdersDetails_get);
router.get("/admin/dashboard/pricing-errors", requireAdminLogin, dashboardAnalyticsController.pricingErrorsDetails_get);

// Top rankings
router.get("/admin/dashboard/analytics/top-products", requireAdminLogin, dashboardAnalyticsController.topProducts_get);
router.get("/admin/dashboard/analytics/top-categories", requireAdminLogin, dashboardAnalyticsController.topCategories_get);
router.get("/admin/dashboard/analytics/top-users", requireAdminLogin, dashboardAnalyticsController.topUsers_get);
router.get("/admin/dashboard/analytics/top-locations", requireAdminLogin, dashboardAnalyticsController.topLocations_get);

// Growth KPIs
router.get("/admin/dashboard/analytics/revenue-trends", requireAdminLogin, dashboardAnalyticsController.revenueTrends_get);
router.get("/admin/dashboard/analytics/repeat-purchase-rate", requireAdminLogin, dashboardAnalyticsController.repeatPurchaseRate_get);
router.get("/admin/dashboard/analytics/stock-turnover", requireAdminLogin, dashboardAnalyticsController.stockTurnover_get);
router.get("/admin/dashboard/analytics/category-distribution", requireAdminLogin, dashboardAnalyticsController.categoryDistribution_get);

// Financial Transparency
router.get("/admin/dashboard/analytics/tax-summary", requireAdminLogin, dashboardAnalyticsController.taxSummary_get);
router.get("/admin/dashboard/analytics/coupon-analytics", requireAdminLogin, dashboardAnalyticsController.couponAnalytics_get);
router.get("/admin/dashboard/analytics/loyalty-liability", requireAdminLogin, dashboardAnalyticsController.loyaltyLiability_get);
router.get("/admin/dashboard/analytics/financial-summary", requireAdminLogin, dashboardAnalyticsController.financialSummary_get);
router.get("/admin/dashboard/export", requireAdminLogin, dashboardAnalyticsController.exportFinancialData_get);
router.get("/admin/dashboard/analytics/payment-reconciliation", requireAdminLogin, dashboardAnalyticsController.paymentReconciliation_get);
router.get("/admin/dashboard/analytics/inventory-valuation-trend", requireAdminLogin, dashboardAnalyticsController.inventoryValuationTrend_get);
router.get("/admin/dashboard/analytics/customer-cohorts", requireAdminLogin, dashboardAnalyticsController.customerCohorts_get);

module.exports = router;
