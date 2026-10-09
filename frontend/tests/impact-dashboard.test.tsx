import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ImpactDashboard, calculatePotentialExcess } from "../src/screens/ImpactDashboard.tsx";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

beforeEach(() => setLanguage("en"));
const entered = (value: number) => ({ plannedOrder: { state: "value" as const, value, source: "input by you" as const }, incomingStock: { state: "empty" as const } });
function costEvidence() {
  const original = makeEvidence();
  return { ...original, snapshot: { ...original.snapshot, evidenceKey: "checked-costs", productCosts: [
    { productKey: "A", field: "unit_cost" as const, state: "usable" as const, value: 2.5, sourceRows: [2], sourceColumn: "Unit Cost" },
    { productKey: "B", field: "unit_cost" as const, state: "usable" as const, value: 4, sourceRows: [10], sourceColumn: "Unit Cost" },
  ] } };
}
function summary(title: string): HTMLElement { return screen.getByText(title).parentElement!; }
// The restored design opens the Environmental lens first; business checks open their tab.
function openAnalysis() { expect(screen.getByRole("heading", { name: "Detailed estimates and how they work" })).toBeTruthy(); }
function businessPanel() { openAnalysis(); fireEvent.click(screen.getByRole("tab", { name: /Business/ })); return within(screen.getByRole("tabpanel", { name: "Business" })); }

describe("impact dashboard", () => {
  it("opens the relevant product breakdown from each overview card", () => {
    const { snapshot, forecast } = costEvidence();
    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={{ A: entered(100) }} onBack={() => {}} />);
    const overview = within(screen.getByRole("list", { name: "Your plan at a glance" }));
    expect(overview.getAllByRole("button")).toHaveLength(3);
    expect(overview.getByText("From 2 of 3 products · next 4 weeks")).toBeTruthy();
    expect((document.getElementById("business-breakdown") as HTMLDetailsElement).open).toBe(false);
    expect((document.getElementById("environment-breakdown") as HTMLDetailsElement).open).toBe(false);
    fireEvent.click(overview.getByRole("button", { name: /Possible excess stock/ }));
    expect(document.getElementById("impact-excess-products")).toBeTruthy();
    fireEvent.click(overview.getByRole("button", { name: /Money tied up in excess/ }));
    expect(screen.getByRole("tab", { name: "Business" }).getAttribute("aria-selected")).toBe("true");
    expect((document.getElementById("business-breakdown") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText("Excess-stock cost by product")).toBeTruthy();
    fireEvent.click(overview.getByRole("button", { name: /Estimated CO₂e of excess/ }));
    expect(screen.getByRole("tab", { name: "Environmental" }).getAttribute("aria-selected")).toBe("true");
    expect((document.getElementById("environment-breakdown") as HTMLDetailsElement).open).toBe(true);
    expect(screen.getByText("Why these estimates? Potential excess by product")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Download your results" })).toBeTruthy();
  });
  it("uses checked purchase quantities and excludes products without a usable check", () => {
    const { snapshot, forecast } = makeEvidence();
    const empty = calculatePotentialExcess(snapshot, forecast, {});
    expect(empty).toHaveLength(0);

    const drafts = {
      A: {
        plannedOrder: { state: "value" as const, value: 100, source: "input by you" as const },
        incomingStock: { state: "empty" as const },
      },
    };
    const lines = calculatePotentialExcess(snapshot, forecast, drafts);
    expect(lines).toHaveLength(1);
    expect(lines[0].key).toBe("A");
    expect(lines[0].units).toBeGreaterThan(0);

    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={drafts} onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "See the impact of your purchase plan" })).toBeTruthy();
    openAnalysis();
    expect(screen.getByRole("button", { name: /Possible excess stock/ }).querySelector("b")?.textContent).toBe(`${lines[0].units} units`);
    const business = businessPanel();
    expect(business.getByText("Planned purchase spend")).toBeTruthy();
    expect(summary("Planned purchase spend").querySelector("b")?.textContent).toBe("Unavailable");
  });

  it("switches impact tabs and expands an explanation", () => {
    const { snapshot, forecast } = makeEvidence();
    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={{}} onBack={() => {}} />);
    openAnalysis();

    const environment = screen.getByRole("tab", { name: /Environmental/ });
    const business = screen.getByRole("tab", { name: /Business/ });
    expect(environment.getAttribute("aria-selected")).toBe("true");
    expect(business.getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("business-impact")?.hidden).toBe(true);
    fireEvent.click(business);
    expect(business.getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("business-impact")?.hidden).toBe(false);
    fireEvent.click(environment);
    expect(environment.getAttribute("aria-selected")).toBe("true");
    expect(business.getAttribute("aria-selected")).toBe("false");
    expect(document.getElementById("environment-impact")?.hidden).toBe(false);
    expect(screen.queryByText("No outcome recorded")).toBeNull();
    const question = screen.getByText("How CO₂e estimates are calculated");
    fireEvent.click(question);
    expect(question.closest("details")?.open).toBe(true);
    fireEvent.click(business);
    expect(document.getElementById("environment-impact")?.hidden).toBe(true);
  });

  it("counts an entered zero among checked products while excluding an unentered order", () => {
    const { snapshot, forecast } = makeEvidence();
    const drafts = Object.fromEntries(["A", "B"].map(key => [key, {
      plannedOrder: { state: "value" as const, value: key === "A" ? 100 : 0, source: "input by you" as const },
      incomingStock: { state: "empty" as const },
    }]));
    const lines = calculatePotentialExcess(snapshot, forecast, drafts);
    expect(lines).toHaveLength(2);
    expect(lines.some(line => line.units === 0)).toBe(true);
    const excess = lines.reduce((total, line) => total + line.units, 0);
    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={drafts} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /Possible excess stock/ }).querySelector("b")?.textContent).toBe(`${excess} units`);
    expect(businessPanel().getByText("Planned purchase spend")).toBeTruthy();
  });

  it("uses validated seller costs, shows real zero and updates current totals after a quantity edit", () => {
    const { snapshot, forecast } = costEvidence();
    const props = { snapshot, forecast, onBack: () => {} };
    const { rerender } = render(<ImpactDashboard {...props} drafts={{ A: entered(100), B: entered(0) }} />);
    expect(summary("Planned purchase spend").querySelector("b")?.textContent).toBe("MYR 250.00");
    expect(summary("Planned purchase spend").querySelector("small")?.textContent).toBe("Included / total: 2/3");
    const row = businessPanel().getByText(/000202/).closest("tr")!;
    expect(within(row).getAllByText("MYR 0.00").length).toBeGreaterThan(0);
    rerender(<ImpactDashboard {...props} drafts={{ A: entered(50), B: entered(0) }} />);
    expect(summary("Planned purchase spend").querySelector("b")?.textContent).toBe("MYR 125.00");
    expect(screen.getByText(/These are estimates, not achieved savings or profit/)).toBeTruthy();
  });

  it("uses sourced automatic drafts for missing orders and preserves an entered zero", () => {
    const { snapshot, forecast } = costEvidence();
    const { rerender } = render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={{}} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /Possible excess stock/ }).querySelector("b")?.textContent).toBe("0 units");
    expect(summary("Planned purchase spend").querySelector("b")?.textContent).toBe("MYR 50.00");
    expect(summary("Planned purchase spend").querySelector("small")?.textContent).toBe("Included / total: 2/3");
    rerender(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={{ A: entered(0) }} onBack={() => {}} />);
    expect(screen.getByRole("button", { name: /Possible excess stock/ }).querySelector("b")?.textContent).toBe("0 units");
    expect(summary("Planned purchase spend").querySelector("b")?.textContent).toBe("MYR 20.00");
    expect(summary("Planned purchase spend").querySelector("small")?.textContent).toBe("Included / total: 2/3");
  });

  it("requires confirmed food categories before showing CO2e and exposes actual factor sources", () => {
    const { snapshot: original, forecast } = costEvidence();
    const snapshot = { ...original, productWeights: [{ productKey: "A", field: "unit_weight_kg" as const, state: "usable" as const, value: 0.25, sourceRows: [2], sourceColumn: "Weight" }] };
    const props = { snapshot, forecast, drafts: { A: entered(100) }, onBack: () => {} };
    const { rerender } = render(<ImpactDashboard {...props} />);
    fireEvent.click(screen.getByRole("tab", { name: "Environmental" }));
    expect(summary("Potential excess: estimated CO₂e").querySelector("b")?.textContent).toBe("Unavailable");
    rerender(<ImpactDashboard {...props} contexts={{ A: { evidenceKey: snapshot.evidenceKey, category: "flour", categoryConfirmed: true, isFood: true } }} />);
    expect(summary("Potential excess: estimated CO₂e").querySelector("b")?.textContent).toMatch(/^≈ [\d,.]+ kg CO₂e$/);
    expect(screen.getAllByText("Sources agree").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SU-EATABLE LIFE \(used in factor\):/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/AGRIBALYSE \(used in factor\):/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Recorded waste: estimated CO₂e")).toBeNull();
  });
});
