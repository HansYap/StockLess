import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReadinessOverview } from "../src/screens/ReadinessOverview.tsx";
import { ReadinessCharts } from "../src/screens/ReadinessCharts.tsx";
import { buildProductTimelines } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => { cleanup(); setLanguage("en"); });
describe("Readiness product overview", () => {
  it("reconciles each excluded row once and filters from the four active chart cards", () => {
    const { snapshot } = makeEvidence();
    const sourceRow = snapshot.rows[0].sourceRow;
    const issue = {
      id: "date-issue", sourceRow, issueCode: "INVALID_DATE" as const,
      observedValue: "bad", reason: "Invalid date", correctiveAction: "Fix date", resolutionState: "unresolved" as const,
    };
    const changed = {
      ...snapshot,
      rows: snapshot.rows.map((row, index) => index === 0 ? { ...row, useState: "excluded" as const } : row),
      issues: [issue, { ...issue, id: "quantity-issue", issueCode: "INVALID_QUANTITY" as const }],
      reconciliation: { ...snapshot.reconciliation, rowsUsed: snapshot.rows.length - 1, rowsExcluded: 1 },
    };
    const onFilter = vi.fn();
    render(<ReadinessCharts snapshot={changed} filter={null} onFilter={onFilter} />);
    expect(document.querySelectorAll(".issue")).toHaveLength(4);
    expect(screen.getByText(`${snapshot.rows.length} → ${snapshot.rows.length - 1} + 1`)).toBeTruthy();
    const quality = screen.getByRole("region", { name: "Data quality by row" });
    expect(within(quality).getByText("Date issues").closest("li")?.textContent).toContain("1");
    expect(within(quality).getByText("Quantity issues").closest("li")?.textContent).toContain("0");
    fireEvent.click(screen.getByRole("button", { name: "Filter: Date issues" }));
    expect(onFilter).toHaveBeenCalledWith("dates");
  });
  it("separates clean products from incomplete histories and searches by displayed SKU", () => {
    const { snapshot } = makeEvidence();
    render(<ReadinessOverview snapshot={snapshot} timelines={buildProductTimelines(snapshot)} />);
    expect(screen.getByText("3 products checked").textContent).toContain("3");
    expect(document.querySelectorAll(".pcard")).toHaveLength(3);
    const summary = screen.getByRole("region", { name: "Product readiness summary" });
    expect(within(summary).getByRole("button", { name: /1 products ready/ })).toBeTruthy();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "SKU 000202" } });
    expect(document.querySelectorAll(".pcard")).toHaveLength(1);
    expect(document.querySelector(".pcard__code")?.textContent).toContain("000202");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "absent" } });
    expect(screen.getByRole("status").textContent).toBe("No matching products.");
  });
  it("shows missing stock separately and preserves missing weeks instead of plotting them as zero", () => {
    setLanguage("zh");
    const { snapshot } = makeEvidence();
    const input = { ...snapshot, productStock: snapshot.productStock.filter(stock => stock.productKey !== "B") };
    render(<ReadinessOverview snapshot={input} timelines={buildProductTimelines(input)} />);
    const card = [...document.querySelectorAll(".pcard")].find(card => card.textContent?.includes("000202"))!;
    expect(card.className).toContain("pcard--review");
    expect(card.querySelector(".rd-pill")?.textContent).toBe("需查看");
    expect(card.querySelectorAll(".spark__bar--missing")).toHaveLength(2);
    expect(card.querySelector(".spark")?.getAttribute("aria-label")).toContain("缺失");
  });
});
