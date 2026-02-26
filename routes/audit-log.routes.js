const express = require("express");
const router = express.Router();
const auditLogController = require("../controllers/audit-log.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

router.get(
  "/api/admin/audit-logs",
  requireAdminLogin,
  auditLogController.getAuditLogs
);

router.get(
  "/api/admin/audit-logs/entity/:entityType/:entityId",
  requireAdminLogin,
  auditLogController.getEntityAuditLogs
);

module.exports = router;
