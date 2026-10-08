/** Drawn icons for the Impact dashboard, in the same flat style as GrowthIcon. */
export type ImpactIconName = "sprout" | "coins" | "globe" | "check" | "recycle" | "bin" | "puzzle" | "trend" | "data" | "warning" | "cart" | "building";

const LEAF = "#34B08F", LEAF_LIGHT = "#8FD2C8", TEAL = "#167D74", AMBER = "#E0A13A", AMBER_LIGHT = "#F6D08A", SKY = "#5B8DC9", SKY_LIGHT = "#BFD6F2", INK = "#33474F";

export function ImpactIcon({ name, size = 20, className }: { name: ImpactIconName; size?: number; className?: string }) {
  return (
    <svg className={`impact-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">
      {name === "sprout" && <>
        <path d="M12 22v-8" stroke={LEAF} strokeWidth="2" strokeLinecap="round" fill="none" />
        <path d="M12 15c0-4 3-6.5 7.5-6.5 0 4-3 6.5-7.5 6.5z" fill={LEAF} />
        <path d="M12 16.5c0-3-2.5-5-6.5-5 0 3 2.5 5 6.5 5z" fill={LEAF_LIGHT} />
      </>}
      {name === "coins" && <>
        <ellipse cx="12" cy="17" rx="7" ry="3" fill={AMBER} />
        <ellipse cx="12" cy="13" rx="7" ry="3" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="1.2" />
        <ellipse cx="12" cy="9" rx="7" ry="3" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="1.2" />
        <path d="M10.5 8.6h3" stroke={AMBER} strokeWidth="1.4" strokeLinecap="round" />
      </>}
      {name === "globe" && <>
        <circle cx="12" cy="12" r="9" fill={SKY_LIGHT} />
        <path d="M7 7.5c2 .5 2.5 2 1.5 3.5S9 14 11 14.5s1 3 0 4.5M14 4.5c-1 1.5 0 3 1.5 3.5s3 0 4 1.5M15 15c1-.8 2.6-.6 3.6.4" stroke={LEAF} strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <circle cx="12" cy="12" r="9" fill="none" stroke={SKY} strokeWidth="1.4" />
      </>}
      {name === "check" && <>
        <circle cx="12" cy="12" r="9" fill={LEAF_LIGHT} />
        <path d="M7.5 12.5l3 3 6-6.5" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>}
      {name === "recycle" && <>
        <path d="M12 4l3 5h-6z" fill={LEAF} />
        <path d="M5 18l2.5-5.2 3.2 4.7z" fill={LEAF_LIGHT} />
        <path d="M19 18l-5.7.3 2.5-5z" fill={TEAL} />
        <path d="M9.2 9.6L7 13.4M16.6 13.2l2 3.6M14.6 19H9.5" stroke={LEAF} strokeWidth="1.8" strokeLinecap="round" />
      </>}
      {name === "bin" && <>
        <path d="M6.5 8h11l-1 12.5h-9z" fill={LEAF_LIGHT} />
        <path d="M5 7.5h14M10 5h4" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
        <path d="M10 11v6.5M14 11v6.5" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" />
      </>}
      {name === "puzzle" && <>
        <path d="M5 8h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4H5z" fill={LEAF_LIGHT} stroke={TEAL} strokeWidth="1.4" strokeLinejoin="round" />
      </>}
      {name === "trend" && <>
        <path d="M4 19h16" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M5 16l4.5-4.5 3 3L19 8" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M15.5 8H19v3.5" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>}
      {name === "data" && <>
        <rect x="5" y="12" width="3.5" height="7" rx="1" fill={LEAF_LIGHT} />
        <rect x="10.25" y="7" width="3.5" height="12" rx="1" fill={LEAF} />
        <rect x="15.5" y="10" width="3.5" height="9" rx="1" fill={TEAL} />
      </>}
      {name === "warning" && <>
        <path d="M12 4l9 15.5H3z" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M12 10v4.5" stroke="#8B5C10" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="17" r="1.1" fill="#8B5C10" />
      </>}
      {name === "cart" && <>
        <path d="M3.5 5h2.2l2.2 10h10l2-7.5H6.6" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M8.5 9h10l-1.3 5h-7.6z" fill={LEAF_LIGHT} />
        <circle cx="9.5" cy="19" r="1.6" fill={TEAL} />
        <circle cx="16.5" cy="19" r="1.6" fill={TEAL} />
      </>}
      {name === "building" && <>
        <path d="M4 9l8-5 8 5z" fill={TEAL} />
        <path d="M6 10.5v7M10 10.5v7M14 10.5v7M18 10.5v7" stroke={LEAF} strokeWidth="2" strokeLinecap="round" />
        <path d="M4 20h16" stroke={TEAL} strokeWidth="2" strokeLinecap="round" />
      </>}
    </svg>
  );
}
