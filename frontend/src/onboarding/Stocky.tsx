import type { ReactNode } from "react";

export type StockyPose = "hello" | "great" | "magnify" | "idle" | "point" | "think" | "careful" | "check" | "coins" | "box";

const ARM = "#2A9C80";
const INK = "#16313B";

type Layers = Record<StockyPose, ReactNode>;
/* Each pose = what sits behind Stocky, its arms, eyes, mouth and anything held in front. */
const BACK: Layers = {
  hello: <><path d="M196 72 L205 65 M200 88 L212 86 M196 104 L206 108" stroke="#65C9BC" strokeWidth="4" strokeLinecap="round" fill="none"/></>,
  great: <><g fill="#E0A63A"><path transform="translate(14 40) scale(1.3)" d="M0 -10 C 1.5 -2 2 -1.5 10 0 C 2 1.5 1.5 2 0 10 C -1.5 2 -2 1.5 -10 0 C -2 -1.5 -1.5 -2 0 -10 Z"/><path transform="translate(190 44)" d="M0 -10 C 1.5 -2 2 -1.5 10 0 C 2 1.5 1.5 2 0 10 C -1.5 2 -2 1.5 -10 0 C -2 -1.5 -1.5 -2 0 -10 Z"/></g></>,
  magnify: null,
  idle: null,
  point: <><path d="M196 80 L202 72 M208 88 L214 82" stroke="#65C9BC" strokeWidth="4" strokeLinecap="round" fill="none"/></>,
  think: <><text x="168" y="70" fontFamily="Manrope, system-ui, sans-serif" fontSize="44" fontWeight="800" fill="#16958B">?</text><circle cx="160" cy="88" r="4" fill="#65C9BC"/><circle cx="152" cy="100" r="2.5" fill="#65C9BC"/></>,
  careful: <><path d="M158 84 C 152 94 150 100 156 104 C 162 107 167 101 164 94 C 162 90 160 87 158 84 Z" fill="#9ED8F0"/></>,
  check: null,
  coins: <><g fill="#E0A63A"><path transform="translate(198 112) scale(.7)" d="M0 -10 C 1.5 -2 2 -1.5 10 0 C 2 1.5 1.5 2 0 10 C -1.5 2 -2 1.5 -10 0 C -2 -1.5 -1.5 -2 0 -10 Z"/></g></>,
  box: null,
};
const ARMS: Layers = {
  hello: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/><ellipse cx="186" cy="100" rx="11" ry="19" transform="rotate(35 186 100)" fill={ARM}/></>,
  great: <><ellipse cx="14" cy="102" rx="11" ry="19" transform="rotate(-30 14 102)" fill={ARM}/><ellipse cx="186" cy="102" rx="11" ry="19" transform="rotate(30 186 102)" fill={ARM}/></>,
  magnify: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/></>,
  idle: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/><ellipse cx="180" cy="150" rx="11" ry="18" transform="rotate(-25 180 150)" fill={ARM}/></>,
  point: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/><ellipse cx="184" cy="112" rx="20" ry="10" transform="rotate(-18 184 112)" fill={ARM}/><circle cx="201" cy="106" r="6" fill={ARM}/></>,
  think: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/></>,
  careful: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/><ellipse cx="180" cy="150" rx="11" ry="18" transform="rotate(-25 180 150)" fill={ARM}/></>,
  check: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/></>,
  coins: <><ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill={ARM}/></>,
  box: null,
};
const EYES: Layers = {
  hello: <><ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="82.5" cy="128" r="2.8" fill="#fff"/><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="122.5" cy="128" r="2.8" fill="#fff"/></>,
  great: <><path d="M72 135 Q80 125 88 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/><path d="M112 135 Q120 125 128 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/></>,
  magnify: <><path d="M72 135 Q80 125 88 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="122.5" cy="128" r="2.8" fill="#fff"/></>,
  idle: <><ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="82.5" cy="128" r="2.8" fill="#fff"/><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="122.5" cy="128" r="2.8" fill="#fff"/></>,
  point: <><ellipse cx="84" cy="131" rx="7.5" ry="9.5" fill={INK}/><circle cx="86.5" cy="127" r="2.8" fill="#fff"/><ellipse cx="124" cy="131" rx="7.5" ry="9.5" fill={INK}/><circle cx="126.5" cy="127" r="2.8" fill="#fff"/></>,
  think: <><ellipse cx="82" cy="128" rx="7.5" ry="9.5" fill={INK}/><circle cx="84.5" cy="124" r="2.8" fill="#fff"/><ellipse cx="122" cy="128" rx="7.5" ry="9.5" fill={INK}/><circle cx="124.5" cy="124" r="2.8" fill="#fff"/></>,
  careful: <><ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="82.5" cy="128" r="2.8" fill="#fff"/><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="122.5" cy="128" r="2.8" fill="#fff"/><path d="M70 115 Q80 108 90 114" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round"/><path d="M110 114 Q120 108 130 115" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round"/></>,
  check: <><ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="82.5" cy="128" r="2.8" fill="#fff"/><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="122.5" cy="128" r="2.8" fill="#fff"/></>,
  coins: <><path d="M72 135 Q80 125 88 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/><path d="M112 135 Q120 125 128 135" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/></>,
  box: <><ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="82.5" cy="128" r="2.8" fill="#fff"/><ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill={INK}/><circle cx="122.5" cy="128" r="2.8" fill="#fff"/></>,
};
const MOUTH: Layers = {
  hello: <><path d="M88 150 C 90 167 110 167 112 150 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round"/><path d="M93 159 C 97 164 103 164 107 159 C 103 156 97 156 93 159 Z" fill="#F07F7A"/></>,
  great: <><path d="M88 150 C 90 167 110 167 112 150 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round"/><path d="M93 159 C 97 164 103 164 107 159 C 103 156 97 156 93 159 Z" fill="#F07F7A"/></>,
  magnify: <><path d="M89 151 Q100 162 111 151" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/></>,
  idle: <><path d="M89 151 Q100 162 111 151" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/></>,
  point: <><path d="M88 150 C 90 167 110 167 112 150 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round"/><path d="M93 159 C 97 164 103 164 107 159 C 103 156 97 156 93 159 Z" fill="#F07F7A"/></>,
  think: <><path d="M93 156 Q101 152 109 157" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/></>,
  careful: <><ellipse cx="100" cy="157" rx="6" ry="7" fill={INK}/></>,
  check: <><path d="M89 151 Q100 162 111 151" stroke={INK} strokeWidth="4.5" fill="none" strokeLinecap="round"/></>,
  coins: <><path d="M88 150 C 90 167 110 167 112 150 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round"/><path d="M93 159 C 97 164 103 164 107 159 C 103 156 97 156 93 159 Z" fill="#F07F7A"/></>,
  box: <><path d="M88 150 C 90 167 110 167 112 150 Z" fill={INK} stroke={INK} strokeWidth="2" strokeLinejoin="round"/><path d="M93 159 C 97 164 103 164 107 159 C 103 156 97 156 93 159 Z" fill="#F07F7A"/></>,
};
const FRONT: Layers = {
  hello: null,
  great: null,
  magnify: <><line x1="157" y1="134" x2="179" y2="160" stroke="#0F6664" strokeWidth="10" strokeLinecap="round"/><circle cx="140" cy="116" r="24" fill="#DFF2F6" fillOpacity="0.45" stroke="#0F6664" strokeWidth="7"/><ellipse cx="183" cy="163" rx="11" ry="14" transform="rotate(0 183 163)" fill={ARM}/></>,
  idle: null,
  point: null,
  think: <><ellipse cx="118" cy="170" rx="10" ry="17" transform="rotate(-35 118 170)" fill={ARM}/></>,
  careful: null,
  check: <><rect x="150" y="112" width="44" height="56" rx="7" fill="#FDF8EC" stroke="#0F6664" strokeWidth="4"/><rect x="162" y="106" width="20" height="10" rx="3" fill="#0F6664"/><path d="M160 140 L168 148 L184 128" stroke="#34B08F" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round"/><ellipse cx="160" cy="170" rx="11" ry="15" transform="rotate(20 160 170)" fill={ARM}/></>,
  coins: <><circle cx="176" cy="140" r="19" fill="#F2B84B" stroke="#C98A1E" strokeWidth="4"/><circle cx="176" cy="140" r="10" fill="none" stroke="#C98A1E" strokeWidth="3"/><ellipse cx="170" cy="164" rx="11" ry="15" transform="rotate(15 170 164)" fill={ARM}/></>,
  box: <><rect x="58" y="168" width="84" height="40" rx="6" fill="#D99A55" stroke="#B57B37" strokeWidth="3"/><path d="M100 168 V208 M58 182 H142" stroke="#B57B37" strokeWidth="3"/><ellipse cx="54" cy="180" rx="11" ry="16" transform="rotate(20 54 180)" fill={ARM}/><ellipse cx="146" cy="180" rx="11" ry="16" transform="rotate(-20 146 180)" fill={ARM}/></>,
};

/**
 * Stocky, the StockLess guide. Decorative only: it never carries information
 * the surrounding text does not already say, so screen readers skip it unless
 * a label is passed.
 */
export function Stocky({ pose = "hello", size = 120, label }: { readonly pose?: StockyPose; readonly size?: number; readonly label?: string }) {
  return <svg className="stocky" width={size} height={Math.round(size * 226 / 220)} viewBox="-10 -6 220 226" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} focusable="false">
    <ellipse cx="100" cy="212" rx="58" ry="7" fill={INK} opacity="0.08"/>
    {BACK[pose]}
    <path d="M100 42 C 101 32 104 26 110 20" stroke="#0F6664" strokeWidth="4" fill="none" strokeLinecap="round"/><path d="M108 22 C 110 6 128 -2 146 2 C 144 20 128 30 108 22 Z" fill="#16958B"/><path d="M103 30 C 94 18 78 16 66 22 C 74 36 90 38 103 30 Z" fill="#65C9BC"/><ellipse cx="78" cy="203" rx="17" ry="9" fill="#1E8C78"/><ellipse cx="122" cy="203" rx="17" ry="9" fill="#1E8C78"/>
    {ARMS[pose]}
    <path d="M100 38 C 128 52 178 78 178 130 C 178 174 144 204 100 204 C 56 204 22 174 22 130 C 22 78 72 52 100 38 Z" fill="#34B08F"/><path d="M44 106 C 52 82 68 66 86 57" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.3" fill="none"/><ellipse cx="100" cy="138" rx="56" ry="46" fill="#FDF8EC"/>
    {EYES[pose]}
    <ellipse cx="64" cy="152" rx="9" ry="5.5" fill="#F29C97" opacity="0.65"/><ellipse cx="136" cy="152" rx="9" ry="5.5" fill="#F29C97" opacity="0.65"/>
    {MOUTH[pose]}
    {FRONT[pose]}
  </svg>;
}
