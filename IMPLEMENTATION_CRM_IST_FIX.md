# Implementation Plan: Unified CRM Orders & Metrics with IST

To resolve the data mismatch between the "Orders List" and "Metrics Cards" (Total Orders, Completed, etc.) while correctly supporting **Indian Standard Time (IST)**.

## 1. Core Issues
1.  **Timezone Gap:** The backend appends `Z` (UTC) to dates, causing a 5.5-hour misalignment with India.
2.  **Fragmented Logic:** Metrics and the List use different API calls with varying filter logic.
3.  **Frontend Aggregation:** The frontend manually totals metrics from partial data (e.g., only tracking 6 statuses).

## 2. Technical Approach: Unified Metrics & IST Offsets
Instead of separate API calls, we will:
*   **Unify the Data:** Use MongoDB `$facet` in the `getAllOrders` controller to return both the paginated list and the summary metrics in a single atomic response.
*   **Fix the Offset:** Use `ISO-8601` with the `+05:30` offset (IST) for all date boundary calculations.
*   **Sync the Logic:** Ensure metrics cards use the exact same filters as the list.

## 3. Step-by-Step implementation

### Phase 1: Backend Infrastructure (IST Handling)
- Create `backend/utility/date-ist.js` with `getISTBoundaries(startDate, endDate)`.
- This ensures that selecting "Apr 3rd" correctly targets `Apr 2nd 18:30:00Z` to `Apr 3rd 18:29:59Z`.

### Phase 2: Unified Controller (`controllers/order.controller.js`)
- Refactor `getAllOrders_get` to use an aggregation pipeline.
- Use `$match` for all filters (status, search, dates).
- Use `$facet` to branch into two results:
    1.  `metadata`: Total count and Summary Metrics (Total, Completed, AOV, Repeat Rate).
    2.  `data`: The paginated list of orders.
- This guarantees $100\%$ consistency since they share the same source query.

### Phase 3: Analytics Alignment
- Update `controllers/dashboard-analytics.controller.js` to use the same IST date helper.
- Standardize "Completed" status across both systems (e.g., only `DELIVERED`).

### Phase 4: Frontend Simplification
- In `admin/src/components/order/order-list.tsx`:
    - Delete the 3 separate analytics hooks (`useOrderFunnel`, etc.).
    - Update the `useGetOrders` hook to consume the new `summary` object from the backend.
    - Directly map `res.data.summary.total` to the "Total Orders" card.

## 4. Verification Plan
- [ ] Select a date with active orders (e.g., Today).
- [ ] Verify that high-noon orders and late-night (11:59 PM) orders are included.
- [ ] Confirm "Total Orders" count exactly matches the number of rows in the list.
- [ ] Validate "Average Order Value" using a calculator against the visible list.
