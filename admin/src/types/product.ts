// Enums
export type MetalType = 'GOLD_24K' | 'GOLD_22K' | 'SILVER_999' | 'SILVER_925' | 'PLATINUM'

export type PricingMode = 'SUBCATEGORY_DYNAMIC' | 'CUSTOM_DYNAMIC' | 'STATIC_PRICE'

export type GemstoneType = 
  | 'Diamond'
  | 'Ruby'
  | 'Emerald'
  | 'Sapphire'
  | 'Pearl'
  | 'Topaz'
  | 'Amethyst'
  | 'Garnet'
  | 'Opal'
  | 'Turquoise'
  | 'Aquamarine'
  | 'Peridot'
  | 'Citrine'
  | 'Tanzanite'
  | 'Jade'
  | 'Coral'
  | 'Moonstone'
  | 'Alexandrite'
  | 'Spinel'
  | 'Zircon'
  | 'Kunzite'
  | 'Morganite'
  | 'Tourmaline'
  | 'Other'

// Gemstone interface
export interface Gemstone {
  name: GemstoneType
  customName?: string
  weight: number // in carats
  pricePerCarat: number
  totalCost?: number // auto-calculated
}

// Price Breakdown Component
export interface PriceBreakdownComponent {
  componentKey: string
  componentName: string
  value: number
  isFrozen: boolean
  isVisible: boolean
}

// Price Breakdown
export interface PriceBreakdown {
  components: PriceBreakdownComponent[]
  metalType: MetalType
  metalRate: number
  metalCost: number
  gemstoneCost: number
  subtotal: number
  totalPrice: number
  lastCalculated: Date
}

// Hierarchy Interfaces
export interface Material {
  _id: string
  name: string
  code: string
}

export interface Gender {
  _id: string
  name: string
  code: string
  materialId: string
}

export interface Item {
  _id: string
  name: string
  code: string
  materialId: string
  genderId: string
  fullCategoryId: string
}

export interface Category {
  _id: string
  name: string
  code: string
  materialId: string
  genderId: string
  itemId: string
  fullCategoryId: string
}

export interface Subcategory {
  _id: string
  name: string
  code: string
  materialId: string
  genderId: string
  itemId: string
  categoryId: string
  parentSubcategoryId?: string
  fullCategoryId: string
  level: number
  depth: number
  ancestorPath: string[]
}

// Product Form Data
export interface ProductFormData {
  // Status
  isActive: boolean
  isFeatured: boolean

  // Basic Info
  productTitle: string
  productSlug: string
  skuNo: string
  productDescription?: string
  careHandling?: string

  // Hierarchy - Auto-populated from subcategory
  subcategoryId: string
  categoryId?: string
  materialId?: string
  genderId?: string
  itemId?: string

  // Physical Properties
  metalType: MetalType
  grossWeight: number
  netWeight: number

  // Gemstones
  gemstones: Gemstone[]

  // Pricing
  pricingMode: PricingMode
  staticPrice?: number

  // Optional References
  brandId?: string
  colorId?: string

  // SEO (auto-generated from productTitle)
  metaTitle?: string
  metaDescription?: string
  metaKeywords?: string[]
}

// Product Response from API
export interface Product extends ProductFormData {
  _id: string
  categoryHierarchyPath: string
  priceBreakdown?: PriceBreakdown
  createdAt: Date
  updatedAt: Date
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export interface PricePreviewRequest {
  metalType: MetalType
  netWeight: number
  grossWeight: number
  gemstones: Gemstone[]
  subcategoryId: string
}

export interface PricePreviewResponse {
  priceBreakdown: PriceBreakdown
  estimatedPrice: number
}
