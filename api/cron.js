const { fetchMCXPrices } = require("./jobs/fetch-mcx-prices");
const silverPriceService = require("./services/silver-price.service");

module.exports = async (req, res) => {
  // Security check: Only allow Vercel's internal cron to trigger this
  // requires CRON_SECRET to be set in Vercel environment variables
  if (process.env.NODE_ENV === "production" && 
      req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const results = {};

  try {
    console.log("[CRON] Starting daily price updates...");
    
    // 1. Fetch MCX Prices
    try {
      await fetchMCXPrices();
      results.mcx = "Success";
    } catch (err) {
      console.error("[CRON] MCX update failed:", err.message);
      results.mcx = `Failed: ${err.message}`;
    }

    // 2. Fetch Silver Prices
    try {
      const priceData = await silverPriceService.fetchCurrentSilverPrice();
      await silverPriceService.saveSilverPrice(priceData);
      results.silver = "Success";
    } catch (err) {
      console.error("[CRON] Silver update failed:", err.message);
      results.silver = `Failed: ${err.message}`;
    }

    return res.status(200).json({
      message: "Cron job executed",
      timestamp: new Date().toISOString(),
      results
    });
  } catch (error) {
    console.error("[CRON] Global failure:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
