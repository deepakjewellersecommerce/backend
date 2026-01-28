const cron = require('node-cron');
const silverPriceService = require('../services/silver-price.service');

let cronTask = null;

// Schedule a job to update silver price every day at 6:00 AM server time
// Only start in non-test environments to prevent Jest hanging
const startCron = () => {
  if (process.env.NODE_ENV === 'test') {
    console.log('[CRON] Skipping cron job in test environment');
    return;
  }

  if (cronTask) {
    console.log('[CRON] Cron job already running');
    return;
  }

  cronTask = cron.schedule('0 6 * * *', async () => {
    try {
      console.log('[CRON] Fetching and updating silver price...');
      const priceData = await silverPriceService.fetchCurrentSilverPrice();
      await silverPriceService.saveSilverPrice(priceData);
      console.log('[CRON] Silver price updated successfully.');
    } catch (error) {
      console.error('[CRON] Error updating silver price:', error.message);
    }
  });

  console.log('[CRON] Silver price cron job started');
};

// Stop the cron job (useful for testing and graceful shutdown)
const stopCron = () => {
  if (cronTask) {
    cronTask.stop();
    cronTask = null;
    console.log('[CRON] Silver price cron job stopped');
  }
};

// Auto-start cron when this module is required (unless in test mode)
startCron();

module.exports = { startCron, stopCron };
