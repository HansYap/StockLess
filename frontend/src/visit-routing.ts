export function startRouteFor(datasetId?: string): string {
  return datasetId ? `#dataset/${encodeURIComponent(datasetId)}` : "#workspace";
}

export function isWorkspaceRoute(route: string): boolean {
  return route === "#workspace" || route === "#guide" || route.startsWith("#guide/") || route.startsWith("#dataset/") || route.startsWith("#update/");
}

export function datasetIdFromRoute(route: string): string | undefined {
  if (!route.startsWith("#dataset/") && !route.startsWith("#update/") && !route.startsWith("#guide/")) return undefined;
  try { return decodeURIComponent(route.slice(route.indexOf("/") + 1)) || undefined; }
  catch { return undefined; }
}
