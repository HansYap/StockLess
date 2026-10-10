import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { GuideButton, OnboardingProvider, useGuidePage, useOnboarding } from "../src/onboarding/Onboarding.tsx";
import { ONBOARDING_KEY, guides, guideLabels, readGuidePreferences, visibleGuideTarget, type GuidePage } from "../src/onboarding/guides.ts";
import { AppShell } from "../src/components/AppShell.tsx";
import { messages } from "../src/i18n/messages.ts";
import { listSavedDatasets } from "../src/storage/saved-datasets.ts";
import { StrictMode } from "react";

vi.mock("../src/storage/saved-datasets.ts", () => ({ listSavedDatasets: vi.fn(async () => []) }));
function Screen({ invite = false, page = "upload" }: { invite?: boolean; page?: GuidePage | null }) {
  useGuidePage(page, invite);
  const guide = useOnboarding();
  return <><GuideButton /><button data-guide="upload-actions" onClick={() => guide.emit("file:ready")}>Choose a valid file</button><button data-guide="upload-continue">Continue to matching</button><button data-guide="mapping-confirm">Confirm matches</button></>;
}
beforeEach(() => {
  window.location.hash = "#workspace";
  localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ invited: false, completed: [] }));
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 200, height: 44 }] as unknown as DOMRectList);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(100, 150, 200, 44));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.removeItem(ONBOARDING_KEY); });

it("invites only once on eligible Upload, including after a reload", async () => {
  const view = render(<OnboardingProvider><Screen page={null} /></OnboardingProvider>);
  expect(document.querySelector(".onboarding-welcome:not(.onboarding-guide-menu)")?.hasAttribute("open")).toBe(false);
  view.rerender(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  await waitFor(() => expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
  expect(document.querySelector(".onboarding-welcome:not(.onboarding-guide-menu)")?.hasAttribute("open")).toBe(false);
  view.rerender(<OnboardingProvider><Screen page={null} /></OnboardingProvider>);
  view.rerender(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  expect(document.querySelector(".onboarding-welcome:not(.onboarding-guide-menu)")?.hasAttribute("open")).toBe(false);
  cleanup();
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  expect(document.querySelector(".onboarding-welcome:not(.onboarding-guide-menu)")?.hasAttribute("open")).toBe(false);
});

it("does not invite again after a skipped guide on a fresh visit without saved work", async () => {
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Follow along" }));
  fireEvent.click(await screen.findByRole("button", { name: "Skip guide" }));
  cleanup();
  render(<OnboardingProvider><Screen invite /></OnboardingProvider>);
  expect(document.querySelector(".onboarding-welcome:not(.onboarding-guide-menu)")?.hasAttribute("open")).toBe(false);
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
  fireEvent.click(screen.getByRole("button", { name: "Restart full setup guide" }));
  await waitFor(() => expect(window.location.hash).toBe("#guide/old%20plan"));
  expect(listSavedDatasets).not.toHaveBeenCalled();
  expect(document.querySelector(".onboarding-welcome:not(.onboarding-guide-menu)")?.hasAttribute("open")).toBe(false);
});

it("replay from the same Guide route requests a fresh session, rather than retaining a partially completed import", async () => {
  window.location.hash = "#guide";
  const changed = vi.fn(); window.addEventListener("hashchange", changed);
  render(<OnboardingProvider><Screen /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Start with your sales file" });
  fireEvent.click(screen.getByRole("button", { name: "Choose a valid file" }));
  await screen.findByRole("heading", { name: "Your file is ready" });
  fireEvent.click(screen.getByRole("button", { name: "Guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Restart full setup guide" }));
  await waitFor(() => expect(changed).toHaveBeenCalled());
  window.removeEventListener("hashchange", changed);
});

const targets: Partial<Record<GuidePage, string[]>> = {
  upload: ["upload-actions", "upload-continue"],
  mapping: ["mapping-required", "mapping-optional", "mapping-confirm"],
  readiness: ["readiness-summary", "readiness-status", "readiness-products", "readiness-findings", "readiness-continue"],
  purchase: ["purchase-products", "purchase-demand", "purchase-order", "purchase-supplier", "purchase-expiry", "purchase-check", "purchase-next"],
  impact: ["impact-summary", "impact-views", "impact-story", "impact-products", "impact-downloads"],
  history: ["history-resume", "history-list", "history-manage"],
};
function Page({ page, sidebar = true, unavailable = false, blocked = false, workspaceShell = false, beforeSetup }: {
  page: GuidePage; sidebar?: boolean; unavailable?: boolean; blocked?: boolean; workspaceShell?: boolean;
  beforeSetup?: () => Promise<string | undefined>;
}) {
  useGuidePage(page);
  const content = <>
    {sidebar && <><nav data-guide="sidebar-navigation">Navigation</nav><button data-guide="sidebar-reupload">Reupload</button><a href="#history">Upload history</a></>}
    {targets[page]?.filter(target => !unavailable || !["purchase-demand", "purchase-order", "purchase-supplier", "purchase-check"].includes(target)).map(target => <section key={target} data-guide={target} data-guide-state={target === "readiness-status" && blocked ? "blocked" : undefined}>{target}</section>)}
    {unavailable && <section data-guide="purchase-unavailable">Not enough sales history</section>}
  </>;
  return workspaceShell ? <AppShell current={page === "upload" ? 1 : page === "mapping" ? 2 : page === "readiness" ? 3 : 4}
    reached={4} onNavigate={() => {}} onBeforeSetupGuide={beforeSetup}>{content}</AppShell>
    : <><GuideButton onBeforeSetup={beforeSetup} />{content}</>;
}
async function finishTips(count: number) {
  for (let index = 0; index < count; index++) {
    const button = await screen.findByRole("button", { name: /^(Got it|Done)/ });
    expect(document.querySelector(".onboarding-coach__stocky .stocky")).not.toBeNull();
    fireEvent.click(button);
  }
}

it.each(["upload", "mapping", "readiness", "purchase", "impact", "history"] as const)("starts %s's page guide from the workspace dialog without waiting for saves", async page => {
  const beforeSetup = vi.fn(async () => { throw new Error("Storage unavailable"); });
  render(<OnboardingProvider><Page page={page} workspaceShell beforeSetup={beforeSetup} /></OnboardingProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guide", exact: true }));
  const targetBounds = vi.mocked(HTMLElement.prototype.getBoundingClientRect);
  targetBounds.mockImplementation(function (this: HTMLElement) {
    if (this.hasAttribute("data-guide")) expect(document.querySelector(".onboarding-guide-menu[open]")).toBeNull();
    return new DOMRect(100, 150, 200, 44);
  });
  fireEvent.click(screen.getByRole("button", { name: `Guide this page · ${guideLabels[page]}` }));
  await screen.findByRole("heading", { name: guides[page][0].title });
  expect(beforeSetup).not.toHaveBeenCalled();
  expect(document.querySelectorAll(".onboarding-coach")).toHaveLength(1);
});

it("starts workspace navigation directly even if saving is unavailable", async () => {
  const beforeSetup = vi.fn(async () => { throw new Error("Storage unavailable"); });
  render(<OnboardingProvider><Page page="purchase" workspaceShell beforeSetup={beforeSetup} /></OnboardingProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guide", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Workspace navigation guide" }));
  await screen.findByRole("heading", { name: "Find your way around" });
  expect(beforeSetup).not.toHaveBeenCalled();
  expect(document.querySelector(".onboarding-guide-menu[open]")).toBeNull();
});

it("saves before a full restart, keeps failure actionable, and retries with the saved return id", async () => {
  const beforeSetup = vi.fn<() => Promise<string | undefined>>()
    .mockRejectedValueOnce(new Error("Storage unavailable"))
    .mockImplementationOnce(async () => {
      expect(document.querySelector(".onboarding-guide-menu[open]")).not.toBeNull();
      return "saved plan";
    });
  render(<OnboardingProvider><Page page="purchase" workspaceShell beforeSetup={beforeSetup} /></OnboardingProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guide", exact: true }));
  fireEvent.click(screen.getByRole("button", { name: "Restart full setup guide" }));
  await screen.findByRole("alert");
  expect(window.location.hash).toBe("#workspace");
  expect(document.querySelector(".onboarding-guide-menu[open]")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Restart full setup guide" }));
  await waitFor(() => expect(window.location.hash).toBe("#guide/saved%20plan"));
  expect(beforeSetup).toHaveBeenCalledTimes(2);
  expect(document.querySelector(".onboarding-guide-menu[open]")).toBeNull();
});

it("guides Readiness then all seven Purchase tips before two sidebar tips, without requiring History", async () => {
  window.location.hash = "#guide";
  const view = render(<OnboardingProvider><Page page="readiness" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Can I use this file?" });
  await finishTips(4);
  view.rerender(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Start with one product" });
  await finishTips(3);
  await screen.findByRole("heading", { name: "Does your supplier sell by the case?" });
  await finishTips(1);
  await screen.findByRole("heading", { name: "Will this stock sell before expiry?" });
  await finishTips(3);
  await screen.findByRole("heading", { name: "Find your way around" });
  expect(document.querySelectorAll(".onboarding-coach")).toHaveLength(1);
  await finishTips(2);
  expect(window.location.hash).toBe("#guide");
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
  view.rerender(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "What does this plan mean for my shop?" });
  await finishTips(5);
  view.rerender(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
  expect(readGuidePreferences().completed).toEqual(["readiness", "purchase", "sidebar", "impact"]);
  view.rerender(<OnboardingProvider><Page page="history" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Your uploads live here" });
});

it("replays just the current page without navigating or starting the next page's guide", async () => {
  window.location.hash = "#dataset/my-plan";
  const view = render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Guide this page · Purchase plan" }));
  await screen.findByRole("heading", { name: "Start with one product" });
  expect(window.location.hash).toBe("#dataset/my-plan");
  expect(listSavedDatasets).not.toHaveBeenCalled();
  await finishTips(7);
  expect(screen.queryByRole("heading", { name: "Find your way around" })).toBeNull();
  view.rerender(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
});

it.each([
  { page: "readiness" as const, beforeFinal: 3, width: 1280, target: "readiness-continue" },
  { page: "purchase" as const, beforeFinal: 6, width: 1280, target: "purchase-next" },
  { page: "readiness" as const, beforeFinal: 3, width: 390, target: "readiness-continue" },
  { page: "purchase" as const, beforeFinal: 6, width: 390, target: "purchase-next" },
])("returns to the top for $page's final tip at $width px, then allows normal scrolling", async ({ page, beforeFinal, width, target }) => {
  window.location.hash = "#guide";
  vi.stubGlobal("innerWidth", width);
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    // The action row is partly visible: the old off-screen check missed it.
    return this.dataset.guide === target ? new DOMRect(100, -120, 200, 240) : new DOMRect(100, 150, 200, 44);
  });
  render(<OnboardingProvider><Page page={page} sidebar={false} /></OnboardingProvider>);
  await finishTips(beforeFinal - 1);
  vi.mocked(window.scrollTo).mockClear();
  await finishTips(1);
  await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" }));
  if (width <= 760) expect(document.querySelector(".onboarding-slot")?.previousElementSibling?.getAttribute("data-guide")).toBe(target);
  // Allow the bounded layout corrections to finish before an owner scrolls.
  for (let frame = 0; frame < 4; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
  vi.mocked(window.scrollTo).mockClear();
  fireEvent.scroll(window);
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(window.scrollTo).not.toHaveBeenCalled();
});

it("includes the illustrated Impact story without requiring the owner to play it", async () => {
  window.location.hash = "#guide";
  render(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  await finishTips(2);
  await screen.findByRole("heading", { name: "See your plan as a story" });
  expect(document.querySelector(".onboarding-coach p")?.textContent).toContain("The illustration does not change your orders");
  expect(document.querySelector(".onboarding-coach__stocky .stocky")).not.toBeNull();
  await finishTips(1);
  await screen.findByRole("heading", { name: "Find what is behind the totals" });
});

it("keeps a tall tip inline when its wider layout makes the card shorter", async () => {
  window.location.hash = "#guide";
  vi.stubGlobal("innerWidth", 1440); vi.stubGlobal("innerHeight", 900);
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    return this.dataset.guide === "purchase-check" ? new DOMRect(100, 150, 650, 451) : new DOMRect(100, 150, 200, 44);
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    if (!this.classList.contains("onboarding-coach")) return 44;
    return this.parentElement?.classList.contains("onboarding-slot") ? 304 : 414;
  });
  render(<OnboardingProvider><Page page="purchase" sidebar={false} /></OnboardingProvider>);
  await finishTips(5);
  await screen.findByRole("heading", { name: "Check the order before deciding" });
  await waitFor(() => expect(document.querySelector(".onboarding-coach")?.parentElement?.className).toBe("onboarding-slot"));
  for (let frame = 0; frame < 5; frame++) {
    fireEvent(window, new Event("resize"));
    await new Promise(resolve => requestAnimationFrame(resolve));
    expect(document.querySelector(".onboarding-coach")?.parentElement?.className).toBe("onboarding-slot");
  }
  await finishTips(1);
  await screen.findByRole("heading", { name: "Your draft is ready to review" });
});

it("puts the final Readiness tip after the action when a short desktop has no floating space", async () => {
  window.location.hash = "#guide";
  vi.stubGlobal("innerWidth", 800); vi.stubGlobal("innerHeight", 522);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(346);
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    return this.dataset.guide === "readiness-continue" ? new DOMRect(250, 400, 330, 44) : new DOMRect(100, 150, 200, 44);
  });
  render(<OnboardingProvider><Page page="readiness" /></OnboardingProvider>);
  await finishTips(3);
  await screen.findByRole("heading", { name: "Start planning with usable data" });
  await waitFor(() => expect(document.querySelector(".onboarding-coach")?.parentElement?.className).toBe("onboarding-slot"));
  expect(document.querySelector(".onboarding-slot")?.previousElementSibling?.getAttribute("data-guide")).toBe("readiness-continue");
});

it("reveals the final Readiness action below the app bar when the phone header fills the screen", async () => {
  window.location.hash = "#guide";
  vi.stubGlobal("innerWidth", 390); vi.stubGlobal("innerHeight", 626); vi.stubGlobal("scrollY", 0);
  vi.mocked(window.scrollTo).mockImplementation(options => {
    if (typeof options === "object") vi.stubGlobal("scrollY", options.top ?? 0);
  });
  vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (this: HTMLElement) {
    return this.dataset.guide === "readiness-continue" ? new DOMRect(16, 900 - window.scrollY, 256, 44) : new DOMRect(16, 150, 343, 44);
  });
  render(<OnboardingProvider><Page page="readiness" /></OnboardingProvider>);
  await finishTips(3);
  await waitFor(() => expect(window.scrollY).toBe(768));
  expect(document.querySelector('[data-guide="readiness-continue"]')?.getBoundingClientRect().top).toBe(132);
  expect(document.querySelector(".onboarding-slot")?.previousElementSibling?.getAttribute("data-guide")).toBe("readiness-continue");
});

it("explains how to make the Impact story available when there are no assessed orders", async () => {
  window.location.hash = "#guide";
  function EmptyStory() {
    useGuidePage("impact");
    return <><section data-guide="impact-summary" /><section data-guide="impact-views" /><section data-guide="impact-story" data-guide-state="empty" /><section data-guide="impact-products" /><section data-guide="impact-downloads" /></>;
  }
  render(<OnboardingProvider><EmptyStory /></OnboardingProvider>);
  await finishTips(2);
  await screen.findByRole("heading", { name: "Your plan will appear here" });
  await finishTips(3);
  expect(readGuidePreferences().completed).toContain("impact");
});

it("lets Impact take priority over unfinished sidebar tips and resumes those tips on return", async () => {
  window.location.hash = "#guide";
  const view = render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await finishTips(7);
  await screen.findByRole("heading", { name: "Find your way around" });
  await finishTips(1);
  view.rerender(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "What does this plan mean for my shop?" });
  expect(document.querySelectorAll(".onboarding-coach")).toHaveLength(1);
  view.rerender(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Keep your plan up to date" });
});

it("resumes an unfinished page after navigation and supports going back", async () => {
  window.location.hash = "#guide";
  const view = render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await finishTips(3);
  await screen.findByRole("heading", { name: "Does your supplier sell by the case?" });
  view.rerender(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "What does this plan mean for my shop?" });
  view.rerender(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Does your supplier sell by the case?" });
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  await screen.findByRole("heading", { name: "Choose what you plan to buy" });
});

it("switches safely from a late Purchase tip to a shorter Impact guide", async () => {
  window.location.hash = "#guide";
  const view = render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await finishTips(5);
  await screen.findByRole("heading", { name: "Check the order before deciding" });
  view.rerender(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "What does this plan mean for my shop?" });
  await new Promise(resolve => requestAnimationFrame(resolve));
  expect(document.querySelector(".onboarding-coach__top")?.textContent).toContain("1 / 5");
});

it("skips one page while continuing the journey and lets Skip guide stop everything", async () => {
  window.location.hash = "#guide";
  const view = render(<OnboardingProvider><Page page="readiness" /></OnboardingProvider>);
  fireEvent.click(await screen.findByRole("button", { name: "Skip this page" }));
  view.rerender(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Start with one product" });
  fireEvent.click(screen.getByRole("button", { name: "Skip guide" }));
  view.rerender(<OnboardingProvider><Page page="impact" /></OnboardingProvider>);
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
  expect(readGuidePreferences().completed).not.toContain("readiness");
});

it("explains blocked readiness without asking the owner to press a disabled action", async () => {
  window.location.hash = "#guide";
  render(<OnboardingProvider><Page page="readiness" blocked /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Your file needs a correction first" });
  await finishTips(3);
  await screen.findByRole("heading", { name: "Fix the file before continuing" });
  fireEvent.click(screen.getByRole("button", { name: /Done/ }));
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
});

it("omits unavailable order and supplier controls and gives useful recovery guidance", async () => {
  window.location.hash = "#guide";
  render(<OnboardingProvider><Page page="purchase" unavailable sidebar={false} /></OnboardingProvider>);
  await finishTips(1);
  await screen.findByRole("heading", { name: "This product needs more data" });
  expect(document.querySelector(".onboarding-coach__top")?.textContent).toContain("2 / 4");
  await finishTips(1);
  await screen.findByRole("heading", { name: "Will this stock sell before expiry?" });
  await finishTips(2);
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
});

it("pauses coach marks while a real dialog is open and restores them on close", async () => {
  window.location.hash = "#guide";
  render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  await screen.findByRole("heading", { name: "Start with one product" });
  fireEvent.click(screen.getByRole("button", { name: "Guide" }));
  await waitFor(() => expect(document.querySelector(".onboarding-coach")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await screen.findByRole("heading", { name: "Start with one product" });
});

it("allows a separate sidebar replay and remembers completed guidance across visits", async () => {
  const view = render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Guide" }));
  fireEvent.click(screen.getByRole("button", { name: "Workspace navigation guide" }));
  await screen.findByRole("heading", { name: "Find your way around" });
  await finishTips(2);
  view.unmount();
  render(<OnboardingProvider><Page page="purchase" /></OnboardingProvider>);
  expect(readGuidePreferences().completed).toContain("sidebar");
  expect(screen.queryByRole("button", { name: "Skip guide" })).toBeNull();
});

it("has Chinese and Malay copy for every tip, including alternate states", () => {
  for (const step of Object.values(guides).flat()) {
    for (const text of [step.title, step.body, ...step.alternatives?.flatMap(item => [item.title, item.body]) ?? []]) {
      expect(messages[text], text).toBeDefined();
      expect(messages[text]?.every(value => value.length > 0), text).toBe(true);
    }
  }
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
