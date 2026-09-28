import { t, useLanguage, getLocale } from "../i18n/index.ts";
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
import { numberText } from "../purchase-plan/SourceTag.tsx";
import {
  purchasePlanFilename,
  serializePurchasePlanCsv,
} from "../purchase-plan/purchase-plan-export.ts";
import "../purchase-plan/purchase-plan.css";
import { FinancePreview } from "../finance-preview/FinancePreview.tsx";

interface Props {
  snapshot: ReadinessSnapshot;
  forecast: DemandForecastReview;
  drafts: PurchaseDrafts;
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  onDraftChange: (key: string, inputs: ProductPurchaseInputs) => void;
  onBack: () => void;
  onImpact?: () => void;
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
  onImpact,
  evaluatePurchase = evaluateProductPurchasePlan,
  expiryByProduct,
}: Props) {
  useLanguage();
  const [query, setQuery] = useState("");
  const [orderingOnly, setOrderingOnly] = useState(false);
  const [view, setView] = useState<"all" | "plannable" | "unavailable">("all");
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
        .includes(query.trim().replace(/^sku\s*:?\s*/i, "").toLowerCase()) &&
      (view === "all" || (view === "plannable" ? plans.get(product.key)?.estimatedRestock.state === "available" : plans.get(product.key)?.estimatedRestock.state !== "available")) &&
      (!orderingOnly ||
        !hasPlans ||
        inputsFor(product).plannedOrder.state === "value"),
  );
  const plannableCount = products.filter(product => plans.get(product.key)?.estimatedRestock.state === "available").length;
  const enteredCount = products.filter(product => inputsFor(product).plannedOrder.state === "value").length;
  const priority = (product: PurchaseProduct) => {
    const plan = plans.get(product.key);
    return plan?.audit.state === "verdict" && plan.audit.verdict === "Overstock risk" ? 0
      : plan?.expiry.state === "expires_within_four_weeks" ? 1
      : plan?.audit.state === "verdict" && plan.audit.verdict === "Needs review" ? 2
      : plan?.estimatedRestock.state === "available" ? 3 : 4;
  };
  const highlighted = [...visible].sort((a,b) => priority(a) - priority(b)).slice(0, 3);
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
            {t("Purchase plan ·")}{t(" ")}
            {new Date(`${snapshot.analysisDate}T00:00:00Z`).toLocaleDateString(
              getLocale(),
              {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              },
            )}
          </p>
          <h1 className="page-title">
            {t("Plan what to restock, then check it before you order.")}</h1>
          <p className="lede">
            {t("Start with StockLess's estimated quantity, enter what you intend to buy, and see whether the plan fits expected demand.")}</p>
        </div>
        <button className="btn btn--ghost" type="button" onClick={download}>
          {t("↓ Download purchase summary")}</button>
      </section>
      <p className="privacy-note">
        <span aria-hidden="true">▣</span>
        <span>
          <strong>{t("Your figures stay local.")}</strong> {t("Typed order quantities last for this visit only and are not sent to a supplier.")}</span>
      </p>
      <details className="planning-guide"><summary>{t("How to plan an order")}</summary><section className="planning-guide__body" aria-label={t("Purchase planning instructions")}>
        <div className="planning-guide__intro">
          <span className="planning-guide__icon" aria-hidden="true">🌳</span>
          <div>
            <h2>{t("From sales data to your next order")}</h2>
            <p>{t("Select a product below, then follow these three steps.")}</p>
          </div>
        </div>
        <ol className="planning-steps">
          {[
            ["Review demand", "See past sales and the four-week range."],
            ["Enter your quantities", "Add your planned order and incoming stock."],
            ["Check before ordering", "Compare the plan with expected demand."],
          ].map(([title, description]) => (
            <li key={title}><b>{t(title)}</b><span>{t(description)}</span></li>
          ))}
        </ol>
      </section></details>
      <section className="plan-overview" aria-label={t("Purchase planning overview")}>
        <div className="plan-overview__intro"><span className="plan-overview__icon" aria-hidden="true">🌳</span><div><h2>{t("Your next purchase, at a glance")}</h2><p>{products.length} {t("products")} · {t("for the next 4 weeks")}</p></div></div>
        <div className="plan-overview__groups">
          <button type="button" aria-pressed={view === "plannable"} onClick={() => setView(view === "plannable" ? "all" : "plannable")} className="plan-group plan-group--ready"><b>{plannableCount}</b><span>{t("Can plan")}</span><small>{t("Usable demand and stock evidence")}</small></button>
          <button type="button" aria-pressed={view === "unavailable"} onClick={() => setView(view === "unavailable" ? "all" : "unavailable")} className="plan-group plan-group--missing"><b>{products.length - plannableCount}</b><span>{t("Need more data")}</span><small>{t("Open a product to see the next action")}</small></button>
          <div className="plan-group plan-group--entered"><b>{enteredCount}</b><span>{t("Plans entered")}</span><small>{t("Included in the product totals")}</small></div>
        </div>
      </section>
      <FinancePreview />
      <p className="plan-next"><b>{t("Next step:")}</b> {t("Open a product, review the estimate, and enter the quantity you intend to order.")}</p>
      <section className="plan-highlights" aria-label={t("Suggested starting points")}>
        <div className="plan-section-head"><h2>{t("Start with these products")}</h2><p>{t("Purchase concerns appear first. Each suggestion uses your current inputs.")}</p></div>
        <div className="plan-cards">{highlighted.map(product => {
          const plan = plans.get(product.key);
          const restock = plan?.estimatedRestock;
          const audit = plan?.audit;
          const tone = audit?.state === "verdict" ? audit.verdict === "Overstock risk" ? "high" : audit.verdict === "Needs review" ? "review" : "balanced" : restock?.state === "available" ? "balanced" : "missing";
          return <article className={`plan-card plan-card--${tone}`} key={product.key}>
            <header><div><h3>{product.name}</h3><small>SKU {product.sku ?? "—"}</small></div><DataLabel product={product} /></header>
            <div className="plan-card__action"><span>{t(audit?.state === "verdict" ? "Purchase check" : "Estimated restock")}</span><strong>{t(audit?.state === "verdict" ? audit.verdict : restock?.state === "available" ? `${numberText(restock.quantity.value)} units` : "No reliable estimate")}</strong></div>
            <p>{t(audit?.state === "verdict" ? audit.reasonSentence : restock?.state === "unavailable" ? restock.reason : product.issue ?? "Review the estimate before entering your plan.")}</p>
            {plan?.expiry.state === "expires_within_four_weeks" && <p className="plan-card__expiry">{t(plan.expiry.message)}</p>}
            <button type="button" className="btn btn--ghost btn--small" onClick={() => onSelect(product.key)}>{t(restock?.state === "available" ? "Review and plan →" : "See what is needed →")}</button>
          </article>;
        })}</div>
      </section>
      {t(mismatchCount > 0 && (
        <p className="evidence-warning" role="alert">
          {t("Evidence mismatch affects ")}{t(mismatchCount)}{t(" ")}
          {t(mismatchCount === 1 ? "product" : "products")}{t(". These products remain listed but cannot be evaluated. Return to readiness and refresh the forecast.")}</p>
      ))}
      <div className={`purchase-layout${selected ? " purchase-layout--detail" : ""}`}>
      <section className="card list-card">
        <div className="card-head">
          <div>
            <p className="eyebrow">{t("All products")}</p>
            <h2>{t("Your purchase plan")}</h2>
            <p>
              {t("Select a product to enter quantities and see its evidence and full calculation.")}</p>
          </div>
          <span className="pill pill--neutral">
            {t(products.length)} {t("products")}</span>
        </div>
        <div className="readiness-counts" aria-label={t("Product data labels")}>
          <strong>{t("All ")}{t(products.length)} {t("products")}</strong>
          {["Ready", "Limited", "Cannot assess"].map((label) => (
            <span className={`pill pill--${label === "Ready" ? "ready" : label === "Limited" ? "limited" : "cannot"}`} key={label}>
              <b>{t(counts(label))}</b> {t(label)}
            </span>
          ))}
        </div>
        <div className="plan-view"><span>{t("Show:")}</span>{(["all", "plannable", "unavailable"] as const).map(item => <button type="button" key={item} aria-pressed={view === item} onClick={() => setView(item)}>{t(item === "all" ? "All products" : item === "plannable" ? "Can plan" : "Need more data")}</button>)}</div>
        <div className="toolbar">
          <label className="search">
            <span className="visually-hidden">{t("Search products")}</span>
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
              placeholder={t("Search by product name or SKU")}
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
            <span>{t("Only products I am ordering")}</span>
          </label>
        </div>
        {t(!snapshot.purchaseFileEvidence?.expiryDateColumnConfirmed
          && !Object.values(expiryByProduct ?? {}).some((input) => input?.columnConfirmed) && (
          <p className="expiry-note">
            {t("Expiry not checked — your file has no expiry dates")}</p>
        ))}
        <div className="table-scroll">
          <table>
            <colgroup>
              {t(["30%", "19%", "14%", "14%", "23%"].map((width, index) => (
                <col key={index} style={{ width }} />
              )))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t("Product")}</th>
                <th scope="col">{t("Expected demand")}</th>
                <th scope="col">{t("In stock")}</th>
                <th scope="col">{t("Your order")}</th>
                <th scope="col">{t("Check")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((product) => {
                const plan = plans.get(product.key);
                const order = inputsFor(product).plannedOrder;
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
                    <td data-label={t("Product")}>
                      <button
                        className="product-button"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelect(product.key);
                        }}
                      >
                        {product.name}
                        <small>{t("SKU ")}{product.sku || "Not available"}</small>
                        <DataLabel product={product} />
                      </button>
                    </td>
                    <td data-label={t("Expected demand")}>
                      <span className="range">
                        {t(range
                          ? `${numberText(range.low)}–${numberText(range.high)} units`
                          : "No range")}
                        <small>
                          {t(range
                            ? "for the next 4 weeks"
                            : product.issue ||
                              product.demand?.labelReason?.message)}
                        </small>
                      </span>
                    </td>
                    <td data-label={t("In stock")}>
                      {product.stock?.usableForCover && product.stock.currentStock !== undefined
                        ? <span className="num">{numberText(product.stock.currentStock)}</span>
                        : <span className="estimate estimate--none">—</span>}
                    </td>
                    <td data-label={t("Your order")}>
                      {order.state === "value" ? <span className="num">{numberText(order.value)}</span> : <span className="estimate estimate--none">—</span>}
                      {plan?.estimatedRestock.state === "available" && <small className="input-source">{t("Suggested")}{" "}{numberText(plan.estimatedRestock.quantity.value)}</small>}
                    </td>
                    <td data-label={t("Check")}>
                      <button className={`purchase-check purchase-check--${plan?.audit.state === "verdict" ? plan.audit.verdict === "Overstock risk" ? "risk" : "ready" : "pending"}`} type="button" aria-label={t(`Open purchase plan for ${product.name}, SKU ${product.sku || product.key}`)} onClick={(event) => { event.stopPropagation(); onSelect(product.key); }}>
                        {t(plan?.audit.state === "verdict" ? plan.audit.verdict : plan?.audit.state === "cannot_judge" ? "Cannot judge" : "Review →")}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {t(!visible.length && (
                <tr>
                  <td colSpan={5} className="empty-row">
                    {t(products.length
                      ? "No products match"
                      : "No products are available. Return to readiness to review your data.")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="list-footer">
          <span role="status">
            {t("Showing ")}{t(visible.length)} {t("of ")}{t(products.length)} {t("products. Counts above do not change when filtering.")}</span>
          <button
            className="btn btn--ghost btn--small"
            type="button"
            onClick={onBack}
          >
            {t("← Back to readiness")}</button>
        </div>
      </section>
      {selected && (
        <ProductPurchaseDialog
          inline
          key={selected.key}
          product={selected}
          plan={plans.get(selected.key)}
          inputs={inputsFor(selected)}
          analysisDate={snapshot.analysisDate}
          onChange={(inputs) => onDraftChange(selected.key, inputs)}
          onReviewData={() => { onSelect(null); onBack(); }}
          onClose={() => onSelect(null)}
        />
      )}
      </div>
      {onImpact && <div className="purchase-impact-action"><button type="button" className="btn btn--primary" onClick={onImpact}>{t("See your impact →")}</button></div>}
    </main>
  );
}
