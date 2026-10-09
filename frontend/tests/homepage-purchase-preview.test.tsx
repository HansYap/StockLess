import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "../src/screens/HomePage.tsx";

afterEach(() => vi.useRealTimers());

function renderExample() {
  const { container } = render(<HomePage startHref="#start" />);
  return within(container.querySelector<HTMLElement>("#hp-pp")!);
}

describe("redesigned homepage", () => {
  it("uses the same four-week forecast comparison and keeps it unchanged when an order is edited", () => {
    const example = renderExample();
    const forecast = example.getByRole("img", { name: /Recorded sales and four-week demand range/ });
    expect(forecast.getAttribute("aria-label")).toContain("20 Jul – 16 Aug: 14 units");
    expect(forecast.getAttribute("aria-label")).toContain("17 Aug – 13 Sept: 22 units");
    expect(forecast.getAttribute("aria-label")).toContain("Next 4 weeks: 15–21 units");
    fireEvent.change(example.getByRole("slider", { name: "Your order" }), { target: { value: "10" } });
    expect(example.getByRole("img", { name: /^Stock after order:/ }).getAttribute("aria-label")).toContain("Stock after order: 18 units");
    expect(forecast.getAttribute("aria-label")).toContain("Next 4 weeks: 15–21 units");
  });
  it("keeps start links on visit routing while workflow cards return to the homepage top", () => {
    render(<HomePage startHref="#start" />);
    const starts = screen.getAllByRole("link", { name: "Start with your sales data →" });
    expect(starts).toHaveLength(3);
    for (const link of starts) expect(link.getAttribute("href")).toBe("#start");
    for (const label of ["Upload your sales data", "Map your columns", "Check your data is ready", "Plan your purchases"]) {
      expect(screen.getByRole("link", { name: new RegExp(label) }).getAttribute("href")).toBe("#top");
    }
    expect(screen.getByRole("link", { name: "Try it with your own data →" }).getAttribute("href")).toBe("#start");
  });

  it("checks high, low and balanced orders against the reference example and includes incoming stock", () => {
    const example = renderExample();
    const planned = example.getByRole("slider", { name: "Your order" }) as HTMLInputElement;
    const exact = example.getByRole("spinbutton", { name: "Your order" }) as HTMLInputElement;
    const incoming = example.getByRole("spinbutton", { name: "Incoming stock" }) as HTMLInputElement;
    expect(planned.value).toBe("37");
    expect(example.getByText("This plan looks too high.")).toBeTruthy();
    fireEvent.change(planned, { target: { value: "0" } });
    expect(exact.value).toBe("0");
    expect(example.getByText("This plan looks too low.")).toBeTruthy();
    fireEvent.click(example.getByRole("button", { name: "Use suggested 10" }));
    expect(planned.value).toBe("10");
    expect(example.getByText("This plan is within range.")).toBeTruthy();
    fireEvent.change(incoming, { target: { value: "5" } });
    expect(example.getByText("This plan looks too high.")).toBeTruthy();
    fireEvent.click(example.getByRole("button", { name: "Use suggested 5" }));
    expect(exact.value).toBe("5");
    expect(example.getByText("You'd have 18 units, inside the expected 15–21.")).toBeTruthy();
    fireEvent.click(example.getByRole("button", { name: "One more" }));
    expect(planned.value).toBe("6");
    fireEvent.click(example.getByRole("button", { name: "One less" }));
    expect(planned.value).toBe("5");
  });

  it("clamps invalid numeric orders and never suggests negative quantities", () => {
    const example = renderExample();
    const order = example.getByRole("spinbutton", { name: "Your order" }) as HTMLInputElement;
    fireEvent.change(order, { target: { value: "-9" } });
    expect(order.value).toBe("0");
    fireEvent.change(order, { target: { value: "999" } });
    expect(order.value).toBe("60");
    fireEvent.change(example.getByRole("spinbutton", { name: "Incoming stock" }), { target: { value: "20" } });
    expect(example.getByRole("button", { name: "Use suggested 0" })).toBeTruthy();
    fireEvent.click(example.getByRole("button", { name: "Use suggested 0" }));
    expect(order.value).toBe("0");
    expect(example.getByText("This plan looks too high.")).toBeTruthy();
  });

  it("pauses and resumes the independent hero story without changing the interactive order", () => {
    vi.useFakeTimers();
    const { container } = render(<HomePage />);
    expect(container.querySelector("#ha-order")!.textContent).toBe("37");
    act(() => vi.advanceTimersByTime(2400));
    expect(container.querySelector("#ha-order")!.textContent).toBe("37");
    act(() => vi.advanceTimersByTime(100));
    expect(container.querySelector("#ha-order")!.textContent).toBe("24");
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const initial = container.querySelector("#ha-order")!.textContent;
    act(() => vi.advanceTimersByTime(4000));
    expect(container.querySelector("#ha-order")!.textContent).toBe(initial);
    fireEvent.click(screen.getByRole("button", { name: "Play" }));
    act(() => vi.advanceTimersByTime(2500));
    expect(container.querySelector("#ha-order")!.textContent).toBe("10");
    expect((screen.getByRole("slider", { name: "Your order" }) as HTMLInputElement).value).toBe("37");
    expect(Number(container.querySelector("#ha-saved")!.textContent)).toBe(24);
  });

  it("opens individual FAQs and expands or collapses all FAQs", () => {
    const { container } = render(<HomePage />);
    const faqs = Array.from(container.querySelectorAll("details.hp-faq"));
    fireEvent.click(screen.getByText("How does StockLess work?"));
    expect(faqs[0].hasAttribute("open")).toBe(true);
    expect(faqs[1].hasAttribute("open")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "View all FAQs →" }));
    expect(faqs.every(faq => faq.hasAttribute("open"))).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close all FAQs ↑" }));
    expect(faqs.every(faq => !faq.hasAttribute("open"))).toBe(true);
  });
});
