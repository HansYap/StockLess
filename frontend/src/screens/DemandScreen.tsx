import { useMemo } from "react";
import { analyseDemand, type ProductSummary } from "../mock-analysis.ts";
import type { MappingState, ParsedDataset } from "../engine.ts";

interface DemandScreenProps {
  readonly dataset: ParsedDataset;
  readonly mapping: MappingState;
  readonly selectedKey: string | null;
  readonly onSelect: (key: string) => void;
  readonly onBack: () => void;
}

const STATUS_LABEL: Record<ProductSummary["status"], string> = {
  complete: "Complete",
  missing_week: "Missing week",
  stale_stock: "Stock may be stale",
};

/** Screen 04. Describes recorded sales; it does not forecast or recommend. */
export function DemandScreen(props: DemandScreenProps) {
  const result = useMemo(
    () => analyseDemand(props.dataset, props.mapping),
    [props.dataset, props.mapping],
  );

  const selected =
    result.products.find((product) => product.key === props.selectedKey) ?? result.products[0];

  if (!selected) {
    return (
      <>
        <p className="eyebrow">Where each product currently stands</p>
        <h1 className="title">No product history could be built.</h1>
        <p className="lede">
          Every row was excluded during the readiness check, so there is nothing to describe. Go
          back, correct the flagged rows and re-import the file.
        </p>
        <button type="button" className="btn--link back-link" onClick={props.onBack}>
          ← Back to readiness
        </button>
      </>
    );
  }

  return (
    <>
      <p className="eyebrow">Where each product currently stands</p>
      <h1 className="title">See the rhythm of your actual sales.</h1>

      <div className="notice notice--warn">
        <b>Descriptive view only.</b>
        <span>
          This screen summarises past sales and current stock. It does not predict future demand or
          recommend what you should purchase.
        </span>
      </div>

      <div className="picker">
        <div className="picker__left">
          <span className="picker__label">Viewing product</span>
          <select
            className="select"
            aria-label="Viewing product"
            value={selected.key}
            onChange={(event) => props.onSelect(event.target.value)}
          >
            {result.products.map((product) => (
              <option key={product.key} value={product.key}>
                {product.displayName}
              </option>
            ))}
          </select>
        </div>
        <span className={`pill ${selected.status === "complete" ? "pill--teal" : "pill--amber"}`}>
          {selected.status === "complete" ? "Complete history" : `Usable · ${STATUS_LABEL[selected.status].toLowerCase()}`}
        </span>
      </div>

      <div className="s4-grid">
        <section className="card chart-card">
          <div className="card__head">
            <div>
              <h2 className="card-title">Weekly units sold</h2>
              <p className="card-sub">
                {selected.weeks.length} recorded {selected.weeks.length === 1 ? "week" : "weeks"} ·
                actual transactions only
              </p>
            </div>
            <div className="legend">
              <div><span className="swatch-bar" />Units sold</div>
              <div><span className="swatch-missing" />Missing week</div>
            </div>
          </div>
          <WeeklyChart weeks={selected.weeks} />
        </section>

        <aside className="cover">
          <h2>Current weeks of cover</h2>
          {selected.weeksOfCover === null ? (
            <>
              <p className="cover__lede">
                {result.coverUnavailable
                  ? "No current-stock column was confirmed, so cover cannot be calculated."
                  : "Cover needs current stock and a positive recent weekly average."}
              </p>
              <div className="cover__value cover__value--muted">—</div>
              <div className="cover__unit">not available</div>
              <div className="cover__maths">
                <b>Map a current-stock column to unlock this</b>
                Go back to step 2 and confirm which column holds current stock, plus the date that
                snapshot was taken.
              </div>
            </>
          ) : (
            <>
              <p className="cover__lede">A descriptive comparison using the latest recorded stock.</p>
              <div className="cover__value">{selected.weeksOfCover.toFixed(1)}</div>
              <div className="cover__unit">weeks</div>
              <div className="cover__maths">
                <b>{selected.currentStock} units currently recorded</b>
                ÷ {selected.recentWeeklyAverage?.toFixed(1)} average units sold per recent week
                <br />= {selected.weeksOfCover.toFixed(1)} weeks of cover
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="metrics">
        <div className="metric">
          <div className="metric__label">Recent weekly average</div>
          <div className="metric__value">
            {selected.recentWeeklyAverage === null
              ? "—"
              : `${selected.recentWeeklyAverage.toFixed(1)} units`}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">Current stock recorded</div>
          <div className="metric__value">
            {selected.currentStock === null ? "Not mapped" : `${selected.currentStock} units`}
          </div>
        </div>
        <div className="metric">
          <div className="metric__label">History included</div>
          <div className="metric__value">
            {selected.observedWeeks} of {selected.weeks.length} weeks
          </div>
        </div>
      </div>

      <section className="card all-products">
        <div className="card__head">
          <div>
            <h2 className="card-title">All products</h2>
            <p className="card-sub">Descriptive measures based on valid recorded history</p>
          </div>
          <span className="pill pill--grey">
            {result.products.length} {result.products.length === 1 ? "product" : "products"}
          </span>
        </div>

        <div className="table-scroll">
          <table className="dtable">
            <thead>
              <tr>
                <th style={{ width: "30%" }}>Product</th>
                <th style={{ width: "18%" }}>Recent weekly average</th>
                <th style={{ width: "16%" }}>Current stock</th>
                <th style={{ width: "16%" }}>Weeks of cover</th>
                <th style={{ width: "20%" }}>Data status</th>
              </tr>
            </thead>
            <tbody>
              {result.products.map((product) => (
                <tr
                  key={product.key}
                  className={product.key === selected.key ? "row--selected" : undefined}
                  onClick={() => props.onSelect(product.key)}
                >
                  <td><b>{product.displayName}</b></td>
                  <td>{product.recentWeeklyAverage === null ? "—" : `${product.recentWeeklyAverage.toFixed(1)} units`}</td>
                  <td>{product.currentStock === null ? "—" : `${product.currentStock} units`}</td>
                  <td style={{ fontWeight: 700 }}>
                    {product.weeksOfCover === null ? "—" : `${product.weeksOfCover.toFixed(1)} weeks`}
                  </td>
                  <td>
                    <span className={`pill ${product.status === "complete" ? "pill--teal" : "pill--amber"}`}>
                      {STATUS_LABEL[product.status]}
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

/** Bar chart of weekly units with dashed outlines for observed gaps. */
function WeeklyChart({ weeks }: { readonly weeks: readonly { label: string; units: number | null }[] }) {
  const width = 700;
  const height = 200;
  const left = 42;
  const top = 24;
  const bottom = 172;

  const values = weeks.map((week) => week.units ?? 0);
  const peak = Math.max(4, ...values);
  const ticks = 4;
  const slot = (width - left - 10) / Math.max(1, weeks.length);
  const barWidth = Math.min(34, slot * 0.6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="chart" role="img" aria-label="Weekly units sold">
      {Array.from({ length: ticks + 1 }, (_, index) => {
        const y = top + ((bottom - top) / ticks) * index;
        const value = Math.round(peak - (peak / ticks) * index);
        return (
          <g key={index}>
            <line x1={left} y1={y} x2={width - 10} y2={y} stroke="#EEF2F1" />
            <text x={left - 8} y={y + 3} fontSize="9.2" fill="#829197" textAnchor="end" fontFamily="Inter, sans-serif">
              {value}
            </text>
          </g>
        );
      })}

      {weeks.map((week, index) => {
        const x = left + slot * index + (slot - barWidth) / 2;
        const full = bottom - top;
        if (week.units === null) {
          return (
            <g key={week.label}>
              <rect x={x} y={top} width={barWidth} height={full} fill="none" stroke="#93A4A8" strokeWidth="1.6" strokeDasharray="4 3" />
              <text x={x + barWidth / 2} y={top + full / 2} fontSize="8" fill="#718187" textAnchor="middle" fontFamily="Inter, sans-serif" transform={`rotate(-90 ${x + barWidth / 2} ${top + full / 2})`}>
                NO DATA
              </text>
            </g>
          );
        }
        const barHeight = peak === 0 ? 0 : (week.units / peak) * full;
        return <rect key={week.label} x={x} y={bottom - barHeight} width={barWidth} height={barHeight} fill="#167D74" />;
      })}

      {weeks.map((week, index) => (
        <text
          key={`label-${week.label}`}
          x={left + slot * index + slot / 2}
          y={bottom + 18}
          fontSize="8.4"
          fill="#829197"
          textAnchor="middle"
          fontFamily="Inter, sans-serif"
        >
          {week.label}
        </text>
      ))}
    </svg>
  );
}
