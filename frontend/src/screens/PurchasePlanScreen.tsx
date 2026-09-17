import { useMemo, useRef, useState } from "react";
import {
  evaluateProductPurchasePlan,
  type DemandForecastReview,
  type ReadinessSnapshot,
  type ProductPurchaseInputs,
  type ExpiryCheckInput,
} from "../engine.ts";
import {
  evaluatePurchaseProduct,
  joinPurchaseEvidence,
  type PurchaseDrafts,
  type PurchaseEvaluator,
  type PurchaseProduct,
} from "../purchase-plan/model.ts";
import {
  DataLabel,
  ProductPurchaseDialog,
} from "../purchase-plan/ProductPurchaseDialog.tsx";
import { SourceTag, numberText } from "../purchase-plan/SourceTag.tsx";
import {
  purchasePlanFilename,
  serializePurchasePlanCsv,
} from "../purchase-plan/purchase-plan-export.ts";
import "../purchase-plan/purchase-plan.css";

interface Props {
  snapshot: ReadinessSnapshot;
  forecast: DemandForecastReview;
  drafts: PurchaseDrafts;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onDraftChange: (key: string, inputs: ProductPurchaseInputs) => void;
  onBack: () => void;
  evaluatePurchase?: PurchaseEvaluator;
  expiryByProduct?: Readonly<Record<string, ExpiryCheckInput | undefined>>;
}

interface PlanCacheEntry {
  readonly product: PurchaseProduct;
  readonly inputs: ProductPurchaseInputs;
  readonly expiry: ExpiryCheckInput;
  readonly evaluator: PurchaseEvaluator;
  readonly analysisDate: string;
  readonly result: ReturnType<typeof evaluatePurchaseProduct>;
}

export function PurchasePlanScreen({
  snapshot,
  forecast,
  drafts,
  selectedKey,
  onSelect,
  onDraftChange,
  onBack,
  evaluatePurchase = evaluateProductPurchasePlan,
  expiryByProduct,
}: Props) {
  const [query, setQuery] = useState("");
  const [orderingOnly, setOrderingOnly] = useState(false);
  const products = useMemo(
    () => joinPurchaseEvidence(snapshot, forecast),
    [snapshot, forecast],
  );
  const planCache = useRef(new Map<string, PlanCacheEntry>());
  // Only Epic 5 depends on purchase drafts; readiness and Epic 3 evidence are stable.
  const plans = useMemo(
    () => {
      const nextCache = new Map<string, PlanCacheEntry>();
      const nextPlans = new Map<string, ReturnType<typeof evaluatePurchaseProduct>>();
      for (const product of products) {
        const inputs = drafts[product.key] ?? product.fileInputs;
        const expiry = expiryByProduct?.[product.key] ?? product.fileExpiry;
        const cached = planCache.current.get(product.key);
        const result = cached
          && cached.product === product
          && cached.inputs === inputs
          && cached.expiry === expiry
          && cached.evaluator === evaluatePurchase
          && cached.analysisDate === snapshot.analysisDate
          ? cached.result
          : evaluatePurchaseProduct(
              product,
              snapshot.analysisDate,
              inputs,
              evaluatePurchase,
              expiry,
            );
        nextPlans.set(product.key, result);
        nextCache.set(product.key, {
          product,
          inputs,
          expiry,
          evaluator: evaluatePurchase,
          analysisDate: snapshot.analysisDate,
          result,
        });
      }
      planCache.current = nextCache;
      return nextPlans;
    },
    [
      products,
      snapshot.analysisDate,
      drafts,
      evaluatePurchase,
      expiryByProduct,
    ],
  );
  const inputsFor = (product: (typeof products)[number]) =>
    drafts[product.key] ?? product.fileInputs;
  const hasPlans = products.some(
    (product) => inputsFor(product).plannedOrder.state === "value",
  );
  const visible = products.filter(
    (product) =>
      `${product.name} ${product.sku ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()) &&
      (!orderingOnly ||
        !hasPlans ||
        inputsFor(product).plannedOrder.state === "value"),
  );
  const selected = products.find((product) => product.key === selectedKey);
  const counts = (label: string) =>
    products.filter(
      (product) => !product.issue && product.demand?.label === label,
    ).length;
  const mismatchCount = products.filter((product) => product.issue).length;
  function download() {
    const rows = [
      [
        "Product",
        "SKU",
        "Data label",
        "Demand low",
        "Demand high",
        "Estimated restock",
        "Planned order",
        "Incoming stock",
        "Purchase check",
      ],
      ...products.map((product) => {
        const plan = plans.get(product.key),
          input = inputsFor(product);
        return [
          product.name,
          product.sku ?? "",
          product.issue || product.demand?.label || "",
          product.issue ? "" : (product.demand?.range?.low ?? ""),
          product.issue ? "" : (product.demand?.range?.high ?? ""),
          plan?.estimatedRestock.state === "available"
            ? plan.estimatedRestock.quantity.value
            : "",
          input.plannedOrder.state === "value" ? input.plannedOrder.value : "",
          input.incomingStock.state === "value"
            ? input.incomingStock.value
            : "",
          plan?.audit.state === "verdict"
            ? plan.audit.verdict
            : plan?.audit.state === "cannot_judge"
              ? plan.audit.label
              : "",
        ];
      }),
    ];
    const csv = serializePurchasePlanCsv(rows, snapshot.sourceMode);
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = purchasePlanFilename(snapshot.sourceMode);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return (
    <main className="purchase-plan">
      <section className="heading-row">
        <div>
          <p className="eyebrow">
            Purchase plan ·{" "}
            {new Date(`${snapshot.analysisDate}T00:00:00Z`).toLocaleDateString(
              "en-GB",
              {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              },
            )}
          </p>
          <h1 className="page-title">
            Plan what to restock, then check it before you order.
          </h1>
          <p className="lede">
            Start with StockLess's estimated quantity, enter what you intend to
            buy, and see whether the plan fits expected demand.
          </p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={download}>
          ↓ Download purchase summary
        </button>
      </section>
      <p className="privacy-note">
        <span aria-hidden="true">▣</span>
        <span>
          <strong>Your figures stay local.</strong> Typed order quantities last
          for this visit only and are not sent to a supplier.
        </span>
      </p>
      <section className="summary" aria-label="Purchase planning instructions">
        <article className="summary-main">
          <p className="eyebrow">Instructions</p>
          <h2>Select a product to plan its next order.</h2>
          <p>
            Click any row below to review its forecast, enter incoming stock and
            planned order, and receive a purchase check.
          </p>
        </article>
      </section>
      <div className="readiness-counts" aria-label="Product data labels">
        <strong>All {products.length} products</strong>
        {["Ready", "Limited", "Cannot assess"].map((label) => (
          <span key={label}>
            <b>{counts(label)}</b> {label}
          </span>
        ))}
      </div>
      {mismatchCount > 0 && (
        <p className="evidence-warning" role="alert">
          Evidence mismatch affects {mismatchCount}{" "}
          {mismatchCount === 1 ? "product" : "products"}. These products remain
          listed but cannot be evaluated. Return to readiness and refresh the
          forecast.
        </p>
      )}
      <section className="card list-card">
        <div className="card-head">
          <div>
            <p className="eyebrow">All products</p>
            <h2>Your purchase plan</h2>
            <p>
              Select a product to enter quantities and see its evidence and full
              calculation.
            </p>
          </div>
          <span className="pill pill--neutral">
            {visible.length} {visible.length === 1 ? "product" : "products"}{" "}
            shown
          </span>
        </div>
        <div className="toolbar">
          <label className="search">
            <span className="visually-hidden">Search products</span>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle
                cx="11"
                cy="11"
                r="7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="m16.5 16.5 4 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              placeholder="Search by product name or SKU"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <label className="switch">
            <input
              type="checkbox"
              disabled={!hasPlans}
              checked={hasPlans && orderingOnly}
              onChange={(event) => setOrderingOnly(event.currentTarget.checked)}
            />
            <span className="switch-track" aria-hidden="true" />
            <span>Only products I am ordering</span>
          </label>
        </div>
        {!snapshot.purchaseFileEvidence?.expiryDateColumnConfirmed
          && !Object.values(expiryByProduct ?? {}).some((input) => input?.columnConfirmed) && (
          <p className="expiry-note">
            Expiry not checked — your file has no expiry dates
          </p>
        )}
        <div className="table-scroll">
          <table>
            <colgroup>
              {["29%", "17%", "22%", "26%", "6%"].map((width) => (
                <col key={width} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Data label</th>
                <th scope="col">4-week demand</th>
                <th scope="col">Estimated restock</th>
                <th scope="col">
                  <span className="visually-hidden">Open action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const restock = plans.get(product.key)?.estimatedRestock;
                const range =
                  !product.issue && product.demand?.label !== "Cannot assess"
                    ? product.demand?.range
                    : undefined;
                return (
                  <tr
                    key={product.key}
                    className={`clickable-row${selectedKey === product.key ? " selected" : ""}`}
                    onClick={() => onSelect(product.key)}
                  >
                    <td>
                      <button
                        className="product-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(product.key);
                        }}
                      >
                        {product.name}
                        <small>SKU {product.sku || "Not available"}</small>
                      </button>
                    </td>
                    <td>
                      <DataLabel product={product} />
                      {(product.issue || product.demand?.labelReason) && (
                        <small className="input-source">
                          {product.issue ||
                            product.demand?.labelReason?.message}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className="range">
                        {range
                          ? `${numberText(range.low)}–${numberText(range.high)} units`
                          : "No range"}
                        {range && product.demand?.pattern && (
                          <span className="pill pill--neutral range-pattern">
                            {product.demand.pattern}
                          </span>
                        )}
                        <small>
                          {range
                            ? "for the next 4 weeks"
                            : product.issue ||
                              product.demand?.labelReason?.message}
                        </small>
                        {range && (
                          <SourceTag source="worked out by StockLess" />
                        )}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`estimate${restock?.state !== "available" ? " estimate--none" : ""}`}
                      >
                        {restock?.state === "available"
                          ? `${numberText(restock.quantity.value)} units`
                          : "No estimate"}
                        <small>
                          {restock?.state === "available" ? (
                            <SourceTag source={restock.quantity.source} />
                          ) : (
                            "Evidence not usable"
                          )}
                        </small>
                      </span>
                    </td>
                    <td>
                      <button
                        className="row-action"
                        type="button"
                        aria-label={`Open purchase plan for ${product.name}, SKU ${product.sku || product.key}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(product.key);
                        }}
                      >
                        ›
                      </button>
                    </td>
                  </tr>
                );
              })}
              {!visible.length && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {products.length
                      ? "No products match"
                      : "No products are available. Return to readiness to review your data."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="list-footer">
          <span role="status">
            Showing {visible.length} of {products.length} products. Counts above
            do not change when filtering.
          </span>
          <button
            className="btn btn--ghost btn--small"
            type="button"
            onClick={onBack}
          >
            ← Back to readiness
          </button>
        </div>
      </section>
      {selected && (
        <ProductPurchaseDialog
          key={selected.key}
          product={selected}
          plan={plans.get(selected.key)}
          inputs={inputsFor(selected)}
          analysisDate={snapshot.analysisDate}
          onChange={(inputs) => onDraftChange(selected.key, inputs)}
          onClose={() => onSelect(null)}
        />
      )}
    </main>
  );
}
