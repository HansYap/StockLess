import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomePage } from "../src/screens/HomePage.tsx";

describe("homepage purchase-plan example", () => {
 it("retains the design's example and updates comparisons using both controls", () => {
  render(<HomePage />);
  const planned = screen.getByRole('slider', {name:'Your planned order'}) as HTMLInputElement;
  const incoming = screen.getByRole('slider', {name:'Incoming stock'}) as HTMLInputElement;
  expect(planned.value).toBe('9'); expect(incoming.value).toBe('2');
  expect(screen.getByText('Looks balanced')).toBeTruthy();
  fireEvent.change(incoming,{target:{value:'30'}});
  expect(screen.getByText('This plan is above the range.')).toBeTruthy();
  expect(screen.getByText(/You would have 46 units, above the 7–28/)).toBeTruthy();
  fireEvent.change(incoming,{target:{value:'0'}});
  fireEvent.change(planned,{target:{value:'0'}});
  expect(screen.getByText('Looks balanced')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Use 10'}));
  expect(planned.value).toBe('10');
  expect((screen.getByRole('spinbutton',{name:'Your planned order'}) as HTMLInputElement).value).toBe('10');
 });
});
