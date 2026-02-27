/**
 * Shared Pricing Calculator Utility
 * Used by both Product and Variant models for consistent price calculations
 */

/**
 * Calculate price breakdown from a pricing configuration
 * @param {Object} config - Pricing configuration with components array
 * @param {Object} context - Calculation context with netWeight, metalRate
 * @returns {Object} Breakdown with components, subtotal, metalRate, metalCost
 */
function calculateBreakdown(config, context) {
  const { netWeight, metalRate } = context;

  const breakdown = [];
  let subtotal = 0;
  let metalCost = 0;

  const components = config.components || [];
  const sortedComponents = [...components].sort(
    (a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)
  );

  for (const component of sortedComponents) {
    if (!component.isActive) continue;

    let value;

    if (component.isFrozen) {
      value = component.frozenValue;
    } else {
      // Special handling for metal_cost component
      if (component.componentKey === "metal_cost") {
        if (component.metalPriceMode === "MANUAL" && component.manualMetalPrice) {
          value = component.manualMetalPrice * netWeight;
        } else {
          value = netWeight * metalRate; // AUTO mode
        }
        metalCost = value; // Store metalCost for percentage calculations
      } else {
        switch (component.calculationType) {
          case "PER_GRAM":
            value = netWeight * (component.value || 1);
            break;

          case "PERCENTAGE":
            const base = component.percentageOf === "subtotal" ? subtotal : metalCost;
            value = (base * component.value) / 100;
            break;

          case "FIXED":
            value = component.value;
            break;

          default:
            value = 0;
        }
      }
    }

    value = Math.round(value * 100) / 100;

    breakdown.push({
      componentKey: component.componentKey,
      componentName: component.componentName,
      value,
      isFrozen: component.isFrozen,
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
      breakdown[i].value = 0; // Set to 0 so total remains same
    }
  }

  if (hiddenValueTotal > 0 && metalCostIndex !== -1) {
    breakdown[metalCostIndex].value =
      Math.round((breakdown[metalCostIndex].value + hiddenValueTotal) * 100) / 100;
    breakdown[metalCostIndex].componentName = "Unit Cost";
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
 * Create a price breakdown schema object for Mongoose
 * @returns {Object} Price breakdown object ready for use in schema
 */
function createPriceBreakdownData(breakdown, metalType, gemstoneCost = 0) {
  const totalPrice = breakdown.subtotal + gemstoneCost;

  return {
    components: breakdown.components,
    metalType,
    metalRate: breakdown.metalRate,
    metalCost: breakdown.metalCost,
    gemstoneCost,
    subtotal: breakdown.subtotal,
    totalPrice: Math.round(totalPrice * 100) / 100,
    lastCalculated: new Date()
  };
}

/**
 * Check if all components are frozen
 * @param {Array} components - Array of price components
 * @returns {Boolean}
 */
function areAllComponentsFrozen(components) {
  if (!components || components.length === 0) return false;
  return components.every((c) => c.isFrozen);
}

module.exports = {
  calculateBreakdown,
  createPriceBreakdownData,
  areAllComponentsFrozen
};