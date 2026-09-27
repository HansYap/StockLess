import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReadinessOverview } from "../src/screens/ReadinessOverview.tsx";
import { buildProductTimelines } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => { cleanup(); setLanguage("en"); });
describe("Readiness product overview", () => {
  it("separates clean products from incomplete histories and searches by displayed SKU", () => {
    const { snapshot } = makeEvidence();
    render(<ReadinessOverview snapshot={snapshot} timelines={buildProductTimelines(snapshot)} />);
    const summary = screen.getByRole("region", { name: "Product readiness summary" });
    expect(within(summary).getByText("3 products checked").textContent).toContain("3");
    expect(document.querySelectorAll(".pcard")).toHaveLength(2);
    expect(document.querySelectorAll(".dtable--ready tbody tr")).toHaveLength(1);
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
    expect(card.className).toContain("pcard--missing");
    expect(card.querySelector(".pill")?.textContent).toBe("数据缺失");
    expect(card.querySelectorAll(".spark__bar--missing")).toHaveLength(2);
    expect(card.querySelector(".spark")?.getAttribute("aria-label")).toContain("缺失");
  });
});
