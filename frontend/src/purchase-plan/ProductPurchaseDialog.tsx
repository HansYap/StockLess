import { t, useLanguage } from "../i18n/index.ts";
import { useEffect, useRef } from "react";
import {
  applyPurchaseQuantityEdit,
  type ProductPurchaseInputs,
  type ProductPurchasePlan,
  type PurchaseAuditResult,
  type PurchaseFigureSource,
} from "../engine.ts";
import type { PurchaseProduct } from "./model.ts";
import { SourceTag, numberText, oneDecimalText } from "./SourceTag.tsx";
import { DemandChart } from "./DemandChart.tsx";

export function DataLabel({ product }: { product: PurchaseProduct }) {
  useLanguage();
  const label = product.issue ? "Evidence mismatch" : product.demand?.label;
  return (
    <span
      className={`pill pill--${label === "Ready" ? "ready" : label === "Limited" ? "limited" : "cannot"}`}
      title={t(product.issue || product.demand?.labelReason?.message)}
    >
      {t(label)}
    </span>
  );
}

function Metric({
  label,
  value,
  source,
}: {
  label: string;
  value: string;
  source?: PurchaseFigureSource;
}) {
  useLanguage();
  return (
    <div className="evidence-metric">
      <span>{t(label)}</span>
      <strong>{t(value)}</strong>
      {t(source && <SourceTag source={source} />)}
    </div>
  );
}

function purchaseValue(inputs: ProductPurchaseInputs, field: keyof ProductPurchaseInputs): number {
  return inputs[field].state === "value" ? inputs[field].value : 0;
}

/** Keeps the sliders useful for both small examples and larger retailer quantities. */
function purchaseSliderMaximum(
  product: PurchaseProduct,
  plan: ProductPurchasePlan | undefined,
  inputs: ProductPurchaseInputs,
): number {
  const rangeHigh = product.demand?.range?.high ?? 0;
  const stockOnHand = product.stock?.currentStock ?? 0;
  const estimate = plan?.estimatedRestock.state === "available"
    ? plan.estimatedRestock.quantity.value
    : 0;
  const largest = Math.max(
    rangeHigh,
    stockOnHand,
    estimate,
    purchaseValue(inputs, "plannedOrder"),
    purchaseValue(inputs, "incomingStock"),
  );
  const target = Math.max(100, largest * 2);
  if (target >= 999_999) return 999_999;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const interval = Math.max(10, magnitude / 2);
  return Math.ceil(target / interval) * interval;
}

function PurchaseVerdict({ audit }: { audit?: PurchaseAuditResult }) {
  useLanguage();
  if (!audit)
    return (
      <section className="verdict verdict--none" aria-label={t("Purchase check")}>
        <strong>{t("Purchase check")}</strong>
        <p>{t("Refresh the evidence before checking a purchase.")}</p>
      </section>
    );
  if (audit.state === "not_planned")
    return (
      <section className="verdict verdict--none" aria-label={t("Purchase check")}>
        <div className="verdict-label">
          <strong>{t("Purchase check")}</strong>
          <span className="pill pill--neutral">{t("No plan entered")}</span>
        </div>
        <h3>{t("Enter a planned order when you are ready.")}</h3>
        <p>
          {t("StockLess will check it immediately. You can leave this product alone without answering anything.")}</p>
      </section>
    );
  if (audit.state === "cannot_judge")
    return (
      <section
        className="verdict verdict--cannot"
        aria-label={t("Purchase check")}
        aria-live="polite"
      >
        <div className="verdict-label">
          <strong>{t("Purchase check")}</strong>
          <span className="pill pill--cannot">{t(audit.label)}</span>
        </div>
        <h3>{t("StockLess cannot judge this purchase.")}</h3>
        <p>{t(audit.reason)}.</p>
        <p className="verdict-action">
          {t("What you can do: ")}{t(audit.correctiveAction)}
        </p>
      </section>
    );
  const tone =
    audit.verdict === "Overstock risk"
      ? "high"
      : audit.verdict === "Needs review"
        ? "review"
        : "balanced";
  const titles = {
    high: "This plan looks too high.",
    review: "This plan looks too low.",
    balanced: "This plan is within range.",
  };
  const labels = {
    stockOnHand: "Stock on hand",
    incomingStock: "Incoming stock",
    plannedOrder: "Planned order",
    demandLow: "Demand range low",
    demandHigh: "Demand range high",
    availableAfterOrder: "Stock after order",
  };
  return (
    <section
      className={`verdict verdict--${tone}`}
      aria-label={t("Purchase check")}
      aria-live="polite"
    >
      <div className="verdict-label">
        <strong>{t("Purchase check")}</strong>
        <span className={`pill pill--${tone}`}>
          {t(audit.verdict)}
        </span>
      </div>
      <h3>{t(titles[tone])}</h3>
      <p>
        {t(audit.reasonSentence)} <SourceTag source="worked out by StockLess" />
      </p>
      {t(audit.gettingOld && <p className="verdict-action">{t("Getting old")}</p>)}
      <div className="figure-grid">
        {t((Object.keys(labels) as (keyof typeof labels)[]).map((key) => (
          <div className="figure" key={key}>
            <span className="figure-label">{t(labels[key])}</span>
            <strong>{t(numberText(audit.figures[key].value))} {t("units")}</strong>
            <SourceTag source={audit.figures[key].source} />
          </div>
        )))}
      </div>
    </section>
  );
}

export function ProductPurchaseDialog({
  product,
  plan,
  inputs,
  analysisDate,
  onChange,
  onClose,
}: {
  product: PurchaseProduct;
  plan?: ProductPurchasePlan;
  inputs: ProductPurchaseInputs;
  analysisDate: string;
  onChange: (inputs: ProductPurchaseInputs) => void;
  onClose: () => void;
}) {
  useLanguage();
  const ref = useRef<HTMLDialogElement>(null);
  const sliderMaximum = useRef(purchaseSliderMaximum(product, plan, inputs)).current;
  useEffect(() => {
    const dialog = ref.current!;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  const update = (field: keyof ProductPurchaseInputs, raw: string) => {
    const result = applyPurchaseQuantityEdit(inputs[field], raw);
    if (result.accepted) onChange({ ...inputs, [field]: result.field });
  };
  const range =
    !product.issue && product.demand?.label !== "Cannot assess"
      ? product.demand?.range
      : undefined;
  const pattern = range && product.demand?.pattern;
  const restock = plan?.estimatedRestock;
  const cannotJudge = plan?.audit.state === "cannot_judge";
  const stock = product.stock;
  const evidence = product.evidence;
  const reason = product.issue || product.demand?.labelReason?.message;
  return (
    <dialog
      ref={ref}
      aria-labelledby="purchase-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            onClose();
        }
      }}
    >
      <header className="dialog-head">
        <div>
          <p className="eyebrow">
            {t("Purchase plan · SKU ")}{product.sku || "Not available"}
          </p>
          <h2 id="purchase-dialog-title">{product.name}</h2>
          <p>
            {t("Stock counted ")}{stock?.stockAsOfDate || "date unavailable"}{t(" ")}
            {stock?.stockAsOfDate && <SourceTag source="from your file" />}
            {t(stock?.freshness.ageDays !== undefined && (
              <>
                {t(" ")}
                · {t(stock.freshness.ageDays)} {t("days old")}{t(" ")}
                <SourceTag source="worked out by StockLess" />
              </>
            ))}
          </p>
          <div className="dialog-badges">
            <DataLabel product={product} />
            {t(stock?.freshness.state === "limited" && (
              <span className="pill pill--limited">{t("Getting old")}</span>
            ))}
          </div>
        </div>
        <button
          className="icon-btn"
          type="button"
          aria-label={t("Close purchase plan")}
          onClick={onClose}
          autoFocus
        >
          ×
        </button>
      </header>
      <div className="dialog-layout">
        <div className="dialog-column">
          <section className="panel">
            <div className="evidence-top">
              <div>
                <p className="eyebrow">{t("Demand evidence")}</p>
                <h3 className="panel-title">{t("Past sales and expected demand")}</h3>
                <p className="panel-sub">
                  {t("Missing weeks remain separate from recorded zero sales.")}</p>
              </div>
              <div className="range-callout">
                <span>{t(range ? "Expected demand" : "Demand range")}</span>
                <strong>
                  {t(range
                    ? `${numberText(range.low)}–${numberText(range.high)} units`
                    : "No range")}
                </strong>
                {t(pattern && <span className="pill pill--neutral range-pattern">{t(pattern)}</span>)}
                {t(range ? (
                  <>
                    <span>{t("total for the next 4 weeks")}</span>
                    <SourceTag source="worked out by StockLess" />
                  </>
                ) : (
                  <span>{t(reason)}</span>
                ))}
              </div>
            </div>
            {range && (
              <>
                <DemandChart
                  weeks={
                    evidence?.timeline.weeks.filter(
                      (week) => week.weekEnd < analysisDate,
                    ).slice(-8) ?? []
                  }
                  range={range}
                  name={product.name}
                />
                <p className="basis">
                  {t("Range based on ")}{t(range.basedOnWeekCount)} {t("weeks, from")}{t(" ")}
                  {t(range.firstWeekUsed)} {t("to ")}{t(range.lastWeekUsed)}.
                  {t(" ")}
                  <SourceTag source="worked out by StockLess" />
                </p>
                {t(reason && <p className="evidence-warning">{t(reason)}</p>)}
              </>
            )}
            <div className="evidence-metrics">
              <Metric
                label="Current stock"
                value={
                  stock?.currentStock === undefined
                    ? "Not available"
                    : `${numberText(stock.currentStock)} units`
                }
                source={
                  stock?.currentStock === undefined
                    ? undefined
                    : "from your file"
                }
              />
              <Metric
                label="Stock-count date"
                value={stock?.stockAsOfDate || "Not available"}
                source={stock?.stockAsOfDate ? "from your file" : undefined}
              />
              <Metric
                label="Recent weekly average"
                value={
                  !range || evidence?.recentAverage.value === undefined
                    ? "Not available"
                    : `${numberText(evidence.recentAverage.value)} units`
                }
                source={
                  range && evidence?.recentAverage.value !== undefined
                    ? "worked out by StockLess"
                    : undefined
                }
              />
              <Metric
                label="Current weeks of cover"
                value={
                  !range || evidence?.cover.value === undefined
                    ? "Cannot calculate"
                    : `${oneDecimalText(evidence.cover.value)} weeks`
                }
                source={
                  range && evidence?.cover.value !== undefined
                    ? "worked out by StockLess"
                    : undefined
                }
              />
            </div>
          </section>
        </div>
        <aside className="dialog-column">
          <section className="estimate-hero">
            <p className="eyebrow">{t("Estimated restock")}</p>
            {t(restock?.state === "available" && !cannotJudge ? (
              <>
                <div className="estimate-number">
                  {t(numberText(restock.quantity.value))}
                  <span>{t("units")}</span>
                </div>
                <p className="estimate-copy">
                  {t("A practical starting quantity for this product's next four weeks.")}</p>
                <div className="estimate-method">
                  {t("Midpoint of demand range − stock on hand − incoming stock")}<br />
                  <SourceTag source={restock.quantity.source} />
                </div>
              </>
            ) : (
              <>
                <div className="estimate-number estimate-unavailable">
                  {t("No reliable estimate")}</div>
                {t(!cannotJudge && (
                  <p className="estimate-copy">
                    {t(restock?.state === "unavailable" ? restock.reason : reason)}
                  </p>
                ))}
              </>
            ))}
          </section>

          <section className="panel order-panel">
            <p className="eyebrow">{t("Your purchase")}</p>
            <h3 className="panel-title">{t("What are you planning to order?")}</h3>
            <p className="panel-sub">
              {t("Both fields are optional. The purchase check updates as soon as a valid figure changes.")}</p>
            <div className="form-grid">
              {t((["plannedOrder", "incomingStock"] as const).map((field) => {
                const input = inputs[field];
                const entered = input.state === "value";
                const value = input.state === "value" ? input.value : 0;
                const label = field === "plannedOrder" ? "Planned order" : "Incoming stock";
                return (
                  <div className="quantity-slider" key={field}>
                    <div className="quantity-slider__head">
                      <label htmlFor={`purchase-${field}`}>{t(label)}</label>
                      <output
                        htmlFor={`purchase-${field}`}
                        className={entered ? undefined : "quantity-slider__empty"}
                        aria-live="polite"
                      >
                        {t(entered ? (
                          <>{t(numberText(value))}<small> {t("units")}</small></>
                        ) : (
                          "Not entered"
                        ))}
                      </output>
                    </div>
                    {t(input.state === "value" && <SourceTag source={input.source} />)}
                    <input
                      className="quantity-slider__input"
                      id={`purchase-${field}`}
                      type="range"
                      min="0"
                      max={sliderMaximum}
                      step="1"
                      value={value}
                      aria-valuetext={t(entered ? `${numberText(value)} units` : "Not entered")}
                      aria-describedby={`purchase-${field}-help`}
                      onChange={(event) => update(field, event.currentTarget.value)}
                    />
                    <div className="quantity-slider__ends" aria-hidden="true">
                      <span>{t("0 units")}</span>
                      <span>{t(numberText(sliderMaximum))} {t("units")}</span>
                    </div>
                    <div className="quantity-slider__footer">
                      <small id={`purchase-${field}-help`}>
                        {t(field === "incomingStock"
                          ? "Not entered is treated as 0."
                          : "Move the slider to check the plan instantly.")}
                      </small>
                      {t(entered && (
                        <button
                          type="button"
                          className="quantity-slider__clear"
                          onClick={() => update(field, "")}
                          aria-label={t(`Clear ${label.toLowerCase()}`)}
                        >
                          {t("Clear")}</button>
                      ))}
                    </div>
                  </div>
                );
              }))}
            </div>
            <p className="visit-note">
              {t("Figures you enter are marked “input by you” and last for this visit only.")}</p>
          </section>
          <PurchaseVerdict audit={plan?.audit} />
          <div className="expiry">
            <span aria-hidden="true">◷</span>
            <div>
              <strong>{t("Expiry information")}</strong>
              <br />
              <span>
                {t(plan?.expiry.message ?? "Expiry not checked — evidence mismatch for this product")}
              </span>
              {plan?.expiry &&
                "earliestDate" in plan.expiry && (
                  <>
                    <br />
                    <SourceTag source="worked out by StockLess" />
                    <br />
                    {t("Earliest expiry: ")}{plan.expiry.earliestDate}{t(" ")}
                    <SourceTag source="from your file" />
                  </>
                )}
            </div>
          </div>
        </aside>
      </div>
      <footer className="dialog-footer">
        <button className="btn btn--ghost" type="button" onClick={onClose}>
          {t("Done")}</button>
      </footer>
    </dialog>
  );
}
