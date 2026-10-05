import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import Site from "../src/Site.tsx";

vi.mock("../src/storage/saved-datasets.ts", () => ({
  hasSavedDatasets: vi.fn().mockRejectedValue(new Error("Storage unavailable")),
}));

beforeEach(() => {
  window.location.hash = "#start";
});

it("opens Upload when saved-dataset storage cannot be checked", async () => {
  render(<Site />);
  await waitFor(() => expect(window.location.hash).toBe("#workspace"));
  expect(await screen.findByRole("heading", { name: "Upload your sales file" }, { timeout: 5000 })).toBeTruthy();
});
