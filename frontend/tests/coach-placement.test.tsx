import { expect, it } from "vitest";
import { positionCoach } from "../src/onboarding/coach-placement.ts";

it.each([
  { name: "right", target: { left: 100, right: 300, top: 150, bottom: 194 }, viewport: { width: 1440, height: 900 } },
  { name: "left", target: { left: 900, right: 1180, top: 390, bottom: 434 }, viewport: { width: 1280, height: 900 } },
  { name: "below", target: { left: 100, right: 1200, top: 100, bottom: 144 }, viewport: { width: 1280, height: 900 } },
  { name: "above", target: { left: 100, right: 1200, top: 640, bottom: 684 }, viewport: { width: 1280, height: 900 } },
])("keeps the coach and mascot clear of the highlighted control when placed $name", ({ name, target, viewport }) => {
  const card = { width: 330, height: 346 };
  const result = positionCoach(target, card, viewport)!;
  expect(result).not.toBeNull();
  expect(result.left).toBeGreaterThanOrEqual(16);
  expect(result.left + card.width).toBeLessThanOrEqual(viewport.width - 16);
  expect(result.top - 46).toBeGreaterThanOrEqual(16);
  expect(result.top + card.height).toBeLessThanOrEqual(viewport.height - 16);
  const clear = { right: result.left > target.right, left: result.left + card.width < target.left, below: result.top - 46 > target.bottom, above: result.top + card.height < target.top };
  expect(clear[name as keyof typeof clear]).toBe(true);
});

it("requires an inline card when no floating position keeps the button visible", () => {
  expect(positionCoach({ left: 250, right: 580, top: 400, bottom: 444 }, { width: 330, height: 346 }, { width: 800, height: 522 })).toBeNull();
});

it("requires an inline card when the tip is taller than the viewport", () => {
  expect(positionCoach({ left: 100, right: 300, top: 150, bottom: 194 }, { width: 330, height: 700 }, { width: 1440, height: 626 })).toBeNull();
});
