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
    expect(screen.getByText("Potential excess stock")).toBeTruthy();
    expect(screen.getByText((_, element) => element?.classList.contains("impact__lunits") === true && element.textContent === `${lines[0].units} units above expected demand`)).toBeTruthy();
    expect(screen.getAllByText("Not yet available")).toHaveLength(2);
    expect(container.querySelectorAll(".impact-faq__item")).toHaveLength(4);
  });

  it("opens one impact explanation at a time and lets it close", () => {
    const { snapshot, forecast } = makeEvidence();
    render(<ImpactDashboard snapshot={snapshot} forecast={forecast} drafts={{}} onBack={() => {}} />);

    const excess = screen.getByRole("button", { name: /How is potential excess estimated/ });
    const cost = screen.getByRole("button", { name: /How would cost saving be calculated/ });
    expect(excess.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(excess);
    expect(excess.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(cost);
    expect(excess.getAttribute("aria-expanded")).toBe("false");
    expect(cost.getAttribute("aria-expanded")).toBe("true");
    const closedPanel = document.getElementById(excess.getAttribute("aria-controls")!);
    expect(closedPanel?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(cost);
    expect(cost.getAttribute("aria-expanded")).toBe("false");
  });
});
