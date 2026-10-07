import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReadinessScreen } from "../src/screens/ReadinessScreen.tsx";
import { ReadinessEvidenceTable } from "../src/screens/ReadinessEvidenceTable.tsx";
import { ReadinessRowsTab, summariseRows } from "../src/screens/ReadinessRowsTab.tsx";
import { buildFindings, buildReadinessProducts } from "../src/readiness/model.ts";
import { buildProductTimelines, createMappingState, type ParsedDataset } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => { cleanup(); setLanguage("en"); });
function evidence() {
  const { snapshot } = makeEvidence();
  const changed = {
    ...snapshot,
    rows: snapshot.rows.map((row, i) => i < 2 ? { ...row, useState: "excluded" as const } : row),
    reconciliation: { ...snapshot.reconciliation, rowsUsed: snapshot.rows.length - 2, rowsExcluded: 2 },
    issues: [
      { id: "date", sourceRow: 2, issueCode: "INVALID_DATE" as const, observedValue: "bad", reason: "Invalid date", correctiveAction: "Fix date", resolutionState: "unresolved" as const },
      { id: "qty", sourceRow: 2, issueCode: "INVALID_QUANTITY" as const, observedValue: "bad", reason: "Invalid quantity", correctiveAction: "Fix quantity", resolutionState: "unresolved" as const },
    ],
    duplicateGroups: [{ fingerprint: "dup", sourceRows: [3, 4], retainedSourceRow: 4, productKeys: ["A"], decision: "treat_as_duplicate" as const }],
    normalizations: [{ sourceRow: 4, sourceColumn: "sku", originalValue: " A ", resultingValue: "A", normalizationType: "trim_whitespace" as const }],
  };
  const findings = buildFindings(changed, buildReadinessProducts(changed, buildProductTimelines(changed)));
  return { snapshot: changed, findings };
}
describe("readiness views", () => {
  it("counts a row with multiple issues once and separates excluded duplicates from used tidy-ups", () => {
    const { snapshot, findings } = evidence();
    const summary = summariseRows(snapshot, findings);
    expect(summary.reasons.map(item => [item.type, item.count, item.sourceRows])).toEqual([["date", 1, [2]], ["tidy", 1, [3]]]);
    expect(summary.tidied).toBe(1);
    const onShowGroup = vi.fn();
    render(<ReadinessRowsTab snapshot={snapshot} findings={findings} onShowGroup={onShowGroup} onDownload={() => {}} />);
    fireEvent.click(screen.getByRole("radio", { name: /Repeated rows/ }));
    expect(screen.getByText("Nothing to fix")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Show these rows/ }));
    expect(onShowGroup).toHaveBeenCalledWith("tidy");
  });
  it("switches views with the keyboard, opens findings after clearing filters, and retains table pagination", () => {
    const { snapshot } = evidence();
    const changed = { ...snapshot, normalizations: Array.from({ length: 30 }, () => snapshot.normalizations[0]) };
    const dataset: ParsedDataset = { sourceName: "sales.csv", sourceMode: "user", sourceSha256: "hash", sourceByteLength: 1, delimiter: ",", columns: [], rows: [], normalizations: [] };
    render(<ReadinessScreen dataset={dataset} mapping={createMappingState()} snapshot={changed} dateConfirmations={[]} checking={false} error={null} forecasting={false} forecastError={null} filter={null} onFilter={() => {}} onConfirmDateFormat={() => {}} onBack={() => {}} onContinue={() => {}} reportFilename="problems.csv" />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /^Products/ }), { key: "ArrowRight" });
    const panel = screen.getByRole("tabpanel", { name: /^Rows in your file/ });
    expect(document.querySelector("#readiness-view-panel-products")?.hasAttribute("hidden")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Add filter", exact: true }));
    const menu = screen.getByRole("dialog", { name: "Add filter" });
    fireEvent.click(within(menu).getByRole("button", { name: "Status / shown" }));
    fireEvent.click(within(menu).getByRole("button", { name: "Left out" }));
    fireEvent.click(within(menu).getByRole("button", { name: "Apply filters" }));
    fireEvent.click(within(panel).getByRole("radio", { name: /Repeated rows/ }));
    fireEvent.click(within(panel).getByRole("button", { name: /Show these rows/ }));
    expect((document.querySelector("#readiness-finding-tidy") as HTMLDetailsElement).open).toBe(true);
    expect(document.querySelector("#readiness-finding-date summary svg")).toBeTruthy();
    const details = screen.getByText("See every finding as a table").closest("details")!;
    fireEvent.click(within(details).getByText("See every finding as a table"));
    details.open = true;
    expect(within(details).getAllByRole("row")).toHaveLength(26);
    fireEvent.click(within(details).getByRole("button", { name: "Next →" }));
    expect(within(details).getAllByRole("row")).toHaveLength(10);
  });
  it("keeps 10,000 affected rows compact and opens matching, paginated row evidence", () => {
    const { snapshot } = makeEvidence();
    const rows = Array.from({ length: 10000 }, (_, index) => ({ ...snapshot.rows[0], sourceRow: index + 2, useState: index === 9999 ? "used" as const : "excluded" as const }));
    const changed = { ...snapshot, rows, productStock: snapshot.productStock.slice(0, 1), reconciliation: { ...snapshot.reconciliation, rowsIn: 10000, rowsUsed: 1, rowsExcluded: 9999 },
      duplicateGroups: [{ fingerprint: "large-duplicate", sourceRows: rows.map(row => row.sourceRow), retainedSourceRow: 10001, productKeys: ["A"], decision: "treat_as_duplicate" as const }],
      normalizations: [{ sourceRow: 10001, sourceColumn: "sku", originalValue: " A ", resultingValue: "A", normalizationType: "trim_whitespace" as const }],
    };
    const dataset: ParsedDataset = { sourceName: "sales.csv", sourceMode: "user", sourceSha256: "hash", sourceByteLength: 1, delimiter: ",", columns: [], rows: [], normalizations: [] };
    render(<ReadinessScreen dataset={dataset} mapping={createMappingState()} snapshot={changed} dateConfirmations={[]} checking={false} error={null} forecasting={false} forecastError={null} filter={null} onFilter={() => {}} onConfirmDateFormat={() => {}} onBack={() => {}} onContinue={() => {}} reportFilename="problems.csv" />);
    const summary = document.querySelector("#readiness-finding-tidy") as HTMLDetailsElement;
    summary.open = true;
    expect(summary.textContent!.length).toBeLessThan(1200);
    expect(summary.textContent).not.toContain("2, 3, 4, 5");
    fireEvent.click(within(summary).getByRole("button", { name: /View affected rows.*Identical rows/ }));
    const details = screen.getByText("See every finding as a table").closest("details")!;
    expect(details.open).toBe(true);
    const table = within(details).getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(26);
    expect(within(details).getByText("1 / 400")).toBeTruthy();
    expect(within(table).getAllByRole("row")[1].children[0].textContent).toBe("2");
    expect(within(table).getAllByRole("row")[1].lastElementChild?.textContent).toBe("Left out");
    fireEvent.click(within(details).getByRole("button", { name: "Next →" }));
    expect(within(table).getAllByRole("row")[1].children[0].textContent).toBe("27");
    fireEvent.click(within(details).getByRole("button", { name: "Show all findings" }));
    expect(within(details).getByText("1 / 401")).toBeTruthy();
  });
  it("paginates compact groups instead of expanding every tidy-up", () => {
    const { snapshot } = evidence();
    const changed = { ...snapshot, normalizations: Array.from({ length: 30 }, () => snapshot.normalizations[0]) };
    const dataset: ParsedDataset = { sourceName: "sales.csv", sourceMode: "user", sourceSha256: "hash", sourceByteLength: 1, delimiter: ",", columns: [], rows: [], normalizations: [] };
    render(<ReadinessScreen dataset={dataset} mapping={createMappingState()} snapshot={changed} dateConfirmations={[]} checking={false} error={null} forecasting={false} forecastError={null} filter={null} onFilter={() => {}} onConfirmDateFormat={() => {}} onBack={() => {}} onContinue={() => {}} reportFilename="problems.csv" />);
    const group = document.querySelector("#readiness-finding-tidy") as HTMLDetailsElement;
    group.open = true;
    expect(group.querySelectorAll(".rd-finding")).toHaveLength(25);
    fireEvent.click(within(group).getByRole("button", { name: "Next →" }));
    expect(group.querySelectorAll(".rd-finding")).toHaveLength(6);
    expect(within(group).queryByRole("button", { name: /Show all findings/ })).toBeNull();
  });
  it("keeps full observed values and distinguishes excluded and retained duplicate rows", () => {
    const { findings } = evidence();
    const duplicate = findings.find(item => item.id === "dup")!;
    const observed = "Original source value with extra information ".repeat(20);
    render(<ReadinessEvidenceTable findings={[{ ...duplicate, observed }]} selectedFindingId="dup" onClearSelection={() => {}} onDownload={() => {}} />);
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].children[0].textContent).toBe("3");
    expect(rows[0].lastElementChild?.textContent).toBe("Left out");
    expect(rows[1].children[0].textContent).toBe("4");
    expect(rows[1].lastElementChild?.textContent).toBe("Still counted");
    expect(rows[0].children[3].textContent).toBe(observed);
  });
  it("translates the row summary and handles a fully usable file", () => {
    setLanguage("ms");
    const { snapshot } = makeEvidence();
    render(<ReadinessRowsTab snapshot={snapshot} findings={[]} onShowGroup={() => {}} onDownload={() => {}} />);
    expect(screen.getByText("Tiada apa perlu dibaiki. Semua baris boleh digunakan.")).toBeTruthy();
    expect(screen.queryByRole("radiogroup")).toBeNull();
  });
});
