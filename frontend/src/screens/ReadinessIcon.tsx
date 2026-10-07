import { WorkflowIcon } from "../components/WorkflowIcon.tsx";

const PATHS = {
  search: "M18 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0m-2 5 5 5",
  check: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0m-13 0 3 3 5-6",
  warning: "M12 4 2.5 20h19ZM12 10v4m0 3h.01",
  missing: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0m-12-3 6 6m0-6-6 6",
  download: "M12 4v12m0 0-5-5m5 5 5-5M4 20h16",
  filter: "M3 6h18M6 12h12M10 18h4",
  chevron: "m6 9 6 6 6-6",
  lock: "M5 10h14v10H5ZM8 10V7a4 4 0 0 1 8 0v3",
} as const;
type IconName = keyof typeof PATHS | "calendar" | "barcode" | "cart" | "box" | "document";

export function ReadinessIcon({ name }: { name: IconName }) {
  if (name === "calendar" || name === "barcode" || name === "cart" || name === "box" || name === "document") return <WorkflowIcon name={name} />;
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>;
}
