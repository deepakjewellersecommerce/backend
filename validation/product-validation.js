const { z } = require("zod");


module.exports.addproductVariantSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/),
    size: z.string().min(1),
    price: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().min(0)),
    salePrice: z.union([z.number(), z.string()]).transform(Number).pipe(z.number()).optional(),
    stock: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().min(0)),
    color: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional(),
    weight: z.union([z.number(), z.string()]).transform(Number).pipe(z.number().min(0)).optional(),
    images: z.array(z.string()).optional(),
    imageUrls: z.any().optional(),
    isActive: z.any().optional(),
  }).passthrough(),
});
