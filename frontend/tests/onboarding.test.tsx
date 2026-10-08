import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { GuideButton, OnboardingProvider, useGuidePage, useOnboarding } from "../src/onboarding/Onboarding.tsx";
import { ONBOARDING_KEY, visibleGuideTarget } from "../src/onboarding/guides.ts";
import { listSavedDatasets } from "../src/storage/saved-datasets.ts";
import { StrictMode } from "react";

vi.mock("../src/storage/saved-datasets.ts", () => ({ listSavedDatasets: vi.fn(async () => []) }));
function Screen({ invite = false, page = "upload" }: { invite?: boolean; page?: "upload" | "mapping" | "sidebar" | "history" | null }) {
  useGuidePage(page, invite);
  const guide = useOnboarding();
  return <><GuideButton /><button data-guide="upload-actions" onClick={() => guide.emit("file:ready")}>Choose a valid file</button><button data-guide="upload-continue">Continue to matching</button><button data-guide="mapping-confirm">Confirm matches</button></>;
}
beforeEach(() => {
  window.location.hash = "#workspace";
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ invited: false, completed: [] }));
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 200, height: 44 }] as unknown as DOMRectList);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 150, 200, 44));
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
});
afterEach(() => { vi.restoreAllMocks(); localStorage.removeItem(ONBOARDING_KEY); });

it("invites only on eligible Upload and remembers a skip for the current visit", async () => {
  const view = render(<OnboardingProvider><Screen page={null} /></OnboardingProvider>);
  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
  view.rerender(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  await waitFor(() => expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
  view.rerender(<OnboardingProvider><Screen page={null} /></OnboardingProvider>);
  view.rerender(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
  cleanup();
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  await waitFor(() => expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true));
});

it("invites again after a skipped guide on a fresh visit without saved work", async () => {
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Follow along" }));
  fireEvent.click(await screen.findByRole("button", { name: "Skip guide" }));
  cleanup();
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  expect(await screen.findByRole("button", { name: "Follow along" })).toBeTruthy();
});

it("lets users perform the highlighted action and advances only after the successful event", async () => {
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Follow along" }));
  await screen.findByRole("heading", { name: "Start with your sales file" });
  fireEvent.click(screen.getByRole("button", { name: "Continue to matching" }));
  expect(screen.getByRole("heading", { name: "Start with your sales file" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Choose a valid file" }));
  await screen.findByRole("heading", { name: "Your file is ready" });
  fireEvent.click(screen.getByRole("button", { name: "Skip guide" }));
  expect(screen.queryByRole("heading", { name: "Your file is ready" })).toBeNull();
  expect(screen.getByRole("button", { name: "Continue to matching" }).hasAttribute("disabled")).toBe(false);
});

it("Guide routes a returning user to guided Upload with their saved return id and no invitation", async () => {
  window.location.hash = "#dataset/old%20plan";
  render(<OnboardingProvider><Screen page={null} /></OnboardingProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guide" }));
  await waitFor(() => expect(window.location.hash).toBe("#guide/old%20plan"));
  expect(listSavedDatasets).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog", { hidden: true }).hasAttribute("open")).toBe(false);
});

it("replay from the same Guide route requests a fresh session, rather than retaining a partially completed import", async () => {
  window.location.hash = "#guide";
  const changed = vi.fn(); window.addEventListener("hashchange", changed);
  render(<OnboardingProvider><Screen /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Start with your sales file" });
  fireEvent.click(screen.getByRole("button", { name: "Choose a valid file" }));
  await screen.findByRole("heading", { name: "Your file is ready" });
  fireEvent.click(screen.getByRole("button", { name: "Guide" }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  window.removeEventListener("hashchange", changed);
});

it("starts replay guidance reliably when React checks mount effects twice", async () => {
  window.location.hash = "#guide";
  render(<StrictMode><OnboardingProvider><Screen /></OnboardingProvider></StrictMode>);
  expect(await screen.findByRole("heading", { name: "Start with your sales file" })).toBeTruthy();
});

it("prefers the open navigation content over its menu button, even when the button appears first in the page", () => {
  const view = render(<><button data-guide="sidebar-menu">Menu</button><nav data-guide="sidebar-navigation">Navigation</nav></>);
  expect(visibleGuideTarget('[data-guide="sidebar-navigation"], [data-guide="sidebar-menu"]')).toBe(view.container.querySelector("nav"));
});
