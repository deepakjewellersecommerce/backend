# Seed Scripts - Metal Group Structure V2

This directory contains seed scripts for initializing the database with the new Metal Group structure that supports MCX India pricing with retailer premium.

## 📋 Overview

### New Pricing Structure

```
MCX Price (from API)
+ Premium (retailer markup)
= Base Price

Base Price × Purity Formula
= Material Price
```

### Entity Hierarchy

1. **Metal Groups** - Base metals (Gold, Silver, Platinum) with MCX pricing
2. **Materials** - Purity variants (Gold 24K, Gold 22K, etc.) with formulas
3. **Genders** - Male, Female, Unisex, Kids
4. **Items** - Necklace, Ring, Earring, etc.
5. **Categories** - Temple, Bridal, Daily Wear, etc.

## 🚀 Quick Start

### Run All Seeds (Recommended)

```bash
# Run all seeds in correct order
node seeds/seed-all-v2.js
```

### Run Individual Seeds

```bash
# 1. First: Seed metal groups (MUST run first)
node seeds/seed-metal-groups.js

# 2. Then: Seed category hierarchy
node seeds/seed-categories-v2.js

# 3. Optional: Seed price components
node seeds/seed-price-components.js
```

## 📁 File Descriptions

### New Structure (V2)

| File | Description | Prerequisites |
|------|-------------|---------------|
| `seed-metal-groups.js` | Seeds Gold, Silver, Platinum groups with MCX pricing | None |
| `seed-categories-v2.js` | Seeds materials with purity formulas, genders, items | `seed-metal-groups.js` |
| `seed-all-v2.js` | Master script - runs all seeds in order | None |
| `README.md` | This documentation | - |

### Legacy Files (Old Structure)

| File | Description | Status |
|------|-------------|--------|
| `seed-categories.js` | Old material structure with `metalType` enum | Deprecated |
| `seed-metal-prices.js` | Old `MetalPrice` collection | Deprecated |

## 📊 Seeded Data

### Metal Groups (3)

| Name | Symbol | API Key | MCX Price | Premium | Base Price |
|------|--------|---------|-----------|---------|------------|
| Gold | Au | `mcx_gold` | ₹15,526.80 | ₹500 | ₹16,026.80 |
| Silver | Ag | `mcx_silver` | ₹250.00 | ₹50 | ₹300.00 |
| Platinum | Pt | `mcx_platinum` | ₹6,114.10 | ₹200 | ₹6,314.10 |

### Materials (6)

| Material | Metal Group | Purity | Formula | Price/gram |
|----------|-------------|--------|---------|------------|
| Gold 24K | Gold | 100.00% | `99.995 / 99.995` | ₹16,026.80 |
| Gold 22K | Gold | 91.67% | `91.6667 / 99.995` | ₹14,688.50 |
| Gold 18K | Gold | 75.00% | `75.0 / 99.995` | ₹12,020.10 |
| Silver 999 | Silver | 100.00% | `99.9 / 99.9` | ₹300.00 |
| Silver 925 | Silver | 92.59% | `92.5 / 99.9` | ₹277.77 |
| Platinum | Platinum | 100.00% | `95.0 / 95.0` | ₹6,314.10 |

### Genders (4)

- Female (F)
- Male (M)
- Unisex (U)
- Kids (K)

### Items (10)

- Necklace (N)
- Ring (R)
- Earring (E)
- Bracelet (B)
- Bangle (BG)
- Pendant (P)
- Chain (C)
- Anklet (A)
- Nose Pin (NP)
- Mangalsutra (MS)

### Categories (8 sample)

- Temple (T)
- Bridal (BR)
- Daily Wear (DW)
- Antique (AN)
- Modern (MD)
- Minimalist (MN)
- Traditional (TR)
- Gemstone (GS)

## 🔧 Adding Custom Materials

To add a new material (e.g., Gold 20K):

1. Determine the metal group (Gold, Silver, or Platinum)
2. Calculate purity formula
3. Add to `seed-categories-v2.js`:

```javascript
{
  name: "Gold 20K",
  displayName: "Gold (20K)",
  idAttribute: "G20",
  metalGroup: goldGroup._id,
  purityType: "DERIVED",
  purityNumerator: 83.33,      // 20/24 * 100 = 83.33
  purityDenominator: 99.995,
  purityFormula: "83.33 / 99.995",
  purityPercentage: 83.33,
  // Price will be auto-calculated
}
```

## 🔄 Price Calculation Examples

### Gold 22K Price Calculation

```
MCX Gold Price:     ₹15,526.80/g
+ Retailer Premium: ₹500.00/g
= Base Price:       ₹16,026.80/g

Gold 22K Purity:    91.6667 / 99.995 = 0.916713

Gold 22K Price:     ₹16,026.80 × 0.916713
                  = ₹14,688.50/g
```

### Silver 925 Price Calculation

```
MCX Silver Price:   ₹250.00/g
+ Retailer Premium: ₹50.00/g
= Base Price:       ₹300.00/g

Silver 925 Purity:  92.5 / 99.9 = 0.925926

Silver 925 Price:   ₹300.00 × 0.925926
                  = ₹277.78/g
```

## 🔐 Environment Variables

Required in `.env`:

```env
MONGO_URI=mongodb://localhost:27017/varlyq-dj
```

## 🐛 Troubleshooting

### Error: "Metal Groups not found"

**Solution**: Run `seed-metal-groups.js` first before `seed-categories-v2.js`

```bash
node seeds/seed-metal-groups.js
node seeds/seed-categories-v2.js
```

### Error: "MongoDB URI not found"

**Solution**: Check `.env` file has `MONGO_URI` defined

### Duplicate Key Errors

**Solution**: Clear existing data or update seed logic to skip existing records

```bash
# MongoDB shell
use varlyq-dj
db.metalgroups.deleteMany({})
db.materials.deleteMany({})
```

## 📝 Migration from Old Structure

If you have existing data with the old `metalType` structure:

1. Backup your database
2. Run new seeds
3. Update existing materials to link to metal groups
4. Update frontend to use new structure

Migration script coming soon...

## 🔮 Next Steps

After seeding:

1. Set up cron job to fetch MCX prices (every 15 minutes)
2. Implement admin UI to update premium
3. Test price calculations
4. Configure price override functionality

## 📞 Support

For issues or questions, contact the development team.
