const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

const router = express.Router();

// Main dashboard KPIs endpoint
router.get("/admin/dashboard/kpis", requireAdminLogin, dashboardController.getDashboardKPIs_get);

// Detailed views for alerts
router.get("/admin/dashboard/pending-orders", requireAdminLogin, dashboardController.getPendingOrdersDetails_get);
router.get("/admin/dashboard/stock-out-orders", requireAdminLogin, dashboardController.getStockOutOrdersDetails_get);
router.get("/admin/dashboard/pricing-errors", requireAdminLogin, dashboardController.getPricingErrorsDetails_get);
router.get("/admin/dashboard/revenue-by-metal", requireAdminLogin, dashboardController.getRevenueByMetal_get);

module.exports = router;