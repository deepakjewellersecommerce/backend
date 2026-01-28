# Dashboard Analytics API Documentation

This document describes the analytics API endpoints for the admin dashboard, providing comprehensive data visualization and KPI tracking capabilities.

**Base URL**: `http://localhost:5000` (for development)

**Authentication**: All endpoints require admin authentication via `requireAdminLogin` middleware. The API uses HttpOnly cookies for authentication.

---

## Table of Contents

1. [KPI Cards](#1-kpi-cards)
2. [Revenue by Metal Type](#2-revenue-by-metal-type)
3. [Performance by Item Type](#3-performance-by-item-type)
4. [Discount Efficiency](#4-discount-efficiency)
5. [Inventory Health](#5-inventory-health)
6. [Order Status Funnel](#6-order-status-funnel)

---

## 1. KPI Cards

Get real-time Key Performance Indicators for dashboard cards.

### Endpoint

```
GET /admin/dashboard/analytics/kpi-cards
```

### Description

Returns critical KPIs including:
- Pending orders count (orders in PLACED status)
- Today's revenue and order count
- Inventory health valuation

### Authentication

Required (Admin only)

### Query Parameters

None

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": {
      "pendingOrders": {
        "count": 15
      },
      "todayRevenue": {
        "amount": 125000.50,
        "orderCount": 8
      },
      "inventoryHealth": {
        "valuation": 5000000.00,
        "totalStockCount": 450
      }
    }
  }
}
```

### Response Fields

- `pendingOrders.count` (Number): Count of orders with PLACED status and COMPLETE payment
- `todayRevenue.amount` (Number): Total revenue from orders placed today (from midnight)
- `todayRevenue.orderCount` (Number): Count of orders placed today
- `inventoryHealth.valuation` (Number): Total inventory valuation (availableStock × costPrice)
- `inventoryHealth.totalStockCount` (Number): Total number of items in stock

### Use Cases

- Display KPI cards on the dashboard
- Monitor real-time business metrics
- Track daily performance
- Alert for pending order backlogs

---

## 2. Revenue by Metal Type

Get revenue breakdown by metal type (e.g., Gold 24K, Silver 925, Platinum).

### Endpoint

```
GET /admin/dashboard/analytics/revenue-by-metal
```

### Description

Aggregates order data to show revenue and order count per metal type. Useful for understanding which metal types generate the most revenue.

### Authentication

Required (Admin only)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | String (YYYY-MM-DD) | No | Filter orders from this date (inclusive) |
| `endDate` | String (YYYY-MM-DD) | No | Filter orders up to this date (inclusive) |

### Example Request

```
GET /admin/dashboard/analytics/revenue-by-metal?startDate=2024-01-01&endDate=2024-12-31
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "metalType": "GOLD_24K",
        "revenue": 450000.00,
        "orderCount": 25
      },
      {
        "metalType": "SILVER_925",
        "revenue": 125000.00,
        "orderCount": 42
      },
      {
        "metalType": "PLATINUM",
        "revenue": 85000.00,
        "orderCount": 8
      }
    ]
  }
}
```

### Response Fields

- `metalType` (String): Type of metal (from METAL_TYPES enum)
- `revenue` (Number): Total revenue for this metal type
- `orderCount` (Number): Number of orders containing this metal type

### Data Source

- Filters orders with `payment_status: "COMPLETE"` and `order_status != "CANCELLED BY ADMIN"`
- Unwinds products array to aggregate by metalType
- Orders by revenue (descending)

### Use Cases

- Bar chart visualization of revenue by metal type
- Identify best-performing metal types
- Track metal preference trends over time
- Inform inventory purchasing decisions

---

## 3. Performance by Item Type

Get sales performance by jewelry item category (e.g., Ring, Necklace, Bracelet).

### Endpoint

```
GET /admin/dashboard/analytics/performance-by-item
```

### Description

Analyzes performance at the "Item" level (Level 3 in the category hierarchy). Shows which jewelry types are selling best.

### Authentication

Required (Admin only)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | String (YYYY-MM-DD) | No | Filter orders from this date (inclusive) |
| `endDate` | String (YYYY-MM-DD) | No | Filter orders up to this date (inclusive) |

### Example Request

```
GET /admin/dashboard/analytics/performance-by-item?startDate=2024-01-01&endDate=2024-06-30
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "itemName": "Ring",
        "revenue": 320000.00,
        "salesCount": 78
      },
      {
        "itemName": "Necklace",
        "revenue": 285000.00,
        "salesCount": 45
      },
      {
        "itemName": "Bracelet",
        "revenue": 125000.00,
        "salesCount": 52
      }
    ]
  }
}
```

### Response Fields

- `itemName` (String): Name of the jewelry item category
- `revenue` (Number): Total revenue from this item type
- `salesCount` (Number): Total quantity of items sold

### Data Source

- Joins orders with products and item details
- Filters completed, non-cancelled orders
- Groups by item name from category hierarchy
- Orders by revenue (descending)

### Use Cases

- Pie chart or bar chart showing item performance
- Identify best-selling jewelry types
- Plan marketing campaigns around popular items
- Optimize product mix based on demand

---

## 4. Discount Efficiency

Analyze discount/coupon effectiveness and revenue impact.

### Endpoint

```
GET /admin/dashboard/analytics/discount-efficiency
```

### Description

Provides insights into how discounts affect revenue, comparing orders with and without coupons.

### Authentication

Required (Admin only)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | String (YYYY-MM-DD) | No | Filter orders from this date (inclusive) |
| `endDate` | String (YYYY-MM-DD) | No | Filter orders up to this date (inclusive) |

### Example Request

```
GET /admin/dashboard/analytics/discount-efficiency?startDate=2024-Q1
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": {
      "grossRevenue": 750000.00,
      "totalDiscount": 45000.00,
      "netRevenue": 705000.00,
      "withCoupon": 35,
      "withoutCoupon": 65
    }
  }
}
```

### Response Fields

- `grossRevenue` (Number): Total subtotal before discounts
- `totalDiscount` (Number): Total discount amount given
- `netRevenue` (Number): Total grandTotal after discounts
- `withCoupon` (Number): Count of orders that used a coupon
- `withoutCoupon` (Number): Count of orders without coupons

### Calculated Metrics

You can derive additional metrics from this data:
- **Discount Rate**: `(totalDiscount / grossRevenue) × 100`
- **Coupon Usage Rate**: `(withCoupon / (withCoupon + withoutCoupon)) × 100`
- **Average Discount per Coupon Order**: `totalDiscount / withCoupon`

### Use Cases

- Donut chart showing orders with/without coupons
- Evaluate discount strategy effectiveness
- Calculate ROI of coupon campaigns
- Adjust discount policies based on data

---

## 5. Inventory Health

Analyze inventory status, valuation, and identify stuck stock.

### Endpoint

```
GET /admin/dashboard/analytics/inventory-health
```

### Description

Provides comprehensive inventory metrics including:
- Total inventory valuation
- Stock count
- Stuck stock items (not sold in 90 days)

### Authentication

Required (Admin only)

### Query Parameters

None (analyzes current inventory state)

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": {
      "valuation": 5000000.00,
      "totalStockCount": 450,
      "stuckStock": {
        "count": 12,
        "items": [
          {
            "productTitle": "Vintage Gold Ring",
            "skuNo": "VGR-001",
            "availableStock": 5,
            "category": "Jewelry > Rings > Vintage"
          },
          {
            "productTitle": "Silver Bracelet Set",
            "skuNo": "SBS-042",
            "availableStock": 8,
            "category": "Jewelry > Bracelets > Sets"
          }
        ]
      }
    }
  }
}
```

### Response Fields

- `valuation` (Number): Total inventory value (availableStock × costPrice)
- `totalStockCount` (Number): Total items in inventory
- `stuckStock.count` (Number): Number of items not sold in 90 days
- `stuckStock.items` (Array): Top 10 stuck stock items with details
  - `productTitle` (String): Product name
  - `skuNo` (String): SKU identifier
  - `availableStock` (Number): Units in stock
  - `category` (String): Product category path

### Stuck Stock Definition

Items are considered "stuck" if:
- Available stock > 0
- No sales in the last 90 days

### Use Cases

- Monitor inventory health metrics
- Identify slow-moving products
- Plan clearance sales or promotions
- Optimize purchasing decisions
- Prevent capital tied up in dead stock

---

## 6. Order Status Funnel

Track orders through the fulfillment pipeline.

### Endpoint

```
GET /admin/dashboard/analytics/order-funnel
```

### Description

Shows order counts at each stage of the fulfillment process (PLACED → CONFIRMED → PROCESSING → SHIPPED → DELIVERED).

### Authentication

Required (Admin only)

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | String (YYYY-MM-DD) | No | Filter orders from this date (inclusive) |
| `endDate` | String (YYYY-MM-DD) | No | Filter orders up to this date (inclusive) |

### Example Request

```
GET /admin/dashboard/analytics/order-funnel?startDate=2024-01-01
```

### Success Response (200 OK)

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "status": "PLACED",
        "count": 15
      },
      {
        "status": "CONFIRMED",
        "count": 12
      },
      {
        "status": "PROCESSING",
        "count": 8
      },
      {
        "status": "SHIPPED",
        "count": 25
      },
      {
        "status": "DELIVERED",
        "count": 150
      }
    ]
  }
}
```

### Response Fields

- `status` (String): Order status (one of the funnel stages)
- `count` (Number): Number of orders in this status

### Order Statuses (in sequence)

1. **PLACED**: Order created, awaiting confirmation
2. **CONFIRMED**: Order confirmed by admin
3. **PROCESSING**: Order being prepared for shipment
4. **SHIPPED**: Order dispatched to customer
5. **DELIVERED**: Order successfully delivered

### Use Cases

- Funnel chart visualization showing order progression
- Identify bottlenecks in fulfillment
- Monitor order processing efficiency
- Track time spent in each stage
- Alert for orders stuck in early stages

---

## Common Response Patterns

### Success Response Structure

All endpoints return data in this format:

```json
{
  "success": true,
  "data": {
    "data": { /* endpoint-specific data */ }
  }
}
```

### Error Responses

#### 401 Unauthorized

```json
{
  "error": "Unauthorized!"
}
```

Returned when the request lacks valid admin authentication.

#### 500 Internal Server Error

```json
{
  "error": "Internal Error!"
}
```

Returned when an unexpected error occurs on the server.

---

## Date Filtering

Several endpoints support date range filtering via query parameters:

- **startDate**: Filter from this date (inclusive)
- **endDate**: Filter up to this date (inclusive)
- Format: `YYYY-MM-DD` (e.g., `2024-01-15`)

### Examples

```bash
# Last 30 days
?startDate=2024-11-01&endDate=2024-11-30

# Year to date
?startDate=2024-01-01

# Specific month
?startDate=2024-03-01&endDate=2024-03-31
```

---

## Frontend Integration Examples

### React Query Hook Example

```javascript
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

export const useKPICards = () => {
  return useQuery({
    queryKey: ['dashboard-kpi-cards'],
    queryFn: async () => {
      const { data } = await axios.get(
        '/admin/dashboard/analytics/kpi-cards',
        { withCredentials: true }
      );
      return data.data.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });
};

export const useRevenueByMetal = (startDate, endDate) => {
  return useQuery({
    queryKey: ['revenue-by-metal', startDate, endDate],
    queryFn: async () => {
      const { data } = await axios.get(
        '/admin/dashboard/analytics/revenue-by-metal',
        {
          params: { startDate, endDate },
          withCredentials: true,
        }
      );
      return data.data.data;
    },
  });
};
```

### Recharts Integration Example

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useRevenueByMetal } from './dashboard-analytics-query';

export const RevenueByMetalChart = ({ startDate, endDate }) => {
  const { data, isLoading } = useRevenueByMetal(startDate, endDate);

  if (isLoading) return <div>Loading...</div>;

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <XAxis dataKey="metalType" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="revenue" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
};
```

---

## Performance Considerations

1. **Caching**: Consider implementing Redis caching for frequently accessed metrics
2. **Indexes**: Ensure MongoDB indexes exist on:
   - `createdAt` (for date range queries)
   - `payment_status` and `order_status` (for filtering)
   - `products.metalType` (for metal aggregation)
3. **Pagination**: For large datasets, consider adding pagination support
4. **Real-time Updates**: Use WebSocket or polling for real-time KPI updates

---

## Testing

All endpoints are covered by integration tests in `test/dashboard-analytics.test.js`. Tests verify:
- Route existence
- Authentication requirements
- Query parameter handling
- Response structure validation
- Date filtering functionality

Run tests with:

```bash
npm test
```

---

## Security Notes

- All endpoints require admin authentication
- Uses HttpOnly cookies for session management
- Input sanitization middleware applied
- Rate limiting active on all routes
- CORS configured for allowed origins only

---

## Support

For questions or issues with these endpoints, please refer to:
- Main documentation: `ADMIN_FRONTEND_API_INTEGRATION.md`
- Backend repository: https://github.com/deepakjewellersecommerce/backend
