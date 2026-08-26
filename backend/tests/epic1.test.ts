import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_FIELDS,
  CsvImportError,
  FIELD_REGISTRY,
  PERSISTENCE_POLICY,
  UPLOAD_REQUIREMENTS,
  applyBijectiveDisplayRename,
  assertEveryFieldUnlocksCapability,
  buildProductKey,
  canProceedToMapping,
  clearActiveSession,
  confirmIdentityMode,
  confirmMapping,
  correctionReportMetadata,
  createEmptySession,
  createMappingState,
  detectIdentityConflicts,
  evaluateCapabilities,
  getReadinessBlockers,
  parseCsvBytes,
  partitionCapabilities,
  proposeMappings,
  recordConfirmedIdentity,
  replaceSessionSource,
  setMapping,
  updateSessionMapping,
  MappingConflictError,
} from "../src/index.ts";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

async function datasetFrom(csv: string, sourceMode: "user" | "sample" = "user") {
  return parseCsvBytes(encode(csv), {
    sourceMode,
    sourceName: sourceMode === "sample" ? "sample.csv" : "retailer.csv",
    mimeType: "text/csv",
  });
}

test("E1.US1.1.AC1-AC3: registry describes every field and both valid core paths", () => {
  assert.equal(UPLOAD_REQUIREMENTS.maxBytes, 10 * 1024 * 1024);
  assert.equal(UPLOAD_REQUIREMENTS.maxRows, 100_000);
  assert.equal(FIELD_REGISTRY.transaction_date.status, "core");
  assert.equal(FIELD_REGISTRY.quantity_sold.status, "core");
  assert.equal(FIELD_REGISTRY.planned_order_quantity.status, "later_locked");
  assert.doesNotThrow(assertEveryFieldUnlocksCapability);
  assert.equal(CANONICAL_FIELDS.length, 15);
});

test("E1.US1.3.AC1 and AC3: shuffled semicolon CSV parses without mutating source bytes", async () => {
  const bytes = encode("qty_sold;sku;sale_date\r\n12;000123;2026-08-03\r\n-2;000123;2026-08-04\r\n");
  const before = new Uint8Array(bytes);
  const dataset = await parseCsvBytes(bytes, {
    sourceMode: "user",
    sourceName: "export.csv",
    mimeType: "text/csv",
  });

  assert.equal(dataset.delimiter, ";");
  assert.deepEqual(dataset.columns.map((column) => column.header), ["qty_sold", "sku", "sale_date"]);
  assert.equal(dataset.rows.length, 2);
  assert.equal(canProceedToMapping(dataset), true);
  assert.deepEqual(bytes, before);
  assert.match(dataset.sourceSha256, /^[a-f0-9]{64}$/);
});

test("E1.US1.3.AC4: parser exposes progress and cancellation hooks for a worker adapter", async () => {
  const phases: string[] = [];
  await parseCsvBytes(encode("a,b\n1,2"), {
    sourceMode: "user",
    sourceName: "export.csv",
    onProgress: (progress) => phases.push(progress.phase),
  });
  assert.ok(phases.includes("decode"));
  assert.ok(phases.includes("parse"));
  assert.equal(phases.at(-1), "complete");

  const controller = new AbortController();
  controller.abort(new Error("cancelled"));
  await assert.rejects(
    () => parseCsvBytes(encode("a,b\n1,2"), {
      sourceMode: "user",
      sourceName: "export.csv",
      signal: controller.signal,
    }),
    /cancelled/,
  );
});

test("E1.US1.3.AC1: quoted commas, escaped quotes, CRLF/LF, and tab delimiters are supported", async () => {
  const quoted = await datasetFrom('sale_date,sku,product_name,qty_sold\n2026-08-03,001,"Sambal, Hot",2\n2026-08-04,001,"Say ""Hi""",3\n');
  assert.equal(quoted.rows[0].normalizedValues[2], "Sambal, Hot");
  assert.equal(quoted.rows[1].normalizedValues[2], 'Say "Hi"');

  const tabbed = await datasetFrom("sale_date\tsku\tqty_sold\r\n2026-08-03\t001\t2");
  assert.equal(tabbed.delimiter, "\t");
});

test("E1.US1.3.AC2: structured errors include a recovery instruction", async () => {
  await assert.rejects(
    () => parseCsvBytes(encode("a,b\n1,2"), { sourceMode: "user", sourceName: "export.xlsx" }),
    (error: unknown) => error instanceof CsvImportError
      && error.code === "UNSUPPORTED_FILE_TYPE"
      && error.recovery.includes(".csv"),
  );

  await assert.rejects(
    () => parseCsvBytes(encode("a,b\n1,2\n3,4"), {
      sourceMode: "user",
      sourceName: "export.csv",
      maxRows: 1,
    }),
    (error: unknown) => error instanceof CsvImportError && error.code === "ROW_LIMIT_EXCEEDED",
  );
});

test("E1.US1.2.AC1-AC3: sample and retailer sources share a pipeline and replace atomically", async () => {
  const empty = createEmptySession({ locale: "en-MY" }, "2026-08-26T00:00:00.000Z");
  const sample = await replaceSessionSource(
    empty,
    encode("sale_date,sku,qty_sold\n2026-08-03,001,2"),
    { sourceMode: "sample", sourceName: "sample.csv" },
  );
  let mapping = setMapping(sample.session.mapping, "transaction_date", "column-0", true);
  mapping = setMapping(mapping, "product_code", "column-1", true);
  mapping = setMapping(mapping, "quantity_sold", "column-2", true);
  mapping = confirmIdentityMode(mapping, "stable");
  const mappedSample = updateSessionMapping(sample, mapping);

  const retailer = await replaceSessionSource(
    mappedSample,
    encode("transaction_date,barcode,quantity_sold\n2026-08-04,999,5\n2026-08-05,999,7"),
    { sourceMode: "user", sourceName: "retailer.csv" },
  );

  assert.equal(sample.session.dataset?.rows.length, 1);
  assert.equal(retailer.session.dataset?.rows.length, 2);
  assert.deepEqual(retailer.session.mapping.mappings, {});
  assert.equal(retailer.preferences.locale, "en-MY");
  assert.notEqual(retailer.session.id, sample.session.id);
});

test("E1.US1.2.AC2: sample report labelling derives from session source", async () => {
  const empty = createEmptySession();
  const sample = await replaceSessionSource(
    empty,
    encode("sale_date,sku,qty_sold\n2026-08-03,001,2"),
    { sourceMode: "sample", sourceName: "sample.csv" },
  );
  assert.deepEqual(correctionReportMetadata(sample.session, "2026-08-26"), {
    filename: "StockLess_SAMPLE_correction_report_2026-08-26.csv",
    sourceMode: "Sample data",
  });
});

test("E1.US1.4.AC1-AC2 and AC6: deterministic proposals remain unconfirmed when AI is unavailable", async () => {
  const dataset = await datasetFrom(
    "sale_date,sku,qty_sold,stock_on_hand,stock_date\n2026-08-03,000123,12,30,2026-08-20",
  );
  const result = await proposeMappings(dataset);
  const dateProposal = result.proposals.find((proposal) => proposal.targetField === "transaction_date")!;
  const identityProposal = result.proposals.find((proposal) => proposal.targetField === "product_code")!;

  assert.equal(result.usedSemanticModel, false);
  assert.match(result.fallbackNotice ?? "", /deterministic/i);
  assert.equal(dateProposal.sourceHeader, "sale_date");
  assert.equal(identityProposal.sourceHeader, "sku");
  assert.equal(dateProposal.confirmed, false);
  assert.equal(dateProposal.scoreBand, "exact_alias");
});

test("E1.US1.4.AC5-AC6: local semantic scorer port is usable and model failure falls back safely", async () => {
  const dataset = await datasetFrom(
    "sold_when,item_ref,amount_moved\n2026-08-03,000123,12",
  );
  const localScorer = {
    kind: "local-browser-model" as const,
    async score(requests: readonly { targetField: string; sourceHeader: string }[]) {
      return requests.map((request) => {
        if (request.targetField === "transaction_date" && request.sourceHeader === "sold when") return 0.99;
        if (request.targetField === "product_code" && request.sourceHeader === "item ref") return 0.99;
        if (request.targetField === "quantity_sold" && request.sourceHeader === "amount moved") return 0.99;
        return 0;
      });
    },
  };
  const semanticResult = await proposeMappings(dataset, localScorer);
  assert.equal(semanticResult.usedSemanticModel, true);
  assert.equal(
    semanticResult.proposals.find((proposal) => proposal.targetField === "transaction_date")?.sourceHeader,
    "sold_when",
  );

  const failingScorer = {
    kind: "local-browser-model" as const,
    async score(): Promise<readonly number[]> {
      throw new Error("model failed");
    },
  };
  const fallbackResult = await proposeMappings(dataset, failingScorer);
  assert.equal(fallbackResult.usedSemanticModel, false);
  assert.match(fallbackResult.fallbackNotice ?? "", /preserved/i);
  assert.equal(dataset.rows.length, 1);
});

test("E1.US1.4.AC2 and AC4: ambiguous date headings stay unconfirmed", async () => {
  const dataset = await datasetFrom(
    "date_a,date_b,product_id,quantity_sold\n2026-08-03,2026-08-04,001,2\n2026-08-10,2026-08-11,001,3",
  );
  const result = await proposeMappings(dataset);
  const proposal = result.proposals.find((item) => item.targetField === "transaction_date")!;
  assert.equal(proposal.sourceColumnId, undefined);
  assert.equal(proposal.scoreBand, "unconfirmed");
});

test("E1.US1.4.AC3: a source column cannot map to incompatible targets", () => {
  let mapping = setMapping(createMappingState(), "product_name", "column-1");
  assert.throws(
    () => setMapping(mapping, "product_code", "column-1"),
    (error: unknown) => error instanceof MappingConflictError && error.existingTarget === "product_name",
  );
  mapping = confirmMapping(mapping, "product_name");
  assert.equal(mapping.mappings.product_name?.confirmed, true);
});

test("E1.US1.4.AC2 and E1.US1.6.AC1: readiness requires confirmed core mappings and identity", () => {
  let mapping = createMappingState();
  mapping = setMapping(mapping, "transaction_date", "column-0", true);
  mapping = setMapping(mapping, "quantity_sold", "column-1", true);
  assert.deepEqual(getReadinessBlockers(mapping), [
    "Product identity (stable code or confirmed product name plus pack variant)",
  ]);

  mapping = setMapping(mapping, "product_code", "column-2", true);
  mapping = confirmIdentityMode(mapping, "stable");
  assert.deepEqual(getReadinessBlockers(mapping), []);
});

test("E1.US1.5.AC1-AC4: capabilities are partitioned and later functions remain locked", () => {
  let mapping = createMappingState();
  mapping = setMapping(mapping, "transaction_date", "column-0", true);
  mapping = setMapping(mapping, "product_code", "column-1", true);
  mapping = setMapping(mapping, "quantity_sold", "column-2", true);
  mapping = confirmIdentityMode(mapping, "stable");

  const capabilities = evaluateCapabilities(mapping, {
    validFields: new Set(["transaction_date", "product_code", "quantity_sold"]),
    hasValidRows: true,
    observedWeekCount: 3,
    recentAverageState: "limited",
  });
  const partitioned = partitionCapabilities(capabilities);

  assert.equal(capabilities.find((item) => item.capability === "weekly_history")?.state, "available");
  assert.equal(capabilities.find((item) => item.capability === "recent_weekly_average")?.state, "limited");
  assert.equal(capabilities.find((item) => item.capability === "weeks_of_cover")?.state, "needs_information");
  assert.equal(capabilities.find((item) => item.capability === "purchase_audit")?.state, "locked");
  assert.ok(partitioned.locked.length >= 3);
});

test("E1.US1.6.AC1-AC3: identity preserves codes and reports traceable conflicts", async () => {
  assert.equal(buildProductKey({ productCode: " 000AbC " }, "stable"), "ID|000AbC");
  assert.equal(
    buildProductKey({ productName: "Sambal", packVariant: "200 g" }, "composite"),
    "COMPOSITE|Sambal|200 g",
  );

  const dataset = await datasetFrom(
    "sale_date,sku,product_name,pack_variant,qty_sold\n"
      + "2026-08-03,001,Sambal,200 g,2\n"
      + "2026-08-04,001,Sambal,500 g,3",
  );
  let mapping = createMappingState();
  mapping = setMapping(mapping, "product_code", "column-1", true);
  mapping = setMapping(mapping, "product_name", "column-2", true);
  mapping = setMapping(mapping, "pack_variant", "column-3", true);
  const conflicts = detectIdentityConflicts(dataset, mapping);
  assert.equal(conflicts[0].code, "CODE_TO_MULTIPLE_VARIANTS");
  assert.deepEqual(conflicts[0].sourceRows, [2, 3]);

  mapping = confirmIdentityMode(mapping, "stable");
  const envelope = updateSessionMapping(createEmptySession(), mapping);
  const evidenced = recordConfirmedIdentity(envelope, "2026-08-26T12:00:00.000Z");
  assert.equal(evidenced.session.identityEvidence.length, 1);
  assert.deepEqual(evidenced.session.identityEvidence[0].sourceColumns, ["column-1"]);
});

test("E1.US1.6.AC4: display renaming is bijective and leaves numeric evidence unchanged", () => {
  const records = [{ productKey: "ID|001", displayName: "Old", netQuantity: 12.5 }];
  const renamed = applyBijectiveDisplayRename(records, { "ID|001": "New" });
  assert.equal(renamed[0].displayName, "New");
  assert.equal(renamed[0].netQuantity, 12.5);
  assert.throws(() => applyBijectiveDisplayRename(
    [
      { productKey: "ID|001", displayName: "A" },
      { productKey: "ID|002", displayName: "B" },
    ],
    { "ID|001": "Same", "ID|002": "Same" },
  ));
});

test("E1.US1.7.AC2-AC3: no retailer persistence is configured and clear removes session data", async () => {
  assert.deepEqual(PERSISTENCE_POLICY.retailerDataStores, []);
  const empty = createEmptySession();
  const active = await replaceSessionSource(
    empty,
    encode("sale_date,sku,qty_sold\n2026-08-03,001,2"),
    { sourceMode: "user", sourceName: "retailer.csv" },
  );
  const cleared = clearActiveSession(active, "2026-08-26T12:00:00.000Z");
  assert.equal(cleared.cleared, true);
  assert.equal(cleared.envelope.session.dataset, undefined);
  assert.deepEqual(cleared.envelope.session.mapping.mappings, {});
  assert.deepEqual(cleared.envelope.session.identityEvidence, []);
  assert.match(cleared.message, /cleared/i);
});
