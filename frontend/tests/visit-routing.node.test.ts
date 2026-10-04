import assert from "node:assert/strict";
import { test } from "node:test";
import { datasetIdFromRoute, isWorkspaceRoute, startRouteFor } from "../src/visit-routing.ts";

test("the landing page starts new visitors at upload and returning visitors at saved datasets", () => {
  assert.equal(startRouteFor(false), "#workspace");
  assert.equal(startRouteFor(true), "#returning");
});

test("saved dataset links keep each dataset identity separate", () => {
  const id = "shop one / sales";
  assert.equal(datasetIdFromRoute(`#dataset/${encodeURIComponent(id)}`), id);
  assert.equal(datasetIdFromRoute(`#update/${encodeURIComponent(id)}`), id);
  assert.equal(isWorkspaceRoute("#returning"), false);
  assert.equal(isWorkspaceRoute("#workspace"), true);
  assert.equal(isWorkspaceRoute(`#dataset/${encodeURIComponent(id)}`), true);
});
