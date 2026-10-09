import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { PlanningInputsPanel } from "../src/components/PlanningInputsPanel.tsx";
import { CategoryConfirmation } from "../src/components/CategoryConfirmation.tsx";
import { suggestedCategoryRows } from "../src/components/product-estimates.ts";
import { FOODKEEPER_PRODUCTS, type PlanningContexts, type ProductPlanningContext } from "../src/engine.ts";
import { joinPurchaseEvidence } from "../src/purchase-plan/model.ts";
import { setLanguage } from "../src/i18n/index.ts";
import { makeEvidence } from "./fixtures.ts";

afterEach(() => act(() => setLanguage("en")));
function evidence() {
  const data = makeEvidence();
  data.snapshot = { ...data.snapshot, evidenceKey:"current-source", rows:data.snapshot.rows.map(row => ({ ...row, interpretedValues:{ ...row.interpretedValues, productName:row.productKey === "C" ? "Unknown item" : "Beras", packVariant:"500g" } })),
    productCosts:[{ productKey:"A", field:"unit_cost", state:"usable", value:2.5, sourceColumn:"Cost", sourceRows:[] }] };
  return data;
}
const stored: ProductPlanningContext = { evidenceKey:"current-source", category:"rice", categoryConfirmed:true, isFood:true, unitCost:4, sellingPrice:7, kgPerUnit:.2, restockDate:"2026-09-10", storageSelection:{ confirmed:true, storage:"freeze", categoryId:1 }, priceCatcherItemCode:"224" };
function Harness({ initial, save = vi.fn() }: { initial?:ProductPlanningContext; save?:ReturnType<typeof vi.fn> }) {
  const [data] = useState(evidence), [value,setValue] = useState(initial);
  return <PlanningInputsPanel snapshot={data.snapshot} productKey="A" value={value} onChange={next => { save(next); setValue(next); }} />;
}
const open = () => fireEvent.click(screen.getByText("Improve product estimates"));
const edit = (name:string) => fireEvent.click(screen.getByRole("button", { name:new RegExp(`^${name} `) }));
const save = () => fireEvent.click(screen.getByRole("button", { name:"Save this detail" }));

describe("focused product details", () => {
  it("resolves category and pack weight without asking for confirmation or bookkeeping", () => {
    render(<Harness />); open();
    expect(screen.getByText("Rice · AI estimate")).toBeTruthy();
    expect(screen.getByText("MYR 2.50 · From your file")).toBeTruthy();
    expect(screen.getByText("0.5000 kg · Resolved automatically")).toBeTruthy();
    expect(screen.queryByLabelText("Storage method")).toBeNull();
    expect(screen.queryByText("Other optional details →")).toBeNull();
    expect(screen.queryByLabelText("Your selling price / sales unit (MYR)")).toBeNull();
  });
  it("rejects invalid cost, saves explicit zero and preserves existing optional evidence", () => {
    const saved=vi.fn(); render(<Harness initial={stored} save={saved} />); open(); edit("Purchase cost");
    fireEvent.change(screen.getByLabelText("Your purchase cost / sales unit (MYR)"), {target:{value:"-1"}}); save();
    expect(saved).not.toHaveBeenCalled(); expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your purchase cost / sales unit (MYR)"), {target:{value:"0"}}); save();
    expect(saved).toHaveBeenCalledWith({...stored,unitCost:0});
  });
  it("removes only the selected override and falls back to file cost", () => {
    const saved=vi.fn(); render(<Harness initial={stored} save={saved} />); open(); edit("Purchase cost");
    fireEvent.change(screen.getByLabelText("Your purchase cost / sales unit (MYR)"), {target:{value:""}}); save();
    expect(saved).toHaveBeenCalledWith({...stored,unitCost:undefined});
    expect(screen.getByText("MYR 2.50 · From your file")).toBeTruthy();
  });
  it("lets the owner remove an old saved storage limit without changing other details", () => {
    const saved=vi.fn(); render(<Harness initial={stored} save={saved} />); open();
    fireEvent.click(screen.getByRole('button',{name:'Remove saved storage limit'}));
    expect(saved).toHaveBeenCalledWith({...stored,storageSelection:undefined});
  });
  it("records an optional manual correction separately from an AI category", () => {
    const saved=vi.fn(); render(<Harness save={saved} />); open(); edit("Food category");
    expect((screen.getByLabelText("Food category") as HTMLSelectElement).value).toBe("rice");
    expect(saved).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Food category"), {target:{value:"non_food"}}); save();
    expect(saved.mock.lastCall?.[0]).toMatchObject({evidenceKey:"current-source",category:"non_food",categoryConfirmed:true,categorySource:"manual",isFood:false});
    expect(saved.mock.lastCall?.[0].categoryProvenance).toBeUndefined();
  });
  it("discards old-source overrides and derives fresh automatic evidence", () => {
    const saved=vi.fn(); render(<Harness initial={{...stored,evidenceKey:"old-source"}} save={saved} />); open();
    expect(screen.getByText("Rice · AI estimate")).toBeTruthy();
    edit("Purchase cost"); expect((screen.getByLabelText("Your purchase cost / sales unit (MYR)") as HTMLInputElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Your purchase cost / sales unit (MYR)"), {target:{value:"3"}}); save();
    expect(saved.mock.lastCall?.[0]).toMatchObject({evidenceKey:"current-source",unitCost:3,categorySource:"ai",categoryConfirmed:false});
    expect(saved.mock.lastCall?.[0].sellingPrice).toBeUndefined();
  });
  it.each(["zh","ms"] as const)("keeps optional corrections translated in %s", language => {
    act(()=>setLanguage(language)); render(<Harness />);
    fireEvent.click(screen.getByText(language === "zh" ? "完善商品估算" : "Perbaiki anggaran produk"));
    fireEvent.click(screen.getByRole("button",{name:new RegExp(language === "zh" ? "^采购成本 " : "^Kos belian ")}));
    expect(screen.getByRole("button",{name:language === "zh" ? "暂时跳过" : "Langkau buat masa ini"})).toBeTruthy();
  });
});

describe("category batch confirmation", () => {
  it("reviews duplicate product names by key, skips without writing, then confirms only checked rows while keeping other inputs", () => {
    const data = evidence(), products = joinPurchaseEvidence(data.snapshot,data.forecast), changed = vi.fn();
    const contexts: PlanningContexts = { A:{ ...stored,category:undefined,categoryConfirmed:false } };
    render(<CategoryConfirmation snapshot={data.snapshot} products={products} contexts={contexts} onChange={changed} />);
    const openReview = () => fireEvent.click(screen.getByRole("button", { name:"Review suggested categories (2)" }));
    openReview(); const first = within(screen.getByRole("dialog"));
    expect(first.getAllByRole("checkbox")).toHaveLength(2);
    fireEvent.click(first.getByRole("button", { name:"Skip for now" })); expect(changed).not.toHaveBeenCalled();
    openReview(); const modal = within(screen.getByRole("dialog"));
    fireEvent.click(modal.getByRole("checkbox", { name:"Confirm category for Beras, SKU 000202" }));
    fireEvent.click(modal.getByRole("button", { name:"Confirm 1 category" }));
    expect(changed).toHaveBeenCalledWith({ A:{ ...stored, category:"rice",categoryConfirmed:true,isFood:true } });
  });
  it("preserves confirmed categories and refuses unresolved identities or mismatched evidence", () => {
    const data = evidence(), products = joinPurchaseEvidence(data.snapshot,data.forecast);
    expect(suggestedCategoryRows(data.snapshot,products,{ A:stored }).map(row => row.product.key)).toEqual(["B"]);
    expect(suggestedCategoryRows(data.snapshot,products.map(product=>({...product,issue:"Identity unresolved"})),{})).toEqual([]);
    expect(suggestedCategoryRows(data.snapshot,joinPurchaseEvidence(data.snapshot,{...data.forecast,snapshotId:"other"}),{})).toEqual([]);
    expect(suggestedCategoryRows({...data.snapshot,evidenceKey:undefined},products,{})).toEqual([]);
    const stale = suggestedCategoryRows(data.snapshot,products,{ A:{...stored,evidenceKey:"previous"} }).find(row=>row.product.key === "A")!;
    expect(stale.context.unitCost).toBeUndefined(); expect(stale.context.kgPerUnit).toBeUndefined();
  });
  it("blocks a changed review until refreshed and keeps a category confirmed after preview", () => {
    const data = evidence(), products = joinPurchaseEvidence(data.snapshot,data.forecast), changed = vi.fn();
    const rendered = render(<CategoryConfirmation snapshot={data.snapshot} products={products} contexts={{}} onChange={changed} />);
    fireEvent.click(screen.getByRole("button", { name:"Review suggested categories (2)" }));
    rendered.rerender(<CategoryConfirmation snapshot={data.snapshot} products={products} contexts={{ A:stored }} onChange={changed} />);
    const modal = within(screen.getByRole("dialog"));
    expect((modal.getByRole("button", { name:"Confirm 2 categories" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(modal.getByRole("button", { name:"Refresh review" }));
    expect(modal.getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(modal.getByRole("button", { name:"Confirm 1 category" }));
    expect(Object.keys(changed.mock.calls[0][0])).toEqual(["B"]);
  });
});
