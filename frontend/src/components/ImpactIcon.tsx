/** Drawn icons for the Impact dashboard, in the same flat style as GrowthIcon. */
export type ImpactIconName = "sprout" | "coins" | "globe" | "check" | "recycle" | "bin" | "puzzle" | "trend" | "data" | "warning" | "cart" | "building" | "story" | "box" | "clipboard" | "pencil" | "calendar" | "calc" | "scales" | "search" | "cloud" | "target" | "download" | "shop" | "people" | "leaf";

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
      {name === "story" && <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" fill={LEAF_LIGHT} />
        <path d="M3 16l5-5 4 4 3-3 6 6" fill="none" stroke={TEAL} strokeWidth="1.8" strokeLinejoin="round" />
        <circle cx="16" cy="9" r="2" fill={AMBER} />
      </>}
      {name === "box" && <>
        <path d="M4 8l8-4 8 4v9l-8 4-8-4z" fill={AMBER_LIGHT} />
        <path d="M4 8l8 4 8-4M12 12v9" fill="none" stroke={AMBER} strokeWidth="1.6" strokeLinejoin="round" />
      </>}
      {name === "clipboard" && <>
        <rect x="5" y="4" width="14" height="17" rx="2" fill={LEAF_LIGHT} />
        <rect x="9" y="2.5" width="6" height="3.5" rx="1.2" fill={TEAL} />
        <path d="M8.5 11l2 2 4-4M8.5 17h7" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>}
      {name === "pencil" && <>
        <path d="M4 20l1-4L16 5l3 3L8 19z" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M14 7l3 3" stroke={AMBER} strokeWidth="1.4" />
        <path d="M4 20l1-4 3 3z" fill={INK} />
      </>}
      {name === "calendar" && <>
        <rect x="3.5" y="5" width="17" height="15" rx="2.5" fill="#fff" stroke={TEAL} strokeWidth="1.6" />
        <path d="M3.5 10h17" stroke={TEAL} strokeWidth="1.6" />
        <path d="M8 3v4M16 3v4" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" />
        <rect x="7" y="13" width="4" height="4" rx="1" fill={LEAF} />
        <rect x="13" y="13" width="4" height="4" rx="1" fill={AMBER} />
      </>}
      {name === "calc" && <>
        <rect x="5" y="3" width="14" height="18" rx="2.5" fill={LEAF_LIGHT} />
        <rect x="7.5" y="5.5" width="9" height="4" rx="1" fill="#fff" />
        <g fill={TEAL}><circle cx="9" cy="13" r="1.2" /><circle cx="12" cy="13" r="1.2" /><circle cx="15" cy="13" r="1.2" /><circle cx="9" cy="17" r="1.2" /><circle cx="12" cy="17" r="1.2" /><circle cx="15" cy="17" r="1.2" /></g>
      </>}
      {name === "scales" && <>
        <path d="M12 4v16M7 20h10M5 7h14" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M5 7l-3 6h6z" fill={AMBER_LIGHT} />
        <path d="M19 7l-3 6h6z" fill={LEAF_LIGHT} />
      </>}
      {name === "search" && <>
        <circle cx="10.5" cy="10.5" r="6" fill={LEAF_LIGHT} stroke={TEAL} strokeWidth="1.8" />
        <path d="M15 15l5 5" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" />
      </>}
      {name === "cloud" && <>
        <path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 0 9z" fill={SKY_LIGHT} stroke={SKY} strokeWidth="1.4" />
        <path d="M9 14.5h6" stroke={SKY} strokeWidth="1.6" strokeLinecap="round" />
      </>}
      {name === "target" && <>
        <circle cx="12" cy="12" r="9" fill="#fff" stroke={AMBER} strokeWidth="1.6" />
        <circle cx="12" cy="12" r="5.5" fill={AMBER_LIGHT} />
        <circle cx="12" cy="12" r="2" fill={AMBER} />
      </>}
      {name === "download" && <>
        <path d="M12 4v10M8 10.5l4 4 4-4" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M5 16v3h14v-3" stroke={TEAL} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>}
      {name === "shop" && <>
        <path d="M4 9l1.5-5h13L20 9z" fill={AMBER} />
        <path d="M5 9v11h14V9" fill="#fff" stroke={TEAL} strokeWidth="1.6" />
        <rect x="10" y="13" width="4" height="7" fill={LEAF_LIGHT} />
      </>}
      {name === "people" && <>
        <circle cx="9" cy="8" r="3" fill={LEAF} />
        <circle cx="16.5" cy="9.5" r="2.4" fill={LEAF_LIGHT} />
        <path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5z" fill={LEAF} />
        <path d="M13 19c.3-2.6 1.8-4.3 3.6-4.3 2 0 3.4 1.8 3.4 4.3z" fill={LEAF_LIGHT} />
      </>}
      {name === "leaf" && <>
        <path className="impact-icon__leaf" d="M5 19c0-8 5-13 14-14 0 9-5 14-14 14z" fill={LEAF} />
        <path d="M5 19l8-8" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
      </>}
    </svg>
  );
}
