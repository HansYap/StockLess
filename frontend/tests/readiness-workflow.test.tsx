import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ReadinessScreen, findingsCsv } from "../src/screens/ReadinessScreen.tsx";
import { ReadinessOverview } from "../src/screens/ReadinessOverview.tsx";
import { foodCategory } from "../src/readiness/categories.ts";
import { buildFindings, buildReadinessProducts } from "../src/readiness/model.ts";
import { buildProductTimelines, createMappingState, type ParsedDataset } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => { setLanguage("en"); });
describe("readiness workflow", () => {
  it("classifies multilingual names with phrase priority, word boundaries and unknown fallback", () => {
    for (const name of ["Orange juice", "Kopi O", "奶茶"]) expect(foodCategory(name)).toBe("Beverages");
    for (const name of ["Keropok Ikan", "Milk chocolate", "巧克力"]) expect(foodCategory(name)).toBe("Snacks");
    expect(foodCategory("Sabun Cuci")).toBe("Non-food");
    expect(foodCategory("Sardin Ayam Brand")).toBe("Cooking & canned");
    expect(foodCategory("Beras Wangi")).toBe("Staples");
    expect(foodCategory("鸡蛋")).toBe("Fresh & dairy");
    expect(foodCategory("Steak")).toBe("Other / unknown");
    expect(foodCategory("MM0008")).toBe("Other / unknown");
  });
  it("searches ready products too, combines status and category, and opens evidence in a dialog", () => {
    const { snapshot } = makeEvidence();
    const changed = { ...snapshot, rows: snapshot.rows.map(row => ({ ...row, interpretedValues: { ...row.interpretedValues, productName: row.productKey === "A" ? "Kopi O" : "Beras Wangi" } })) };
    render(<ReadinessOverview snapshot={changed} timelines={buildProductTimelines(changed)} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "000101" } });
    expect(document.querySelectorAll(".pcard")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "View details: Kopi O · 000101" }));
    const dialog = document.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(within(dialog).getAllByRole("row")).toHaveLength(9);
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(dialog.hasAttribute("open")).toBe(false);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("tab", { name: /Staples/ }));
    fireEvent.click(screen.getByRole("button", { name: /1 products ready/ }));
    expect(screen.getByText("No matching products.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(document.querySelectorAll(".pcard")).toHaveLength(2);
  });
  it("combines finding filters, keeps duplicates in completed tidy-ups and exports safe, traceable values", () => {
    const { snapshot } = makeEvidence();
    const first = snapshot.rows[0];
    const changed = { ...snapshot, duplicateGroups: [{ fingerprint: "dup", sourceRows: [2, 3], productKeys: ["A"], decision: "treat_as_duplicate" as const }],
      issues: [{ id: "sale", sourceRow: first.sourceRow, productKey: first.productKey, issueCode: "UNUSUAL_SALE" as const, observedValue: "2300", reason: "Check large sale", correctiveAction: "Still counted", resolutionState: "unresolved" as const }],
      normalizations: [{ sourceRow: first.sourceRow, sourceColumn: "sku", originalValue: " A ", resultingValue: "A", normalizationType: "trim_whitespace" as const }],
    };
    const dataset: ParsedDataset = { sourceName: "sales.csv", sourceMode: "user", sourceSha256: "hash", sourceByteLength: 1, delimiter: ",", columns: [], rows: [], normalizations: [] };
    const onContinue = vi.fn();
    render(<ReadinessScreen dataset={dataset} mapping={createMappingState()} snapshot={changed} dateConfirmations={[]} checking={false} error={null} forecasting={false} forecastError={null} filter={null} onFilter={() => {}} onConfirmDateFormat={() => {}} onBack={() => {}} onContinue={onContinue} reportFilename="problems.csv" />);
    const findingsRegion = screen.getByRole("region", { name: "What we found" });
    expect(within(findingsRegion).getByText("Safe tidy-ups applied")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add filter +" }));
    const menu = screen.getByRole("dialog", { name: "Add filter" });
    fireEvent.click(within(menu).getByRole("button", { name: "Status / shown" }));
    fireEvent.click(within(menu).getByRole("button", { name: /Done/ }));
    fireEvent.click(within(menu).getByRole("button", { name: "← All filters" }));
    fireEvent.click(within(menu).getByRole("button", { name: "Issue type" }));
    fireEvent.click(within(menu).getByRole("button", { name: /Other things to check/ }));
    fireEvent.click(within(menu).getByRole("button", { name: "Apply filters", exact: true }));
    expect(within(findingsRegion).getByText("Nothing matches these filters.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove filter: Issue type" }));
    expect(within(findingsRegion).getByText("Safe tidy-ups applied")).toBeTruthy();
    const products = buildReadinessProducts(changed, buildProductTimelines(changed));
    const findings = buildFindings(changed, products);
    const csv = findingsCsv(findings.map(item => ({ ...item, name: "=SUM(1)" })), "sales.csv", changed.analysisDate);
    expect(csv).toContain("'\u003dSUM(1)");
    expect(csv).toContain('"2, 3"');
    expect(csv).toContain('"" A "" → ""A""');
    expect(csv).not.toContain("duplicateFingerprint");
  });
});
