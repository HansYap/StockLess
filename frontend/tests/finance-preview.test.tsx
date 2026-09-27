import { afterEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { FinancePreview } from "../src/finance-preview/FinancePreview.tsx";
import { setLanguage } from "../src/i18n/index.ts";

afterEach(() => setLanguage("en"));
describe("isolated finance design preview", () => {
  it("keeps actual money unavailable and updates only fictional example figures", () => {
    setLanguage("en");
    render(<FinancePreview />);
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.queryByText("RM 340")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open dashboard example →" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Fictional example · separate from your file")).toBeTruthy();
    const input = dialog.getByRole("textbox");
    fireEvent.change(input, { target: { value: "10" } });
    expect(dialog.getAllByText("RM 260")).toHaveLength(2);
    expect(dialog.getByText("RM 40")).toBeTruthy();
    fireEvent.change(input, { target: { value: "-5" } });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(dialog.getByRole("alert")).toBeTruthy();
    expect(dialog.getAllByText("RM 260")).toHaveLength(2);
    fireEvent.click(dialog.getByRole("button", { name: "Close dashboard example" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByText("—")).toHaveLength(3);
  });
  it("supports Chinese and treats zero as a valid example quantity", () => {
    setLanguage("zh");
    render(<FinancePreview />);
    fireEvent.click(screen.getByRole("button", { name: "查看 Dashboard 示例 →" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.change(dialog.getByRole("textbox"), { target: { value: "0" } });
    expect(dialog.getAllByText("RM 180")).toHaveLength(2);
    expect(dialog.queryByRole("alert")).toBeNull();
    expect(dialog.getByRole("textbox").getAttribute("aria-invalid")).toBe("false");
  });
});
