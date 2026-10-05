import { previousCompleteWeekStarts, addCalendarDays, type DemandRangeEvidence, type WeeklyEvidence } from "../engine.ts";
import { t, getLocale, useLanguage } from "../i18n/index.ts";
import { numberText } from "./SourceTag.tsx";

export function purchaseDate(date: string, year = false): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(getLocale(), { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC" });
}

/** The future columns show a weekly equivalent of the supplied four-week range. */
export function PurchaseDemandChart({ weeks, range, name, analysisDate }: { weeks: readonly WeeklyEvidence[]; range: DemandRangeEvidence; name: string; analysisDate: string }) {
  useLanguage();
  const dates = previousCompleteWeekStarts(analysisDate);
  const recent = dates.map(start => weeks.find(week => week.weekStart === start));
  const low = range.low / 4, high = range.high / 4;
  const maximum = Math.max(1, high, ...recent.map(week => week?.positiveQuantity ?? 0)) * 1.25;
  const height = (value: number) => 118 * value / maximum;
  const returns = recent.some(week => (week?.negativeQuantity ?? 0) < 0);
  return <div className="pp-forecast-chart" role="img" aria-label={t(`Recorded sales and four-week demand range for ${name}`)}>
    <div className="pp-fc-plot">
      {recent.map((week, i) => {
        const missing = !week || week.state === "missing";
        const value = week?.positiveQuantity ?? 0;
        return <div className="pp-fc-col" key={dates[i]} title={`${dates[i]}: ${missing ? t("Missing — not zero sales") : `${numberText(value)} ${t("units")}`}`}>
          <span className="num pp-fc-value">{missing ? "—" : numberText(value)}</span>
          <span data-testid={missing ? "missing-week" : value === 0 ? "zero-sales-bar" : "recorded-sales-bar"} className={`pp-fc-bar${missing ? " pp-fc-bar--missing" : value === 0 ? " pp-fc-bar--zero" : ""}`} style={{ height: missing ? 18 : Math.max(3, height(value)) }} />
        </div>;
      })}
      <div className="pp-fc-future"><span className="pp-fc-future-label">{t("Next 4 weeks")}</span>
        {[0, 1, 2, 3].map(i => <div className="pp-fc-fcol" key={i}><span data-testid="forecast-week-band" className="pp-fc-band" style={{ bottom: height(low), height: Math.max(4, height(high - low)) }} /><span className="pp-fc-mid" style={{ bottom: height((low + high) / 2) }} /></div>)}
      </div>
    </div>
    <div className="pp-fc-dates">{dates.map(date => <span key={date}>{purchaseDate(date)}</span>)}<div>{[0, 7, 14, 21].map(days => <span key={days}>{purchaseDate(addCalendarDays(analysisDate, days))}</span>)}</div></div>
    <p className="pp-fc-mobile-labels"><span>{t("Past 8 weeks")}</span><span>{t("Next 4 weeks")}</span></p>
    <ul className="pp-legend"><li><i className="pp-swatch pp-swatch--sales" />{t("Recorded sales")}</li><li><i className="pp-swatch pp-swatch--range" />{t("Weekly equivalent of expected demand")}</li><li><i className="pp-swatch pp-swatch--missing" />{t("Missing week")}</li></ul>
    {returns && <p className="pp-small-note">{t("Bars show positive sales. Returns remain in the underlying records.")}</p>}
  </div>;
}
