import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Site from "../src/Site.tsx";
import { listSavedDatasets } from "../src/storage/saved-datasets.ts";

vi.mock("../src/storage/saved-datasets.ts", () => ({ listSavedDatasets: vi.fn() }));
vi.mock("../src/App.tsx", () => ({ default: ({ initialDatasetId }: { initialDatasetId?: string }) => <>
  <h1>{initialDatasetId ? "Current purchase plan" : "Upload your sales file"}</h1>
  {initialDatasetId && <aside aria-label="Workspace navigation">{initialDatasetId}</aside>}
</> }));

beforeEach(() => { vi.resetAllMocks(); window.location.hash = "#start"; });

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

it("keeps the landing page for first-time visitors", async () => {
  window.location.hash = "";
  vi.mocked(listSavedDatasets).mockResolvedValue([]);
  render(<Site />);
  await waitFor(() => expect(window.location.hash).toBe("#home"));
  expect(document.getElementById("home-title")).toBeTruthy();
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
