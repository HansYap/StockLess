import type {
  CanonicalField,
  CapabilityId,
  CapabilityReason,
  CapabilityResult,
  CapabilityEvidenceContext,
  MappingState,
} from "./contracts.ts";
import { CANONICAL_FIELDS, CORE_COLUMN_PATHS, FIELD_REGISTRY } from "./field-registry.ts";

interface CapabilityDefinition {
  readonly id: CapabilityId;
  readonly label: string;
  readonly iterationEnabled: boolean;
  readonly requiredFields: readonly CanonicalField[];
}

export const CAPABILITY_LABELS: Readonly<Record<CapabilityId, string>> = Object.freeze({
  weekly_history: "Weekly product history",
  timeline_gap_evidence: "Timeline gap evidence",
  recent_weekly_average: "Recent weekly average",
  stock_freshness: "Stock freshness",
  weeks_of_cover: "Descriptive weeks of cover",
  purchase_audit: "Purchase audit",
  expiry_aware_note: "Expiry-aware note",
  supplier_scenario: "Supplier scenario",
});

const CAPABILITY_REGISTRY: readonly CapabilityDefinition[] = Object.freeze([
  { id: "weekly_history", label: CAPABILITY_LABELS.weekly_history, iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold"] },
  { id: "timeline_gap_evidence", label: CAPABILITY_LABELS.timeline_gap_evidence, iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold"] },
  { id: "recent_weekly_average", label: CAPABILITY_LABELS.recent_weekly_average, iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold"] },
  { id: "stock_freshness", label: CAPABILITY_LABELS.stock_freshness, iterationEnabled: true, requiredFields: ["current_stock", "stock_as_of_date"] },
  { id: "weeks_of_cover", label: CAPABILITY_LABELS.weeks_of_cover, iterationEnabled: true, requiredFields: ["transaction_date", "quantity_sold", "current_stock", "stock_as_of_date"] },
  { id: "purchase_audit", label: CAPABILITY_LABELS.purchase_audit, iterationEnabled: false, requiredFields: ["planned_order_quantity", "incoming_stock_quantity", "current_stock"] },
  { id: "expiry_aware_note", label: CAPABILITY_LABELS.expiry_aware_note, iterationEnabled: false, requiredFields: ["expiry_date", "expiry_quantity"] },
  { id: "supplier_scenario", label: CAPABILITY_LABELS.supplier_scenario, iterationEnabled: false, requiredFields: ["supplier_id_or_name", "supplier_lead_time_days", "pack_size"] },
]);

export interface UploadAttributeGuide {
  readonly id: string;
  readonly label: string;
  readonly requirement: "required" | "optional";
  readonly description: string;
  readonly capabilities: readonly CapabilityId[];
  readonly acceptedForms?: readonly string[];
}

function featureList(...capabilities: CapabilityId[]): readonly CapabilityId[] {
  return Object.freeze(capabilities);
}

/** The nine plain-language upload attributes and the exact features that depend on them. */
export const UPLOAD_ATTRIBUTE_GUIDE: readonly UploadAttributeGuide[] = Object.freeze([
  Object.freeze({
    id: "sale_date",
    label: "Sale date",
    requirement: "required",
    description: "The date each sale or return was recorded.",
    capabilities: featureList("weekly_history", "timeline_gap_evidence", "recent_weekly_average", "weeks_of_cover"),
  }),
  Object.freeze({
    id: "product_identity",
    label: "How your products are named or coded",
    requirement: "required",
    description: "Choose either accepted form. Both keep products and pack sizes separate.",
    acceptedForms: Object.freeze([
      "One code column: SKU, barcode or product code",
      "Product name together with pack size",
    ]),
    capabilities: featureList(
      "weekly_history",
      "timeline_gap_evidence",
      "recent_weekly_average",
      "stock_freshness",
      "weeks_of_cover",
      "purchase_audit",
      "expiry_aware_note",
      "supplier_scenario",
    ),
  }),
  Object.freeze({
    id: "quantity_sold",
    label: "Quantity sold",
    requirement: "required",
    description: "The quantity sold or returned in each record.",
    capabilities: featureList("weekly_history", "timeline_gap_evidence", "recent_weekly_average", "weeks_of_cover"),
  }),
  Object.freeze({
    id: "stock_on_hand",
    label: "Stock on hand",
    requirement: "optional",
    description: "Your latest counted quantity for each product.",
    capabilities: featureList("stock_freshness", "weeks_of_cover", "purchase_audit"),
  }),
  Object.freeze({
    id: "stock_count_date",
    label: "Stock count date",
    requirement: "optional",
    description: "The date that stock count was taken.",
    capabilities: featureList("stock_freshness", "weeks_of_cover"),
  }),
  Object.freeze({
    id: "planned_orders",
    label: "Planned orders",
    requirement: "optional",
    description: "Quantities you are considering ordering.",
    capabilities: featureList("purchase_audit"),
  }),
  Object.freeze({
    id: "incoming_stock",
    label: "Incoming stock",
    requirement: "optional",
    description: "Quantities already ordered and expected to arrive.",
    capabilities: featureList("purchase_audit"),
  }),
  Object.freeze({
    id: "expiry_dates",
    label: "Expiry dates",
    requirement: "optional",
    description: "Expiry dates and affected quantities for product batches.",
    capabilities: featureList("expiry_aware_note"),
  }),
  Object.freeze({
    id: "supplier_details",
    label: "Supplier details",
    requirement: "optional",
    description: "Supplier identity, delivery time and ordering pack information.",
    capabilities: featureList("supplier_scenario"),
  }),
]);

/** Returns whether a field has a confirmed mapping and passes known validation. */
function mappedAndValid(
  state: MappingState,
  field: CanonicalField,
  context: CapabilityEvidenceContext,
): boolean {
  if (!state.mappings[field]?.confirmed) return false;
  return context.validFields === undefined || context.validFields.has(field);
}

/** Checks that the selected product identity path is confirmed and valid. */
function identityReady(state: MappingState, context: CapabilityEvidenceContext): boolean {
  if (!state.identityConfirmed) return false;
  if (state.identityMode === "stable") return mappedAndValid(state, "product_code", context);
  if (state.identityMode === "composite") {
    return mappedAndValid(state, "product_name", context) && mappedAndValid(state, "pack_variant", context);
  }
  return false;
}

/** Builds user-facing reasons for missing, unconfirmed, or invalid prerequisites. */
function missingFieldReasons(
  definition: CapabilityDefinition,
  state: MappingState,
  context: CapabilityEvidenceContext,
): CapabilityReason[] {
  const reasons: CapabilityReason[] = [];
  for (const field of definition.requiredFields) {
    if (!state.mappings[field]?.confirmed) {
      reasons.push({
        code: "FIELD_NOT_CONFIRMED",
        message: `${FIELD_REGISTRY[field].label} must be mapped and confirmed. It can come from ${FIELD_REGISTRY[field].acquisitionSource === "file" ? "a file column" : FIELD_REGISTRY[field].acquisitionSource === "aina" ? "Aina" : "a file column or Aina"}.`,
        field,
        acquisitionSource: FIELD_REGISTRY[field].acquisitionSource,
      });
    } else if (context.validFields !== undefined && !context.validFields.has(field)) {
      reasons.push({
        code: "FIELD_NOT_VALID_ENOUGH",
        message: `${FIELD_REGISTRY[field].label} is mapped but is not valid enough for this capability.`,
        field,
        acquisitionSource: FIELD_REGISTRY[field].acquisitionSource,
      });
    }
  }

  if (!identityReady(state, context)) {
    reasons.push({
      code: "PRODUCT_IDENTITY_NOT_CONFIRMED",
      message: `Confirm ${CORE_COLUMN_PATHS.map((path) => path.label).join(" or ")}.`,
      acquisitionSource: "file",
    });
  }
  return reasons;
}

/** Evaluates every capability from confirmed mappings and available evidence. */
export function evaluateCapabilities(
  state: MappingState,
  context: CapabilityEvidenceContext = {},
): readonly CapabilityResult[] {
  return Object.freeze(CAPABILITY_REGISTRY.map((definition): CapabilityResult => {
    const reasons = missingFieldReasons(definition, state, context);

    if (!definition.iterationEnabled) {
      const lockedReason: CapabilityReason = {
        code: "LATER_ITERATION",
        message: `${definition.label} is visible but locked until Iteration 2.`,
      };
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "locked",
        reasons: Object.freeze([lockedReason, ...reasons]),
        iterationEnabled: false,
      });
    }

    if (reasons.length > 0) {
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "needs_information",
        reasons: Object.freeze(reasons),
        iterationEnabled: true,
      });
    }

    if (["weekly_history", "timeline_gap_evidence", "recent_weekly_average", "weeks_of_cover"].includes(definition.id)
      && context.hasValidRows === false) {
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "needs_information",
        reasons: Object.freeze([{ code: "NO_VALID_ROWS", message: "At least one valid mapped transaction row is required." }]),
        iterationEnabled: true,
      });
    }

    if (definition.id === "timeline_gap_evidence" && (context.observedWeekCount ?? 0) < 2) {
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "needs_information",
        reasons: Object.freeze([{ code: "INSUFFICIENT_OBSERVED_WEEKS", message: "At least two observed week keys are required." }]),
        iterationEnabled: true,
      });
    }

    if (definition.id === "recent_weekly_average") {
      if (context.recentAverageState === "unavailable") {
        return Object.freeze({
          capability: definition.id,
          label: definition.label,
          state: "needs_information",
          reasons: Object.freeze([{ code: "NO_COMPLETED_OBSERVED_WEEK", message: "At least one completed observed week is required." }]),
          iterationEnabled: true,
        });
      }
      if (context.recentAverageState === "limited") {
        return Object.freeze({
          capability: definition.id,
          label: definition.label,
          state: "limited",
          reasons: Object.freeze([{ code: "LIMITED_RECENT_EVIDENCE", message: `${CAPABILITY_LABELS.recent_weekly_average} is available with limited evidence.` }]),
          iterationEnabled: true,
        });
      }
    }

    if (definition.id === "stock_freshness" && context.stockFreshnessState === "limited") {
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "limited",
        reasons: Object.freeze([{ code: "AGED_STOCK", message: "The stock count is getting old because it is 8–14 days old." }]),
        iterationEnabled: true,
      });
    }

    if (definition.id === "stock_freshness" && context.stockFreshnessState === "unusable") {
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "needs_information",
        reasons: Object.freeze([{ code: "UNUSABLE_STOCK_SNAPSHOT", message: "The stock count date is missing, invalid, in the future, or too old to rely on." }]),
        iterationEnabled: true,
      });
    }

    if (definition.id === "weeks_of_cover" && context.weeksOfCoverEligible === false) {
      return Object.freeze({
        capability: definition.id,
        label: definition.label,
        state: "needs_information",
        reasons: Object.freeze([{ code: "COVER_PREREQUISITES_FAILED", message: `Valid stock on hand and a positive value for ${CAPABILITY_LABELS.recent_weekly_average} are required.` }]),
        iterationEnabled: true,
      });
    }

    const limited = definition.id === "weeks_of_cover"
      && (context.recentAverageState === "limited" || context.stockFreshnessState === "limited");
    return Object.freeze({
      capability: definition.id,
      label: definition.label,
      state: limited ? "limited" : "available",
      reasons: Object.freeze(limited
        ? [{ code: "LIMITED_INPUT", message: `${CAPABILITY_LABELS.weeks_of_cover} is available but one or more inputs are Limited.` }]
        : []),
      iterationEnabled: true,
    });
  }));
}

/** Groups capability results into the sections used by the interface. */
export function partitionCapabilities(results: readonly CapabilityResult[]): Readonly<{
  availableNow: readonly CapabilityResult[];
  needsMoreInformation: readonly CapabilityResult[];
  locked: readonly CapabilityResult[];
}> {
  return Object.freeze({
    availableNow: Object.freeze(results.filter((result) => result.state === "available" || result.state === "limited")),
    needsMoreInformation: Object.freeze(results.filter((result) => result.state === "needs_information")),
    locked: Object.freeze(results.filter((result) => result.state === "locked")),
  });
}

/** Throws when a canonical field does not describe any capability it unlocks. */
export function assertEveryFieldUnlocksCapability(): void {
  for (const field of CANONICAL_FIELDS) {
    if (FIELD_REGISTRY[field].unlocks.length === 0) {
      throw new Error(`${field} does not name a capability it unlocks.`);
    }
  }
}
