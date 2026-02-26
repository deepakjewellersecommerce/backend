const express = require("express");
const router = express.Router();
const rfidTagController = require("../controllers/rfid-tag.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId } = require("../middlewares/validation");

router.post(
  "/admin/rfid-tags/generate",
  requireAdminLogin,
  rfidTagController.generateTags
);

router.get(
  "/admin/rfid-tags/:productId/download",
  requireAdminLogin,
  validateObjectId("productId"),
  rfidTagController.downloadTagsCsv
);

router.get(
  "/admin/rfid-tags/:productId/summary",
  requireAdminLogin,
  validateObjectId("productId"),
  rfidTagController.getTagsSummary
);

router.get(
  "/admin/rfid-tags/:productId",
  requireAdminLogin,
  validateObjectId("productId"),
  rfidTagController.getTagsByProduct
);

router.put(
  "/admin/rfid-tags/:tagId/status",
  requireAdminLogin,
  validateObjectId("tagId"),
  rfidTagController.updateTagStatus
);

// Bulk delete must come before single delete (Express matches "product" as :tagId otherwise)
router.delete(
  "/admin/rfid-tags/product/:productId",
  requireAdminLogin,
  validateObjectId("productId"),
  rfidTagController.deleteTagsByProduct
);

router.delete(
  "/admin/rfid-tags/:tagId",
  requireAdminLogin,
  validateObjectId("tagId"),
  rfidTagController.deleteTag
);

module.exports = router;
