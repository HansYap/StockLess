# Purchase plan (page 4)

The approved `StockLess_Purchase_Plan_UI_Concept_v1_1.html` supplies the scoped page and dialog styles. `AppShell` retains its existing logo and green step circles.

- `App.tsx` owns visit-only purchase drafts separately from readiness and forecast state. Clear session, source replacement, and mapping invalidation clear drafts. Step navigation retains them. No draft, forecast, or verdict persistence or server submission is added.
- `PurchasePlanScreen` joins readiness and forecast by product key, preserves the union of products, and explicitly blocks evaluation for missing, duplicate, stale, or incomplete forecast evidence. Counts remain independent of search and ordering filters.
- `model.ts` is the presentation/domain boundary. The existing Epic 5 exports already available through `engine.ts` provide all quantity validation, restock estimates, purchase verdicts, freshness rules, and expiry checks. An injectable evaluator supports future integration without rewriting the dialog. No backend code was changed.
- `ProductPurchaseDialog` uses native modal dialog behavior, labelled inputs, associated errors, Escape dismissal, and focus restoration. `DemandChart` projects the supplied four-week range onto weekly chart coordinates; it never estimates demand or reruns the forecast worker.

## Remaining contract gap

`ReadinessSnapshot` and `InterpretedRowValues` do not expose confirmed expiry dates. Page 4 accepts optional `expiryByProduct` (`ExpiryCheckInput` keyed by product key), displays its actual domain result when provided, and otherwise says expiry evidence is unavailable. A future domain extraction step must provide this evidence; the UI does not infer expiry from raw columns or claim the file has no expiry dates.

## Verification

From the repository root:

```sh
npm test --workspace stockless-frontend
npm run typecheck --workspace stockless-frontend
npm run build --workspace stockless-frontend
```

The frontend test command copies the exact source and tests into a temporary directory because Vite interprets the colon in this workspace path as a URL scheme. It shares installed dependencies, executes the tests, and removes the temporary copy. Test fixtures are confined to `frontend/tests`; production inputs start empty.
