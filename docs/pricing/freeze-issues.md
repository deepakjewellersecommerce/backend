# Freeze Workflow - Issues to Create

This file lists GitHub issues to create for implementing the Pricing Freeze Workflow. Copy each block as a new GitHub issue.

---

## 1) docs: Add Pricing Freeze Workflow design doc
- Title: docs(pricing): add pricing freeze workflow design doc
- Body: Link to `docs/pricing/freeze-workflow.md`. Include short summary and acceptance criteria. Tag: docs, high priority
- Acceptance criteria: doc present in repo, reviewed by backend and product teams

---

## 2) backend: Add preview endpoint for freeze (dry-run)
- Title: feat(pricing): add freeze preview endpoint for subcategory pricing component
- Body: Implement: `POST /admin/subcategories/:id/pricing/components/:componentKey/freeze?preview=true` returns affectedCount, sample of products, stats. No state changes in preview mode.
- Tests: unit + integration for preview outputs
- Labels: backend, api, tests

---

## 3) backend: Implement apply freeze job & recalc
- Title: feat(pricing): implement freeze apply (background job) + bulk recalc
- Body: Apply freeze (store frozen meta) for the component and enqueue background job to recalc affected products. Add Job model, job status endpoint, CSV export of results.
- Tests: integration test to apply freeze and validate a sample product price is set to frozenValue and unaffected by future metal updates.
- Labels: backend, jobs, tests

---

## 4) backend: Unfreeze endpoint & audit trail
- Title: feat(pricing): add unfreeze endpoint + audit trail for freeze/unfreeze
- Body: Implement unfreeze API and ensure historical freeze metadata is preserved in audit history. Provide ability to rollback freeze.
- Tests: unit test for unfreeze path and metadata
- Labels: backend, tests

---

## 5) backend: Migration & index
- Title: chore(migration): add migration script for pricing/freeze fields and job indexing
- Body: Add migration script that validates pricing components schema (adds missing freeze fields), and adds necessary indexes (e.g., subcategoryId, jobId). Support dry-run and report mode.
- Labels: backend, migration

---

## 6) admin: UI - Freeze preview modal & apply
- Title: feat(admin): add freeze preview modal and apply action in Subcategory pricing UI
- Body: Modal should call preview endpoint and show sample rows, reason field, and confirm CTA to apply freeze (calls apply API). Export CSV option.
- Tests: React unit tests + storybook
- Labels: frontend, admin, ux

---

## 7) admin: UI - Affected products modal and export
- Title: feat(admin): add affected-products modal and CSV export
- Body: Implement server-side pagination and export to CSV for previewed affected products. Show sample rows, counts, and estimated duration after confirm.
- Labels: frontend, admin, ux

---

## 8) tests & CI: Add integration/E2E tests for freeze workflow
- Title: test(ci): add integration/E2E tests for freeze preview and apply
- Body: Add tests in `test/` that cover preview → apply → verify freeze across metal rate change. Ensure CI runs these tests.
- Labels: tests, ci

---

Notes:
- I cannot create GitHub issues directly from this environment. Please review these and create them in the repository using the Issue template above or assign to the project board.
- If you want, I can open PR(s) with the implementation after you approve the plan and issue tracking.
