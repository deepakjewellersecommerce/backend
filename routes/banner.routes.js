const express = require("express");
const bannerController = require("../controllers/banner.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const upload = require("../middlewares/Multer");
const router = express.Router();

// Routes for managing banners
router.post("/admin/banners", requireAdminLogin, upload.array("bannerImages", 10), bannerController.addBanner_post);
router.get("/banners", bannerController.getAllBanners_get);
router.get("/banners/:id", bannerController.getBannerById);
/* router.get("/banners/slug/:slug", bannerController.);
 */router.put("/admin/banners/:id", requireAdminLogin, upload.array("bannerImages", 10), bannerController.editBanner);
// duplicate route removed
router.delete("/admin/banners/:id", requireAdminLogin, bannerController.deleteBanner);

module.exports = router;
