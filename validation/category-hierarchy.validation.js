const { z } = require("zod");
const mongoose = require("mongoose");

// ==================== SHARED HELPERS ====================

const objectIdSchema = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid ObjectId format",
  });

const idAttributeSchema = z
  .string()
  .min(1, "ID attribute is required")
  .max(10, "ID attribute cannot exceed 10 characters")
  .regex(/^[^-]+$/, "ID attribute cannot contain hyphens")
  .transform((v) => v.toUpperCase());

const nameSchema = z
  .string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name cannot exceed 100 characters")
  .trim();

const optionalUrl = z
  .string()
  .url("Must be a valid URL")
  .optional()
  .or(z.literal(""))
  .or(z.literal(null));

const seoFields = {
  seoTitle: z.string().max(60, "SEO title cannot exceed 60 characters").optional(),
  seoDescription: z.string().max(160, "SEO description cannot exceed 160 characters").optional(),
};

/**
 * Generic validation middleware factory
 */
function validate(schema, source = "body") {
  return (req, res, next) => {
    try {
      const data = source === "body" ? req.body : req.query;
      const validated = schema.parse(data);
      if (source === "body") req.body = validated;
      else req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        }));
        return res.status(400).json({
          status: "error",
          error: { code: 400, message: "Validation error", fields: errors },
        });
      }
      next(error);
    }
  };
}

// ==================== MATERIAL (Level 1) ====================

const createMaterialSchema = z.object({
  name: nameSchema,
  displayName: z.string().max(100).optional(),
  idAttribute: idAttributeSchema,
  metalGroupId: objectIdSchema,
  purityType: z.enum(["BASE", "DERIVED"], {
    required_error: "Purity type must be BASE or DERIVED",
  }),
  purityNumerator: z
    .number({ required_error: "Purity numerator is required" })
    .positive("Purity numerator must be positive"),
  purityDenominator: z
    .number({ required_error: "Purity denominator is required" })
    .positive("Purity denominator must be positive"),
  imageUrl: optionalUrl,
  sortOrder: z.number().int().min(0).optional().default(0),
  description: z.string().max(500).optional(),
});

const updateMaterialSchema = z.object({
  name: nameSchema.optional(),
  displayName: z.string().max(100).optional(),
  imageUrl: optionalUrl,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  description: z.string().max(500).optional(),
  overridePrice: z.number().positive("Override price must be positive").optional(),
  overrideReason: z.string().max(200).optional(),
  removeOverride: z.boolean().optional(),
});

// ==================== GENDER (Level 2) ====================

const createGenderSchema = z.object({
  name: nameSchema,
  idAttribute: idAttributeSchema,
  imageUrl: optionalUrl,
  sortOrder: z.number().int().min(0).optional().default(0),
});

const updateGenderSchema = z.object({
  name: nameSchema.optional(),
  imageUrl: optionalUrl,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ==================== ITEM (Level 3) ====================

const createItemSchema = z.object({
  name: nameSchema,
  idAttribute: idAttributeSchema,
  description: z.string().max(500).optional(),
  imageUrl: optionalUrl,
  sortOrder: z.number().int().min(0).optional().default(0),
});

const updateItemSchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(500).optional(),
  imageUrl: optionalUrl,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

// ==================== CATEGORY (Level 4) ====================

const createCategorySchema = z.object({
  name: nameSchema,
  idAttribute: idAttributeSchema,
  materialId: objectIdSchema,
  genderId: objectIdSchema,
  itemId: objectIdSchema,
  description: z.string().max(500).optional(),
  imageUrl: optionalUrl,
  sortOrder: z.number().int().min(0).optional().default(0),
  ...seoFields,
});

const updateCategorySchema = z.object({
  name: nameSchema.optional(),
  description: z.string().max(500).optional(),
  imageUrl: optionalUrl,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
  ...seoFields,
});

// ==================== METAL GROUP ====================

const updateMetalGroupSchema = z.object({
  mcxPrice: z.number().min(0, "MCX price cannot be negative").optional(),
  premium: z.number().min(0, "Premium cannot be negative").optional(),
  isActive: z.boolean().optional(),
  isAutoUpdate: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const updateMetalGroupPremiumSchema = z.object({
  premium: z
    .number({ required_error: "Premium value is required" })
    .min(0, "Premium cannot be negative"),
});

// ==================== METAL PRICE ====================

const updateMetalPriceSchema = z.object({
  pricePerGram: z
    .number({ required_error: "Price per gram is required" })
    .positive("Price per gram must be positive"),
});

// ==================== EXPORTS ====================

module.exports = {
  // Middleware
  validateCreateMaterial: validate(createMaterialSchema),
  validateUpdateMaterial: validate(updateMaterialSchema),
  validateCreateGender: validate(createGenderSchema),
  validateUpdateGender: validate(updateGenderSchema),
  validateCreateItem: validate(createItemSchema),
  validateUpdateItem: validate(updateItemSchema),
  validateCreateCategory: validate(createCategorySchema),
  validateUpdateCategory: validate(updateCategorySchema),
  validateUpdateMetalGroup: validate(updateMetalGroupSchema),
  validateUpdateMetalGroupPremium: validate(updateMetalGroupPremiumSchema),
  validateUpdateMetalPrice: validate(updateMetalPriceSchema),
  // Schemas (for reuse)
  createMaterialSchema,
  updateMaterialSchema,
  createGenderSchema,
  updateGenderSchema,
  createItemSchema,
  updateItemSchema,
  createCategorySchema,
  updateCategorySchema,
  updateMetalGroupSchema,
  updateMetalGroupPremiumSchema,
  updateMetalPriceSchema,
};
