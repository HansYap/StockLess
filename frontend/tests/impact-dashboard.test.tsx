import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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

    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={drafts} onBack={() => {}} />);
    expect(screen.getByText("Potential excess stock")).toBeTruthy();
    expect(screen.getByText((_, element) => element?.classList.contains("impact__lunits") === true && element.textContent === `${lines[0].units} units above expected demand`)).toBeTruthy();
    expect(screen.getAllByText("Not yet available")).toHaveLength(2);
  });
});
