const ICON_PATHS = {
  calendar: "M4 5h16v15H4ZM4 10h16M8 3v4m8-4v4",
  barcode: "M4 5v14M7 5v14M10 5v14M14 5v14M17 5v14M20 5v14",
  cart: "M3 4h2l2.2 10.5h10.9L20 8H6.2M10.4 19a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0m8 0a1.4 1.4 0 1 1-2.8 0 1.4 1.4 0 1 1 2.8 0",
  box: "m3 7 9-4 9 4v10l-9 4-9-4ZM3 7l9 4 9-4M12 11v10",
  document: "M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6",
  expiry: "M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9m8-18c0 5-8 5-8 9s8 4 8 9",
  cost: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0M15 9.5c-.5-1-1.6-1.5-3-1.5-1.7 0-3 .9-3 2s1.3 1.7 3 2 3 .9 3 2-1.3 2-3 2c-1.4 0-2.5-.5-3-1.5M12 6v2m0 8v2",
  truck: "M3 6h11v10H3ZM14 9h4l3 3v4h-7M8.6 17.5a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0m10 0a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 1 1 3.2 0",
  chart: "M3 21h18M5 20V12h3v8M11 20V7h3v13M17 20V3h3v17",
  leaf: "M20 4C5 3 2 9 5 16c7 8 15-2 15-12ZM4 21 16 8",
} as const;
export function WorkflowIcon({ name }: { readonly name: keyof typeof ICON_PATHS }) {
  return <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>;
}
