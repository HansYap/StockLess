import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImpactDashboard, calculatePotentialExcess } from "../src/screens/ImpactDashboard.tsx";
import { makeEvidence } from "./fixtures.ts";

describe("impact dashboard", () => {
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

    const { container } = render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={drafts} onBack={() => {}} />);
    expect(screen.getByRole("heading", { name: "See the impact of your purchase plan" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "What you could avoid" })).toBeTruthy();
    expect(screen.getByText((_, element) => element?.classList.contains("impact__lunits") === true && element.textContent === `${lines[0].units} units above expected demand`)).toBeTruthy();
    expect(container.querySelector(".sx-badge__num")?.textContent).toBe(String(lines[0].units));
    expect(container.querySelectorAll(".learn__item")).toHaveLength(4);
  });

  it("switches impact tabs and expands an explanation", () => {
    const { snapshot, forecast } = makeEvidence();
    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={{}} onBack={() => {}} />);

    const environment = screen.getByRole("tab", { name: /Environmental/ });
    const business = screen.getByRole("tab", { name: /Business/ });
    expect(environment.getAttribute("aria-selected")).toBe("true");
    fireEvent.click(business);
    expect(business.getAttribute("aria-selected")).toBe("true");
    expect(document.getElementById("sx-lens-biz")?.hidden).toBe(false);
    const question = screen.getByText("How is potential excess estimated?");
    fireEvent.click(question);
    expect(question.closest("details")?.open).toBe(true);
  });

  it("counts balanced checked products in planned and expected stock totals", () => {
    const { snapshot, forecast } = makeEvidence();
    const drafts = Object.fromEntries(["A", "B"].map(key => [key, {
      plannedOrder: { state: "value" as const, value: key === "A" ? 100 : 0, source: "input by you" as const },
      incomingStock: { state: "empty" as const },
    }]));
    const lines = calculatePotentialExcess(snapshot, forecast, drafts);
    expect(lines).toHaveLength(2);
    expect(lines.some(line => line.units === 0)).toBe(true);
    const planned = lines.reduce((total, line) => total + line.available, 0);
    const excess = lines.reduce((total, line) => total + line.units, 0);
    const { container } = render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={drafts} onBack={() => {}} />);
    const beats = container.querySelectorAll(".sx-disc");
    expect(Number(beats[0].textContent?.replaceAll(",", ""))).toBe(planned);
    expect(Number(beats[1].textContent?.replaceAll(",", ""))).toBe(planned - excess);
  });
});
