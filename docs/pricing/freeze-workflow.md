# Pricing Freeze Workflow — Design Document

Status: Draft
Authors: GitHub Copilot (on behalf of the team)
Created: 2026-01-21

## 1. Summary

Introduce a robust "Freeze" workflow for pricing components so admins can lock specific price components (e.g., Making Charges, Hallmarking) at a rupee value, preventing automatic changes when metal rates update. Provide preview, apply, rollback, and affected-products reporting plus UI affordances to preview impact before applying.

Goals:
- Safe bulk-freeze operations at subcategory level with mandatory reason.
- Preview mode (dry-run) showing affected products and new/old prices and which components will change.
- Recalculation flow that respects frozen components (uses frozenValue) and recalculates only non-frozen components.
- Audit trail with timestamps, admin, metalRate snapshot, and freeze reason.
- Admin UX: preview modal, confirm apply, affected-products modal with sample & stats.

Out of scope (for this change): front-end mass-edit grids for pricing components across categories (future work).


## 2. High-level design

- Data model: Extend `SubcategoryPricing` and `PriceComponent` with freeze metadata (isFrozen, frozenValue, frozenAt, freezeReason, frozenBy, metalRateAtFreeze).
- API endpoints: support `preview` query param (dry-run), `POST /admin/subcategories/:id/pricing/components/:componentKey/freeze?preview=true` (preview) and same endpoint without preview to apply freeze. Complementary unfreeze endpoints exist.
- Pricing calculation: When calculating product price, component calculation uses frozenValue if isFrozen == true; otherwise compute from formula/percentage. Freeze stores both frozen rupee value and prior calculation metadata to allow unfreeze rollbacks.
- Bulk Recalc: A bulk recalc endpoint that recalculates selected metals or entire site but skips frozen components.
- UI: Modal to preview freeze impact, affected-products list with sample rows (old/new price columns), ability to export preview as CSV and a confirm CTA with required reason.


## 3. API Contract (summary)

1) Preview freeze
- Method: POST
- Path: /api/admin/subcategories/:id/pricing/components/:componentKey/freeze?preview=true
- Auth: Admin
- Body: { reason: string, applyTo?: "subcategories"|"products" } (reason optional in preview but required when applying)
- Response: { affectedCount, sample: [{ productId, sku, oldPrice, newPrice, changedComponents: [componentKey] }], stats: { totalProducts, newlyFrozenCount } }

2) Apply freeze
- Method: POST
- Path: /api/admin/subcategories/:id/pricing/components/:componentKey/freeze
- Auth: Admin
- Body: { reason: string } (required)
- Response: { success: true, affectedCount, jobId }

3) Job status / results
- Method: GET
- Path: /api/admin/jobs/:jobId
- Response: { jobId, status: "pending|running|completed|failed", summary: { updated: n, skippedFrozen: m, errors: [{ productId, error }] }, urlToCsv } 

4) Unfreeze
- Method: PATCH
- Path: /api/admin/subcategories/:id/pricing/components/:componentKey/unfreeze
- Body: { reason?: string }
- Response: { success: true }

5) Public/product preview (already exists)
- POST /api/products/price-preview
- Body: { subcategoryId, grossWeight, netWeight, gemstones[], pricingModeOverride? }
- Response: { breakdown, metalRateUsed, pricingModeUsed }


## 4. Data Model (changes)

- SubcategoryPricing components already have freeze fields, ensure fields exist with required metadata:
  - isFrozen: Boolean
  - frozenValue: Number (Rupees)
  - frozenAt: Date
  - frozenBy: String (admin id/name)
  - freezeReason: String
  - metalRateAtFreeze: Number
  - originalCalculationType/value/formula -> retained for unfreeze

- Add job model for long running tasks (if not present): `Job` with type, params, status, resultSummary and createdBy.


## 5. Recalculation behavior

- When freeze is applied, store frozenValue (the rupee value to use for that component) and do NOT recompute it on metal rate updates.
- Bulk recalculation endpoint must recalc only products where component is not frozen; skip or mark unchanged where frozen.
- On unfreeze, resume percentage/formula-based calculations using current metal rate.


## 6. UI changes

- Subcategory Pricing UI: Add a Freeze button/icon next to each component. Clicking opens Preview modal (dry-run) showing:
  - Component old calculated value (per product sample), new calculated value (if freeze were applied), which products would change, and estimated count
  - Text input for reason (required to confirm)
  - Confirm freeze CTA (Primary) and export CSV option
- Affected Products Modal: Show pages of sample products, ability to export CSV and start background job
- Product form: Show freeze indicators on price preview (component-level marker and reason tooltip)


## 7. Validation & Testing

- Unit tests for calculation with frozen components, ensuring frozenValue is respected across metal rate changes
- Integration tests for preview endpoint and freeze application job (dry-run → apply → verify sample products changed and snapshots created)
- E2E: Admin flow preview → apply freeze → verify product price unaffected by metal rate change


## 8. Acceptance Criteria

- Admin can preview freeze for a component and see accurate affected-products sample and delta calculations
- Freeze requires a reason and records admin + timestamp
- Pricing calculations respect frozen values across metal rate updates
- Bulk recalc only updates non-frozen components
- All endpoints are secured and covered by tests


## 9. Implementation Plan (phases)

- Phase 1: Doc + API & model changes + unit tests + preview endpoint
- Phase 2: Background job + bulk apply + CI tests
- Phase 3: Admin UI modal + affected-products UI + export
- Phase 4: E2E tests + documentation + release notes


---

Appendix: Related endpoints and files (references)
- `controllers/subcategory-v2.controller.js` (pricing endpoints)
- `controllers/product-pricing.controller.js` (price preview endpoints)
- `services/pricing-calculation.service.js` (calculation logic)
- `models/subcategory-pricing.model.js` (pricing storage)
- `models/product.model.js` (product pre-save and calculatePrice)
- Tests: `test/freeze.test.js`




