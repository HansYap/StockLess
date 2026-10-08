/**
 * Hero basket, drawn in the same flat style and colours as the growth-path
 * icons (replaces design-basket.png). Decorative only.
 */
export function HeroBasket({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 360 300" width="360" height="300" aria-hidden="true" focusable="false">
      {/* soft ground + background leaves */}
      <ellipse cx="185" cy="286" rx="150" ry="10" fill="#CFE6D6"/>
      <path d="M318 120c-30 6-42 34-38 60 26-4 44-30 38-60z" fill="#BFE3CF"/>
      <path d="M300 182c-4-28-20-48-46-54" stroke="#9ED2BC" strokeWidth="2" fill="none"/>
      <path d="M40 120c26 4 40 26 38 50-24-2-42-24-38-50z" fill="#BFE3CF"/>
      {/* leafy greens at the back */}
      <path d="M150 182c-10-40-4-80 18-104 10 30 10 70-4 104z" fill="#2A9C80"/>
      <path d="M168 182c4-44 22-76 48-90 0 34-14 70-36 92z" fill="#34B08F"/>
      <path d="M160 180c-2-30 6-56 22-72" stroke="#1E7F67" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* lettuce left */}
      <path d="M74 186c-8-22 2-44 22-50 4-12 22-16 32-6 14-4 28 8 26 22 10 10 6 28-6 34z" fill="#8CC66B"/>
      <path d="M90 180c4-14 14-24 28-28M110 182c2-12 10-20 22-24" stroke="#6EAD4E" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
      {/* carrots */}
      <path d="M128 186l22-66 10 4-12 64z" fill="#EE8A3A"/>
      <path d="M146 188l28-62 9 5-17 59z" fill="#F29A4A"/>
      <path d="M152 120c-6-14-2-26 6-32M156 122c2-14 10-22 20-24M178 128c-2-14 4-26 14-30" stroke="#34B08F" strokeWidth="4" fill="none" strokeLinecap="round"/>
      <path d="M136 160l8 3M140 146l8 3M156 162l8 4M162 148l7 4" stroke="#D9762E" strokeWidth="2" strokeLinecap="round"/>
      {/* broccoli right */}
      <path d="M262 190l-6-30h14l-2 30z" fill="#8FD2C8"/>
      <circle cx="246" cy="150" r="17" fill="#2A9C80"/><circle cx="270" cy="140" r="20" fill="#2A9C80"/><circle cx="292" cy="154" r="16" fill="#2A9C80"/><circle cx="268" cy="160" r="16" fill="#34B08F"/>
      <circle cx="262" cy="134" r="5" fill="#34B08F"/><circle cx="284" cy="146" r="4" fill="#34B08F"/><circle cx="244" cy="146" r="4" fill="#34B08F"/>
      {/* red apple (back centre) */}
      <path d="M206 140c10-6 24-4 30 6 8 14 2 36-14 40-6 2-10-2-16-2s-10 4-16 2c-16-4-22-26-14-40 6-10 20-12 30-6z" fill="#D9534F"/>
      <path d="M206 140c0-8 2-14 6-18" stroke="#7A4A22" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <path d="M212 126c8-6 18-6 22-2-6 6-14 8-22 2z" fill="#34B08F"/>
      <ellipse cx="192" cy="154" rx="5" ry="8" fill="#F08A84" opacity={0.7}/>
      {/* tomato left */}
      <circle cx="104" cy="196" r="24" fill="#E0604A"/>
      <path d="M96 174l8 6 8-6-4 9 8 2-10 2-2 8-2-8-10-2 8-2z" fill="#34B08F"/>
      <ellipse cx="94" cy="190" rx="5" ry="7" fill="#F2897A" opacity={0.7}/>
      {/* green apple */}
      <path d="M168 176c10-6 22-4 28 6 8 14 2 34-14 38-5 1-9-2-14-2s-9 3-14 2c-16-4-22-24-14-38 6-10 18-12 28-6z" fill="#9BCB5A"/>
      <path d="M168 176c0-7 2-12 5-15" stroke="#7A4A22" strokeWidth="3" fill="none" strokeLinecap="round"/>
      <ellipse cx="156" cy="190" rx="5" ry="8" fill="#C4E39A" opacity={0.8}/>
      {/* orange */}
      <circle cx="240" cy="200" r="25" fill="#F2A23A"/>
      <circle cx="240" cy="178" r="2.5" fill="#B9741E"/>
      <ellipse cx="230" cy="192" rx="5" ry="7" fill="#F8C77A" opacity={0.8}/>
      {/* tomato right */}
      <circle cx="290" cy="202" r="20" fill="#E0604A"/>
      <path d="M284 184l6 5 6-5-3 7 6 2-8 1-1 7-2-7-8-1z" fill="#34B08F"/>
      {/* basket */}
      <path d="M62 214h236l-20 64q-3 10-14 10H96q-11 0-14-10z" fill="#D99A55"/>
      <path d="M74 236h212M80 256h200M88 274h184" stroke="#C07F3C" strokeWidth="3" strokeLinecap="round"/>
      <path d="M104 216l6 70M140 216l3 72M180 216v72M220 216l-3 72M256 216l-6 70" stroke="#C07F3C" strokeWidth="2.5" strokeLinecap="round" opacity={0.75}/>
      <rect x="52" y="204" width="256" height="20" rx="10" fill="#C9844A"/>
      <path d="M64 214h232" stroke="#E7B27A" strokeWidth="3" strokeLinecap="round"/>
      {/* front leaves */}
      <path d="M30 290c4-26 24-40 50-38-4 24-24 38-50 38z" fill="#34B08F"/>
      <path d="M34 286c12-12 26-22 42-30" stroke="#2A9C80" strokeWidth="2" fill="none"/>
      <path d="M336 292c-2-24-20-38-44-38 2 22 20 36 44 38z" fill="#8FD2C8"/>
    </svg>
  );
}
