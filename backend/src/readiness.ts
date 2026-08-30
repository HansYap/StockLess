import type {
  CanonicalField,
  ConfirmedDateFormat,
  DataIssue,
  DateFormatConfirmation,
  DateFormatDetection,
  DuplicateGroup,
  InterpretedRowValues,
  MappingState,
  NormalizationEvent,
  ParsedDataset,
  ParsedRow,
  ProductLimitation,
  ProductStockEvidence,
  ReadinessOptions,
  ReadinessSnapshot,
  ReconciliationSummary,
  ValidatedRow,
} from "./contracts.ts";
import { formatIsoDate, parseConfirmedDate, parseIsoDate } from "./dates.ts";
import { evaluateStockFreshness } from "./freshness.ts";
import { buildProductKey } from "./identity.ts";
import { getReadinessBlockers } from "./mapping.ts";

const CONFIRMABLE_DATE_FORMATS: readonly ConfirmedDateFormat[] = Object.freeze([
  "DD/MM/YYYY",
  "MM/DD/YYYY",
  "DD.MM.YYYY",
  "MM.DD.YYYY",
  "DD-MM-YYYY",
  "MM-DD-YYYY",
]);

interface MappedColumn {
  readonly id: string;
  readonly index: number;
  readonly header: string;
}

interface RowDraft {
  readonly sourceRow: number;
  readonly productKey?: string;
  readonly originalProductHint?: string;
  readonly originalValues: readonly string[];
  readonly normalizedValues: readonly string[];
  readonly interpretedValues: InterpretedRowValues;
  readonly fingerprintValues: string[];
  duplicateFingerprint: string;
  useState: "used" | "excluded";
  readonly issueIds: string[];
}

interface DateInterpretation {
  readonly value?: string;
  readonly issueCode?: "INVALID_DATE" | "DATE_FORMAT_CONFIRMATION_REQUIRED" | "INVALID_STOCK_DATE";
  readonly normalization?: NormalizationEvent;
}

/** Resolves one confirmed mapping to its parsed source column. */
function mappedColumn(
  dataset: ParsedDataset,
  mapping: MappingState,
  field: CanonicalField,
): MappedColumn | undefined {
  const selected = mapping.mappings[field];
  if (!selected?.confirmed) return undefined;
  const column = dataset.columns.find((candidate) => candidate.id === selected.sourceColumnId);
  if (!column) throw new Error(`Confirmed mapping for ${field} references an unknown source column.`);
  return Object.freeze({ id: column.id, index: column.index, header: column.header });
}

/** Reads a normalized row value from an optional mapped column. */
function normalizedValue(row: ParsedRow, column: MappedColumn | undefined): string {
  return column ? (row.normalizedValues[column.index] ?? "") : "";
}

/** Reads the untouched source value from an optional mapped column. */
function originalValue(row: ParsedRow, column: MappedColumn | undefined): string {
  return column ? (row.originalValues[column.index] ?? "") : "";
}

/** Parses a finite decimal without guessing locale-specific separators. */
function parseFiniteDecimal(value: string): number | undefined {
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Builds the most useful original product label available on a row. */
function originalProductHint(
  row: ParsedRow,
  codeColumn: MappedColumn | undefined,
  nameColumn: MappedColumn | undefined,
  variantColumn: MappedColumn | undefined,
): string | undefined {
  const code = normalizedValue(row, codeColumn);
  const name = normalizedValue(row, nameColumn);
  const variant = normalizedValue(row, variantColumn);
  if (name && variant) return `${name} | ${variant}`;
  return name || code || undefined;
}

/** Creates one immutable issue and assigns a stable identifier within the snapshot. */
function addIssue(
  issues: DataIssue[],
  input: Omit<DataIssue, "id">,
): DataIssue {
  const id = `${input.issueCode}:${input.sourceRow}:${input.field ?? "row"}:${issues.length + 1}`;
  const issue = Object.freeze({ id, ...input });
  issues.push(issue);
  return issue;
}

/** Detects the safe column-level date formats supported for confirmation. */
export function detectDateFormatCandidate(
  dataset: ParsedDataset,
  sourceColumnId: string,
): DateFormatDetection {
  const column = dataset.columns.find((candidate) => candidate.id === sourceColumnId);
  if (!column) throw new Error(`Unknown source column: ${sourceColumnId}.`);
  const values = dataset.rows
    .map((row) => row.normalizedValues[column.index] ?? "")
    .filter((value) => value !== "");
  if (values.length === 0) {
    return Object.freeze({ sourceColumnId, state: "empty", candidates: Object.freeze([]) });
  }

  const isoCount = values.filter((value) => parseIsoDate(value) !== undefined).length;
  if (isoCount === values.length) {
    return Object.freeze({ sourceColumnId, state: "iso", candidates: Object.freeze([]) });
  }
  if (isoCount > 0) {
    return Object.freeze({ sourceColumnId, state: "unsupported", candidates: Object.freeze([]) });
  }

  const candidates = CONFIRMABLE_DATE_FORMATS.filter((format) =>
    values.every((value) => parseConfirmedDate(value, format) !== undefined));
  return Object.freeze({
    sourceColumnId,
    state: candidates.length === 0 ? "unsupported" : candidates.length === 1 ? "candidate" : "ambiguous",
    candidates: Object.freeze(candidates),
  });
}

/** Validates that every date confirmation applies consistently to its full column. */
function confirmationMap(
  dataset: ParsedDataset,
  confirmations: readonly DateFormatConfirmation[],
): ReadonlyMap<string, DateFormatConfirmation> {
  const mapped = new Map<string, DateFormatConfirmation>();
  for (const confirmation of confirmations) {
    if (mapped.has(confirmation.sourceColumnId)) {
      throw new Error(`Date column ${confirmation.sourceColumnId} has more than one confirmation.`);
    }
    const detection = detectDateFormatCandidate(dataset, confirmation.sourceColumnId);
    if (!detection.candidates.includes(confirmation.format)) {
      throw new Error(`Confirmed format ${confirmation.format} is not consistent with column ${confirmation.sourceColumnId}.`);
    }
    if (!confirmation.confirmationId.trim()) {
      throw new Error("A date-format confirmation must include a confirmationId.");
    }
    mapped.set(confirmation.sourceColumnId, Object.freeze({ ...confirmation }));
  }
  return mapped;
}

/** Interprets one mapped date without guessing an unconfirmed format. */
function interpretDate(
  row: ParsedRow,
  column: MappedColumn,
  confirmations: ReadonlyMap<string, DateFormatConfirmation>,
  detection: DateFormatDetection,
  invalidCode: "INVALID_DATE" | "INVALID_STOCK_DATE",
): DateInterpretation {
  const current = normalizedValue(row, column);
  if (current === "") return Object.freeze({ issueCode: invalidCode });
  const iso = parseIsoDate(current);
  if (iso) return Object.freeze({ value: formatIsoDate(iso) });

  const confirmation = confirmations.get(column.id);
  if (!confirmation) {
    return Object.freeze({
      issueCode: detection.state === "candidate" || detection.state === "ambiguous"
        ? "DATE_FORMAT_CONFIRMATION_REQUIRED"
        : invalidCode,
    });
  }

  const interpreted = parseConfirmedDate(current, confirmation.format);
  if (!interpreted) return Object.freeze({ issueCode: invalidCode });
  const result = formatIsoDate(interpreted);
  return Object.freeze({
    value: result,
    normalization: Object.freeze({
      sourceRow: row.sourceRow,
      sourceColumn: column.header,
      originalValue: current,
      resultingValue: result,
      normalizationType: "confirmed_date_format",
      confirmationId: confirmation.confirmationId,
    }),
  });
}

/** Encodes one cell with a byte-length prefix for unambiguous hashing. */
function lengthPrefixed(value: string): string {
  return `${new TextEncoder().encode(value).byteLength}:${value}`;
}

/** Calculates the exact duplicate fingerprint for all normalized source cells. */
async function duplicateFingerprint(values: readonly string[]): Promise<string> {
  const bytes = new TextEncoder().encode(values.map(lengthPrefixed).join(""));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

/** Replaces confirmed date representations before duplicate fingerprinting. */
function applyConfirmedDatesToFingerprint(
  values: string[],
  dataset: ParsedDataset,
  confirmations: ReadonlyMap<string, DateFormatConfirmation>,
): void {
  for (const confirmation of confirmations.values()) {
    const column = dataset.columns.find((candidate) => candidate.id === confirmation.sourceColumnId);
    if (!column) continue;
    const interpreted = parseConfirmedDate(values[column.index] ?? "", confirmation.format);
    if (interpreted) values[column.index] = formatIsoDate(interpreted);
  }
}

/** Adds optional stock conflicts and produces one snapshot per identified product. */
function buildProductStockEvidence(
  drafts: readonly RowDraft[],
  issues: DataIssue[],
  analysisDate: string,
  currentStockMapped: boolean,
  stockDateMapped: boolean,
): readonly ProductStockEvidence[] {
  if (!currentStockMapped && !stockDateMapped) return Object.freeze([]);
  const byProduct = new Map<string, RowDraft[]>();
  for (const row of drafts) {
    if (!row.productKey) continue;
    byProduct.set(row.productKey, [...(byProduct.get(row.productKey) ?? []), row]);
  }

  const evidence: ProductStockEvidence[] = [];
  for (const [productKey, rows] of [...byProduct.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const stockRows = rows.filter((row) => row.interpretedValues.currentStock !== undefined);
    const dateRows = rows.filter((row) => row.interpretedValues.stockAsOfDate !== undefined);
    const stockValues = [...new Set(stockRows.map((row) => row.interpretedValues.currentStock!))];
    const dateValues = [...new Set(dateRows.map((row) => row.interpretedValues.stockAsOfDate!))];
    const reasonCodes = new Set<string>();

    if (stockValues.length > 1) {
      reasonCodes.add("CONFLICTING_CURRENT_STOCK");
      for (const row of stockRows) {
        const issue = addIssue(issues, {
          sourceRow: row.sourceRow,
          productKey,
          originalProductHint: row.originalProductHint,
          issueCode: "CONFLICTING_CURRENT_STOCK",
          field: "current_stock",
          observedValue: String(row.interpretedValues.currentStock),
          reason: "This product has more than one different nonblank current-stock value.",
          correctiveAction: "Confirm one product-level current-stock snapshot in the source file.",
          resolutionState: "unresolved",
        });
        row.issueIds.push(issue.id);
      }
    }
    if (dateValues.length > 1) {
      reasonCodes.add("CONFLICTING_STOCK_DATE");
      for (const row of dateRows) {
        const issue = addIssue(issues, {
          sourceRow: row.sourceRow,
          productKey,
          originalProductHint: row.originalProductHint,
          issueCode: "CONFLICTING_STOCK_DATE",
          field: "stock_as_of_date",
          observedValue: row.interpretedValues.stockAsOfDate!,
          reason: "This product has more than one different nonblank stock snapshot date.",
          correctiveAction: "Confirm one product-level stock snapshot date in the source file.",
          resolutionState: "unresolved",
        });
        row.issueIds.push(issue.id);
      }
    }

    const productIssues = issues.filter((issue) => issue.productKey === productKey);
    for (const issue of productIssues) {
      const currentStockIssue = issue.field === "current_stock"
        && ["INVALID_CURRENT_STOCK", "MISSING_CURRENT_STOCK"].includes(issue.issueCode);
      const stockDateIssue = issue.field === "stock_as_of_date"
        && [
          "DATE_FORMAT_CONFIRMATION_REQUIRED",
          "INVALID_STOCK_DATE",
          "MISSING_STOCK_DATE",
          "FUTURE_STOCK_DATE",
        ].includes(issue.issueCode);
      if (currentStockIssue || stockDateIssue) {
        reasonCodes.add(issue.issueCode);
      }
    }

    const currentStock = stockValues.length === 1 && !reasonCodes.has("CONFLICTING_CURRENT_STOCK")
      ? stockValues[0]
      : undefined;
    const stockAsOfDate = dateValues.length === 1 && !reasonCodes.has("CONFLICTING_STOCK_DATE")
      ? dateValues[0]
      : undefined;
    const freshness = evaluateStockFreshness(stockAsOfDate, analysisDate);
    if (freshness.reasonCode) reasonCodes.add(freshness.reasonCode);
    if (currentStock === undefined) reasonCodes.add("MISSING_OR_INVALID_CURRENT_STOCK");

    evidence.push(Object.freeze({
      productKey,
      currentStock,
      stockAsOfDate,
      freshness,
      usableForCover: currentStock !== undefined
        && freshness.state !== "unusable"
        && !reasonCodes.has("CONFLICTING_CURRENT_STOCK")
        && !reasonCodes.has("CONFLICTING_STOCK_DATE"),
      reasonCodes: Object.freeze([...reasonCodes].sort()),
    }));
  }
  return Object.freeze(evidence);
}

/** Calculates and verifies the exact terminal row-state reconciliation. */
function reconcileRows(
  rows: readonly RowDraft[],
  normalizations: readonly NormalizationEvent[],
): ReconciliationSummary {
  const rowsUsed = rows.filter((row) => row.useState === "used").length;
  const rowsExcluded = rows.filter((row) => row.useState === "excluded").length;
  const usedRows = new Set(rows.filter((row) => row.useState === "used").map((row) => row.sourceRow));
  const normalizedUsedRows = new Set(
    normalizations
      .filter((event) => usedRows.has(event.sourceRow))
      .map((event) => event.sourceRow),
  );
  const summary = Object.freeze({
    rowsIn: rows.length,
    rowsUsed,
    rowsExcluded,
    rowsSafelyNormalized: normalizedUsedRows.size,
  });
  if (summary.rowsIn !== summary.rowsUsed + summary.rowsExcluded) {
    throw new Error("Row reconciliation failed: rowsIn must equal rowsUsed plus rowsExcluded.");
  }
  return summary;
}

/** Validates mapped rows and returns immutable readiness evidence for later selectors. */
export async function runReadinessCheck(
  dataset: ParsedDataset,
  mapping: MappingState,
  options: ReadinessOptions,
): Promise<ReadinessSnapshot> {
  if (!parseIsoDate(options.analysisDate)) {
    throw new Error("analysisDate must be a valid ISO YYYY-MM-DD date.");
  }
  const blockers = getReadinessBlockers(mapping);
  if (blockers.length > 0) {
    throw new Error(`Readiness requires confirmed mappings for: ${blockers.join(", ")}.`);
  }

  const transactionDateColumn = mappedColumn(dataset, mapping, "transaction_date")!;
  const quantityColumn = mappedColumn(dataset, mapping, "quantity_sold")!;
  const codeColumn = mappedColumn(dataset, mapping, "product_code");
  const nameColumn = mappedColumn(dataset, mapping, "product_name");
  const variantColumn = mappedColumn(dataset, mapping, "pack_variant");
  const currentStockColumn = mappedColumn(dataset, mapping, "current_stock");
  const stockDateColumn = mappedColumn(dataset, mapping, "stock_as_of_date");
  const confirmations = confirmationMap(dataset, options.dateConfirmations ?? []);
  const transactionDateDetection = detectDateFormatCandidate(dataset, transactionDateColumn.id);
  const stockDateDetection = stockDateColumn
    ? detectDateFormatCandidate(dataset, stockDateColumn.id)
    : undefined;
  const issues: DataIssue[] = [];
  const normalizations: NormalizationEvent[] = dataset.normalizations.map((event) => {
    const column = dataset.columns.find((candidate) => candidate.id === event.sourceColumn);
    return Object.freeze({ ...event, sourceColumn: column?.header ?? event.sourceColumn });
  });
  const drafts: RowDraft[] = [];

  for (const row of dataset.rows) {
    const productCode = normalizedValue(row, codeColumn) || undefined;
    const productName = normalizedValue(row, nameColumn) || undefined;
    const packVariant = normalizedValue(row, variantColumn) || undefined;
    const hint = originalProductHint(row, codeColumn, nameColumn, variantColumn);
    const productKey = buildProductKey({ productCode, productName, packVariant }, mapping.identityMode!);
    const issueIds: string[] = [];
    const fingerprintValues = [...row.normalizedValues];
    applyConfirmedDatesToFingerprint(fingerprintValues, dataset, confirmations);

    const date = interpretDate(
      row,
      transactionDateColumn,
      confirmations,
      transactionDateDetection,
      "INVALID_DATE",
    );
    if (date.normalization) normalizations.push(date.normalization);
    if (date.value) fingerprintValues[transactionDateColumn.index] = date.value;
    if (date.issueCode) {
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        productKey,
        originalProductHint: hint,
        issueCode: date.issueCode,
        field: "transaction_date",
        sourceColumn: transactionDateColumn.header,
        observedValue: originalValue(row, transactionDateColumn),
        reason: date.issueCode === "DATE_FORMAT_CONFIRMATION_REQUIRED"
          ? "The date uses a non-ISO format that has not been confirmed for this column."
          : "The sale date is blank or is not a valid date under the confirmed column format.",
        correctiveAction: date.issueCode === "DATE_FORMAT_CONFIRMATION_REQUIRED"
          ? "Confirm the column-level date format, or export dates as YYYY-MM-DD."
          : "Enter a real date using YYYY-MM-DD or the one confirmed column format.",
        resolutionState: "unresolved",
      });
      issueIds.push(issue.id);
    }

    const quantityText = normalizedValue(row, quantityColumn);
    const quantitySold = parseFiniteDecimal(quantityText);
    if (quantitySold === undefined) {
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        productKey,
        originalProductHint: hint,
        issueCode: "INVALID_QUANTITY",
        field: "quantity_sold",
        sourceColumn: quantityColumn.header,
        observedValue: originalValue(row, quantityColumn),
        reason: "Quantity sold is blank or is not a finite decimal number.",
        correctiveAction: "Enter a decimal number using a dot as the decimal separator.",
        resolutionState: "unresolved",
      });
      issueIds.push(issue.id);
    }

    if (!productKey) {
      const identityFields = mapping.identityMode === "stable"
        ? ["product_code"] as const
        : ["product_name", "pack_variant"] as const;
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        originalProductHint: hint,
        issueCode: "MISSING_IDENTITY",
        field: identityFields.find((field) => !normalizedValue(row, mappedColumn(dataset, mapping, field))),
        observedValue: hint ?? "",
        reason: mapping.identityMode === "stable"
          ? "The confirmed product-code identity is blank on this row."
          : "The confirmed product name and pack size identity is incomplete on this row.",
        correctiveAction: "Complete the confirmed product identity fields in the source file.",
        resolutionState: "unresolved",
      });
      issueIds.push(issue.id);
    }

    const currentStockText = normalizedValue(row, currentStockColumn);
    const currentStock = currentStockText === "" ? undefined : parseFiniteDecimal(currentStockText);
    if (currentStockColumn && currentStockText !== "" && (currentStock === undefined || currentStock < 0)) {
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        productKey,
        originalProductHint: hint,
        issueCode: "INVALID_CURRENT_STOCK",
        field: "current_stock",
        sourceColumn: currentStockColumn.header,
        observedValue: originalValue(row, currentStockColumn),
        reason: "Stock on hand must be a finite non-negative decimal.",
        correctiveAction: "Enter a non-negative stock quantity or leave the optional value blank.",
        resolutionState: "unresolved",
      });
      issueIds.push(issue.id);
    }

    let stockAsOfDate: string | undefined;
    if (stockDateColumn && normalizedValue(row, stockDateColumn) !== "") {
      const stockDate = interpretDate(
        row,
        stockDateColumn,
        confirmations,
        stockDateDetection!,
        "INVALID_STOCK_DATE",
      );
      if (stockDate.normalization) normalizations.push(stockDate.normalization);
      stockAsOfDate = stockDate.value;
      if (stockDate.value) fingerprintValues[stockDateColumn.index] = stockDate.value;
      if (stockDate.issueCode) {
        const issue = addIssue(issues, {
          sourceRow: row.sourceRow,
          productKey,
          originalProductHint: hint,
          issueCode: stockDate.issueCode,
          field: "stock_as_of_date",
          sourceColumn: stockDateColumn.header,
          observedValue: originalValue(row, stockDateColumn),
          reason: stockDate.issueCode === "DATE_FORMAT_CONFIRMATION_REQUIRED"
            ? "The stock date uses a non-ISO format that has not been confirmed for this column."
            : "The stock snapshot date is not valid under the confirmed column format.",
          correctiveAction: stockDate.issueCode === "DATE_FORMAT_CONFIRMATION_REQUIRED"
            ? "Confirm the column-level date format, or export dates as YYYY-MM-DD."
            : "Enter a real stock snapshot date using YYYY-MM-DD or the confirmed format.",
          resolutionState: "unresolved",
        });
        issueIds.push(issue.id);
      } else if (stockAsOfDate && evaluateStockFreshness(stockAsOfDate, options.analysisDate).reasonCode === "FUTURE_STOCK_DATE") {
        const issue = addIssue(issues, {
          sourceRow: row.sourceRow,
          productKey,
          originalProductHint: hint,
          issueCode: "FUTURE_STOCK_DATE",
          field: "stock_as_of_date",
          sourceColumn: stockDateColumn.header,
          observedValue: originalValue(row, stockDateColumn),
          reason: "The stock snapshot date is later than the analysis date.",
          correctiveAction: "Correct the snapshot date so it is not in the future.",
          resolutionState: "unresolved",
        });
        issueIds.push(issue.id);
      }
    }

    if (currentStockColumn && currentStockText !== "" && stockDateColumn && normalizedValue(row, stockDateColumn) === "") {
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        productKey,
        originalProductHint: hint,
        issueCode: "MISSING_STOCK_DATE",
        field: "stock_as_of_date",
        sourceColumn: stockDateColumn.header,
        observedValue: "",
        reason: "Stock on hand is present without its stock count date.",
        correctiveAction: "Enter the date when the current-stock count was measured.",
        resolutionState: "unresolved",
      });
      issueIds.push(issue.id);
    }
    if (stockDateColumn && normalizedValue(row, stockDateColumn) !== "" && currentStockColumn && currentStockText === "") {
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        productKey,
        originalProductHint: hint,
        issueCode: "MISSING_CURRENT_STOCK",
        field: "current_stock",
        sourceColumn: currentStockColumn.header,
        observedValue: "",
        reason: "A stock snapshot date is present without a current-stock value.",
        correctiveAction: "Enter the non-negative current-stock count measured on that date.",
        resolutionState: "unresolved",
      });
      issueIds.push(issue.id);
    }

    const interpretedValues = Object.freeze({
      transactionDate: date.value,
      quantitySold,
      productCode,
      productName,
      packVariant,
      currentStock: currentStock !== undefined && currentStock >= 0 ? currentStock : undefined,
      stockAsOfDate,
    });
    const hasCoreIssue = date.value === undefined || quantitySold === undefined || productKey === undefined;
    drafts.push({
      sourceRow: row.sourceRow,
      productKey,
      originalProductHint: hint,
      originalValues: row.originalValues,
      normalizedValues: row.normalizedValues,
      interpretedValues,
      fingerprintValues,
      duplicateFingerprint: "",
      useState: hasCoreIssue ? "excluded" : "used",
      issueIds,
    });
  }

  // Bound concurrent Web Crypto work so a near-limit file cannot create
  // tens of thousands of digest promises at once.
  const fingerprintBatchSize = 256;
  for (let start = 0; start < drafts.length; start += fingerprintBatchSize) {
    await Promise.all(drafts.slice(start, start + fingerprintBatchSize).map(async (row) => {
      row.duplicateFingerprint = await duplicateFingerprint(row.fingerprintValues);
    }));
  }

  const byFingerprint = new Map<string, RowDraft[]>();
  for (const row of drafts) {
    byFingerprint.set(row.duplicateFingerprint, [...(byFingerprint.get(row.duplicateFingerprint) ?? []), row]);
  }
  const duplicateGroups: DuplicateGroup[] = [];
  const productLimitations: ProductLimitation[] = [];
  for (const [fingerprint, members] of [...byFingerprint.entries()].filter(([, rows]) => rows.length > 1)) {
    members.sort((left, right) => left.sourceRow - right.sourceRow);
    const decision = options.duplicateDecisions?.[fingerprint] ?? "unresolved";
    duplicateGroups.push(Object.freeze({
      fingerprint,
      sourceRows: Object.freeze(members.map((row) => row.sourceRow)),
      productKeys: Object.freeze([...new Set(members.map((row) => row.productKey).filter((value): value is string => Boolean(value)))].sort()),
      decision,
    }));

    for (const row of members) {
      const issue = addIssue(issues, {
        sourceRow: row.sourceRow,
        productKey: row.productKey,
        originalProductHint: row.originalProductHint,
        issueCode: "DUPLICATE_CANDIDATE",
        observedValue: fingerprint,
        reason: "Every source cell matches another record after permitted representation normalization.",
        correctiveAction: decision === "unresolved"
          ? "Choose “keep both” or “these are duplicates” for this exact-match group."
          : "The retailer has reviewed this exact-match group.",
        resolutionState: decision === "unresolved" ? "unresolved" : "resolved",
      });
      row.issueIds.push(issue.id);
    }

    if (decision === "treat_as_duplicate") {
      for (const row of members.slice(1)) {
        row.useState = "excluded";
        const issue = addIssue(issues, {
          sourceRow: row.sourceRow,
          productKey: row.productKey,
          originalProductHint: row.originalProductHint,
          issueCode: "DUPLICATE_CONFIRMED",
          observedValue: fingerprint,
          reason: `The retailer confirmed this row duplicates source row ${members[0].sourceRow}.`,
          correctiveAction: "Remove the repeated source record if the source spreadsheet should be corrected.",
          resolutionState: "resolved",
        });
        row.issueIds.push(issue.id);
      }
    } else if (decision === "unresolved") {
      for (const productKey of new Set(members.map((row) => row.productKey).filter((value): value is string => Boolean(value)))) {
        productLimitations.push(Object.freeze({
          productKey,
          code: "DUPLICATE_UNRESOLVED",
          message: "An exact duplicate group is awaiting a retailer decision, so this product has Limited data.",
        }));
      }
    }
  }

  const productStock = buildProductStockEvidence(
    drafts,
    issues,
    options.analysisDate,
    currentStockColumn !== undefined,
    stockDateColumn !== undefined,
  );
  const reconciliation = reconcileRows(drafts, normalizations);
  const rows: readonly ValidatedRow[] = Object.freeze(drafts.map((row) => Object.freeze({
    sourceRow: row.sourceRow,
    productKey: row.productKey,
    originalProductHint: row.originalProductHint,
    originalValues: Object.freeze([...row.originalValues]),
    normalizedValues: Object.freeze([...row.normalizedValues]),
    interpretedValues: row.interpretedValues,
    duplicateFingerprint: row.duplicateFingerprint,
    useState: row.useState,
    issueIds: Object.freeze([...row.issueIds]),
  })));

  return Object.freeze({
    id: globalThis.crypto.randomUUID(),
    sourceMode: dataset.sourceMode,
    sourceName: dataset.sourceName,
    sourceSha256: dataset.sourceSha256,
    analysisDate: options.analysisDate,
    rows,
    issues: Object.freeze([...issues]),
    normalizations: Object.freeze(normalizations.map((event) => Object.freeze({ ...event }))),
    duplicateGroups: Object.freeze(duplicateGroups),
    reconciliation,
    productStock,
    productLimitations: Object.freeze(productLimitations),
  });
}
