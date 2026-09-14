import type { PurchaseFigureSource } from "../engine.ts";
export function SourceTag({ source }: { source: PurchaseFigureSource }) {
  return (
    <span
      className={`source-tag source--${source === "from your file" ? "file" : source === "input by you" ? "input" : "worked"}`}
    >
      {source}
    </span>
  );
}
export function numberText(value: number) {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(
    value,
  );
}
