import { previousCompleteWeekStarts, addCalendarDays, type DemandRangeEvidence, type WeeklyEvidence } from "../engine.ts";
import { t, getLocale, useLanguage } from "../i18n/index.ts";
import { numberText } from "./SourceTag.tsx";

export function purchaseDate(date: string, year = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(getLocale(), { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
}

export function demandRangeText(low: number, high: number): string {
  return low === high ? numberText(low) : `${numberText(low)}–${numberText(high)}`;
}

/** Compare equal four-week periods; the forecast does not predict individual weeks. */
export function PurchaseDemandChart({ weeks, range, name, analysisDate }: { weeks: readonly WeeklyEvidence[]; range: Pick<DemandRangeEvidence, "low" | "high">; name: string; analysisDate: string }) {
  useLanguage();
  const dates = previousCompleteWeekStarts(analysisDate);
  const recent = dates.map(start => weeks.find(week => week.weekStart === start));
  const missing = (week: WeeklyEvidence | undefined) => !week || week.state === "missing";
  const periods = [0, 4].map(offset => {
    const entries = recent.slice(offset, offset + 4);
    return { start: dates[offset], end: addCalendarDays(dates[offset + 3], 6),
      complete: entries.every(week => !missing(week)), count: entries.filter(week => !missing(week)).length,
      quantity: entries.reduce((sum, week) => sum + (week?.positiveQuantity ?? 0), 0) };
  });
  const largest = Math.max(1, range.high, ...periods.filter(period => period.complete).map(period => period.quantity));
  const magnitude = 10 ** Math.floor(Math.log10(largest / 4));
  const step = Math.ceil(largest / 4 / magnitude) * magnitude;
  const maximum = step * 4;
  const height = (value: number) => 160 * value / maximum;
  const weeklyMaximum = Math.max(1, ...recent.map(week => week?.positiveQuantity ?? 0));
  const returns = recent.some(week => (week?.negativeQuantity ?? 0) < 0);
  const futureEnd = addCalendarDays(analysisDate, 27);
  const rangeText = demandRangeText(range.low, range.high);
  const historyDescription = periods.map(period => `${purchaseDate(period.start)} – ${purchaseDate(period.end)}: ${period.complete ? `${numberText(period.quantity)} ${t("units")}` : t("Missing records")}`).join("; ");
  return <div className="pp-forecast-chart">
    <p className="pp-chart-title">{t("Sales in 4-week periods")}</p>
    <p className="pp-small-note">{t("Each bar covers 4 weeks, so you can compare past sales with the forecast.")}</p>
    <div className="pp-period-chart" role="img" aria-label={`${t(`Recorded sales and four-week demand range for ${name}`)}. ${historyDescription}; ${t("Next 4 weeks")}: ${rangeText} ${t("units")}, ${purchaseDate(analysisDate)} – ${purchaseDate(futureEnd)}.`}>
      <div className="pp-period-plot" aria-hidden="true">
        <div className="pp-period-axis"><small>{t("units")}</small>{[4, 3, 2, 1, 0].map(i => <span key={i} style={{ bottom: height(step * i) }}>{numberText(step * i)}</span>)}</div>
        <div className="pp-period-grid">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ bottom: height(step * i) }} />)}</div>
        {periods.map(period => <div className="pp-period-col" key={period.start}>
          {period.complete ? <>
            <b className="num pp-period-value" style={{ bottom: height(period.quantity) + 8 }}>{numberText(period.quantity)}</b>
            <span data-testid="recorded-period-bar" className={`pp-period-bar${period.quantity === 0 ? " pp-period-bar--zero" : ""}`} style={{ height: period.quantity === 0 ? 2 : height(period.quantity) }} />
          </> : <div className="pp-period-missing"><b>{t("Missing records")}</b><small>{t(`${period.count} of 4 weeks recorded`)}</small></div>}
        </div>)}
        <div className="pp-period-col pp-period-col--forecast">
          <b className="num pp-period-value" style={{ bottom: height(range.high) + 8 }}>{rangeText}</b>
          <div data-testid="forecast-period-bar" className="pp-period-bar pp-period-bar--forecast" style={{ height: range.high === 0 ? 2 : height(range.high) }}>
            <span className="pp-period-lower" style={{ height: height(range.low) }} />
            {range.high > range.low && <span data-testid="forecast-range-extension" className="pp-period-extension" style={{ height: height(range.high - range.low) }} />}
          </div>
        </div>
      </div>
      <div className="pp-period-labels" aria-hidden="true">
        {periods.map((period, i) => <div key={period.start}><b>{t(i === 0 ? "Earlier 4 weeks" : "Latest 4 weeks")}</b><small>{purchaseDate(period.start)} – {purchaseDate(period.end)}</small><span>{t("Recorded sales")}</span></div>)}
        <div className="pp-period-label--forecast"><b>{t("Next 4 weeks")}</b><small>{purchaseDate(analysisDate)} – {purchaseDate(futureEnd)}</small><span>{t("Estimated sales")}</span></div>
      </div>
    </div>
    <div className="pp-forecast-key"><span><i className="pp-swatch pp-swatch--sales" />{t("Recorded sales")}</span><span><i className="pp-swatch pp-swatch--forecast" />{t(range.high > range.low ? "Lower estimate" : "Estimated sales")}</span>{range.high > range.low && <span><i className="pp-swatch pp-swatch--estimate-range" />{t("Up to the upper estimate")}</span>}</div>
    <p className="pp-small-note">{t("The forecast is an estimate for all 4 weeks together. Actual sales may be lower or higher.")}</p>
    {periods.some(period => !period.complete) && <p className="pp-small-note">{t("A past bar is unavailable when any of its weeks are missing. Missing records do not mean zero sales.")}</p>}
    <details className="pp-weekly-history"><summary>{t("See weekly sales records")}</summary>
      <p className="pp-small-note">{t("Each bar below shows recorded sales for one week.")}</p>
      <div className="pp-weekly-scroll"><div className="pp-weekly-plot">{recent.map((week, i) => {
        const absent = missing(week), value = week?.positiveQuantity ?? 0;
        return <div className="pp-weekly-col" key={dates[i]}>
          <div className="pp-weekly-bar-area"><span className="num">{absent ? "—" : numberText(value)}</span><span data-testid={absent ? "missing-week" : value === 0 ? "zero-sales-bar" : "recorded-sales-bar"} className={`pp-weekly-bar${absent ? " pp-weekly-bar--missing" : value === 0 ? " pp-weekly-bar--zero" : ""}`} style={{ height: absent ? 18 : value === 0 ? 2 : 90 * value / weeklyMaximum }} /></div>
          <small>{purchaseDate(dates[i])}</small><small>{t(absent ? "Missing" : "Recorded")}</small>
        </div>;
      })}</div></div>
    </details>
    {returns && <p className="pp-small-note">{t("Bars show positive sales. Returns remain in the underlying records.")}</p>}
  </div>;
}
