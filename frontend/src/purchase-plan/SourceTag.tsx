import { t, useLanguage, getLocale } from "../i18n/index.ts";
import type { PurchaseFigureSource } from "../engine.ts";
export function SourceTag({ source }: { source: PurchaseFigureSource }) {
  useLanguage();
  return (
    <span
      className={`source-tag source--${source === "from your file" ? "file" : source === "input by you" ? "input" : "worked"}`}
    >
      {t(source)}
    </span>
  );
}
export function numberText(value: number) {
  return new Intl.NumberFormat(getLocale(), { maximumFractionDigits: 2 }).format(
    value,
  );
}

export function oneDecimalText(value: number) {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}
