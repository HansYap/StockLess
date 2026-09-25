import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { HomePage } from "../src/screens/HomePage.tsx";
import { MappingScreen } from "../src/screens/MappingScreen.tsx";
import { PurchasePlanScreen } from "../src/screens/PurchasePlanScreen.tsx";
import { confirmCurrentMapping } from "../src/storage/saved-matching.ts";
import { createMappingState, getReadinessBlockers, setMapping, type MappingState, type ParsedDataset } from "../src/engine.ts";
import { setLanguage, t } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => act(() => setLanguage("en")));
function suggested(composite = false) {
  let mapping = setMapping(createMappingState(), "transaction_date", "date", false);
  mapping = setMapping(mapping, "quantity_sold", "quantity", false);
  if (composite) {
    mapping = setMapping(mapping, "product_name", "name", false);
    return setMapping(mapping, "pack_variant", "pack", false);
  }
  return setMapping(mapping, "product_code", "sku", false);
}
const dataset: ParsedDataset = {
  sourceMode: "user", sourceName: "Ready.csv", sourceSha256: "hash", sourceByteLength: 10,
  delimiter: ",", rows: [], normalizations: [],
  columns: ["date", "quantity", "sku"].map((id, index) => ({ id, index, header: id === "sku" ? "Ready" : id, normalizedHeader: id, previewValues: ["Ready"] })),
};
function mappingPage(mapping: MappingState) {
  return <MappingScreen dataset={dataset} mapping={mapping} proposals={null} error={null} notice={null}
    onSelectColumn={vi.fn()} onConfirmField={vi.fn()} onConfirmIdentity={vi.fn()} onBack={vi.fn()}
    onContinue={vi.fn()} onConfirmAllAndContinue={vi.fn()} />;
}

describe("first-visit bulk confirmation", () => {
  it("confirms selected suggestions and an explicit supported identity without changing the original state", () => {
    for (const composite of [false, true]) {
      const input = suggested(composite);
      const result = confirmCurrentMapping(input)!;
      expect(getReadinessBlockers(result)).toEqual([]);
      expect(result.identityMode).toBe(composite ? "composite" : "stable");
      expect(input.identityConfirmed).toBe(false);
      expect(Object.values(input.mappings).every(match => !match?.confirmed)).toBe(true);
    }
  });
  it("keeps missing required data blocked and refuses duplicate source assignments", () => {
    const partial = setMapping(createMappingState(), "product_code", "sku", false);
    expect(getReadinessBlockers(confirmCurrentMapping(partial)!)).toContain("Sale date");
    const original = suggested();
    const duplicate = { ...original, mappings: { ...original.mappings, quantity_sold: { ...original.mappings.quantity_sold!, sourceColumnId: "date" } } };
    expect(confirmCurrentMapping(duplicate)).toBeNull();
    render(mappingPage(partial));
    expect((screen.getByRole("button", { name: "Looks well, next step" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("persistent language choice across the frontend", () => {
  it("updates homepage copy and dynamic results while retaining slider values", () => {
    const { unmount } = render(<HomePage />);
    fireEvent.change(screen.getByLabelText("Planned order"), { target: { value: "44" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "zh" } });
    expect(screen.getByText("此计划的订购量偏高。")).toBeTruthy();
    expect(screen.getByText("订购后的 56 件库存超过需求上限 36 件。")).toBeTruthy();
    expect((screen.getByLabelText("计划订购量") as HTMLInputElement).value).toBe("44");
    expect(localStorage.getItem("stockless.language")).toBe("zh");
    expect(document.documentElement.lang).toBe("zh-Hans");
    unmount();
    render(mappingPage(suggested()));
    expect(screen.getByText("确认无误，下一步")).toBeTruthy();
    expect(screen.getAllByRole("option", { name: "Ready" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Ready.csv")).toBeTruthy();
    expect(screen.queryByText(/Unique approved/)).toBeNull();
    act(() => setLanguage("ms"));
    expect(screen.getByText("Semuanya betul, langkah seterusnya")).toBeTruthy();
    expect(screen.getByText("Padanan lajur")).toBeTruthy();
  });
  it("translates purchase results without translating retailer product names", () => {
    const { snapshot, forecast } = makeEvidence();
    const custom = { ...snapshot, rows: snapshot.rows.map(row => ({ ...row, interpretedValues: { ...row.interpretedValues, productName: "Ready" } })) };
    act(() => setLanguage("ms"));
    render(<PurchasePlanScreen snapshot={custom} forecast={forecast} drafts={{}} selectedKey={null} onSelect={vi.fn()} onDraftChange={vi.fn()} onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Pelan pembelian anda" })).toBeTruthy();
    expect(screen.getAllByText("Ready").length).toBeGreaterThan(0);
    expect(t("You would have 40 units, above the 36-unit four-week range, so the planned order looks too much.")).toContain("40 unit");
    expect(t("Open purchase plan for Ready, SKU 123")).toBe("Buka pelan pembelian untuk Ready, SKU 123");
  });
});
