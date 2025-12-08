const router = require("express").Router();
const productVariationController = require("../controllers/product_varient.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId } = require("../middlewares/validation");
const { addproductVariantSchema } = require("../validation/product-validation");
const validate = require("../validation/validate");
const upload = require("../middlewares/Multer");

router.post(
  "/product-variant/add",
  validate(addproductVariantSchema),
  productVariationController.addProductVariation
);

router.put(
  "/product-variant/update/:id",
  validate(addproductVariantSchema),
  validateObjectId('id'),
  productVariationController.updateProductVariation
);

router.delete(
  "/product-variant/delete/:id",
  validateObjectId('id'),
  productVariationController.deleteProductVariation
);

router.get(
  "/product-variant/:id/all",
  validateObjectId('id'),
  productVariationController.getAllProductVariation
);

router.get(
  "/product-variant/:id",
  validateObjectId('id'),
  productVariationController.getProductVariation
);

router.put(
  "/product/image/:productId/:colorId",
  requireAdminLogin,
  validateObjectId('productId'),
  validateObjectId('colorId'),
  upload.array("images", 5), // Accept up to 5 images
  productVariationController.addProductImage
);

router.get("/product/image/:productId",
  validateObjectId('productId'),
  productVariationController.getAllProductImages
);

router.get("/product/image/:productId/:colorId",
  validateObjectId('productId'),
  validateObjectId('colorId'),
  productVariationController.getProductImages
);






module.exports = router;
