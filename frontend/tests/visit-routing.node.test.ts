import assert from "node:assert/strict";
import { test } from "node:test";
import { datasetIdFromRoute, isWorkspaceRoute, startRouteFor } from "../src/visit-routing.ts";

test("the landing page starts new visitors at upload and returning visitors at their latest purchase plan", () => {
  assert.equal(startRouteFor(), "#workspace");
  assert.equal(startRouteFor("latest / upload"), "#dataset/latest%20%2F%20upload");
});

test("saved dataset links keep each dataset identity separate", () => {
  const id = "shop one / sales";
  assert.equal(datasetIdFromRoute(`#dataset/${encodeURIComponent(id)}`), id);
  assert.equal(datasetIdFromRoute(`#update/${encodeURIComponent(id)}`), id);
  assert.equal(isWorkspaceRoute("#returning"), false);
  assert.equal(isWorkspaceRoute("#workspace"), true);
  assert.equal(isWorkspaceRoute(`#dataset/${encodeURIComponent(id)}`), true);
});
