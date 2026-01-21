const { MetalPrice, METAL_TYPES } = require("../models/metal-price.model");
const {
  PriceComponent,
  CALCULATION_TYPES,
  FORMULA_VARIABLES
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
    const { grossWeight, netWeight, metalRate } = context;
    const metalCost = netWeight * metalRate;

    const components = pricingConfig.components || [];
    const sortedComponents = [...components].sort(
      (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
    );

    const breakdown = [];
    let subtotal = 0;

    for (const component of sortedComponents) {
      if (!component.isActive) continue;

      let value;

      if (component.isFrozen) {
        value = component.frozenValue;
      } else {
        value = this.calculateComponentValue(component, {
          grossWeight,
          netWeight,
          metalRate,
          metalCost,
          subtotal
        });
      }

      // Round to 2 decimal places
      value = Math.round(value * 100) / 100;

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

    return {
      components: breakdown,
      subtotal: Math.round(subtotal * 100) / 100,
      metalRate,
      metalCost: Math.round(metalCost * 100) / 100
    };
  }

  /**
   * Calculate single component value
   */
  calculateComponentValue(component, context) {
    const { grossWeight, netWeight, metalRate, metalCost, subtotal } = context;

    switch (component.calculationType) {
      case CALCULATION_TYPES.PER_GRAM:
        return netWeight * metalRate * (component.value || 1);

      case CALCULATION_TYPES.PERCENTAGE:
        let base;
        switch (component.percentageOf) {
          case "subtotal":
            base = subtotal;
            break;
          case "grossWeight":
            base = grossWeight * metalRate;
            break;
          case "netWeight":
            base = netWeight * metalRate;
            break;
          case "metalCost":
          default:
            base = metalCost;
        }
        return (base * component.value) / 100;

      case CALCULATION_TYPES.FIXED:
        return component.value || 0;

      case CALCULATION_TYPES.FORMULA:
        return this.evaluateFormula(component.formula, context);

      default:
        return 0;
    }
  }

  /**
   * Evaluate a formula string
   */
  evaluateFormula(formula, context) {
    if (!formula) return 0;

    const { grossWeight, netWeight, metalRate, metalCost, subtotal } = context;

    try {
      // Convert formula operators and replace variables
      let jsFormula = formula
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/grossWeight/g, grossWeight)
        .replace(/netWeight/g, netWeight)
        .replace(/metalRate/g, metalRate)
        .replace(/metalCost/g, metalCost)
        .replace(/subtotal/g, subtotal);

      const result = eval(jsFormula);
      return isFinite(result) ? result : 0;
    } catch (error) {
      console.error(`Formula evaluation error: ${error.message}`);
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
   * Validate a formula
   * @param {string} formula - The formula to validate
   * @param {Object} testValues - Optional test values
   * @returns {Object} Validation result
   */
  validateFormula(formula, testValues = {}) {
    const validVariables = Object.keys(FORMULA_VARIABLES);
    const errors = [];
    const warnings = [];

    if (!formula || formula.trim().length === 0) {
      return {
        valid: false,
        errors: ["Formula cannot be empty"],
        warnings: [],
        testResult: null
      };
    }

    // Check for unknown variables
    const variablePattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
    const usedVariables = formula.match(variablePattern) || [];

    for (const variable of usedVariables) {
      if (!validVariables.includes(variable)) {
        errors.push(`Unknown variable: ${variable}`);
      }
    }

    // Check for invalid operators
    const invalidOperators = formula.match(/[^a-zA-Z0-9_.+\-×÷*/() ]/g);
    if (invalidOperators) {
      const unique = [...new Set(invalidOperators)];
      errors.push(`Invalid characters: ${unique.join(", ")}`);
    }

    // Check for balanced parentheses
    let parenCount = 0;
    for (const char of formula) {
      if (char === "(") parenCount++;
      if (char === ")") parenCount--;
      if (parenCount < 0) {
        errors.push("Unbalanced parentheses");
        break;
      }
    }
    if (parenCount !== 0) {
      errors.push("Unbalanced parentheses");
    }

    // Test calculation with sample values
    const defaultTestValues = {
      grossWeight: testValues.grossWeight ?? 10,
      netWeight: testValues.netWeight ?? 9.5,
      metalRate: testValues.metalRate ?? 5000,
      metalCost: testValues.metalCost ?? 47500,
      subtotal: testValues.subtotal ?? 50000
    };

    // Recalculate metalCost if not provided
    if (!testValues.metalCost) {
      defaultTestValues.metalCost =
        defaultTestValues.netWeight * defaultTestValues.metalRate;
    }

    let testResult = null;
    let breakdown = [];

    if (errors.length === 0) {
      try {
        // Convert and evaluate
        let jsFormula = formula.replace(/×/g, "*").replace(/÷/g, "/");

        // Store intermediate steps for breakdown
        const steps = [];

        // Replace variables with values
        for (const [variable, value] of Object.entries(defaultTestValues)) {
          if (jsFormula.includes(variable)) {
            steps.push({ variable, value });
            jsFormula = jsFormula.replace(new RegExp(variable, "g"), value);
          }
        }

        testResult = eval(jsFormula);

        if (isNaN(testResult)) {
          errors.push("Formula produces NaN (Not a Number)");
        } else if (!isFinite(testResult)) {
          errors.push("Formula produces Infinity (possible division by zero)");
        } else if (testResult < 0) {
          warnings.push("Formula produces negative value");
        }

        // Generate step-by-step breakdown
        breakdown = this.generateFormulaBreakdown(formula, defaultTestValues);
      } catch (error) {
        errors.push(`Syntax error: ${error.message}`);
      }
    }

    // Test edge cases
    if (errors.length === 0) {
      const edgeCaseResults = this.testFormulaEdgeCases(formula);
      warnings.push(...edgeCaseResults.warnings);
      if (edgeCaseResults.errors.length > 0) {
        errors.push(...edgeCaseResults.errors);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      testResult: errors.length === 0 ? Math.round(testResult * 100) / 100 : null,
      testValues: defaultTestValues,
      breakdown
    };
  }

  /**
   * Generate step-by-step formula breakdown
   */
  generateFormulaBreakdown(formula, values) {
    const steps = [];
    let currentFormula = formula;

    // Replace operators for display
    currentFormula = currentFormula.replace(/×/g, " × ").replace(/÷/g, " ÷ ");

    steps.push({
      step: "Original formula",
      expression: currentFormula
    });

    // Replace each variable
    let evalFormula = formula.replace(/×/g, "*").replace(/÷/g, "/");

    for (const [variable, value] of Object.entries(values)) {
      if (evalFormula.includes(variable)) {
        const prevFormula = currentFormula;
        currentFormula = currentFormula.replace(
          new RegExp(variable, "g"),
          value.toString()
        );
        evalFormula = evalFormula.replace(new RegExp(variable, "g"), value);

        steps.push({
          step: `Substitute ${variable}`,
          expression: currentFormula,
          note: `${variable} = ${value}`
        });
      }
    }

    // Calculate final result
    try {
      const result = eval(evalFormula);
      steps.push({
        step: "Final result",
        expression: `= ${Math.round(result * 100) / 100}`,
        value: Math.round(result * 100) / 100
      });
    } catch (e) {
      steps.push({
        step: "Error",
        expression: e.message
      });
    }

    return steps;
  }

  /**
   * Test formula with edge cases
   */
  testFormulaEdgeCases(formula) {
    const warnings = [];
    const errors = [];

    // Test with zero values
    const zeroValues = {
      grossWeight: 0,
      netWeight: 0,
      metalRate: 0,
      metalCost: 0,
      subtotal: 0
    };

    try {
      let jsFormula = formula
        .replace(/×/g, "*")
        .replace(/÷/g, "/");

      for (const [variable, value] of Object.entries(zeroValues)) {
        jsFormula = jsFormula.replace(new RegExp(variable, "g"), value);
      }

      const result = eval(jsFormula);

      if (!isFinite(result)) {
        errors.push("Division by zero when inputs are zero");
      }
    } catch (e) {
      warnings.push(`Edge case test failed: ${e.message}`);
    }

    // Test with very large values
    const largeValues = {
      grossWeight: 1000,
      netWeight: 999,
      metalRate: 100000,
      metalCost: 99900000,
      subtotal: 100000000
    };

    try {
      let jsFormula = formula
        .replace(/×/g, "*")
        .replace(/÷/g, "/");

      for (const [variable, value] of Object.entries(largeValues)) {
        jsFormula = jsFormula.replace(new RegExp(variable, "g"), value);
      }

      const result = eval(jsFormula);

      if (!isFinite(result)) {
        warnings.push("Formula may overflow with large values");
      }
    } catch (e) {
      warnings.push(`Large value test failed: ${e.message}`);
    }

    return { warnings, errors };
  }

  /**
   * Parse formula chips into formula string
   */
  parseFormulaChips(chips) {
    return chips.join(" ");
  }

  /**
   * Convert formula string to chips
   */
  formulaToChips(formula) {
    if (!formula) return [];

    // Split on operators while keeping them
    const tokens = formula
      .replace(/×/g, " × ")
      .replace(/÷/g, " ÷ ")
      .replace(/\+/g, " + ")
      .replace(/-/g, " - ")
      .replace(/\(/g, " ( ")
      .replace(/\)/g, " ) ")
      .split(/\s+/)
      .filter((t) => t.length > 0);

    return tokens;
  }

  /**
   * Get available variables for formula builder
   */
  getFormulaVariables() {
    return Object.entries(FORMULA_VARIABLES).map(([key, description]) => ({
      key,
      description,
      displayName: key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim()
    }));
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
