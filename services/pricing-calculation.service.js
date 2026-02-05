const { MetalPrice, METAL_TYPES } = require("../models/metal-price.model");
const {
  PriceComponent,
  CALCULATION_TYPES
} = require("../models/price-component.model");
const SubcategoryPricing = require("../models/subcategory-pricing.model");
const Subcategory = require("../models/subcategory.model.js");

/**
 * Pricing Calculation Service
 * Handles all pricing calculations, formula validation, and price breakdown generation
 */
class PricingCalculationService {
  /**
   * Calculate price for a product
   * @param {Object} product - Product document or product data
   * @param {Object} options - Calculation options
   */
  async calculateProductPrice(product, options = {}) {
    const { includeGemstones = true, metalRate = null } = options;

    // Get metal rate
    let currentMetalRate = metalRate;
    if (!currentMetalRate) {
      const metalPrice = await MetalPrice.getCurrentPrice(product.metalType);
      currentMetalRate = metalPrice.pricePerGram;
    }

    // Get pricing config based on mode
    let pricingConfig;

    if (product.pricingMode === "STATIC_PRICE") {
      return {
        components: [],
        metalType: product.metalType,
        metalRate: 0,
        metalCost: 0,
        gemstoneCost: includeGemstones ? this.calculateGemstoneCost(product.gemstones) : 0,
        subtotal: product.staticPrice || 0,
        totalPrice: product.staticPrice || 0,
        lastCalculated: new Date()
      };
    }

    if (product.pricingMode === "CUSTOM_DYNAMIC" && product.pricingConfig) {
      pricingConfig = product.pricingConfig;
    } else {
      // Get from subcategory with inheritance
      pricingConfig = await this.getSubcategoryPricingConfig(product.subcategoryId);
    }

    if (!pricingConfig) {
      throw new Error("No pricing configuration found");
    }

    // Calculate breakdown
    const context = {
      grossWeight: product.grossWeight,
      netWeight: product.netWeight,
      metalRate: currentMetalRate
    };

    const breakdown = this.calculateBreakdown(pricingConfig, context);

    // Add gemstone cost
    const gemstoneCost = includeGemstones
      ? this.calculateGemstoneCost(product.gemstones)
      : 0;

    const totalPrice = breakdown.subtotal + gemstoneCost;

    return {
      components: breakdown.components,
      metalType: product.metalType,
      metalRate: currentMetalRate,
      metalCost: breakdown.metalCost,
      gemstoneCost,
      subtotal: breakdown.subtotal,
      totalPrice: Math.round(totalPrice * 100) / 100,
      lastCalculated: new Date()
    };
  }

  /**
   * Get pricing config for a subcategory (with inheritance)
   */
  async getSubcategoryPricingConfig(subcategoryId) {
    const subcategory = await Subcategory.findById(subcategoryId);
    if (!subcategory) {
      return null;
    }

    // Use subcategory's getPricingConfig method (handles inheritance)
    return subcategory.getPricingConfig();
  }

  /**
   * Calculate price breakdown from config
   */
  calculateBreakdown(pricingConfig, context) {
    const { netWeight, metalRate } = context;

    const components = pricingConfig.components || [];
    const sortedComponents = [...components].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
    );

    const breakdown = [];
    let subtotal = 0;
    let metalCost = 0;

    for (const component of sortedComponents) {
      if (!component.isActive) continue;

      let value;

      if (component.isFrozen) {
        value = component.frozenValue;
      } else {
        value = this.calculateComponentValue(component, {
          netWeight,
          metalRate,
          metalCost,
          subtotal,
          manualMetalPrice: component.manualMetalPrice
        });
      }

      // Round to 2 decimal places
      value = Math.round(value * 100) / 100;

      // Track metalCost from metal_cost component
      if (component.componentKey === "metal_cost") {
        metalCost = value;
      }

      breakdown.push({
        componentId: component.componentId,
        componentKey: component.componentKey,
        componentName: component.componentName,
        calculationType: component.calculationType,
        value,
        isFrozen: component.isFrozen,
        frozenValue: component.frozenValue,
        isVisible: component.isVisible
      });

      subtotal += value;
    }

    // Merge hidden components into metal_cost for user view consistency
    let hiddenValueTotal = 0;
    let metalCostIndex = -1;

    for (let i = 0; i < breakdown.length; i++) {
      if (breakdown[i].componentKey === "metal_cost") {
        metalCostIndex = i;
      } else if (!breakdown[i].isVisible) {
        hiddenValueTotal += breakdown[i].value;
        breakdown[i].value = 0; // Set to 0 so total remains same and it's essentially hidden
      }
    }

    if (hiddenValueTotal > 0 && metalCostIndex !== -1) {
      breakdown[metalCostIndex].value =
        Math.round((breakdown[metalCostIndex].value + hiddenValueTotal) * 100) / 100;
      // Update the top-level metalCost in the return object
      metalCost = breakdown[metalCostIndex].value;
    }

    return {
      components: breakdown,
      subtotal: Math.round(subtotal * 100) / 100,
      metalRate,
      metalCost: Math.round(metalCost * 100) / 100
    };
  }

  /**
   * Calculate single component value
   * NOTE: subtotal = running total of all PREVIOUS components (cumulative sum)
   */
  calculateComponentValue(component, context) {
    const { netWeight, metalRate, metalCost, subtotal, manualMetalPrice } = context;

    // Metal Cost component - special handling
    if (component.componentKey === "metal_cost") {
      if (component.metalPriceMode === "MANUAL" && manualMetalPrice) {
        return manualMetalPrice * netWeight;
      }
      return netWeight * metalRate; // AUTO mode
    }

    switch (component.calculationType) {
      case CALCULATION_TYPES.PER_GRAM:
        return netWeight * (component.value || 1);

      case CALCULATION_TYPES.PERCENTAGE:
        // subtotal = sum of all previous components (running total)
        const base = component.percentageOf === "subtotal" ? subtotal : metalCost;
        return (base * component.value) / 100;

      case CALCULATION_TYPES.FIXED:
        return component.value || 0;

      default:
        return 0;
    }
  }

  /**
   * Calculate gemstone cost
   */
  calculateGemstoneCost(gemstones) {
    if (!gemstones || gemstones.length === 0) return 0;
    return gemstones.reduce((sum, gem) => {
      const cost = (gem.weight || 0) * (gem.pricePerCarat || 0);
      return sum + cost;
    }, 0);
  }

  /**
   * Preview price change for a config update
   */
  async previewPriceChange(subcategoryId, newConfig, options = {}) {
    const { limit = 10 } = options;
    const { Product } = require("../models/product.model");

    // Get products using this subcategory
    const products = await Product.find({
      subcategoryId,
      pricingMode: "SUBCATEGORY_DYNAMIC",
      isActive: true
    }).limit(limit);

    const previews = [];

    for (const product of products) {
      const currentPrice = product.calculatedPrice;

      // Calculate new price with proposed config
      const metalPrice = await MetalPrice.getCurrentPrice(product.metalType);
      const context = {
        grossWeight: product.grossWeight,
        netWeight: product.netWeight,
        metalRate: metalPrice.pricePerGram
      };

      const breakdown = this.calculateBreakdown(newConfig, context);
      const gemstoneCost = this.calculateGemstoneCost(product.gemstones);
      const newPrice = breakdown.subtotal + gemstoneCost;

      const delta = newPrice - currentPrice;
      const deltaPercent =
        currentPrice > 0 ? ((delta / currentPrice) * 100).toFixed(2) : 0;

      previews.push({
        productId: product._id,
        productTitle: product.productTitle,
        currentPrice: Math.round(currentPrice * 100) / 100,
        newPrice: Math.round(newPrice * 100) / 100,
        delta: Math.round(delta * 100) / 100,
        deltaPercent: parseFloat(deltaPercent)
      });
    }

    // Get total affected count
    const totalAffected = await Product.countDocuments({
      subcategoryId,
      pricingMode: "SUBCATEGORY_DYNAMIC",
      isActive: true
    });

    return {
      previews,
      totalAffected,
      showing: previews.length
    };
  }

  /**
   * Calculate freeze value for a component
   */
  calculateFreezeValue(component, context) {
    if (component.isFrozen) {
      return component.frozenValue;
    }
    return this.calculateComponentValue(component, context);
  }

  /**
   * Get pricing summary for a product
   */
  async getProductPricingSummary(productId) {
    const { Product } = require("../models/product.model");
    const product = await Product.findById(productId).populate("subcategoryId");

    if (!product) {
      throw new Error("Product not found");
    }

    // Get pricing source
    let pricingSource = "none";
    let pricingSourceSubcategory = null;

    if (product.pricingMode === "STATIC_PRICE") {
      pricingSource = "static";
    } else if (product.pricingMode === "CUSTOM_DYNAMIC") {
      pricingSource = "custom";
      if (product.pricingConfig?.clonedFrom) {
        pricingSourceSubcategory = await Subcategory.findById(
          product.pricingConfig.clonedFrom
        );
      }
    } else {
      // SUBCATEGORY_DYNAMIC
      if (product.subcategoryId) {
        const source = await product.subcategoryId.getPricingSource();
        pricingSource = source.source;
        pricingSourceSubcategory = source.subcategory;
      }
    }

    // Get metal rate info
    const metalPrice = await MetalPrice.getCurrentPrice(product.metalType);

    return {
      product: {
        id: product._id,
        title: product.productTitle,
        metalType: product.metalType,
        grossWeight: product.grossWeight,
        netWeight: product.netWeight
      },
      pricing: {
        mode: product.pricingMode,
        source: pricingSource,
        sourceSubcategory: pricingSourceSubcategory
          ? {
              id: pricingSourceSubcategory._id,
              name: pricingSourceSubcategory.name,
              fullCategoryId: pricingSourceSubcategory.fullCategoryId
            }
          : null,
        allComponentsFrozen: product.allComponentsFrozen
      },
      metalRate: {
        metalType: metalPrice.metalType,
        pricePerGram: metalPrice.pricePerGram,
        lastUpdated: metalPrice.lastUpdated
      },
      breakdown: product.priceBreakdown,
      calculatedPrice: product.calculatedPrice
    };
  }
}

module.exports = new PricingCalculationService();
