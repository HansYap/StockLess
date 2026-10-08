export type StockyPose = "hello" | "magnify" | "great" | "idle";

const ARM = "#2A9C80";
const INK = "#16313B";

/**
 * Stocky, the StockLess guide. Decorative only: it never carries information
 * the surrounding text does not already say, so screen readers skip it unless
 * a label is passed.
 */
export function Stocky({ pose = "hello", size = 120, label }: { readonly pose?: StockyPose; readonly size?: number; readonly label?: string }) {
  const happy = pose === "great";
  const wink = pose === "magnify";
  return <svg className="stocky" width={size} height={Math.round(size * 226 / 220)} viewBox="-10 -6 220 226" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
    <ellipse cx="100" cy="212" rx="58" ry="7" fill={INK} opacity="0.08" />
    {pose === "hello" && <path d="M196 72 L205 65 M200 88 L212 86 M196 104 L206 108" stroke="#65C9BC" strokeWidth="4" strokeLinecap="round" fill="none" />}
    {happy && <g fill="#E0A63A"><path transform="translate(14 40) scale(1.3)" d="M0 -10 C 1.5 -2 2 -1.5 10 0 C 2 1.5 1.5 2 0 10 C -1.5 2 -2 1.5 -10 0 C -2 -1.5 -1.5 -2 0 -10 Z" /><path transform="translate(190 44)" d="M0 -10 C 1.5 -2 2 -1.5 10 0 C 2 1.5 1.5 2 0 10 C -1.5 2 -2 1.5 -10 0 C -2 -1.5 -1.5 -2 0 -10 Z" /></g>}
    <path d="M100 42 C 101 32 104 26 110 20" stroke="#0F6664" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M108 22 C 110 6 128 -2 146 2 C 144 20 128 30 108 22 Z" fill="#16958B" />
    <path d="M103 30 C 94 18 78 16 66 22 C 74 36 90 38 103 30 Z" fill="#65C9BC" />
    <ellipse cx="78" cy="203" rx="17" ry="9" fill="#1E8C78" />
    <ellipse cx="122" cy="203" rx="17" ry="9" fill="#1E8C78" />
    {happy
      ? <><ellipse cx="14" cy="102" rx="11" ry="19" transform="rotate(-30 14 102)" fill={ARM} /><ellipse cx="186" cy="102" rx="11" ry="19" transform="rotate(30 186 102)" fill={ARM} /></>
      : <ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM} />}
    {pose === "hello" && <ellipse cx="186" cy="100" rx="11" ry="19" transform="rotate(35 186 100)" fill={ARM} />}
    {pose === "idle" && <ellipse cx="180" cy="150" rx="11" ry="18" transform="rotate(-25 180 150)" fill={ARM} />}
    <path d="M100 38 C 128 52 178 78 178 130 C 178 174 144 204 100 204 C 56 204 22 174 22 130 C 22 78 72 52 100 38 Z" fill="#34B08F" />
    <path d="M44 106 C 52 82 68 66 86 57" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.3" fill="none" />
    <ellipse cx="100" cy="138" rx="56" ry="46" fill="#FDF8EC" />
    {happy || wink
      ? <path d="M72 135 Q80 125 88 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      : <><ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill={INK} /><circle cx="82.5" cy="128" r="2.8" fill="#fff" /></>}
    {happy
      ? <path d="M112 135 Q120 125 128 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      : <><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK} /><circle cx="122.5" cy="128" r="2.8" fill="#fff" /></>}
    <ellipse cx="64" cy="152" rx="9" ry="5.5" fill="#F29C97" opacity="0.65" />
    <ellipse cx="136" cy="152" rx="9" ry="5.5" fill="#F29C97" opacity="0.65" />
    {pose === "hello" || happy
      ? <><path d="M88 150 C 90 167 110 167 112 150 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round" /><path d="M93 159 C 97 164 103 164 107 159 C 103 156 97 156 93 159 Z" fill="#F07F7A" /></>
      : <path d="M89 151 Q100 162 111 151" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round" />}
    {wink && <>
      <line x1="157" y1="134" x2="179" y2="160" stroke="#0F6664" strokeWidth="10" strokeLinecap="round" />
      <circle cx="140" cy="116" r="24" fill="#DFF2F6" fillOpacity="0.45" stroke="#0F6664" strokeWidth="7" />
      <ellipse cx="183" cy="163" rx="11" ry="14" fill={ARM} />
    </>}
  </svg>;
}
