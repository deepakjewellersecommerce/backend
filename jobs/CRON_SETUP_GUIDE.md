# Cron Job Setup Guide - MCX Price Updates

## 📅 Overview

The backend now includes a cron job that automatically fetches and updates MCX metal prices daily at **9:00 AM IST (Asia/Kolkata timezone)**.

**Schedule:** `0 9 * * *` (Daily at 9 AM)

## 🚀 Setup Instructions

### Step 1: Install Dependencies

Make sure `node-cron` is installed (it should already be in your package.json):

```bash
cd backend
npm install node-cron
```

### Step 2: Add to Backend Entry Point

In your `backend/index.js` or main server file, add:

```javascript
// At the top with other imports
const { scheduleMCXPriceFetch } = require('./jobs/fetch-mcx-prices');

// After mongoose connection is established
mongoose.connect(...).then(() => {
  console.log('MongoDB connected');

  // Schedule MCX price fetch (runs daily at 9 AM)
  scheduleMCXPriceFetch();
});
```

### Step 3: Verify Installation

When your backend starts, you should see:

```
📅 Scheduling MCX Price Fetch...
   Schedule: Daily at 9:00 AM IST (0 9 * * *)
   Timezone: Asia/Kolkata
   Status: ACTIVE

✅ MCX Price Cron Job Scheduled
```

## 📊 How It Works

### Daily Execution (9:00 AM IST)

1. **Fetch Prices** - Retrieves MCX prices from API
2. **Update Metal Groups** - Updates Gold, Silver, Platinum base prices
3. **Recalculate Materials** - Auto-updates all 6 materials (respects price overrides)
4. **Log Results** - Displays detailed update log

### Example Output

```
════════════════════════════════════════════════════════════
[2026-02-07T09:00:00Z] Fetching MCX Metal Prices...
════════════════════════════════════════════════════════════

📊 Latest MCX Prices (per gram, INR):
────────────────────────────────────────────────────────────
  Gold:     ₹15,526.80/g
  Silver:   ₹250.00/g
  Platinum: ₹6,114.10/g
────────────────────────────────────────────────────────────

✅ Gold Updated:
   MCX Price: ₹15,500.00 → ₹15,526.80/g
   Base Price: ₹16,026.80/g
   Affected Materials: 3

✅ Silver Updated:
   MCX Price: ₹248.50 → ₹250.00/g
   Base Price: ₹300.00/g
   Affected Materials: 2

✅ Platinum Updated:
   MCX Price: ₹6,100.00 → ₹6,114.10/g
   Base Price: ₹6,314.10/g
   Affected Materials: 1

════════════════════════════════════════════════════════════
✅ MCX Price Update Complete
════════════════════════════════════════════════════════════
```

## 🔄 What Gets Updated

### Metal Groups Updated:
- ✅ Gold (Au) - mcxPrice & basePrice
- ✅ Silver (Ag) - mcxPrice & basePrice
- ✅ Platinum (Pt) - mcxPrice & basePrice

### Materials Auto-Recalculated:
| Material | Purity | Formula | Updated |
|----------|--------|---------|---------|
| Gold 24K | 100% | 99.995/99.995 | ✅ |
| Gold 22K | 91.67% | 91.6667/99.995 | ✅ |
| Gold 18K | 75% | 75/99.995 | ✅ |
| Silver 999 | 100% | 99.9/99.9 | ✅ |
| Silver 925 | 92.59% | 92.5/99.9 | ✅ |
| Platinum | 100% | 95/95 | ✅ |

### Price Overrides (Protected):
Materials with active price overrides will **NOT** be updated by the cron job. They retain their manual prices until the override is removed.

## 🛠️ Configuration

### Change Execution Time

Edit `backend/jobs/fetch-mcx-prices.js`:

```javascript
// Current: 9:00 AM daily
cron.schedule("0 9 * * *", fetchMCXPrices, {
  timezone: "Asia/Kolkata"
});

// Examples:

// 12:00 AM (midnight)
cron.schedule("0 0 * * *", fetchMCXPrices, {
  timezone: "Asia/Kolkata"
});

// 6:00 PM
cron.schedule("0 18 * * *", fetchMCXPrices, {
  timezone: "Asia/Kolkata"
});

// Every 6 hours
cron.schedule("0 */6 * * *", fetchMCXPrices, {
  timezone: "Asia/Kolkata"
});

// Every hour
cron.schedule("0 * * * *", fetchMCXPrices, {
  timezone: "Asia/Kolkata"
});
```

### Change Timezone

```javascript
// Current: Asia/Kolkata (IST)
cron.schedule("0 9 * * *", fetchMCXPrices, {
  timezone: "Asia/Kolkata"  // IST (UTC+5:30)
});

// Examples:

// UTC
cron.schedule("0 9 * * *", fetchMCXPrices, {
  timezone: "UTC"
});

// US Eastern
cron.schedule("0 9 * * *", fetchMCXPrices, {
  timezone: "America/New_York"
});

// Europe London
cron.schedule("0 9 * * *", fetchMCXPrices, {
  timezone: "Europe/London"
});
```

### Connect to Real MCX API

Replace the hardcoded prices with actual API call:

```javascript
// Current (hardcoded for testing)
const metalPrices = {
  gold: 15526.80,
  silver: 250.0,
  platinum: 6114.10
};

// Option 1: Metals.live API
const fetchMCXPrices = async () => {
  const response = await fetch('https://api.metals.live/v1/spot/metals?currencies=inr');
  const data = await response.json();

  const metalPrices = {
    gold: data.metals.gold,
    silver: data.metals.silver,
    platinum: data.metals.platinum
  };

  // ... rest of code
};

// Option 2: MCX Direct API
const fetchMCXPrices = async () => {
  const response = await fetch('https://api.mcx.com/api/prices', {
    headers: {
      'Authorization': `Bearer ${process.env.MCX_API_KEY}`
    }
  });
  const data = await response.json();

  // ... process data
};

// Option 3: Your own price service
const fetchMCXPrices = async () => {
  const metalPrices = await YourPriceService.fetchLatest();
  // ... use prices
};
```

## 📝 Environment Variables

Add to `.env`:

```env
# MCX Price Fetch Settings
MCX_UPDATE_TIME=09:00                    # Update time in HH:MM format (24-hour)
MCX_TIMEZONE=Asia/Kolkata               # Timezone for scheduling
MCX_API_ENABLED=true                     # Enable/disable automatic updates
MCX_API_KEY=your_api_key_here            # If using external API
MCX_API_URL=https://api.metals.live/... # If using external API
```

## 🧪 Testing the Cron Job

### Test Manually (Uncomment in fetch-mcx-prices.js):

```javascript
// Optional: Run once on startup for testing
// Uncomment the line below to test immediately on server start
// fetchMCXPrices();
```

Or run directly:

```bash
node -e "require('./backend/jobs/fetch-mcx-prices').fetchMCXPrices()"
```

### View Cron Job Logs

The cron job logs to console. For production, integrate with your logging service:

```javascript
// backend/jobs/fetch-mcx-prices.js
const logger = require('../config/logger'); // Your logging service

const fetchMCXPrices = async () => {
  try {
    logger.info('Starting MCX price fetch');
    // ... rest of code
    logger.info('MCX prices updated successfully');
  } catch (error) {
    logger.error('MCX price fetch failed', error);
  }
};
```

## ⚙️ Database Records

Check cron job execution in MongoDB:

```javascript
// View Metal Group updates
db.metalgroups.find({}, {
  name: 1,
  mcxPrice: 1,
  basePrice: 1,
  lastFetched: 1
}).pretty()

// View Material price updates
db.materials.find({}, {
  name: 1,
  pricePerGram: 1,
  lastCalculated: 1,
  'priceOverride.isActive': 1
}).pretty()
```

## 🚨 Error Handling

The cron job includes error handling. If update fails:

```
════════════════════════════════════════════════════════════
❌ Error fetching MCX prices: Connection timeout
════════════════════════════════════════════════════════════
```

**Recovery:**
- Cron job will retry at the next scheduled time
- No data is lost or corrupted
- Previous prices remain unchanged

## 📊 Monitoring

### Enable Detailed Logging

Edit `backend/jobs/fetch-mcx-prices.js`:

```javascript
const isDev = process.env.NODE_ENV === 'development';

const fetchMCXPrices = async () => {
  if (isDev) console.log('DEBUG: Starting price fetch...');

  // ... rest of code

  if (isDev) console.log(`DEBUG: Gold price: ${gold.mcxPrice}`);
};
```

### Track Update History

Create a price update log collection:

```javascript
const priceUpdateSchema = new Schema({
  metalGroup: { type: ObjectId, ref: 'MetalGroup' },
  oldPrice: Number,
  newPrice: Number,
  basePrice: Number,
  materialsAffected: Number,
  updatedAt: { type: Date, default: Date.now }
});

// Log each update
await PriceUpdate.create({
  metalGroup: gold._id,
  oldPrice: oldPrice,
  newPrice: gold.mcxPrice,
  basePrice: gold.basePrice,
  materialsAffected: goldMaterials.length
});
```

## 🔐 Security Notes

1. **API Keys**: Keep MCX_API_KEY in `.env`, never commit it
2. **Rate Limiting**: Be aware of API rate limits (MCX may have daily quota)
3. **Data Validation**: Validate API prices before updating database
4. **Timezone**: Always use Asia/Kolkata for MCX consistency

## ✅ Checklist

- [ ] Copy `fetch-mcx-prices.js` to `backend/jobs/`
- [ ] Add `scheduleMCXPriceFetch()` call to `backend/index.js`
- [ ] Install `node-cron` dependency
- [ ] Test cron job execution
- [ ] Monitor first scheduled run
- [ ] Set up logging for production
- [ ] Configure `.env` variables
- [ ] Document in team wiki/docs

## 📞 Troubleshooting

**Cron job not running?**
- Check that MongoDB connection is established first
- Verify `node-cron` is installed
- Check backend logs for startup messages

**Prices not updating?**
- Verify `isAutoUpdate` is `true` on metal groups
- Check for price override flags (prevents update)
- Verify material purity formulas are correct

**Timezone issues?**
- Use `Asia/Kolkata` for MCX (IST)
- Test with a known timezone
- Check server system time matches expected timezone

---

**Questions?** See `QUICK_START_GUIDE.md` or `IMPLEMENTATION_SUMMARY.md`
