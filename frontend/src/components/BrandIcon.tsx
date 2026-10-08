/**
 * Small drawn icons in the same style and colours as GrowthIcon, used where
 * the homepage used to show emoji (📄 🛒 ♻️). Decorative only.
 */
export type BrandIconName = "file" | "cart" | "reuse";

export function BrandIcon({ name, size = 24, className }: { name: BrandIconName; size?: number; className?: string }) {
  return (
    <svg className={`growth-icon${className ? ` ${className}` : ""}`} viewBox="0 0 24 24" width={size} height={size}
      aria-hidden="true" focusable="false">
      {name === "file" && <>
        <path d="M6 2.5h8l4.5 4.5v13a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V4A1.5 1.5 0 0 1 6 2.5z" fill="#8FD2C8" />
        <path d="M14 2.5l4.5 4.5H15a1 1 0 0 1-1-1z" fill="#34B08F" />
        <path d="M8 12h8M8 15.5h8M8 19h5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      </>}
      {name === "cart" && <>
        <path d="M2.5 4.5h2.4l.8 3" stroke="#11655E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M5.4 7.5h15.1l-1.9 7.2a1.6 1.6 0 0 1-1.6 1.2H8.6a1.6 1.6 0 0 1-1.6-1.3z" fill="#34B08F" />
        <path d="M9 10.8h8" stroke="#8FD2C8" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        <circle cx="9.5" cy="19.5" r="1.7" fill="#11655E" />
        <circle cx="16.5" cy="19.5" r="1.7" fill="#11655E" />
      </>}
      {name === "reuse" && <>
        <path d="M19 12a7 7 0 1 1-2.1-5" stroke="#34B08F" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        <path d="M17.8 3.2v4.3h-4.3" stroke="#34B08F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M9 15c0-3 2.3-5 5.5-5 0 3-2.3 5-5.5 5z" fill="#8FD2C8" />
      </>}
    </svg>
  );
}
