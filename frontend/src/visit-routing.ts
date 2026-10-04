export function startRouteFor(hasDatasets: boolean): "#returning" | "#workspace" {
  return hasDatasets ? "#returning" : "#workspace";
}

export function isWorkspaceRoute(route: string): boolean {
  return route === "#workspace" || route.startsWith("#dataset/") || route.startsWith("#update/");
}

export function datasetIdFromRoute(route: string): string | undefined {
  if (!route.startsWith("#dataset/") && !route.startsWith("#update/")) return undefined;
  try { return decodeURIComponent(route.slice(route.indexOf("/") + 1)) || undefined; }
  catch { return undefined; }
}
