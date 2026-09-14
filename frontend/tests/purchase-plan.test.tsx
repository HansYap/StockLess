import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PurchasePlanScreen } from "../src/screens/PurchasePlanScreen.tsx";
import { DemandChart } from "../src/purchase-plan/DemandChart.tsx";
import {
  buildDemandReview,
  evaluateProductPurchasePlan,
} from "../src/engine.ts";
import {
  joinPurchaseEvidence,
  type PurchaseDrafts,
} from "../src/purchase-plan/model.ts";
import { makeEvidence } from "./fixtures.ts";

function Harness({
  data,
  evaluate = evaluateProductPurchasePlan,
}: {
  data?: ReturnType<typeof makeEvidence>;
  evaluate?: typeof evaluateProductPurchasePlan;
}) {
  const [defaultData] = useState(makeEvidence);
  const evidence = data ?? defaultData;
  const [drafts, setDrafts] = useState<PurchaseDrafts>({});
  const [selectedKey, onSelect] = useState<string | null>(null);
  return (
    <PurchasePlanScreen
      {...evidence}
      drafts={drafts}
      selectedKey={selectedKey}
      onSelect={onSelect}
      onDraftChange={(key, inputs) =>
        setDrafts((previous) => ({ ...previous, [key]: inputs }))
      }
      onBack={() => {}}
      evaluatePurchase={evaluate}
    />
  );
}
const open = (sku = "000101") =>
  fireEvent.click(
    screen.getByRole("button", {
      name: new RegExp(`Open purchase plan.*${sku}`),
    }),
  );

describe("purchase planning", () => {
  it("has only five read-only columns, no verdict, no sample inputs and a disabled ordering filter initially", () => {
    render(<Harness />);
    expect(
      screen.getAllByRole("columnheader").map((el) => el.textContent),
    ).toEqual([
      "Product",
      "Data label",
      "4-week demand",
      "Estimated restock",
      "Open action",
    ]);
    expect(screen.queryByLabelText("Planned order")).toBeNull();
    expect(screen.queryByLabelText("Incoming stock")).toBeNull();
    expect(
      screen.queryByText(/High risk|Needs review|Looks balanced|Cannot judge/),
    ).toBeNull();
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      true,
    );
    open();
    const dialog = screen.getByRole("dialog");
    const planned = within(dialog).getByLabelText("Planned order") as HTMLInputElement;
    const incoming = within(dialog).getByLabelText("Incoming stock") as HTMLInputElement;
    expect(planned.type).toBe("range");
    expect(planned.value).toBe("0");
    expect(planned.getAttribute("aria-valuetext")).toBe("Not entered");
    expect(incoming.type).toBe("range");
    expect(incoming.value).toBe("0");
    expect(incoming.getAttribute("aria-valuetext")).toBe("Not entered");
    expect(
      within(dialog).queryByRole("button", { name: /Use .* as my planned order/ }),
    ).toBeNull();
    expect(within(dialog).getByText("No plan entered")).toBeTruthy();
  });
  it("opens the clicked row by product key even when display names are identical", () => {
    render(<Harness />);
    fireEvent.click(
      screen.getByText("SKU 000202").closest("tr")!.querySelectorAll("td")[2],
    );
    expect(
      within(screen.getByRole("dialog")).getByText(
        "Purchase plan · SKU 000202",
      ),
    ).toBeTruthy();
    expect(
      within(screen.getByRole("dialog")).getByText("Limited"),
    ).toBeTruthy();
  });
  it("enables ordering after a plan, keeps totals unchanged, and restores disabled state after clearing the last plan", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const totals = screen.getByLabelText("Product data labels").textContent;
    open("000202");
    fireEvent.change(screen.getByLabelText("Planned order"), { target: { value: "1" } });
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      false,
    );
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    expect(screen.getByLabelText("Product data labels").textContent).toBe(
      totals,
    );
    open("000202");
    await user.click(screen.getByRole("button", { name: "Clear planned order" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      true,
    );
    expect(screen.getAllByRole("row")).toHaveLength(4);
  });
  it("updates only the selected product as either slider moves", () => {
    const evaluate = vi.fn(evaluateProductPurchasePlan);
    render(<Harness evaluate={evaluate} />);
    open();
    const planned = screen.getByLabelText("Planned order") as HTMLInputElement;
    expect(planned.min).toBe("0");
    expect(planned.step).toBe("1");
    expect(Number(planned.max)).toBeGreaterThanOrEqual(100);
    const beforeMoving = evaluate.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Planned order"), {
      target: { value: "23" },
    });
    expect(evaluate.mock.calls.length).toBe(beforeMoving + 1);
    const calls = evaluate.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Incoming stock"), {
      target: { value: "40" },
    });
    expect(evaluate.mock.calls.length).toBe(calls + 1);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    open("000202");
    expect(screen.getByLabelText("Planned order").getAttribute("aria-valuetext")).toBe("Not entered");
  });
  it("prefills confirmed file figures, preserves provenance, and uses mapped expiry", () => {
    const data = makeEvidence();
    data.snapshot = {
      ...data.snapshot,
      purchaseFileEvidence: {
        plannedOrderColumnConfirmed: true,
        incomingStockColumnConfirmed: true,
        expiryDateColumnConfirmed: true,
        products: [{
          productKey: "A",
          plannedOrderQuantity: 20,
          incomingStockQuantity: 3,
          expiryDates: ["2026-09-20"],
          reasonCodes: [],
        }],
      },
    };
    render(<Harness data={data} />);
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(false);
    open();
    expect((screen.getByLabelText("Planned order") as HTMLInputElement).value).toBe("20");
    expect((screen.getByLabelText("Incoming stock") as HTMLInputElement).value).toBe("3");
    expect(screen.getAllByText("from your file").length).toBeGreaterThan(2);
    expect(screen.getByText("Expires in 6 days (2026-09-20)")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Planned order"), { target: { value: "21" } });
    expect(screen.getAllByText("typed by you").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Clear planned order" }));
    expect(screen.getByText("No plan entered")).toBeTruthy();
  });
  it("shows No range and the reason for Cannot assess without demand figures or seller pattern", () => {
    render(<Harness />);
    open("000303");
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("No range")).toBeTruthy();
    expect(
      dialog.getByText("Only 3 of the last 8 weeks have records"),
    ).toBeTruthy();
    expect(dialog.queryByRole("img")).toBeNull();
    expect(dialog.queryByText(/Steady seller|Occasional seller/)).toBeNull();
    fireEvent.change(dialog.getByLabelText("Planned order"), {
      target: { value: "10" },
    });
    const verdict = within(
      dialog.getByRole("region", { name: "Purchase check" }),
    );
    expect(verdict.getByText("Cannot judge")).toBeTruthy();
    expect(verdict.getByText("the product is Cannot assess.")).toBeTruthy();
    expect(verdict.queryByText("Stock after order")).toBeNull();
  });
  it("surfaces every mismatched product without evaluating it", () => {
    const data = makeEvidence();
    data.forecast = {
      ...data.forecast,
      products: [
        data.forecast.products[0],
        { ...data.forecast.products[1], productKey: "ORPHAN" },
      ],
    };
    const evaluate = vi.fn(evaluateProductPurchasePlan);
    render(<Harness data={data} evaluate={evaluate} />);
    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByRole("alert").textContent).toContain(
      "Evidence mismatch",
    );
    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(
      joinPurchaseEvidence(data.snapshot, {
        ...data.forecast,
        snapshotId: "stale",
      }).every((p) => p.issue),
    ).toBe(true);
  });
  it("displays injected expiry evidence and supports closing with native cancel", () => {
    const data = makeEvidence();
    const onSelect = vi.fn();
    render(
      <PurchasePlanScreen
        {...data}
        drafts={{}}
        selectedKey="A"
        onSelect={onSelect}
        onDraftChange={() => {}}
        onBack={() => {}}
        expiryByProduct={{
          A: { columnConfirmed: true, dates: ["2026-09-20"] },
        }}
      />,
    );
    expect(screen.getByText("Expires in 6 days (2026-09-20)")).toBeTruthy();
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { bubbles: false }),
    );
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});

describe("approved chart semantics", () => {
  it("uses lines without ordinary dots for positive weeks and starts the forecast band exactly at Today", () => {
    const { snapshot, forecast } = makeEvidence();
    const weeks = buildDemandReview(snapshot).products.find(
      (p) => p.productKey === "A",
    )!.timeline.weeks;
    const { container } = render(
      <DemandChart
        weeks={weeks}
        range={forecast.products[0].range!}
        name="Test"
      />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(0);
    expect(container.querySelector("polyline")?.getAttribute("stroke")).toBe(
      "#16313B",
    );
    expect(screen.queryByTestId("missing-week")).toBeNull();
    const today = screen.getByTestId("today-divider").getAttribute("x1");
    expect(
      screen.getByTestId("forecast-band").getAttribute("points")?.split(",")[0],
    ).toBe(today);
    expect(screen.getByTestId("forecast-centre").getAttribute("x1")).toBe(
      today,
    );
    expect(screen.getByTestId("forecast-centre").getAttribute("y1")).not.toBe(
      screen.getByTestId("forecast-centre").getAttribute("y2"),
    );
  });
  it("shows orange dots only for genuine zero-sales weeks and a dashed marker only for missing weeks", () => {
    const { snapshot, forecast } = makeEvidence();
    const weeks = buildDemandReview(snapshot).products.find(
      (p) => p.productKey === "B",
    )!.timeline.weeks;
    const altered = weeks.map((w, i) =>
      i === 0
        ? {
            ...w,
            state: "net_zero_with_activity" as const,
            netQuantity: 0,
            negativeQuantity: -4,
          }
        : i === 2
          ? { ...w, netQuantity: -1 }
          : w,
    );
    const { container } = render(
      <DemandChart
        weeks={altered}
        range={forecast.products[1].range!}
        name="Test"
      />,
    );
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(screen.getByTestId("zero-sales-dot").getAttribute("fill")).toBe(
      "#D99120",
    );
    expect(screen.getAllByTestId("missing-week")).toHaveLength(2);
    expect(screen.getByText("Data note:").parentElement?.textContent).toContain(
      "sales and returns cancelled each other out",
    );
    expect(container.querySelector(".chart-legend")?.textContent).not.toContain(
      "returns",
    );
  });
});
