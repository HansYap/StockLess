import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Site from "../src/Site.tsx";
import { listSavedDatasets } from "../src/storage/saved-datasets.ts";

vi.mock("../src/storage/saved-datasets.ts", () => ({ listSavedDatasets: vi.fn() }));
vi.mock("../src/App.tsx", () => ({ default: ({ initialDatasetId }: { initialDatasetId?: string }) => <>
  <h1>{initialDatasetId ? "Current purchase plan" : "Upload your sales file"}</h1>
  {initialDatasetId && <aside aria-label="Workspace navigation">{initialDatasetId}</aside>}
</> }));

beforeEach(() => { vi.resetAllMocks(); HTMLElement.prototype.scrollIntoView = vi.fn(); window.location.hash = "#start"; });

it("opens Upload when saved storage cannot be checked from Start", async () => {
  vi.mocked(listSavedDatasets).mockRejectedValue(new Error("Storage unavailable"));
  render(<Site />);
  await waitFor(() => expect(window.location.hash).toBe("#workspace"));
  expect(await screen.findByRole("heading", { name: "Upload your sales file" })).toBeTruthy();
});

it.each(["", "#home", "#start"])("opens returning visitors directly in the latest purchase plan from %s", async hash => {
  window.location.hash = hash;
  vi.mocked(listSavedDatasets).mockResolvedValue([{ id: "latest / file" }, { id: "older" }] as Awaited<ReturnType<typeof listSavedDatasets>>);
  render(<Site />);
  await screen.findByRole("heading", { name: "Current purchase plan" });
  expect(window.location.hash).toBe("#dataset/latest%20%2F%20file");
  expect(screen.getByRole("complementary", { name: "Workspace navigation" }).textContent).toBe("latest / file");
  expect(screen.queryByRole("heading", { name: "Upload history" })).toBeNull();
});

it.each([false, true])("keeps the homepage top open after clicking a workflow card (saved data: %s)", async hasSavedData => {
  window.location.hash = "#top";
  vi.mocked(listSavedDatasets).mockResolvedValue(hasSavedData ? [{ id: "latest" }] as Awaited<ReturnType<typeof listSavedDatasets>> : []);
  render(<Site />);
  await waitFor(() => expect(document.getElementById("home-title")).toBeTruthy());
  expect(window.location.hash).toBe("#top");
  expect(screen.queryByRole("heading", { name: "Current purchase plan" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Upload your sales file" })).toBeNull();
});

it.each(["", "#home", "#workspace", "#guide", "#history", "#returning"])("returns visitors without saved work to the landing page when reopening %s", async hash => {
  window.location.hash = hash;
  localStorage.setItem("stockless.hasUploaded", "true");
  localStorage.setItem("stockless.onboarding.v1", JSON.stringify({ invited: true, completed: [] }));
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<Site />);
  await waitFor(() => expect(window.location.hash).toBe("#home"));
  expect(document.getElementById("home-title")).toBeTruthy();
  expect(screen.queryByRole("complementary", { name: "Workspace navigation" })).toBeNull();
  localStorage.removeItem("stockless.hasUploaded");
  localStorage.removeItem("stockless.onboarding.v1");
});

it("keeps the landing page accessible when local storage is unavailable", async () => {
  window.location.hash = "";
  vi.mocked(listSavedDatasets).mockRejectedValue(new Error("Storage unavailable"));
  render(<Site />);
  await waitFor(() => expect(window.location.hash).toBe("#home"));
  expect(document.getElementById("home-title")).toBeTruthy();
});

it("starts new visitors at Upload after the landing page", async () => {
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<Site />);
  await screen.findByRole("heading", { name: "Upload your sales file" });
  expect(window.location.hash).toBe("#workspace");
});
