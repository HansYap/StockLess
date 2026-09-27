# Reversible finance UI preview

Disable `FINANCE_PREVIEW_ENABLED` in `FinancePreview.tsx` and rebuild to hide the Step 1–3 hints, Step 4 summary and dashboard example together.

The existing source screens only import and render `FinanceHint` or `FinancePreview`. For complete removal, remove those imports and elements, then delete this directory and `tests/finance-preview.test.tsx`.

Actual dataset amounts remain unavailable: purchase costs, selling prices and currency are not connected to the import contract. The dashboard modal uses explicitly fictional data with local, disposable input state. It never reads or changes purchase drafts, forecasts, exports or saved datasets. No new packages, backend changes or fifth workflow step.

Follow-up integration: currency and unit-cost validation; dataset-specific prices; real summary coverage; scenario comparison; recorded-outcome persistence. The current amounts are solely for design review.
