export type GuidePage = "upload" | "mapping" | "sidebar" | "history";
export interface GuideStep {
  readonly target: string;
  readonly mobileTarget?: string;
  readonly title: string;
  readonly body: string;
  readonly action?: string;
  readonly hint?: string;
}

/** Only stable screens have guides. Readiness, Purchase Plan and Impact are reserved. */
export const guides: Record<GuidePage, readonly GuideStep[]> = {
  upload: [
    { target: '[data-guide="upload-actions"]', title: "Start with your sales file", body: "Choose a file from your device. Just trying things out? Use the sample file to follow along.", action: "file:ready", hint: "Choose a highlighted button" },
    { target: '[data-guide="upload-continue"]', title: "Your file is ready", body: "Next, check that we’ve understood your column names. Click Continue to matching when you’re ready.", action: "import:complete", hint: "Click the highlighted button" },
  ],
  mapping: [
    { target: '[data-guide="mapping-required"]', title: "Check these three matches", body: "Make sure the date, product and quantity point to the right columns. You can change a match while this tip is showing." },
    { target: '[data-guide="mapping-optional"]', title: "Check any optional columns", body: "Stock, expiry dates and costs add more detail to your results. Check the columns you have, or choose Not in this file for anything missing." },
    { target: '[data-guide="mapping-confirm"]', mobileTarget: '[data-guide="mapping-confirm-inline"]', title: "Happy with the matches?", body: "Use the highlighted confirmation button to check your data and continue. Your original file stays as it is.", action: "mapping:complete", hint: "Click the highlighted button" },
  ],
  sidebar: [
    { target: '[data-guide="sidebar-navigation"], [data-guide="sidebar-menu"]', title: "Find your way around", body: "Use this navigation to return to your purchase plan or view your impact. On a small screen, open the menu to see these options." },
    { target: '[data-guide="sidebar-reupload"], [data-guide="sidebar-menu"]', title: "Ready for a newer sales file?", body: "Reupload starts a new import. Your saved plan stays available until the new purchase plan is ready." },
    { target: '[data-guide="sidebar-history"], [data-guide="sidebar-menu"]', title: "Your past uploads are here", body: "Open Upload history to see files you’ve used before. There’s room for your latest 12 uploads.", action: "history:opened", hint: "Open Upload history when you’re ready" },
  ],
  history: [
    { target: '[data-guide="history-resume"]', title: "Your uploads live here", body: "Real sales files appear here automatically once their purchase plan is ready. The newest upload is shown first. Samples are for practice and aren’t added." },
    { target: '[data-guide="history-list"]', title: "Find an earlier upload", body: "We keep your latest 12 uploads on this device. Search or sort the list, then open a file to see its saved plan." },
    { target: '[data-guide="history-manage"]', title: "You’re in control of your history", body: "Delete a file only if you no longer need it. Clear everything removes all uploads and saved plans from this device. You don’t need to clear anything to finish this guide." },
  ],
};

export const ONBOARDING_KEY = "stockless.onboarding.v1";
interface GuidePreferences { invited: boolean; completed: GuidePage[]; }
let memory: GuidePreferences = { invited: false, completed: [] };
export function readGuidePreferences(): GuidePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? "null") as Partial<GuidePreferences> | null;
    if (saved) return { invited: saved.invited === true, completed: Array.isArray(saved.completed) ? saved.completed.filter(page => Object.hasOwn(guides, page)) : [] };
  } catch { /* In-memory preferences keep guidance usable when storage is unavailable. */ }
  return memory;
}
export function rememberInvitation(): void {
  memory = { ...readGuidePreferences(), invited: true };
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(memory)); } catch { /* This visit still remembers the choice. */ }
}
export function rememberGuide(page: GuidePage): void {
  memory = { invited: true, completed: [...new Set([...readGuidePreferences().completed, page])] };
  try { localStorage.setItem(ONBOARDING_KEY, JSON.stringify(memory)); } catch { /* This visit still remembers the choice. */ }
}
export function guideRouteFor(returnId?: string): string { return returnId ? `#guide/${encodeURIComponent(returnId)}` : "#guide"; }

/** Pick a rendered target, including the mobile drawer rather than its hidden desktop copy. */
export function visibleGuideTarget(selector: string): HTMLElement | null {
  for (const preferred of selector.split(",")) {
    const found = [...document.querySelectorAll<HTMLElement>(preferred.trim())].find(element => element.getClientRects().length > 0 && !element.closest('dialog:not([open])'));
    if (found) return found;
  }
  return null;
}
