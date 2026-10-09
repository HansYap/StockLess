import type { CSSProperties, ReactNode } from "react";
import "./step-garden.css";

type GardenStep = 1 | 2 | 3 | 4;

const LEAF = "#34B08F", LEAF_LIGHT = "#8FD2C8";

/** The four step plants, drawn in the ground's coordinate space (1328 × 120). */
const PLANTS: Record<GardenStep, ReactNode> = {
  1: <><path d="M90 102v-16" stroke={LEAF} strokeWidth="3" strokeLinecap="round" /><path d="M90 90c0-8 6-13 15-13 0 8-6 13-15 13z" fill={LEAF} /><path d="M90 93c0-6-5-10-13-10 0 6 5 10 13 10z" fill={LEAF_LIGHT} /></>,
  2: <><path d="M300 104V66" stroke={LEAF} strokeWidth="3" strokeLinecap="round" /><path d="M300 76c0-7 5-11 13-11 0 7-5 11-13 11z" fill={LEAF} /><path d="M300 80c0-6-5-10-12-10 0 6 5 10 12 10z" fill={LEAF_LIGHT} /><path d="M300 90c0-6 5-10 12-10 0 6-5 10-12 10z" fill={LEAF_LIGHT} /><path d="M300 96c0-6-5-10-12-10 0 6 5 10 12 10z" fill={LEAF} /></>,
  3: <><path d="M1010 84h30l-4 18h-22z" fill="#D99A55" /><path d="M1025 84V62" stroke={LEAF} strokeWidth="3" strokeLinecap="round" /><path d="M1025 70c0-7 5-11 13-11 0 7-5 11-13 11z" fill={LEAF} /><path d="M1025 74c0-7-5-11-13-11 0 7 5 11 13 11z" fill={LEAF_LIGHT} /></>,
  4: <><path d="M1240 104V80" stroke="#9A6A3A" strokeWidth="4" strokeLinecap="round" /><circle cx="1230" cy="72" r="10" fill="#2A9C80" /><circle cx="1250" cy="72" r="10" fill="#2A9C80" /><circle cx="1240" cy="62" r="14" fill={LEAF} /><circle cx="1235" cy="57" r="5" fill={LEAF_LIGHT} /></>,
};
/** Spreads the plants evenly along the ground line. */
const SHIFT: Record<GardenStep, number> = { 1: 110, 2: 220, 3: -185, 4: -90 };
/** Where the gardener stands for each step. */
const STAND: Record<GardenStep, number> = { 1: 110, 2: 430, 3: 750, 4: 910 };
/** Moves each plant to x ≈ 110 for the single-plant phone view. */
const PHONE_SHIFT: Record<GardenStep, number> = { 1: 20, 2: -190, 3: -915, 4: -1130 };
const SWAYS: Record<GardenStep, boolean> = { 1: true, 2: true, 3: false, 4: false };

function plantStyle(n: GardenStep, step: GardenStep, done: boolean): CSSProperties {
  const scale = n > step ? 0.7 : n === step && done ? (n === 4 ? 1.12 : 1.35) : 1;
  return { transform: `translateX(${SHIFT[n]}px) scale(${scale * 1.3})`, opacity: n > step ? 0.35 : 1 };
}

function Plant({ n }: { n: GardenStep }) {
  return <g className={SWAYS[n] ? "garden__sway" : undefined} style={n === 2 ? { animationDelay: "-1.5s" } : undefined}>{PLANTS[n]}</g>;
}

/** Mini Stocky holding a watering can. Drops and blinking replay when the step changes. */
function Gardener({ step, drops }: { step: GardenStep; drops: boolean }) {
  return <g key={step}>
    <g transform="translate(150 50) scale(.25)">
      <ellipse cx="100" cy="212" rx="58" ry="7" fill="#16313B" opacity="0.08" />
      <path d="M100 42 C 101 32 104 26 110 20" stroke="#0F6664" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M108 22 C 110 6 128 -2 146 2 C 144 20 128 30 108 22 Z" fill="#16958B" />
      <path d="M103 30 C 94 18 78 16 66 22 C 74 36 90 38 103 30 Z" fill="#65C9BC" />
      <ellipse cx="78" cy="203" rx="17" ry="9" fill="#1E8C78" />
      <ellipse cx="122" cy="203" rx="17" ry="9" fill="#1E8C78" />
      <ellipse cx="180" cy="150" rx="11" ry="18" transform="rotate(-25 180 150)" fill="#2A9C80" />
      <path d="M100 38 C 128 52 178 78 178 130 C 178 174 144 204 100 204 C 56 204 22 174 22 130 C 22 78 72 52 100 38 Z" fill={LEAF} />
      <path d="M44 106 C 52 82 68 66 86 57" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.3" fill="none" />
      <ellipse cx="100" cy="138" rx="56" ry="46" fill="#FDF8EC" />
      <g className="garden__blink">
        <ellipse cx="80" cy="132" rx="7.5" ry="9.5" fill="#16313B" /><circle cx="82.5" cy="128" r="2.8" fill="#fff" />
        <ellipse cx="120" cy="132" rx="7.5" ry="9.5" fill="#16313B" /><circle cx="122.5" cy="128" r="2.8" fill="#fff" />
      </g>
      <ellipse cx="64" cy="152" rx="9" ry="5.5" fill="#F29C97" opacity="0.65" />
      <ellipse cx="136" cy="152" rx="9" ry="5.5" fill="#F29C97" opacity="0.65" />
      <path d="M89 151 Q100 162 111 151" stroke="#16313B" strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <g transform="rotate(-28 20 150)">
        <path d="M-30 128 h46 l-6 40 h-34 z" fill="#5B8DC9" />
        <path d="M-30 136 L-72 116" stroke="#5B8DC9" strokeWidth="9" strokeLinecap="round" />
        <path d="M-4 128 c0-18 22-18 22 0" stroke="#5B8DC9" strokeWidth="7" fill="none" />
      </g>
      <ellipse cx="20" cy="150" rx="11" ry="18" transform="rotate(25 20 150)" fill="#2A9C80" />
    </g>
    {drops && <g fill="#4A93DB">
      <path className="garden__drop" d="M120 68c3 5 4.5 8 0 11-4.5-3-3-6 0-11z" />
      <path className="garden__drop" style={{ animationDelay: ".5s" }} d="M111 73c3 5 4.5 8 0 11-4.5-3-3-6 0-11z" />
      <path className="garden__drop" style={{ animationDelay: "1s" }} d="M127 75c3 5 4.5 8 0 11-4.5-3-3-6 0-11z" />
    </g>}
  </g>;
}

/**
 * Drawn ground line along the bottom of the step pages. The plants follow the
 * stepper (sprout → leaves → potted → tree) and the mini gardener waters the
 * plant for the current step. Decorative only.
 */
export function StepGround({ step, done }: { step: GardenStep; done: boolean }) {
  const steps: GardenStep[] = [1, 2, 3, 4];
  const drops = step !== 4;
  return <div className="garden" aria-hidden="true">
    <svg className="garden__wide" viewBox="0 0 1328 120" preserveAspectRatio="xMidYMax meet" focusable="false">
      <path d="M0 104 C 220 92 420 112 664 100 S 1120 92 1328 104 L1328 120 L0 120 Z" fill="#E4F1EC" />
      <path d="M0 104 C 220 92 420 112 664 100 S 1120 92 1328 104" fill="none" stroke="#B9DCCF" strokeWidth="2" />
      {steps.map(n => <g key={n} className="garden__plant" style={plantStyle(n, step, done)}><Plant n={n} /></g>)}
      <g className="garden__mover" style={{ transform: `translateX(${STAND[step]}px)` }}><Gardener step={step} drops={drops} /></g>
    </svg>
    <svg className="garden__narrow" viewBox="0 0 390 120" preserveAspectRatio="xMidYMax meet" focusable="false">
      <path d="M0 104 C 90 96 180 110 260 102 S 360 98 390 104 L390 120 L0 120 Z" fill="#E4F1EC" />
      <path d="M0 104 C 90 96 180 110 260 102 S 360 98 390 104" fill="none" stroke="#B9DCCF" strokeWidth="2" />
      <g transform="translate(110 0) scale(1.3) translate(-110 -24)">
        <g transform={`translate(${PHONE_SHIFT[step]} 0)`}>
          <g className="garden__plant" style={{ transform: `scale(${done && step !== 4 ? 1.25 : 1})` }}><Plant n={step} /></g>
        </g>
      </g>
      <g transform="translate(-10 0)"><Gardener step={step} drops={drops} /></g>
    </svg>
  </div>;
}

const VINE = <>
  <path d="M30 900 C 24 780 44 660 34 540 S 24 320 40 200 S 52 70 58 20" fill="none" stroke="#8FC9B0" strokeWidth="3" strokeLinecap="round" />
  <path d="M34 860c-18-6-26-20-22-34 16 2 26 16 22 34z" fill="#BFE3D2" />
  <path d="M36 780c16-8 32-4 40 8-14 10-30 8-40-8z" fill="#D6EEE4" />
  <path d="M34 700c-18-6-26-20-22-34 16 2 26 16 22 34z" fill="#BFE3D2" />
  <path d="M36 620c16-8 32-4 40 8-14 10-30 8-40-8z" fill="#D6EEE4" />
  <path d="M34 540c-18-6-26-20-22-34 16 2 26 16 22 34z" fill="#BFE3D2" />
  <path d="M36 460c16-8 32-4 40 8-14 10-30 8-40-8z" fill="#D6EEE4" />
  <path d="M34 380c-18-6-26-20-22-34 16 2 26 16 22 34z" fill="#BFE3D2" />
  <path d="M36 300c16-8 32-4 40 8-14 10-30 8-40-8z" fill="#D6EEE4" />
  <path d="M34 220c-18-6-26-20-22-34 16 2 26 16 22 34z" fill="#BFE3D2" />
  <path d="M36 140c16-8 32-4 40 8-14 10-30 8-40-8z" fill="#D6EEE4" />
  <g transform="translate(70 800)"><circle r="6" fill="#FFF1CC" /><circle cx="0" cy="-8" r="4.5" fill="#FFF1CC" /><circle cx="8" cy="0" r="4.5" fill="#FFF1CC" /><circle cx="0" cy="8" r="4.5" fill="#FFF1CC" /><circle cx="-8" cy="0" r="4.5" fill="#FFF1CC" /><circle r="3.5" fill="#E9C16B" /></g>
  <g transform="translate(72 690)"><circle r="13" fill="#F2A3A0" /><circle r="13" fill="#E8807B" opacity=".25" cx="3" cy="3" /><path d="M0 -13c1-5 4-8 8-9" stroke="#8B5E34" strokeWidth="2.4" strokeLinecap="round" fill="none" /><path d="M3 -15c4-6 10-6 13-3-4 4-9 5-13 3z" fill="#7BC08F" /></g>
  <g transform="translate(16 590)"><circle r="6" fill="#FFF1CC" /><circle cx="0" cy="-8" r="4.5" fill="#FFF1CC" /><circle cx="8" cy="0" r="4.5" fill="#FFF1CC" /><circle cx="0" cy="8" r="4.5" fill="#FFF1CC" /><circle cx="-8" cy="0" r="4.5" fill="#FFF1CC" /><circle r="3.5" fill="#E9C16B" /></g>
  <g transform="translate(18 480)"><circle r="11" fill="#F6C77A" /><circle cx="-3" cy="-3" r="3" fill="#FBE2B4" /><path d="M0 -11c2-4 6-5 9-4-2 4-6 5-9 4z" fill="#7BC08F" /></g>
  <g transform="translate(72 380)"><circle r="6" fill="#FFF1CC" /><circle cx="0" cy="-8" r="4.5" fill="#FFF1CC" /><circle cx="8" cy="0" r="4.5" fill="#FFF1CC" /><circle cx="0" cy="8" r="4.5" fill="#FFF1CC" /><circle cx="-8" cy="0" r="4.5" fill="#FFF1CC" /><circle r="3.5" fill="#E9C16B" /></g>
  <g transform="translate(70 270)"><circle r="13" fill="#F2A3A0" /><circle r="13" fill="#E8807B" opacity=".25" cx="3" cy="3" /><path d="M0 -13c1-5 4-8 8-9" stroke="#8B5E34" strokeWidth="2.4" strokeLinecap="round" fill="none" /><path d="M3 -15c4-6 10-6 13-3-4 4-9 5-13 3z" fill="#7BC08F" /></g>
  <g transform="translate(18 190)"><circle r="6" fill="#FFF1CC" /><circle cx="0" cy="-8" r="4.5" fill="#FFF1CC" /><circle cx="8" cy="0" r="4.5" fill="#FFF1CC" /><circle cx="0" cy="8" r="4.5" fill="#FFF1CC" /><circle cx="-8" cy="0" r="4.5" fill="#FFF1CC" /><circle r="3.5" fill="#E9C16B" /></g>
  <g transform="translate(62 90)"><path d="M-8 0c0-8 6-12 12-12 4 0 6 2 6 6 0 8-6 14-12 14-4 0-6-4-6-8z" fill="#BFE08A" /><path d="M2 -12c0-4 2-6 4-7" stroke="#8B5E34" strokeWidth="2" strokeLinecap="round" /></g>
</>;

/** Leafy vine with fruit and flowers that grows up from the bottom of the page gutters. */
export function GardenVine() {
  return <svg className="garden-vine" viewBox="0 0 110 900" preserveAspectRatio="xMidYMax meet" focusable="false">{VINE}</svg>;
}
