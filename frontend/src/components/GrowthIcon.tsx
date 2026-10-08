/**
 * The StockLess growth path, drawn in brand colours instead of emoji so it
 * looks the same on every device: sprout (Upload) → leaves (Map columns) →
 * potted plant (Check readiness) → tree (Purchase plan). Decorative only.
 */
export type GrowthStage = "sprout" | "leaves" | "potted" | "tree";

const LEAF = "#34B08F";
const LEAF_LIGHT = "#8FD2C8";

export const STEP_GROWTH: readonly GrowthStage[] = ["sprout", "leaves", "potted"];

export function GrowthIcon({ stage, size = 18, className }: { stage: GrowthStage; size?: number; className?: string }) {
  return (
    <svg className={`growth-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" width={size} height={size}
      aria-hidden="true" focusable="false">
      {stage === "sprout" && <>
        <path d="M12 22v-8" stroke={LEAF} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M12 15c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z" fill={LEAF} />
        <path d="M12 16.5c0-3-2.5-5-6.5-5 0 3 2.5 5 6.5 5z" fill={LEAF_LIGHT} />
      </>}
      {stage === "leaves" && <>
        <path d="M12 23V4" stroke={LEAF} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M12 9c0-3.5 2.5-5.5 6.5-5.5 0 3.5-2.5 5.5-6.5 5.5z" fill={LEAF} />
        <path d="M12 11c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" fill={LEAF_LIGHT} />
        <path d="M12 16c0-3 2.5-5 6-5 0 3-2.5 5-6 5z" fill={LEAF_LIGHT} />
        <path d="M12 19c0-3-2.5-5-6-5 0 3 2.5 5 6 5z" fill={LEAF} />
      </>}
      {stage === "potted" && <>
        <path d="M6.5 15h11l-1.6 7.5H8.1z" fill="#D99A55" />
        <path d="M12 15V6" stroke={LEAF} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M12 9c0-3.5 2.5-5.5 6.5-5.5 0 3.5-2.5 5.5-6.5 5.5z" fill={LEAF} />
        <path d="M12 11c0-3.5-2.5-5.5-6.5-5.5 0 3.5 2.5 5.5 6.5 5.5z" fill={LEAF_LIGHT} />
        <path d="M12 14c0-2.5 2-4 5-4 0 2.5-2 4-5 4z" fill={LEAF_LIGHT} />
      </>}
      {stage === "tree" && <>
        <path d="M12 23v-8" stroke="#9A6A3A" strokeWidth="2.4" strokeLinecap="round" fill="none" />
        <circle cx="8" cy="11.5" r="4.2" fill="#2A9C80" />
        <circle cx="16" cy="11.5" r="4.2" fill="#2A9C80" />
        <circle cx="12" cy="8.5" r="6" fill={LEAF} />
        <circle cx="10.5" cy="6.5" r="2.2" fill={LEAF_LIGHT} />
      </>}
    </svg>
  );
}
