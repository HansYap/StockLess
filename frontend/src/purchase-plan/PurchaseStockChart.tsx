import { t, useLanguage } from "../i18n/index.ts";
import { demandRangeText } from "./PurchaseDemandChart.tsx";
import { numberText } from "./SourceTag.tsx";

export function PurchaseStockChart({ stock, incoming, order, low, high }: { stock: number; incoming: number; order: number; low: number; high: number }) {
  useLanguage();
  const total = stock + incoming + order;
  const largest = Math.max(1, total, high) * 1.1;
  const magnitude = 10 ** Math.floor(Math.log10(largest / 4));
  const maximum = Math.ceil(largest / 4 / magnitude) * magnitude * 4;
  const width = (value: number) => `${value / maximum * 100}%`;
  return <div className="pp-stock-comparison">
    <p className="pp-small-note">{t("Both bars use the same scale for the next 4 weeks.")}</p>
    <div role="img" aria-label={`${t("Stock after order")}: ${numberText(total)} ${t("units")}; ${t("In stock")}: ${numberText(stock)}; ${t("Incoming")}: ${numberText(incoming)}; ${t("Your order")}: ${numberText(order)}; ${t("Expected demand")}: ${demandRangeText(low, high)} ${t("units")}`}>
      <div aria-hidden="true" className="pp-stock-rows">
        <div className="pp-stock-row"><div className="pp-stock-row-label"><b>{t("Stock after your order")}</b><strong className="num">{numberText(total)} {t("units")}</strong></div>
          <div className="pp-stock-track"><span className="pp-stock-segment pp-stock-segment--stock" style={{ width: width(stock) }} /><span className="pp-stock-segment pp-stock-segment--incoming" style={{ width: width(incoming) }} /><span className="pp-stock-segment pp-stock-segment--order" style={{ width: width(order) }} /></div>
        </div>
        <div className="pp-stock-row"><div className="pp-stock-row-label"><b>{t("Expected sales")}</b><strong className="num">{demandRangeText(low, high)} {t("units")}</strong></div>
          <div className="pp-stock-track"><span className="pp-stock-estimate" style={{ width: width(low) }} />{high > low && <span className="pp-stock-estimate-range" style={{ width: width(high - low) }} />}</div>
        </div>
        <div className="pp-stock-scale"><span>0</span><span>{numberText(maximum / 2)}</span><span>{numberText(maximum)} {t("units")}</span></div>
      </div>
    </div>
    <ul className="pp-legend"><li><i className="pp-swatch pp-stock-segment--stock" />{t("In stock")}: {numberText(stock)}</li><li><i className="pp-swatch pp-stock-segment--incoming" />{t("Incoming")}: {numberText(incoming)}</li><li><i className="pp-swatch pp-stock-segment--order" />{t("Your order")}: {numberText(order)}</li>{high > low && <li><i className="pp-swatch pp-swatch--estimate-range" />{t("Estimated sales range")}: {demandRangeText(low, high)}</li>}</ul>
  </div>;
}
