import type { SourceMode } from "../engine.ts";

type CsvValue = string | number;

function csvCell(value: CsvValue): string {
  const text = String(value);
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function purchasePlanFilename(sourceMode: SourceMode): string {
  return sourceMode === "sample"
    ? "stockless-SAMPLE-purchase-plan.csv"
    : "stockless-purchase-plan.csv";
}

export function serializePurchasePlanCsv(
  rows: readonly (readonly CsvValue[])[],
  sourceMode: SourceMode,
): string {
  const labelledRows: readonly (readonly CsvValue[])[] = [
    ["StockLess data source", sourceMode === "sample" ? "Sample data" : "Retailer file"],
    ...rows,
  ];
  return `\uFEFF${labelledRows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
