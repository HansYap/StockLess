import { t, useLanguage } from "../i18n/index.ts";
import { useMemo } from "react";
import {
  CAPABILITY_LABELS,
  buildDemandReview,
  type CoverReasonCode,
  type DemandProductEvidence,
  type ReadinessSnapshot,
  type RecentAverageReasonCode,
  type WeeklyEvidence,
} from "../engine.ts";

interface DemandScreenProps {
  readonly snapshot: ReadinessSnapshot;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onBack: () => void;
}

const REASON_TEXT: Record<CoverReasonCode, string> = {
  MISSING_CURRENT_STOCK: "Stock on hand is missing.",
  INVALID_CURRENT_STOCK: "Stock on hand is not a valid non-negative number.",
  CONFLICTING_CURRENT_STOCK: "This product has conflicting current-stock values.",
  MISSING_STOCK_DATE: "The stock snapshot date is missing.",
  INVALID_STOCK_DATE: "The stock snapshot date is invalid.",
  CONFLICTING_STOCK_DATE: "This product has conflicting stock snapshot dates.",
  FUTURE_STOCK_DATE: "The stock snapshot date is after the analysis date.",
  STALE_STOCK: "The stock snapshot is too old to rely on because it is more than 14 days old.",
  NO_COMPLETED_OBSERVED_WEEK: "There is no completed observed week before the analysis date.",
  ZERO_AVERAGE: "The selected weekly mean is zero.",
  NEGATIVE_AVERAGE: "The selected weekly mean is negative after returns.",
  FEWER_THAN_8_COMPLETED_WEEKS: "Fewer than 8 completed observed weeks are available.",
  MISSING_WEEK_IN_RECENT_SPAN: "A week is missing inside the recent evidence span.",
  AGED_STOCK: "The stock snapshot is getting old because it is 8–14 days old.",
  DUPLICATE_UNRESOLVED: "Possible duplicate rows are still being counted separately.",
};

const RECOVERY_TEXT: Partial<Record<CoverReasonCode, string>> = {
  MISSING_CURRENT_STOCK: "Add or map a current-stock value, then run readiness again.",
  INVALID_CURRENT_STOCK: "Correct the stock value in the source file and import it again.",
  CONFLICTING_CURRENT_STOCK: "Use one consistent stock value for this product.",
  MISSING_STOCK_DATE: "Add or map the date when the stock count was taken.",
  INVALID_STOCK_DATE: "Correct the stock date and import the file again.",
  CONFLICTING_STOCK_DATE: "Use one consistent stock date for this product.",
  FUTURE_STOCK_DATE: "Correct the stock date or use a later valid analysis date.",
  STALE_STOCK: "Provide a stock count dated within 14 days of the analysis date.",
  NO_COMPLETED_OBSERVED_WEEK: "Add sales from at least one completed Monday–Sunday week.",
  ZERO_AVERAGE: "This calculation needs the selected weekly mean above zero.",
  NEGATIVE_AVERAGE: "Review returns and sales; the selected weekly mean must be positive.",
};

const RECENT_REASON_LABEL: Record<RecentAverageReasonCode, string> = {
  FEWER_THAN_8_COMPLETED_WEEKS: "fewer than 8 completed weeks",
  MISSING_WEEK_IN_RECENT_SPAN: "a missing week in the selected span",
  NO_COMPLETED_OBSERVED_WEEK: "no completed observed week",
};

function exactNumber(value: number | undefined): string {
  return value === undefined ? "Not available" : String(value);
}

/** Uses the acceptance-criteria wording and the figures from this exact week. */
function weekActivityLabel(week: WeeklyEvidence): string {
  if (week.state === "missing") return "Missing";
  if (week.state === "confirmed_zero_sales") return "Sold nothing";
  if (week.state === "net_zero_with_activity") {
    return `Sold ${week.positiveQuantity ?? 0}, returned ${Math.abs(week.negativeQuantity ?? 0)}`;
  }
  return "Activity recorded";
}

function coverReason(product: DemandProductEvidence): string {
  return product.cover.reasonCodes.map((reason) => REASON_TEXT[reason]).join(" ");
}

/** Separates an ageing stock count from other reasons a cover result may be limited. */
function coverStatusLabel(product: DemandProductEvidence): string {
  if (product.cover.state === "standard") return "Standard";
  if (product.cover.reasonCodes.includes("AGED_STOCK")) return "Getting old";
  return "Limited data";
}

/** Screen 04. Describes readiness-approved evidence; it never forecasts or recommends. */
export function DemandScreen(props: DemandScreenProps) {
  useLanguage();
  const review = useMemo(() => buildDemandReview(props.snapshot), [props.snapshot]);
  const selected = review.products.find((product) => product.productKey === props.selectedKey)
    ?? review.products[0];

  if (!selected) {
    return (
      <>
        <p className="eyebrow">{t("Where each product currently stands")}</p>
        <h1 className="title">{t("No product history could be built.")}</h1>
        <p className="lede">
          {t("Every row was excluded during readiness, so there is no valid sales history to describe. Correct the flagged rows and run the check again.")}</p>
        <button type="button" className="btn--link back-link" onClick={props.onBack}>
          {t("← Back to readiness")}</button>
      </>
    );
  }

  const timeline = selected.timeline;
  const firstCoverReason = selected.cover.reasonCodes[0];
  const oneWeekAverage = selected.recentAverage.observedWeekCount === 1;

  return (
    <>
      <p className="eyebrow">{t("Where each product currently stands")}</p>
      <h1 className="title">{t("See the rhythm of your actual sales.")}</h1>

      <div className="notice notice--warn">
        <b>{t("Descriptive view only.")}</b>
        <span>
          {t("This uses valid recorded history as at ")}{review.analysisDate}{t(". It does not forecast demand or recommend a purchase quantity.")}</span>
      </div>

      <div className="picker">
        <div className="picker__left">
          <span className="picker__label">{t("Viewing product")}</span>
          <select
            className="select"
            aria-label={t("Viewing product")}
            value={selected.productKey}
            onChange={(event) => props.onSelect(event.target.value)}
          >
            {review.products.map((product) => (
              <option key={product.productKey} value={product.productKey}>
                {t(product.displayName)}
              </option>
            ))}
          </select>
        </div>
        <span className={`pill ${selected.state === "standard" ? "pill--teal" : "pill--amber"}`}>
          {t(selected.state === "standard" ? "Standard demand history" : "Demand history: Limited data")}
        </span>
      </div>

      <div className="s4-grid">
        <section className="card chart-card">
          <div className="card__head chart-head">
            <div>
              <h2 className="card-title">{t(CAPABILITY_LABELS.weekly_history)}</h2>
              <p className="card-sub">
                <b>{t(CAPABILITY_LABELS.timeline_gap_evidence)}</b> {t("· Weeks run Monday to Sunday · ")}{timeline.summary.dateRangeStart} {t("to ")}{timeline.summary.dateRangeEnd}
              </p>
            </div>
            <div className="legend" aria-label={t("Chart legend")}>
              <div><span className="swatch-bar" />{t("Positive net")}</div>
              <div><span className="swatch-negative" />{t("Negative net")}</div>
              <div><span className="swatch-zero" />{t("Sold nothing")}</div>
              <div><span className="swatch-netzero" />{t("Sales and returns cancelled out")}</div>
              <div><span className="swatch-missing" />{t("Missing")}</div>
            </div>
          </div>
          <WeeklyChart weeks={timeline.weeks} />
        </section>

        <aside className={`cover cover--${selected.cover.state}`}>
          <h2>{t(CAPABILITY_LABELS.weeks_of_cover)}</h2>
          {selected.cover.state === "cannot_calculate" ? (
            <>
              <p className="cover__lede">{t("The required evidence did not pass the cover checks.")}</p>
              <div className="cover__cannot">{t("Cannot calculate")}</div>
              <div className="cover__reason">{t(coverReason(selected))}</div>
              <div className="cover__maths">
                <b>{t("What to do next")}</b>
                {t(firstCoverReason && RECOVERY_TEXT[firstCoverReason]
                  ? RECOVERY_TEXT[firstCoverReason]
                  : "Review the named limitation before relying on this measure.")}
              </div>
            </>
          ) : (
            <>
              <p className="cover__lede">{t("Stock on hand divided by the selected completed-week mean.")}</p>
              <div className="cover__value">{t(selected.cover.value!.toFixed(1))}</div>
              <div className="cover__unit">{t("weeks · ")}{t(coverStatusLabel(selected))}</div>
              {t(selected.cover.reasonCodes.length > 0 && (
                <div className="cover__reason">{t(coverReason(selected))}</div>
              ))}
              <div className="cover__maths">
                <b>{t("Inputs used at full precision")}</b>
                {t(exactNumber(selected.cover.currentStock))} {t("stock on hand ÷ ")}{t(exactNumber(selected.cover.recentAverage))} {t("selected mean")}<br />{t("Stock date ")}{selected.cover.stockAsOfDate ?? "not available"} {t("· age ")}{t(selected.cover.stockAgeDays ?? "not available")} {t("days")}</div>
            </>
          )}
        </aside>
      </div>

      <div className="metrics metrics--four">
        <div className="metric">
          <div className="metric__label">{t(CAPABILITY_LABELS.recent_weekly_average)}</div>
          <div className="metric__value">
            {t(selected.recentAverage.value === undefined ? "Cannot calculate" : `${exactNumber(selected.recentAverage.value)} units`)}
          </div>
          <div className="metric__meta">
            {t(selected.recentAverage.state === "standard" ? "Standard" : selected.recentAverage.state === "limited" ? "Limited data" : "Unavailable")}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">{t("Completed weeks selected")}</div>
          <div className="metric__value">{t(selected.recentAverage.observedWeekCount)} {t("of 8")}</div>
          <div className="metric__meta">
            {t(selected.recentAverage.windowStart && selected.recentAverage.windowEnd
              ? `${selected.recentAverage.windowStart} to ${selected.recentAverage.windowEnd}`
              : "No completed observed range")}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">{t("Stock snapshot")}</div>
          <div className="metric__value">
            {t(selected.cover.currentStock === undefined ? "Not available" : `${exactNumber(selected.cover.currentStock)} units`)}
          </div>
          <div className="metric__meta">
            {selected.cover.stockAsOfDate ?? "No usable stock date"}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">{t("History in product span")}</div>
          <div className="metric__value">
            {t(timeline.summary.observedWeekCount)} {t("of ")}{t(timeline.summary.weeksInSpan)} {t("weeks")}</div>
          <div className="metric__meta">{t(timeline.summary.missingWeekCount)} {t("missing")}</div>
        </div>
      </div>

      {t(oneWeekAverage && (
        <p className="evidence-note">
          {t(CAPABILITY_LABELS.recent_weekly_average)} {t("uses Limited data. It is built on one week; more history would make it steadier.")}</p>
      ))}

      {t(!oneWeekAverage && selected.recentAverage.reasonCodes.length > 0 && (
        <p className="evidence-note">
          {t(CAPABILITY_LABELS.recent_weekly_average)} {t("uses Limited data because ")}{t(selected.recentAverage.reasonCodes.map((reason) => RECENT_REASON_LABEL[reason]).join(" and "))}.
        </p>
      ))}

      <section className="card history-table">
        <div className="card__head">
          <div>
            <h2 className="card-title">{t("Weekly evidence")}</h2>
            <p className="card-sub">{t("The table and chart use this same reconciled weekly array.")}</p>
          </div>
          <span className="pill pill--grey">{t(timeline.weeks.length)} {t("weeks in span")}</span>
        </div>
        <div className="table-scroll">
          <table className="dtable dtable--weeks">
            <thead>
              <tr>
                <th>{t("Monday–Sunday")}</th>
                <th>{t("Positive")}</th>
                <th>{t("Returns")}</th>
                <th>{t("Net")}</th>
                <th>{t("Records")}</th>
                <th>{t("State")}</th>
                <th>{t("Source rows")}</th>
              </tr>
            </thead>
            <tbody>
              {timeline.weeks.map((week) => (
                <tr key={week.weekStart}>
                  <td className="num">{week.weekStart}<br />{week.weekEnd}</td>
                  <td className="num">{t(week.positiveQuantity === null ? "Not observed" : exactNumber(week.positiveQuantity))}</td>
                  <td className="num">{t(week.negativeQuantity === null ? "Not observed" : exactNumber(week.negativeQuantity))}</td>
                  <td className="num">{t(week.netQuantity === null ? "Not observed" : exactNumber(week.netQuantity))}</td>
                  <td className="num">{t(week.recordCount)}</td>
                  <td><WeekStatePill week={week} /></td>
                  <td className="num">{week.sourceRows.length > 0 ? week.sourceRows.join(", ") : "None (missing)"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card all-products">
        <div className="card__head">
          <div>
            <h2 className="card-title">{t("All products")}</h2>
            <p className="card-sub">{t("Descriptive measures based only on readiness-approved rows")}</p>
          </div>
          <span className="pill pill--grey">
            {t(review.products.length)} {t(review.products.length === 1 ? "product" : "products")}
          </span>
        </div>
        <div className="table-scroll">
          <table className="dtable dtable--products">
            <thead>
              <tr>
                <th>{t("Product")}</th>
                <th>{t(CAPABILITY_LABELS.recent_weekly_average)}</th>
                <th>{t("Stock on hand")}</th>
                <th>{t(CAPABILITY_LABELS.weeks_of_cover)}</th>
                <th>{t("Demand history")}</th>
              </tr>
            </thead>
            <tbody>
              {review.products.map((product) => (
                <tr key={product.productKey} className={product.productKey === selected.productKey ? "row--selected" : undefined}>
                  <td>
                    <button type="button" className="product-link" onClick={() => props.onSelect(product.productKey)}>
                      {t(product.displayName)}
                    </button>
                  </td>
                  <td>{t(product.recentAverage.value === undefined ? "Cannot calculate" : `${exactNumber(product.recentAverage.value)} units`)}</td>
                  <td>{t(product.cover.currentStock === undefined ? "Not available" : `${exactNumber(product.cover.currentStock)} units`)}</td>
                  <td>
                    {t(product.cover.value === undefined
                      ? `Cannot calculate · ${product.cover.reasonCodes[0] ? REASON_TEXT[product.cover.reasonCodes[0]] : "evidence unavailable"}`
                      : `${product.cover.value.toFixed(1)} weeks · ${coverStatusLabel(product)}`)}
                  </td>
                  <td>
                    <span className={`pill ${product.state === "standard" ? "pill--teal" : "pill--amber"}`}>
                      {t(product.state === "standard" ? "Standard" : "Limited data")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button type="button" className="btn--link back-link" onClick={props.onBack}>
        {t("← Back to readiness")}</button>
    </>
  );
}

function WeekStatePill({ week }: { readonly week: WeeklyEvidence }) {
  useLanguage();
  const tone = week.state === "observed_demand" ? "teal" : week.state === "missing" ? "grey" : "amber";
  return <span className={`pill pill--${tone}`}>{t(weekActivityLabel(week))}</span>;
}

/** Bar chart of the exact net quantities, with distinct quiet-week evidence. */
function WeeklyChart({ weeks }: { readonly weeks: readonly WeeklyEvidence[] }) {
  useLanguage();
  const width = 760;
  const height = 224;
  const left = 48;
  const right = 12;
  const top = 24;
  const bottom = 184;
  const values = weeks.flatMap((week) => week.netQuantity === null ? [] : [week.netQuantity]);
  const highest = Math.max(0, ...values);
  const lowest = Math.min(0, ...values);
  const span = Math.max(1, highest - lowest);
  const plotHeight = bottom - top;
  const yFor = (value: number) => top + ((highest - value) / span) * plotHeight;
  const zeroY = yFor(0);
  const slot = (width - left - right) / Math.max(1, weeks.length);
  const barWidth = Math.min(34, slot * 0.58);
  const labelEvery = Math.max(1, Math.ceil(weeks.length / 12));
  const gridValues = [...new Set([highest, 0, lowest])];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label={t("Weekly net quantity bars with Missing, Sold nothing, and cancelled-out weeks labelled separately")}>
      {t(gridValues.map((value) => {
        const y = yFor(value);
        return (
          <g key={value}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke={value === 0 ? "#C8D3D1" : "#EEF2F1"} />
            <text x={left - 8} y={y + 3} fontSize="9.2" fill="#829197" textAnchor="end" fontFamily="Inter, sans-serif">{value}</text>
          </g>
        );
      }))}

      {weeks.map((week, index) => {
        const x = left + slot * index + (slot - barWidth) / 2;
        const center = x + barWidth / 2;
        const quietLabel = weekActivityLabel(week);
        if (week.state === "missing") {
          return (
            <g key={week.weekStart}>
              <title>{week.weekStart} {t("to ")}{week.weekEnd}{t(": Missing")}</title>
              <rect x={x} y={top} width={barWidth} height={plotHeight} fill="none" stroke="#93A4A8" strokeWidth="1.4" strokeDasharray="4 3" />
              <text x={center} y={top + 10} fontSize="8.8" fill="#66767D" textAnchor="middle" fontFamily="Inter, sans-serif">
                {t("Missing")}</text>
            </g>
          );
        }
        if (week.state === "confirmed_zero_sales") {
          return (
            <g key={week.weekStart}>
              <title>{week.weekStart} {t("to ")}{week.weekEnd}{t(": Sold nothing")}</title>
              <circle cx={center} cy={zeroY} r="4.8" fill="#3F7E98" stroke="#FFFFFF" strokeWidth="1.5" />
              <text x={center} y={Math.max(top + 10, zeroY - 10)} fontSize="8.8" fill="#315F73" textAnchor="middle" fontFamily="Inter, sans-serif">
                {t("Sold nothing")}</text>
            </g>
          );
        }
        if (week.state === "net_zero_with_activity") {
          return (
            <g key={week.weekStart}>
              <title>{week.weekStart} {t("to ")}{week.weekEnd}: {t(quietLabel)}</title>
              <rect x={center - 4} y={zeroY - 4} width="8" height="8" fill="#C4872B" stroke="#FFFFFF" strokeWidth="1" transform={`rotate(45 ${center} ${zeroY})`} />
              <text x={center} y={Math.max(top + 10, zeroY - 10)} fontSize="8.8" fill="#765A2D" textAnchor="middle" fontFamily="Inter, sans-serif">
                {t(quietLabel)}
              </text>
            </g>
          );
        }
        const value = week.netQuantity ?? 0;
        const valueY = yFor(value);
        return (
          <g key={week.weekStart}>
            <title>{week.weekStart} {t("to ")}{week.weekEnd}{t(": net ")}{value}{t("; positive ")}{t(week.positiveQuantity)}{t("; returns ")}{t(week.negativeQuantity)}</title>
            <rect
              x={x}
              y={Math.min(valueY, zeroY)}
              width={barWidth}
              height={Math.max(1.5, Math.abs(zeroY - valueY))}
              fill={value >= 0 ? "#167D74" : "#B94C44"}
              rx="2"
            />
          </g>
        );
      })}

      {weeks.map((week, index) => index % labelEvery === 0 || index === weeks.length - 1 ? (
        <text
          key={`label-${week.weekStart}`}
          x={left + slot * index + slot / 2}
          y={bottom + 18}
          fontSize="8.4"
          fill="#829197"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >
          {week.weekStart.slice(5)}
        </text>
      ) : null)}
    </svg>
  );
}
