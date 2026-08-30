import { useMemo } from "react";
import {
  CAPABILITY_LABELS,
  buildDemandReview,
  type CoverReasonCode,
  type DemandProductEvidence,
  type ReadinessSnapshot,
  type RecentAverageReasonCode,
  type WeeklyEvidence,
  type WeekState,
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
  STALE_STOCK: "The stock snapshot is more than 14 days old.",
  NO_COMPLETED_OBSERVED_WEEK: "There is no completed observed week before the analysis date.",
  ZERO_AVERAGE: "The selected weekly mean is zero.",
  NEGATIVE_AVERAGE: "The selected weekly mean is negative after returns.",
  FEWER_THAN_8_COMPLETED_WEEKS: "Fewer than 8 completed observed weeks are available.",
  MISSING_WEEK_IN_RECENT_SPAN: "A week is missing inside the recent evidence span.",
  AGED_STOCK: "The stock snapshot is 8–14 days old.",
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

const WEEK_STATE_LABEL: Record<WeekState, string> = {
  missing: "Missing",
  confirmed_zero_sales: "Confirmed zero sales",
  net_zero_with_activity: "Net zero with activity",
  observed_demand: "Observed demand",
};

const RECENT_REASON_LABEL: Record<RecentAverageReasonCode, string> = {
  FEWER_THAN_8_COMPLETED_WEEKS: "fewer than 8 completed weeks",
  MISSING_WEEK_IN_RECENT_SPAN: "a missing week in the selected span",
  NO_COMPLETED_OBSERVED_WEEK: "no completed observed week",
};

function exactNumber(value: number | undefined): string {
  return value === undefined ? "Not available" : String(value);
}

function coverReason(product: DemandProductEvidence): string {
  return product.cover.reasonCodes.map((reason) => REASON_TEXT[reason]).join(" ");
}

/** Screen 04. Describes readiness-approved evidence; it never forecasts or recommends. */
export function DemandScreen(props: DemandScreenProps) {
  const review = useMemo(() => buildDemandReview(props.snapshot), [props.snapshot]);
  const selected = review.products.find((product) => product.productKey === props.selectedKey)
    ?? review.products[0];

  if (!selected) {
    return (
      <>
        <p className="eyebrow">Where each product currently stands</p>
        <h1 className="title">No product history could be built.</h1>
        <p className="lede">
          Every row was excluded during readiness, so there is no valid sales history to describe.
          Correct the flagged rows and run the check again.
        </p>
        <button type="button" className="btn--link back-link" onClick={props.onBack}>
          ← Back to readiness
        </button>
      </>
    );
  }

  const timeline = selected.timeline;
  const firstCoverReason = selected.cover.reasonCodes[0];

  return (
    <>
      <p className="eyebrow">Where each product currently stands</p>
      <h1 className="title">See the rhythm of your actual sales.</h1>

      <div className="notice notice--warn">
        <b>Descriptive view only.</b>
        <span>
          This uses valid recorded history as at {review.analysisDate}. It does not forecast demand
          or recommend a purchase quantity.
        </span>
      </div>

      <div className="picker">
        <div className="picker__left">
          <span className="picker__label">Viewing product</span>
          <select
            className="select"
            aria-label="Viewing product"
            value={selected.productKey}
            onChange={(event) => props.onSelect(event.target.value)}
          >
            {review.products.map((product) => (
              <option key={product.productKey} value={product.productKey}>
                {product.displayName}
              </option>
            ))}
          </select>
        </div>
        <span className={`pill ${selected.state === "standard" ? "pill--teal" : "pill--amber"}`}>
          {selected.state === "standard" ? "Standard demand history" : "Limited demand history"}
        </span>
      </div>

      <div className="s4-grid">
        <section className="card chart-card">
          <div className="card__head chart-head">
            <div>
              <h2 className="card-title">{CAPABILITY_LABELS.weekly_history}</h2>
              <p className="card-sub">
                <b>{CAPABILITY_LABELS.timeline_gap_evidence}</b> · ISO Monday–Sunday · {timeline.summary.dateRangeStart} to {timeline.summary.dateRangeEnd}
              </p>
            </div>
            <div className="legend" aria-label="Chart legend">
              <div><span className="swatch-bar" />Positive net</div>
              <div><span className="swatch-negative" />Negative net</div>
              <div><span className="swatch-zero" />Zero sales</div>
              <div><span className="swatch-netzero" />Net zero</div>
              <div><span className="swatch-missing" />Missing</div>
            </div>
          </div>
          <WeeklyChart weeks={timeline.weeks} />
        </section>

        <aside className={`cover cover--${selected.cover.state}`}>
          <h2>{CAPABILITY_LABELS.weeks_of_cover}</h2>
          {selected.cover.state === "cannot_calculate" ? (
            <>
              <p className="cover__lede">The required evidence did not pass the cover checks.</p>
              <div className="cover__cannot">Cannot calculate</div>
              <div className="cover__reason">{coverReason(selected)}</div>
              <div className="cover__maths">
                <b>What to do next</b>
                {firstCoverReason && RECOVERY_TEXT[firstCoverReason]
                  ? RECOVERY_TEXT[firstCoverReason]
                  : "Review the named limitation before relying on this measure."}
              </div>
            </>
          ) : (
            <>
              <p className="cover__lede">Stock on hand divided by the selected completed-week mean.</p>
              <div className="cover__value">{selected.cover.value!.toFixed(2)}</div>
              <div className="cover__unit">weeks · {selected.cover.state}</div>
              {selected.cover.reasonCodes.length > 0 && (
                <div className="cover__reason">{coverReason(selected)}</div>
              )}
              <div className="cover__maths">
                <b>Inputs used at full precision</b>
                {exactNumber(selected.cover.currentStock)} stock on hand ÷ {exactNumber(selected.cover.recentAverage)} selected mean
                <br />Stock date {selected.cover.stockAsOfDate ?? "not available"} · age {selected.cover.stockAgeDays ?? "not available"} days
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="metrics metrics--four">
        <div className="metric">
          <div className="metric__label">{CAPABILITY_LABELS.recent_weekly_average}</div>
          <div className="metric__value">
            {selected.recentAverage.value === undefined ? "Cannot calculate" : `${exactNumber(selected.recentAverage.value)} units`}
          </div>
          <div className="metric__meta">
            {selected.recentAverage.state === "standard" ? "Standard" : selected.recentAverage.state === "limited" ? "Limited" : "Unavailable"}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">Completed weeks selected</div>
          <div className="metric__value">{selected.recentAverage.observedWeekCount} of 8</div>
          <div className="metric__meta">
            {selected.recentAverage.windowStart && selected.recentAverage.windowEnd
              ? `${selected.recentAverage.windowStart} to ${selected.recentAverage.windowEnd}`
              : "No completed observed range"}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">Stock snapshot</div>
          <div className="metric__value">
            {selected.cover.currentStock === undefined ? "Not available" : `${exactNumber(selected.cover.currentStock)} units`}
          </div>
          <div className="metric__meta">
            {selected.cover.stockAsOfDate ?? "No usable stock date"}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">History in product span</div>
          <div className="metric__value">
            {timeline.summary.observedWeekCount} of {timeline.summary.weeksInSpan} weeks
          </div>
          <div className="metric__meta">{timeline.summary.missingWeekCount} missing</div>
        </div>
      </div>

      {selected.recentAverage.reasonCodes.length > 0 && (
        <p className="evidence-note">
          {CAPABILITY_LABELS.recent_weekly_average} is limited because {selected.recentAverage.reasonCodes.map((reason) => RECENT_REASON_LABEL[reason]).join(" and ")}.
        </p>
      )}

      <section className="card history-table">
        <div className="card__head">
          <div>
            <h2 className="card-title">Weekly evidence</h2>
            <p className="card-sub">The table and chart use this same reconciled weekly array.</p>
          </div>
          <span className="pill pill--grey">{timeline.weeks.length} weeks in span</span>
        </div>
        <div className="table-scroll">
          <table className="dtable dtable--weeks">
            <thead>
              <tr>
                <th>Monday–Sunday</th>
                <th>Positive</th>
                <th>Returns</th>
                <th>Net</th>
                <th>Records</th>
                <th>State</th>
                <th>Source rows</th>
              </tr>
            </thead>
            <tbody>
              {timeline.weeks.map((week) => (
                <tr key={week.weekStart}>
                  <td className="num">{week.weekStart}<br />{week.weekEnd}</td>
                  <td className="num">{week.positiveQuantity === null ? "Not observed" : exactNumber(week.positiveQuantity)}</td>
                  <td className="num">{week.negativeQuantity === null ? "Not observed" : exactNumber(week.negativeQuantity)}</td>
                  <td className="num">{week.netQuantity === null ? "Not observed" : exactNumber(week.netQuantity)}</td>
                  <td className="num">{week.recordCount}</td>
                  <td><WeekStatePill state={week.state} /></td>
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
            <h2 className="card-title">All products</h2>
            <p className="card-sub">Descriptive measures based only on readiness-approved rows</p>
          </div>
          <span className="pill pill--grey">
            {review.products.length} {review.products.length === 1 ? "product" : "products"}
          </span>
        </div>
        <div className="table-scroll">
          <table className="dtable dtable--products">
            <thead>
              <tr>
                <th>Product</th>
                <th>{CAPABILITY_LABELS.recent_weekly_average}</th>
                <th>Stock on hand</th>
                <th>{CAPABILITY_LABELS.weeks_of_cover}</th>
                <th>Demand history</th>
              </tr>
            </thead>
            <tbody>
              {review.products.map((product) => (
                <tr key={product.productKey} className={product.productKey === selected.productKey ? "row--selected" : undefined}>
                  <td>
                    <button type="button" className="product-link" onClick={() => props.onSelect(product.productKey)}>
                      {product.displayName}
                    </button>
                  </td>
                  <td>{product.recentAverage.value === undefined ? "Cannot calculate" : `${exactNumber(product.recentAverage.value)} units`}</td>
                  <td>{product.cover.currentStock === undefined ? "Not available" : `${exactNumber(product.cover.currentStock)} units`}</td>
                  <td>
                    {product.cover.value === undefined
                      ? `Cannot calculate · ${product.cover.reasonCodes[0] ? REASON_TEXT[product.cover.reasonCodes[0]] : "evidence unavailable"}`
                      : `${product.cover.value.toFixed(2)} weeks · ${product.cover.state}`}
                  </td>
                  <td>
                    <span className={`pill ${product.state === "standard" ? "pill--teal" : "pill--amber"}`}>
                      {product.state === "standard" ? "Standard" : "Limited"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <button type="button" className="btn--link back-link" onClick={props.onBack}>
        ← Back to readiness
      </button>
    </>
  );
}

function WeekStatePill({ state }: { readonly state: WeekState }) {
  const tone = state === "observed_demand" ? "teal" : state === "missing" ? "grey" : "amber";
  return <span className={`pill pill--${tone}`}>{WEEK_STATE_LABEL[state]}</span>;
}

/** Bar chart of the exact net-quantity values held by the weekly evidence array. */
function WeeklyChart({ weeks }: { readonly weeks: readonly WeeklyEvidence[] }) {
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
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label="Weekly net quantity with missing and zero-week states">
      {gridValues.map((value) => {
        const y = yFor(value);
        return (
          <g key={value}>
            <line x1={left} y1={y} x2={width - right} y2={y} stroke={value === 0 ? "#C8D3D1" : "#EEF2F1"} />
            <text x={left - 8} y={y + 3} fontSize="9.2" fill="#829197" textAnchor="end" fontFamily="Inter, sans-serif">{value}</text>
          </g>
        );
      })}

      {weeks.map((week, index) => {
        const x = left + slot * index + (slot - barWidth) / 2;
        if (week.state === "missing") {
          return (
            <g key={week.weekStart}>
              <title>{week.weekStart} to {week.weekEnd}: missing</title>
              <rect x={x} y={top} width={barWidth} height={plotHeight} fill="none" stroke="#93A4A8" strokeWidth="1.4" strokeDasharray="4 3" />
            </g>
          );
        }
        if (week.state === "confirmed_zero_sales") {
          return (
            <g key={week.weekStart}>
              <title>{week.weekStart} to {week.weekEnd}: confirmed zero sales</title>
              <circle cx={x + barWidth / 2} cy={zeroY} r="4.5" fill="#3F7E98" />
            </g>
          );
        }
        if (week.state === "net_zero_with_activity") {
          const center = x + barWidth / 2;
          return (
            <g key={week.weekStart}>
              <title>{week.weekStart} to {week.weekEnd}: net zero with sales and returns</title>
              <rect x={center - 4} y={zeroY - 4} width="8" height="8" fill="#C4872B" transform={`rotate(45 ${center} ${zeroY})`} />
            </g>
          );
        }
        const value = week.netQuantity ?? 0;
        const valueY = yFor(value);
        return (
          <g key={week.weekStart}>
            <title>{week.weekStart} to {week.weekEnd}: net {value}; positive {week.positiveQuantity}; returns {week.negativeQuantity}</title>
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
