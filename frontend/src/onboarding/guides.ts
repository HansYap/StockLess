export type GuidePage = "upload" | "mapping" | "readiness" | "purchase" | "impact" | "sidebar" | "history";
export interface GuideStep {
  readonly target: string;
  readonly mobileTarget?: string;
  /** Return to the page actions after guiding owners through lower sections. */
  readonly scroll?: "top";
  readonly title: string;
  readonly body: string;
  readonly action?: string;
  readonly hint?: string;
  /** Some controls only exist for products with enough usable data. */
  readonly optional?: boolean;
  readonly alternatives?: readonly { readonly when: string; readonly title: string; readonly body: string }[];
}

export const guideLabels: Record<GuidePage, string> = { upload: "Upload", mapping: "Match columns", readiness: "Data readiness", purchase: "Purchase plan", impact: "Impact dashboard", sidebar: "Your workspace", history: "Upload history" };

/** One useful decision per tip; only Upload and Matching require successful actions. */
export const guides: Record<GuidePage, readonly GuideStep[]> = {
  upload: [
    { target: '[data-guide="upload-actions"]', title: "Start with your sales file", body: "Choose one file containing the full sales period you want to analyse. Later uploads replace the plan’s sales data; they do not add to it. Use the sample file to practise.", action: "file:ready", hint: "Choose a highlighted button" },
    { target: '[data-guide="upload-continue"]', title: "Your file is ready", body: "Next, check that we’ve understood your column names. Click Continue to matching when you’re ready.", action: "import:complete", hint: "Click the highlighted button" },
  ],
  mapping: [
    { target: '[data-guide="mapping-required"]', title: "Check these three matches", body: "Make sure the date, product and quantity point to the right columns. You can change a match while this tip is showing." },
    { target: '[data-guide="mapping-optional"]', title: "Check any optional columns", body: "Stock, expiry dates and costs add more detail to your results. Check the columns you have, or choose Not in this file for anything missing." },
    { target: '[data-guide="mapping-confirm"]', mobileTarget: '[data-guide="mapping-confirm-inline"]', title: "Happy with the matches?", body: "Confirm to check this file and continue. Your plan uses this file’s sales data; previous uploads are not combined. Your original file on your device stays as it is.", action: "mapping:complete", hint: "Click the highlighted button" },
  ],
  readiness: [
    { target: '[data-guide="readiness-summary"], [data-guide="readiness-status"]', title: "Can I use this file?", body: "Ready products can be planned. Need review means there is something to check. Need more data means that product cannot be planned yet. You can still continue with usable rows.", alternatives: [{ when: '[data-guide="readiness-status"][data-guide-state="blocked"]', title: "Your file needs a correction first", body: "There are no usable sales rows yet. Check What we found below. Fix the listed problems in your original file, or return to matching if the wrong columns were chosen. Then check the file again." }] },
    { target: '[data-guide="readiness-products"], [data-guide="readiness-views"]', title: "Check a product when you need to", body: "Search by product name or code. View details explains what needs checking and which sales weeks are available. Rows in your file shows how individual records were handled. You do not need to open every product." },
    { target: '[data-guide="readiness-findings"]', title: "What needs fixing?", body: "What we found explains each issue and what to do. Left out rows are not used in the plan. Download list helps you fix your original file and upload it again. StockLess does not change that file." },
    { target: '[data-guide="readiness-continue"]', scroll: "top", title: "Start planning with usable data", body: "Continue to purchase planning when you are ready. Products that need more data may have no suggestion yet; you can fix them later. Need review does not mean the whole file must be perfect.", alternatives: [{ when: '[data-guide="readiness-status"][data-guide-state="blocked"]', title: "Fix the file before continuing", body: "Continue becomes available when there are usable sales rows. Use Back to matching to correct column choices, or return to Upload with your corrected file. Your original file stays on your device." }] },
  ],
  purchase: [
    { target: '[data-guide="purchase-products"]', title: "Start with one product", body: "Choose a product from the list to see its order details. The cards above filter products by what needs attention. Search by name or code, and work through one product at a time." },
    { target: '[data-guide="purchase-demand"], [data-guide="purchase-unavailable"], [data-guide="purchase-empty"]', title: "How much might sell?", body: "Expected sales is a range for the next four weeks, not a guarantee. Compare it with stock on hand. The suggested order is a starting point based on this data. Show evidence explains the figures.", alternatives: [
      { when: '[data-guide="purchase-unavailable"]', title: "This product needs more data", body: "Read the reason shown here. Fix it in Step 3 takes you back to the product’s data checks. Choose another product to plan now. Order and supplier tips appear for products that can be assessed." },
      { when: '[data-guide="purchase-empty"]', title: "Choose a product to see its plan", body: "Select a product from the list. If there are no results, clear your search or filters. Its sales, stock and order details will appear here." },
    ] },
    { target: '[data-guide="purchase-order"]', optional: true, title: "Choose what you plan to buy", body: "Suggested drafts are already shown. Use the suggestion or type your own quantity; zero means no order. Incoming stock is stock already on the way. Include it so you do not order the same stock twice." },
    { target: '[data-guide="purchase-supplier"]', optional: true, title: "Does your supplier sell by the case?", body: "Supplier rules affect the suggested order in your purchase plan. If needed, enter units per case, minimum order in units and delivery time in days. Check the adjusted quantity and arrival date. Apply it if suitable; an order you typed stays until you apply the new quantity." },
    { target: '[data-guide="purchase-expiry"]', optional: true, title: "Will this stock sell before expiry?", body: "Review expiry to confirm a date or that the product does not expire. Checked dates from your file are already included. Watch for expiry warnings. A date alone does not provide the batch quantities needed for a full expiry check." },
    { target: '[data-guide="purchase-check"]', optional: true, title: "Check the order before deciding", body: "Too high, too low or within range compares stock after ordering with expected sales. Recheck after applying supplier rules. Check expiry warnings too; without usable expiry data, this check uses stock and demand only. Estimated spending below needs a usable purchase cost." },
    { target: '[data-guide="purchase-next"]', scroll: "top", title: "Your draft is ready to review", body: "Use Done, next product to work through the list, or Review suggested orders to review drafts together. Download your draft or open Impact here. These are planning quantities; StockLess never sends an order to a supplier." },
  ],
  impact: [
    { target: '[data-guide="impact-summary"]', title: "What does this plan mean for my shop?", body: "These estimates use your current orders for the next four weeks. Possible excess is stock to reconsider before buying. It is not confirmed waste, money saved or an actual reduction in emissions." },
    { target: '[data-guide="impact-views"]', title: "Look at money and the environment", body: "Business shows spending and money tied up in possible excess. Environmental shows estimated carbon impact. Each figure has its own product coverage. Unavailable means information is missing, not that the result is zero." },
    { target: '[data-guide="impact-story"]', title: "See your plan as a story", body: "Play story shows stock within expected sales and possible excess. Imagine reducing that excess before buying. The illustration does not change your orders; adjust them in Purchase plan. You can replay it or keep going.", alternatives: [{ when: '[data-guide="impact-story"][data-guide-state="empty"]', title: "Your plan will appear here", body: "This illustration compares stock with expected sales. Add a planned order for a product with usable sales data in Purchase plan to see its story. You can continue this guide now." }] },
    { target: '[data-guide="impact-products"]', title: "Find what is behind the totals", body: "This list shows products with possible excess. See products on an estimate shows which products were included and why others were left out. Missing cost, category or weight can be added in Purchase Plan; you can keep planning without them." },
    { target: '[data-guide="impact-downloads"]', title: "Keep your results or adjust your plan", body: "Download the analysis to keep your estimates, or the order list for current positive order quantities. Back to the purchase plan lets you adjust quantities and review the updated impact. Downloads do not place an order." },
  ],
  sidebar: [
    { target: '[data-guide="sidebar-navigation"], [data-guide="sidebar-menu"]', title: "Find your way around", body: "Use this navigation to return to your purchase plan or view your impact. On a small screen, open the menu to see these options." },
    { target: '[data-guide="sidebar-reupload"], [data-guide="sidebar-menu"]', title: "Keep your plan up to date", body: "Reupload replaces the plan’s sales data, so include the full sales period in one file. Your saved plan stays available until the new one is ready. Upload history holds your latest 12 uploads on this device. Visit it whenever you need an older plan." },
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
    const found = [...document.querySelectorAll<HTMLElement>(preferred.trim())].find(element => element.getClientRects().length > 0 && !element.closest('[hidden], dialog:not([open])'));
    if (found) return found;
  }
  return null;
}

export function availableGuideIndexes(page: GuidePage): number[] {
  return guides[page].flatMap((step, index) => !step.optional || visibleGuideTarget(step.target) ? [index] : []);
}

export function resolveGuideStep(step: GuideStep): GuideStep {
  const alternative = step.alternatives?.find(item => visibleGuideTarget(item.when));
  return alternative ? { ...step, title: alternative.title, body: alternative.body } : step;
}
