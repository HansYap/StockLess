import { t, useLanguage } from "../i18n/index.ts";
import type { DemandRangeEvidence, WeeklyEvidence } from "../engine.ts";
import { SourceTag } from "./SourceTag.tsx";

/** SVG coordinates only: the four-week range is projected onto a weekly chart, not re-forecast. */
export function DemandChart({
  weeks,
  range,
  name,
}: {
  weeks: readonly WeeklyEvidence[];
  range: DemandRangeEvidence;
  name: string;
}) {
  useLanguage();
  const left = 42,
    right = 622,
    top = 22,
    bottom = 184,
    today = left + (right - left) * 0.68;
  const max = Math.max(
    1,
    range.high / range.horizonWeeks,
    ...weeks.map((w) => w.positiveQuantity ?? 0),
  );
  const y = (value: number) => bottom - (value / max) * (bottom - top);
  const x = (index: number) =>
    weeks.length <= 1
      ? today
      : left + (index * (today - left)) / (weeks.length - 1);
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  weeks.forEach((week, i) => {
    if (week.state === "missing" || week.positiveQuantity === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push({ x: x(i), y: y(week.positiveQuantity) });
  });
  if (segment.length) segments.push(segment);
  const zero = weeks.some((w) => w.state === "confirmed_zero_sales");
  const missing = weeks.some((w) => w.state === "missing");
  const negative = weeks.filter(
    (w) => w.netQuantity !== null && w.netQuantity < 0,
  ).length;
  const cancelled = weeks.filter(
    (w) => w.state === "net_zero_with_activity",
  ).length;
  const highY = y(range.high / range.horizonWeeks),
    lowY = y(range.low / range.horizonWeeks);
  // Centre of the supplied visual band; no new demand estimate is produced.
  const centreY = (highY + lowY) / 2;
  const lastObserved = [...weeks].reverse().find(
    (week) => week.state !== "missing" && week.positiveQuantity !== null,
  );
  const forecastStartY = y(
    lastObserved?.positiveQuantity ?? (range.unroundedCentral / range.horizonWeeks),
  );
  const fanControlNear = today + (right - today) * 0.28;
  const fanControlFar = today + (right - today) * 0.72;
  const upperFanPath = `M ${today} ${forecastStartY} C ${fanControlNear} ${forecastStartY}, ${fanControlFar} ${highY}, ${right} ${highY}`;
  const lowerFanPath = `M ${today} ${forecastStartY} C ${fanControlNear} ${forecastStartY}, ${fanControlFar} ${lowY}, ${right} ${lowY}`;
  const forecastFanPath = `${upperFanPath} L ${right} ${lowY} C ${fanControlFar} ${lowY}, ${fanControlNear} ${forecastStartY}, ${today} ${forecastStartY} Z`;
  return (
    <>
      <div className="chart-wrap">
        <svg
          viewBox="0 0 640 235"
          role="img"
          aria-label={t(`Observed sales and four-week expected demand range for ${name}`)}
        >
          <text
            x={left}
            y="11"
            fill="#66767D"
            fontSize="9"
          >
            {t("Units per week")}</text>
          {t([0, 0.5, 1].map((r) => (
            <g key={r}>
              <line
                x1={left}
                y1={y(max * r)}
                x2={right}
                y2={y(max * r)}
                stroke="#E8EEEC"
              />
              <text
                x={left - 9}
                y={y(max * r) + 4}
                textAnchor="end"
                fill="#66767D"
                fontSize="10"
              >
                {t(Math.round(max * r))}
              </text>
            </g>
          )))}
          <path
            data-testid="forecast-band"
            d={forecastFanPath}
            fill="rgba(22,125,116,.17)"
          />
          <line
            data-testid="today-divider"
            x1={today}
            x2={today}
            y1={top}
            y2={bottom}
            stroke="#B8C8C4"
            strokeDasharray="4 4"
          />
          <text
            x={today - 7}
            y={top + 10}
            textAnchor="end"
            fill="#66767D"
            fontSize="9"
          >
            {t("Today")}</text>
          <path
            data-testid="forecast-upper-bound"
            d={upperFanPath}
            fill="none"
            stroke="#167D74"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            opacity=".62"
          />
          <path
            data-testid="forecast-lower-bound"
            d={lowerFanPath}
            fill="none"
            stroke="#167D74"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            opacity=".62"
          />
          <line
            data-testid="forecast-centre"
            x1={today}
            x2={right}
            y1={forecastStartY}
            y2={centreY}
            stroke="#167D74"
            strokeWidth="2.5"
            strokeDasharray="7 6"
          />
          {t(segments.map((points, i) =>
            points.length === 1 ? (
              <line
                key={i}
                x1={points[0].x - 5}
                x2={points[0].x + 5}
                y1={points[0].y}
                y2={points[0].y}
                stroke="#16313B"
                strokeWidth="3"
                strokeLinecap="round"
              />
            ) : (
              <polyline
                key={i}
                points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#16313B"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ),
          ))}
          {weeks.map((week, i) => (
            <g key={week.weekStart}>
              {week.state === "missing" && (
                <g>
                  <rect
                    data-testid="missing-week"
                    x={x(i) - 7}
                    y={top}
                    width="14"
                    height={bottom - top}
                    rx="5"
                    fill="none"
                    stroke="#86949A"
                    strokeDasharray="4 4"
                  >
                    <title>{week.weekStart}{t(": missing week")}</title>
                  </rect>
                  <text
                    x={x(i)}
                    y={bottom + 17}
                    textAnchor="middle"
                    fill="#66767D"
                    fontSize="9"
                  >
                    {t("Missing")}</text>
                </g>
              )}
              {week.state === "confirmed_zero_sales" && (
                <circle
                  data-testid="zero-sales-dot"
                  cx={x(i)}
                  cy={y(0)}
                  r="5"
                  fill="#D99120"
                  stroke="#fff"
                  strokeWidth="2"
                >
                  <title>{week.weekStart}{t(": 0 sales recorded")}</title>
                </circle>
              )}
              <text
                x={x(i)}
                y="222"
                textAnchor="middle"
                fill="#66767D"
                fontSize="9"
              >
                {t("W")}{t(i + 1)}
                <title>
                  {week.weekStart} {t("to ")}{week.weekEnd}
                </title>
              </text>
            </g>
          ))}
          {t([1, 2, 3, 4].map((i) => (
            <text
              key={i}
              x={today + (i * (right - today)) / 4}
              y="222"
              textAnchor="middle"
              fill="#66767D"
              fontSize="9"
            >
              {t("F")}{t(i)}
            </text>
          )))}
        </svg>
      </div>
      <div className="chart-legend">
        <span>
          <i className="legend-line" />
          {t("Observed weekly demand ")}<SourceTag source="from your file" />
        </span>
        <span>
          <i className="legend-forecast" />
          {t("Expected weekly equivalent ")}<SourceTag source="worked out by StockLess" />
        </span>
        {t(zero && (
          <span>
            <i className="legend-dot" />{t("0 sales recorded")}</span>
        ))}
        {t(missing && <span>{t("Dashed column = missing week")}</span>)}
      </div>
      {t((negative > 0 || cancelled > 0) && (
        <p className="evidence-warning">
          <strong>{t("Data note:")}</strong>{t(" ")}
          {t(negative > 0 &&
            `${negative} ${negative === 1 ? "week had" : "weeks had"} returns greater than sales. `)}
          {t(cancelled > 0 &&
            `In ${cancelled} ${cancelled === 1 ? "week" : "weeks"}, sales and returns cancelled each other out. `)}
          <SourceTag source="worked out by StockLess" />
        </p>
      ))}
    </>
  );
}
