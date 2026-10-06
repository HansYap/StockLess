import { buildProductAssessments, collectProductLabels, type ProductLabels, type ReadinessSnapshot, type ProductTimeline, type DataIssue } from "../engine.ts";
import { foodCategory, type FoodCategory } from "./categories.ts";
export type ProductStatus = "ready" | "review" | "missing";
export type FindingType = "date" | "quantity" | "identity" | "stock" | "other" | "tidy";
export type FindingStatus = "out" | "in" | "done";
export interface ProductSummary {
  key: string; name: string; code: string; pack?: string; category: FoodCategory; status: ProductStatus;
  assessment?: ReturnType<typeof buildProductAssessments>[number]; cost?: NonNullable<ReadinessSnapshot["productCosts"]>[number];
  stock?: ReadinessSnapshot["productStock"][number]; timeline?: ProductTimeline; reasons: readonly string[];
  labels?: ProductLabels;
}
export interface Finding {
  id: string; type: FindingType; status: FindingStatus; name: string; code: string; category: FoodCategory;
  sourceRows: readonly number[]; observed: string; reason: string; action: string;
  field?: string; sourceColumn?: string;
  rowEvidence?: readonly { sourceRow: number; used: boolean }[];
}
const isDuplicate = (issue: DataIssue) => issue.issueCode === "DUPLICATE_CANDIDATE" || issue.issueCode === "DUPLICATE_CONFIRMED";

export function buildReadinessProducts(snapshot: ReadinessSnapshot, timelines: readonly ProductTimeline[]): readonly ProductSummary[] {
  const labels = collectProductLabels(snapshot);
  const rows = new Map<string, ReadinessSnapshot["rows"][number][]>();
  for (const row of snapshot.rows) if (row.productKey) { const group = rows.get(row.productKey) ?? []; group.push(row); rows.set(row.productKey, group); }
  const stocks = new Map(snapshot.productStock.map(item => [item.productKey, item]));
  const trends = new Map(timelines.map(item => [item.productKey, item]));
  const assessments = new Map(buildProductAssessments(snapshot, timelines).map(item => [item.productKey, item]));
  const costs = new Map(snapshot.productCosts?.map(item => [item.productKey, item]) ?? []);
  const rowKeys = new Map(snapshot.rows.map(row => [row.sourceRow, row.productKey]));
  const issues = new Map<string, DataIssue[]>();
  for (const issue of snapshot.issues) {
    const key = issue.productKey ?? rowKeys.get(issue.sourceRow);
    if (!key || isDuplicate(issue)) continue;
    const group = issues.get(key) ?? []; group.push(issue); issues.set(key, group);
  }
  return [...new Set([...rows.keys(), ...stocks.keys()])].map(key => {
    const group = rows.get(key) ?? [], values = group.find(row => row.interpretedValues.productName)?.interpretedValues ?? group[0]?.interpretedValues;
    const name = values?.productName ?? values?.productCode ?? key, stock = stocks.get(key), timeline = trends.get(key);
    const assessment = assessments.get(key);
    const status: ProductStatus = assessment?.status ?? "missing";
    const reasons = assessment?.reasons ?? ["No usable records. Correct the source file and rerun Step 3."];
    return { key, name, code: values?.productCode ?? key, pack: values?.packVariant, labels: labels.get(key), category: foodCategory(values?.productName ?? ""), stock, timeline, status, reasons, assessment, cost: costs.get(key) };
  }).sort((a, b) => ({ missing: 0, review: 1, ready: 2 }[a.status] - { missing: 0, review: 1, ready: 2 }[b.status]) || a.name.localeCompare(b.name));
}

function findingType(issue: DataIssue): FindingType {
  if (issue.field === "current_stock" || issue.field === "stock_as_of_date" || /STOCK/.test(issue.issueCode)) return "stock";
  if (issue.issueCode === "MISSING_IDENTITY") return "identity";
  if (issue.issueCode === "UNUSUAL_SALE" || issue.issueCode === "PRODUCT_IDENTITY_CONFLICT" || issue.field === "expiry_date") return "other";
  return /DATE/.test(issue.issueCode) ? "date" : /QUANTITY|ORDER/.test(issue.issueCode) ? "quantity" : "other";
}

export function buildFindings(snapshot: ReadinessSnapshot, products: readonly ProductSummary[]): readonly Finding[] {
  const rows = new Map(snapshot.rows.map(row => [row.sourceRow, row]));
  const rowsByProduct = new Map<string, ReadinessSnapshot["rows"][number][]>();
  for (const row of snapshot.rows) if (row.productKey) { const group = rowsByProduct.get(row.productKey) ?? []; group.push(row); rowsByProduct.set(row.productKey, group); }
  const productMap = new Map(products.map(product => [product.key, product]));
  const grouped = new Map<string, Finding>();
  function identity(sourceRow: number) {
    const row = rows.get(sourceRow), product = row?.productKey ? productMap.get(row.productKey) : undefined;
    return { name: product?.name ?? row?.interpretedValues.productName ?? row?.originalProductHint ?? "Unknown product", code: product?.code ?? row?.interpretedValues.productCode ?? "—", category: product?.category ?? foodCategory(row?.interpretedValues.productName ?? "") };
  }
  for (const issue of snapshot.issues.filter(item => !isDuplicate(item))) {
    const row = rows.get(issue.sourceRow), type = findingType(issue), status = row?.useState === "excluded" ? "out" : "in";
    const id = type === "stock" ? [row?.productKey ?? issue.sourceRow, issue.issueCode, issue.observedValue].join("|") : issue.id;
    const existing = grouped.get(id);
    if (existing) { grouped.set(id, { ...existing, sourceRows: [...existing.sourceRows, issue.sourceRow] }); continue; }
    grouped.set(id, { id, type, status, ...identity(issue.sourceRow), sourceRows: [issue.sourceRow], observed: issue.observedValue, reason: issue.reason, action: issue.correctiveAction, field: issue.field, sourceColumn: issue.sourceColumn });
  }
  for (const product of products) {
    if (!product.stock || product.stock.freshness.state === "current") continue;
    const age = product.stock.freshness.ageDays;
    const reason = age !== undefined ? `Stock was counted ${age} days ago.` : "No usable stock count date.";
    if ([...grouped.values()].some(item => item.type === "stock" && item.code === product.code)) continue;
    const sourceRows = (rowsByProduct.get(product.key) ?? []).filter(row => row.interpretedValues.stockAsOfDate === product.stock?.stockAsOfDate).map(row => row.sourceRow);
    grouped.set("freshness-" + product.key, { id: "freshness-" + product.key, type: "stock", status: "in", name: product.name, code: product.code, category: product.category, sourceRows, field: "stock_as_of_date", observed: product.stock.stockAsOfDate ?? "", reason, action: "Count your stock again and update the count date in your file." });
  }
  for (const group of snapshot.duplicateGroups) {
    const last = group.retainedSourceRow ?? group.sourceRows.at(-1)!;
    grouped.set(group.fingerprint, { id: group.fingerprint, type: "tidy", status: "done", ...identity(last), sourceRows: group.sourceRows, observed: "", reason: `Identical rows: kept source row ${last} and left out ${group.sourceRows.length - 1} repeated row(s).`, action: "Handled automatically. Your file is unchanged." });
  }
  snapshot.normalizations.forEach((event, index) => grouped.set("tidy-" + index, { id: "tidy-" + index, type: "tidy", status: "done", ...identity(event.sourceRow), sourceRows: [event.sourceRow], observed: JSON.stringify(event.originalValue) + " → " + JSON.stringify(event.resultingValue), reason: event.normalizationType === "confirmed_date_format" ? "Used the confirmed date format." : event.normalizationType === "trim_whitespace" ? "Extra spaces removed." : "Line endings normalised.", action: "Nothing to fix. Original values are preserved.", field: "representation", sourceColumn: event.sourceColumn }));
  return [...grouped.values()].map(finding => ({ ...finding, rowEvidence: finding.sourceRows.map(sourceRow => ({ sourceRow, used: rows.get(sourceRow)?.useState === "used" })) }));
}
