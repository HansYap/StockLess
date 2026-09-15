import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePage } from "../src/screens/HomePage.tsx";

describe("homepage purchase-plan example", () => {
  it("uses both current sliders and updates the estimate and verdict immediately", () => {
    const { container } = render(<HomePage />);
    const planned = screen.getByLabelText("Planned order") as HTMLInputElement;
    const incoming = screen.getByLabelText("Incoming stock") as HTMLInputElement;
    const estimate = container.querySelector(".sl-preview-estimate strong");

    expect(planned.type).toBe("range");
    expect(incoming.type).toBe("range");
    expect(planned.value).toBe("20");
    expect(incoming.value).toBe("0");
    expect(estimate?.textContent).toContain("20 units");
    expect(screen.getByText("Looks balanced")).toBeTruthy();
    expect(screen.getAllByText("input by you")).toHaveLength(2);

    fireEvent.change(incoming, { target: { value: "10" } });
    expect(estimate?.textContent).toContain("10 units");
    expect(screen.getByText("Overstock Risk")).toBeTruthy();

    fireEvent.change(planned, { target: { value: "0" } });
    expect(screen.getByText("Needs review")).toBeTruthy();

    fireEvent.change(planned, { target: { value: "10" } });
    expect(screen.getByText("Looks balanced")).toBeTruthy();
  });
});
