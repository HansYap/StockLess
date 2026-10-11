import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { AppShell } from "../src/components/AppShell.tsx";
import { MappingScreen } from "../src/screens/MappingScreen.tsx";
import { confirmCurrentMapping } from "../src/mapping-confirmation.ts";
import { createMappingState, parseCsvBytes, removeMapping, setMapping, type CanonicalField, type MappingState, type ParsedDataset } from "../src/engine.ts";
import { setLanguage } from "../src/i18n/index.ts";

let dataset: ParsedDataset;
let initial: MappingState;
beforeEach(async () => {
  setLanguage("en");
  dataset = await parseCsvBytes(new TextEncoder().encode("Date,SKU,Name,Pack,Quantity,Stock,Unused\n2026-02-31,000101,Ready,10 pack,2,12,Keep me"), {
    sourceMode: "user", sourceName: "sample_with_issues_recent.csv", mimeType: "text/csv",
  });
  initial = createMappingState();
  for (const [field, header] of [["transaction_date", "Date"], ["product_code", "SKU"], ["product_name", "Name"], ["pack_variant", "Pack"], ["quantity_sold", "Quantity"], ["current_stock", "Stock"]] as const) {
    initial = setMapping(initial, field, dataset.columns.find(column => column.header === header)!.id, false);
  }
});
afterEach(() => act(() => setLanguage("en")));

function Harness({ input = initial, onConfirmed = vi.fn(), onClear = vi.fn() }: {
  input?: MappingState;
  onConfirmed?: (mapping: MappingState | null) => void;
  onClear?: () => void;
}) {
  const [mapping, updateMapping] = useState(input);
  function select(field: CanonicalField, columnId: string | null) {
    updateMapping(current => columnId ? setMapping(current, field, columnId, false) : removeMapping(current, field));
  }
  return <AppShell current={2} reached={2} sourceMode="user" sourceName={dataset.sourceName} onClear={onClear} onNavigate={vi.fn()}>
    <MappingScreen dataset={dataset} mapping={mapping} proposals={null} error={null} notice={null} onClear={onClear}
      onSelectColumn={select} onSelectIdentity={mode => updateMapping(current => ({ ...current, identityMode: mode, identityConfirmed: false }))}
      onBack={vi.fn()} onConfirmAllAndContinue={() => onConfirmed(confirmCurrentMapping(mapping))} />
  </AppShell>;
}

it("places the real file details and clear control in the hero instead of the top bar", () => {
  const onClear = vi.fn();
  render(<Harness onClear={onClear} />);
  const topbar = screen.getByRole("banner");
  expect(within(topbar).queryByText("Retailer file")).toBeNull();
  expect(within(topbar).queryByText(dataset.sourceName)).toBeNull();
  expect(within(topbar).queryByRole("button", { name: "Clear session" })).toBeNull();
  const hero = screen.getByRole("region", { name: "Match your columns" });
  expect(within(hero).getByText(dataset.sourceName)).toBeTruthy();
  expect(within(hero).getByText("Retailer file")).toBeTruthy();
  fireEvent.click(within(hero).getByRole("button", { name: "Clear session" }));
  expect(onClear).toHaveBeenCalledOnce();
  expect(screen.getByText("2026-02-31")).toBeTruthy();
});

it("confirms the chosen name-and-pack mode and preserves raw product previews across languages", () => {
  const onConfirmed = vi.fn();
  render(<Harness onConfirmed={onConfirmed} />);
  fireEvent.click(screen.getByRole("button", { name: "Name + pack size", exact: true }));
  expect(screen.getByRole("button", { name: "Name + pack size", exact: true }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("combobox", { name: "Source column for Pack size" })).toBeTruthy();
  act(() => setLanguage("ms"));
  expect(screen.getByText("Ready · 10 pack")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Sahkan semua dan teruskan →" }));
  expect(onConfirmed.mock.calls[0][0].identityMode).toBe("composite");
  expect(onConfirmed.mock.calls[0][0].identityConfirmed).toBe(true);
  expect(initial.identityConfirmed).toBe(false);
});

it("blocks duplicate assignments until the source choices are corrected", () => {
  const onConfirmed = vi.fn();
  render(<Harness onConfirmed={onConfirmed} />);
  const quantity = screen.getByRole("combobox", { name: "Source column for Quantity sold" });
  fireEvent.change(quantity, { target: { value: initial.mappings.transaction_date!.sourceColumnId } });
  expect(screen.getAllByText("This column is already used above.")).toHaveLength(2);
  expect((screen.getByRole("button", { name: "Confirm and check my data →" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Confirm all and continue →" }));
  expect(onConfirmed).not.toHaveBeenCalled();
  fireEvent.change(quantity, { target: { value: initial.mappings.quantity_sold!.sourceColumnId } });
  expect(screen.queryByText("This column is already used above.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Confirm and check my data →" }));
  expect(onConfirmed.mock.calls[0][0].identityConfirmed).toBe(true);
});

it("requires both name and pack when composite identity is selected", () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole("button", { name: "Name + pack size", exact: true }));
  fireEvent.change(screen.getByRole("combobox", { name: "Source column for Pack size" }), { target: { value: "" } });
  expect(screen.getByText("Choose a column to continue.")).toBeTruthy();
  expect((screen.getByRole("button", { name: "Confirm all and continue →" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Product code", exact: true }));
  expect((screen.getByRole("button", { name: "Confirm all and continue →" }) as HTMLButtonElement).disabled).toBe(false);
});

it("allows optional fields to be skipped and shows unused original headings", () => {
  render(<Harness />);
  fireEvent.change(screen.getByRole("combobox", { name: "Source column for Stock on hand" }), { target: { value: "" } });
  expect((screen.getByRole("button", { name: "Confirm all and continue →" }) as HTMLButtonElement).disabled).toBe(false);
  const unused = document.querySelector(".mapping-unused") as HTMLElement;
  expect(within(unused).getByText("Stock")).toBeTruthy();
  expect(within(unused).getByText("Unused")).toBeTruthy();
  expect((screen.getByRole("combobox", { name: "Source column for Unit cost" }) as HTMLSelectElement).disabled).toBe(false);
});

it("exposes a conflicting suggestion for a later step so the user can clear it", () => {
  const reservedColumn = dataset.columns.find(column => column.header === "Unused")!.id;
  render(<Harness input={setMapping(initial, "supplier_id_or_name", reservedColumn, false)} />);
  fireEvent.change(screen.getByRole("combobox", { name: "Source column for Quantity sold" }), { target: { value: reservedColumn } });
  const supplier = screen.getByRole("combobox", { name: "Source column for Supplier details" });
  expect(document.querySelector(".mapping-additional")?.getAttribute("open")).not.toBeNull();
  expect((screen.getByRole("button", { name: "Confirm all and continue →" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(supplier, { target: { value: "" } });
  expect((screen.getByRole("button", { name: "Confirm all and continue →" }) as HTMLButtonElement).disabled).toBe(false);
});
