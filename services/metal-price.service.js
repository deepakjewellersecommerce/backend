const axios = require("axios");
const {
  MetalPrice,
  MetalPriceHistory,
  METAL_TYPES,
  PRICE_SOURCES
} = require("../models/metal-price.model");
const cacheService = require("./cache.service");

/**
 * Metal Price Service
 * Handles fetching, caching, and managing metal prices for all supported metals
 * Supports: Gold 24K, Gold 22K, Silver 999, Silver 925, Platinum
 */
class MetalPriceService {
  constructor() {
    // API Configuration - Uses metals.dev API
    this.apiUrl =
      process.env.METAL_PRICE_API_URL ||
      "https://api.metals.dev/v1/latest";
    this.apiKey = process.env.METAL_PRICE_API_KEY || "";

    // Update interval (24 hours for cron, 1 hour for cache)
    this.updateInterval = 1000 * 60 * 60 * 24; // 24 hours
    this.cacheTimeout = 1000 * 60 * 60; // 1 hour cache

    // Metal symbols mapping for API
    this.metalSymbols = {
      [METAL_TYPES.GOLD_24K]: "XAU",
      [METAL_TYPES.GOLD_22K]: "XAU", // Calculate from 24K
      [METAL_TYPES.SILVER_999]: "XAG",
      [METAL_TYPES.SILVER_925]: "XAG", // Calculate from 999
      [METAL_TYPES.PLATINUM]: "XPT"
    };

    // Purity factors for derived rates
    this.purityFactors = {
      [METAL_TYPES.GOLD_24K]: 1.0,
      [METAL_TYPES.GOLD_22K]: 22 / 24, // 91.67%
      [METAL_TYPES.SILVER_999]: 1.0,
      [METAL_TYPES.SILVER_925]: 0.925, // 92.5%
      [METAL_TYPES.PLATINUM]: 1.0
    };

    // Display names
    this.displayNames = {
      [METAL_TYPES.GOLD_24K]: "Gold (24K)",
      [METAL_TYPES.GOLD_22K]: "Gold (22K)",
      [METAL_TYPES.SILVER_999]: "Silver (999)",
      [METAL_TYPES.SILVER_925]: "Silver (925)",
      [METAL_TYPES.PLATINUM]: "Platinum"
    };

    // Troy ounce to gram conversion
    this.TROY_OUNCE_TO_GRAM = 31.1035;
  }

  /**
   * Get cache key for metal price
   */
  getCacheKey(metalType) {
    return `metal_price:${metalType}`;
  }

  /**
   * Fetch price from external API for a specific metal
   * Uses goldapi.io format - adjust if using different API
   */
  async fetchFromAPI(metalType) {
    if (!this.apiKey) {
      console.warn("Metal price API key not configured");
      return null;
    }

    try {
      // metals.dev endpoint format
      const response = await axios.get(this.apiUrl, {
        params: {
          api_key: this.apiKey,
          currency: "INR",
          unit: "g"
        },
        timeout: 10000
      });

      if (response.data && response.data.status === "success" && response.data.data && response.data.data.metals) {
        const apiData = response.data.data.metals;
        let pricePerGram = null;

        // Map metals.dev response to our metal types
        switch (metalType) {
          case METAL_TYPES.GOLD_24K:
            pricePerGram = apiData.gold;
            break;
          case METAL_TYPES.GOLD_22K:
            pricePerGram = apiData.gold ? apiData.gold * (22 / 24) : null;
            break;
          case METAL_TYPES.SILVER_999:
            pricePerGram = apiData.silver;
            break;
          case METAL_TYPES.SILVER_925:
            pricePerGram = apiData.silver ? apiData.silver * 0.925 : null;
            break;
          case METAL_TYPES.PLATINUM:
            pricePerGram = apiData.platinum;
            break;
        }

        if (pricePerGram === null || pricePerGram === undefined) {
          console.warn(`Metal price for ${metalType} not found in API response`);
          return null;
        }

        return {
          pricePerGram: Math.round(pricePerGram * 100) / 100,
          source: PRICE_SOURCES.API
        };
      }

      console.error("Invalid API response format from metals.dev:", response.data);
      return null;
    } catch (error) {
      console.error(`Error fetching ${metalType} price from API:`, error.message);
      if (error.response) {
        console.error("API Response:", error.response.status, error.response.data);
      }
      return null;
    }
  }

  /**
   * Get current price for a metal type
   * Checks cache first, then database
   */
  async getCurrentPrice(metalType) {
    // Check cache first
    const cacheKey = this.getCacheKey(metalType);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Get from database
    const price = await MetalPrice.getCurrentPrice(metalType);

    // Cache it
    if (price) {
      await cacheService.set(cacheKey, price, this.cacheTimeout / 1000);
    }

    return price;
  }

  /**
   * Get all current metal prices
   */
  async getAllPrices() {
    const prices = await MetalPrice.getAllActivePrices();

    // Add display names and affected products count
    const enrichedPrices = await Promise.all(
      prices.map(async (price) => {
        const affectedCount = await this.getAffectedProductsCount(price.metalType);
        return {
          ...price.toObject(),
          displayName: this.displayNames[price.metalType],
          affectedProductsCount: affectedCount
        };
      })
    );

    return enrichedPrices;
  }

  /**
   * Update price for a metal type (with history)
   */
  async updatePrice(metalType, pricePerGram, source, updatedBy) {
    // Clear cache
    const cacheKey = this.getCacheKey(metalType);
    await cacheService.delete(cacheKey);

    // Get affected products count before update
    const affectedCount = await this.getAffectedProductsCount(metalType);

    // Update price (this also creates history)
    const updatedPrice = await MetalPrice.updatePrice(
      metalType,
      pricePerGram,
      source,
      updatedBy,
      affectedCount
    );

    return updatedPrice;
  }

  /**
   * Fetch and update price from API for a single metal
   */
  async fetchAndUpdateSingle(metalType, updatedBy = "API Fetch") {
    const apiResult = await this.fetchFromAPI(metalType);

    if (!apiResult) {
      throw new Error(`Failed to fetch ${metalType} price from API`);
    }

    return this.updatePrice(
      metalType,
      apiResult.pricePerGram,
      PRICE_SOURCES.API,
      updatedBy
    );
  }

  /**
   * Fetch and update all metal prices from API
   */
  async fetchAndUpdateAll(updatedBy = "Bulk API Fetch") {
    const results = {
      updated: [],
      failed: [],
      errors: []
    };

    try {
      // Fetch all prices once from metals.dev
      const response = await axios.get(this.apiUrl, {
        params: {
          api_key: this.apiKey,
          currency: "INR",
          unit: "g"
        },
        timeout: 10000
      });

      if (response.data && response.data.status === "success" && response.data.data && response.data.data.metals) {
        const apiData = response.data.data.metals;

        for (const metalType of Object.values(METAL_TYPES)) {
          let pricePerGram = null;

          switch (metalType) {
            case METAL_TYPES.GOLD_24K:
              pricePerGram = apiData.gold;
              break;
            case METAL_TYPES.GOLD_22K:
              pricePerGram = apiData.gold ? apiData.gold * (22 / 24) : null;
              break;
            case METAL_TYPES.SILVER_999:
              pricePerGram = apiData.silver;
              break;
            case METAL_TYPES.SILVER_925:
              pricePerGram = apiData.silver ? apiData.silver * 0.925 : null;
              break;
            case METAL_TYPES.PLATINUM:
              pricePerGram = apiData.platinum;
              break;
          }

          if (pricePerGram) {
            await this.updatePrice(
              metalType,
              Math.round(pricePerGram * 100) / 100,
              PRICE_SOURCES.API,
              updatedBy
            );
            results.updated.push(metalType);
          } else {
            results.failed.push(metalType);
            results.errors.push({
              metalType,
              error: "Price not found in bulk API response"
            });
          }
        }
      } else {
        throw new Error("Invalid bulk API response format");
      }
    } catch (error) {
      console.error("Bulk API fetch failed:", error.message);
      results.errors.push({
        general: error.message
      });
    }

    return results;
  }

  /**
   * Manual price update
   */
  async manualUpdate(metalType, pricePerGram, adminName) {
    return this.updatePrice(
      metalType,
      pricePerGram,
      PRICE_SOURCES.MANUAL,
      adminName
    );
  }

  /**
   * Get affected products count for a metal type
   */
  async getAffectedProductsCount(metalType) {
    const { Product } = require("../models/product.model");

    return Product.countDocuments({
      metalType,
      isActive: true,
      pricingMode: { $ne: "STATIC_PRICE" },
      allComponentsFrozen: { $ne: true }
    });
  }

  /**
   * Get price history for a metal type
   */
  async getPriceHistory(metalType, options = {}) {
    const {
      limit = 50,
      offset = 0,
      startDate = null,
      endDate = null,
      source = null
    } = options;

    const query = { metalType };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (source) {
      query.source = source;
    }

    const [history, total] = await Promise.all([
      MetalPriceHistory.find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit),
      MetalPriceHistory.countDocuments(query)
    ]);

    return {
      history,
      total,
      limit,
      offset
    };
  }

  /**
   * Get all price history (across all metals)
   */
  async getAllPriceHistory(options = {}) {
    const {
      limit = 50,
      offset = 0,
      startDate = null,
      endDate = null,
      source = null,
      metalTypes = null
    } = options;

    const query = {};

    if (metalTypes && metalTypes.length > 0) {
      query.metalType = { $in: metalTypes };
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (source) {
      query.source = source;
    }

    const [history, total] = await Promise.all([
      MetalPriceHistory.find(query)
        .sort({ timestamp: -1 })
        .skip(offset)
        .limit(limit),
      MetalPriceHistory.countDocuments(query)
    ]);

    return {
      history: history.map((h) => ({
        ...h.toObject(),
        displayName: this.displayNames[h.metalType]
      })),
      total,
      limit,
      offset
    };
  }

  /**
   * Preview bulk recalculation
   * Returns products that would be affected without making changes
   */
  async previewBulkRecalculation(metalTypes) {
    const { Product } = require("../models/product.model");

    const preview = {
      affectedProducts: 0,
      skippedProducts: 0,
      changes: []
    };

    for (const metalType of metalTypes) {
      const products = await Product.find({
        metalType,
        isActive: true,
        pricingMode: { $ne: "STATIC_PRICE" }
      }).limit(100); // Limit preview to 100 products per metal type

      for (const product of products) {
        if (product.allComponentsFrozen) {
          preview.skippedProducts++;
          continue;
        }

        preview.affectedProducts++;
        const oldPrice = product.calculatedPrice;

        // Note: In real implementation, calculate new price without saving
        // This is a simplified preview
        preview.changes.push({
          productId: product._id,
          productTitle: product.productTitle,
          metalType: product.metalType,
          oldPrice,
          // New price would be calculated here
          newPrice: oldPrice, // Placeholder
          delta: 0,
          deltaPercent: 0
        });
      }
    }

    return preview;
  }

  /**
   * Execute bulk recalculation with job persistence
   * Creates a BatchJob record to track progress, enable retries, and survive crashes
   */
  async executeBulkRecalculation(metalTypes, options = {}) {
    const { Product } = require("../models/product.model");
    const { BatchJob, BATCH_JOB_TYPE } = require("../models/batch-job.model");
    const { onProgress, triggeredBy = "System" } = options;

    // Create job record
    const job = await BatchJob.create({
      type: BATCH_JOB_TYPE.PRICE_RECALCULATION,
      params: { metalTypes },
      triggeredBy
    });

    await job.markRunning();

    const results = {
      updated: 0,
      skipped: 0,
      failed: 0,
      failures: [],
      jobId: job._id
    };

    try {
      for (const metalType of metalTypes) {
        const bulkResult = await Product.bulkRecalculate(metalType, {
          batchSize: 100,
          onProgress: (progress) => {
            if (onProgress) {
              onProgress({ metalType, ...progress });
            }
          }
        });

        results.updated += bulkResult.success;
        results.failed += bulkResult.failed;
        results.failures.push(...bulkResult.failures);

        // Persist progress after each metal type
        await job.updateProgress({
          succeeded: results.updated,
          failed: results.failed
        });

        // Track individual failures
        for (const f of bulkResult.failures) {
          job.addFailure(f.productId, f.error);
        }
      }

      // Count skipped (all frozen) products
      const skippedCount = await Product.countDocuments({
        metalType: { $in: metalTypes },
        isActive: true,
        pricingMode: { $ne: "STATIC_PRICE" },
        allComponentsFrozen: true
      });

      results.skipped = skippedCount;

      await job.updateProgress({
        succeeded: results.updated,
        failed: results.failed,
        skipped: skippedCount,
        processed: results.updated + results.failed + skippedCount
      });
      await job.markCompleted(results);

      return results;
    } catch (error) {
      await job.markFailed(error.message);
      throw error;
    }
  }

  /**
   * Recover stale RUNNING jobs (e.g., from server crash)
   * Called on server startup
   */
  async recoverStaleJobs() {
    try {
      const { BatchJob, BATCH_JOB_STATUS } = require("../models/batch-job.model");

      // Mark RUNNING jobs older than 10 minutes as failed (likely crashed)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const staleJobs = await BatchJob.find({
        status: BATCH_JOB_STATUS.RUNNING,
        startedAt: { $lt: tenMinutesAgo }
      });

      for (const job of staleJobs) {
        await job.markFailed("Server crashed or restarted during execution");
        console.warn(`Marked stale batch job ${job._id} as failed`);
      }

      // Retry pending jobs
      const retryableJobs = await BatchJob.getRetryableJobs();
      for (const job of retryableJobs) {
        console.log(`Retrying batch job ${job._id} (attempt ${job.attempts + 1})`);
        try {
          await this.executeBulkRecalculation(job.params.metalTypes, {
            triggeredBy: "System (auto-retry)"
          });
        } catch (err) {
          console.error(`Retry failed for job ${job._id}:`, err.message);
        }
      }
    } catch (error) {
      console.error("Error recovering stale jobs:", error.message);
    }
  }

  /**
   * Cron job handler - called by scheduler at 6 AM IST
   */
  async cronUpdate() {
    console.log("Starting scheduled metal price update...");

    try {
      // Check for recent manual updates (within 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const recentManualUpdate = await MetalPriceHistory.findOne({
        source: PRICE_SOURCES.MANUAL,
        timestamp: { $gte: tenMinutesAgo }
      });

      if (recentManualUpdate) {
        console.log(
          "Skipping cron update - recent manual update found at",
          recentManualUpdate.timestamp
        );
        return {
          skipped: true,
          reason: "Recent manual update detected"
        };
      }

      // Fetch and update all prices
      const result = await this.fetchAndUpdateAll("Cron Job");

      console.log("Scheduled metal price update completed:", result);

      // Trigger bulk recalculation for updated metals
      if (result.updated.length > 0) {
        console.log("Triggering bulk recalculation for:", result.updated);
        const recalcResult = await this.executeBulkRecalculation(result.updated);
        console.log("Bulk recalculation completed:", recalcResult);
      }

      return result;
    } catch (error) {
      console.error("Error in cron update:", error);
      throw error;
    }
  }

  /**
   * Initialize default prices if none exist
   */
  async initializeDefaultPrices() {
    const defaultPrices = {
      [METAL_TYPES.GOLD_24K]: 6500, // INR per gram
      [METAL_TYPES.GOLD_22K]: 5960, // INR per gram
      [METAL_TYPES.SILVER_999]: 85, // INR per gram
      [METAL_TYPES.SILVER_925]: 79, // INR per gram
      [METAL_TYPES.PLATINUM]: 3200 // INR per gram
    };

    const existingPrices = await MetalPrice.find();
    const existingTypes = existingPrices.map((p) => p.metalType);

    for (const [metalType, price] of Object.entries(defaultPrices)) {
      if (!existingTypes.includes(metalType)) {
        await MetalPrice.create({
          metalType,
          pricePerGram: price,
          source: PRICE_SOURCES.MANUAL,
          updatedBy: "System Initialization"
        });
        console.log(`Initialized default price for ${metalType}: ₹${price}/g`);
      }
    }
  }
}

module.exports = new MetalPriceService();
