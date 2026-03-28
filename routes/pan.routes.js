const express = require("express");
const { requireUserLogin, requireAdminLogin } = require("../middlewares/requireLogin");
const panController = require("../controllers/pan.controller");

const router = express.Router();

// ── Customer routes ───────────────────────────────────────────────────────────
router.get("/user/pan/status",   requireUserLogin, panController.getPanStatus);
router.post("/user/pan/verify",  requireUserLogin, panController.verifyPan);

// ── Admin routes ──────────────────────────────────────────────────────────────
router.get("/admin/user/:userId/pan",          requireAdminLogin, panController.adminGetPanStatus);
router.post("/admin/user/:userId/pan/reset",   requireAdminLogin, panController.adminResetPan);

module.exports = router;
