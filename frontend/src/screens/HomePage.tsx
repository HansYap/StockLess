import { useState } from "react";
import { Logo } from "../components/Logo.tsx";
import "../homepage.css";

type HomePageProps = { startHref?: string; assetRoot?: string; imageSources?: Record<string, string> };

const benefits = [
  ["wallet", "Spend less on excess stock", "Avoid over-ordering by identifying when planned restocks exceed expected demand."],
  ["leaf", "Help prevent food waste", "Spot potential overstock early and act before products become stale or expire."],
  ["upload", "Start without new tools", "Use the sales file you already have. No installation, new hardware, or complex setup."],
  ["shield", "Keep your data private", "Your sales records are processed on your device, without sending them to an external server."],
] as const;

function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    wallet: "M3 7h17v13H3z M3 7V4h14v3 M15 12h5v4h-5z",
    leaf: "M20 3C8 2 3 7 5 14s14 7 15-11Z M4 21 15 9 M10 14v-4",
    upload: "M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6",
    shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z m-4 9 3 3 5-6",
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.leaf} /></svg>;
}

function PurchasePreview() {
  const [order, setOrder] = useState(60);
  // Illustrative arithmetic only. Real recommendations belong to DemandScreen.
  const remainingMin = Math.max(0, 12 + order - 36);
  const remainingMax = Math.max(0, 12 + order - 28);
  const shortage = Math.max(0, 36 - (12 + order));
  const high = order > 24;
  return (
    <div className="sl-demo" id="product-preview">
      <div className="sl-demo-bar"><span className="sl-window-dots" aria-hidden="true">● ● ●</span><span>YOUR NEXT RESTOCK, WITH A CLEARER PICTURE</span><span className="sl-demo-label">Interactive example</span></div>
      <div className="sl-demo-grid">
        <div className="sl-evidence">
          <div className="sl-product"><div><span className="sl-kicker">SELECTED PRODUCT</span><h3>Ikan Bilis 200g</h3></div><span className={`sl-risk ${high ? "sl-risk--high" : ""}`}>{high ? "Overstock risk" : "Review demand range"}</span></div>
          <div className={`sl-warning ${high ? "sl-warning--high" : ""}`}><span aria-hidden="true">!</span><div><strong>{high ? "This order may leave you with excess stock." : "A smaller order reduces potential excess."}</strong><p>12 in stock + {order} planned = <b>{12 + order} units</b>, against expected four-week demand of <b>28–36 units</b>.</p></div></div>
          <div className="sl-chart"><div className="sl-chart-heading"><div><span className="sl-kicker">DEMAND EVIDENCE</span><h4>Past sales. A clearer view ahead.</h4></div><span><i /> History <i className="sl-mint-dot" /> Expected range</span></div>
            <svg viewBox="0 0 600 190" role="img" aria-label="Illustrative weekly sales history followed by a shaded future demand range. This is sample data."><g stroke="#e7eeeb" strokeWidth="1"><path d="M35 25H580 M35 65H580 M35 105H580 M35 145H580" /></g><g fill="#71827d" fontSize="11"><text x="12" y="29">12</text><text x="18" y="69">8</text><text x="18" y="109">4</text><text x="18" y="149">0</text><text x="35" y="176">Past 8 weeks</text><text x="429" y="176">Next 4 weeks</text></g><path d="M35 119 80 77 125 102 170 43 215 94 260 66 305 119 350 79 395 53 430 88" fill="none" stroke="#254854" strokeWidth="2.7" strokeLinejoin="round"/><path d="M430 62 465 49 502 58 540 44 580 32V110L540 96 502 107 465 99 430 114Z" fill="#cde6e0"/><path d="M430 88 465 77 502 83 540 70 580 68" fill="none" stroke="#167d74" strokeWidth="2" strokeDasharray="5 5"/><path d="M430 18V150" stroke="#9db8b0" strokeDasharray="4 4"/></svg>
          </div>
          <div className="sl-demo-baseline"><span>Original plan <b>60 units</b></span><span>Original purchase cost <b>RM 240</b></span><span>Potential stock left <b>36–44 units</b></span></div>
        </div>
        <div className="sl-scenario"><span className="sl-kicker">TRY A DIFFERENT PLAN</span><h3>What if you ordered less?</h3><p>Move the slider to see what changes before you buy.</p>
          <label htmlFor="planned-order">Planned order quantity <output htmlFor="planned-order">{order}<small> units</small></output></label>
          <input id="planned-order" type="range" min="0" max="100" step="5" value={order} onChange={e => setOrder(Number(e.target.value))} />
          <div className="sl-range-ends"><span>0 units</span><span>100 units</span></div>
          <button type="button" className="sl-text-button" onClick={() => setOrder(order === 20 ? 60 : 20)}>{order === 20 ? "Reset to original plan ↺" : "Try a 20-unit order ↗"}</button>
          <div className="sl-scenario-result" aria-live="polite" aria-atomic="true"><span>{order <= 60 ? "Less spent than the original plan" : "More spent than the original plan"}</span><strong>RM {Math.abs(60 - order) * 4}</strong><div><span>Potential stock left</span><b>{remainingMin}–{remainingMax} units</b></div><p>{shortage > 0 ? `Higher demand could leave you ${shortage} units short. Check timing before ordering.` : "Excess stock is a risk estimate, not measured food waste."}</p></div>
        </div>
      </div>
      <p className="sl-demo-note">Illustrative scenario · RM 4 per unit · Assumes no other incoming stock. Your results depend on your sales data.</p>
    </div>
  );
}

const comparison = [
  ["Built for small retailers", "Simple & focused", "Scope varies by system", "Flexible spreadsheets"],
  ["Restocking recommendations", "Demand-based guidance", "Depends on modules", "Build your own formulas"],
  ["Demand insights", "Based on sales patterns", "Available with setup", "Manual analysis or formulas"],
  ["Food-waste prevention", "Flags potential overstock", "Depends on configuration", "Requires a custom workflow"],
  ["Getting started", "Import your sales CSV", "Implementation varies", "Create your workbook"],
  ["Technical expertise", "Guided, step by step", "Training may be needed", "Depends on workbook complexity"],
  ["Sales data privacy", "Processed on your device", "Depends on provider", "Depends on storage settings"],
];

export function HomePage({ startHref = "#workspace", assetRoot = "/homepage", imageSources }: HomePageProps) {
  const photo = (name: string) => imageSources?.[name] ?? `${assetRoot}/${name}`;
  return <div className="sl-home" id="home">
    <a className="sl-skip" href="#home-main">Skip to content</a>
    <header className="sl-nav sl-container"><a href="#home" aria-label="StockLess home"><Logo height={43} /></a><nav aria-label="Homepage"><a href="#benefits">Benefits</a><a href="#specifications">Why StockLess</a><a href="#how-to">How it works</a></nav><a className="sl-button sl-button--small" href={startHref}>Get started <span aria-hidden="true">↗</span></a></header>
    <main id="home-main">
      <section className="sl-hero sl-container" aria-labelledby="home-title"><p className="sl-kicker sl-hero-eyebrow"><span /> SMALLER RESTOCKS. BIGGER POSSIBILITIES.</p><h1 id="home-title">Less <em>food waste.</em><br />Lower costs. Higher profits.</h1><p className="sl-hero-copy">Smarter restocking for small retailers.<br className="sl-mobile-break" /> Make the most of what you stock.</p><div className="sl-hero-actions"><a className="sl-button" href={startHref}>Start with your sales data <span aria-hidden="true">↗</span></a><a className="sl-secondary-link" href="#how-to">See how it works <span aria-hidden="true">↓</span></a></div><div className="sl-preview-stage"><PurchasePreview /></div></section>

      <section className="sl-section sl-container" id="benefits" aria-labelledby="benefits-title"><p className="sl-kicker">THE BENEFITS</p><h2 id="benefits-title">Less food waste. Smarter restocking.<br /><span className="sl-muted-heading">More sustainable business.</span></h2><p className="sl-section-copy">StockLess helps you reduce excess stock and food waste by making smarter restocking decisions.</p><div className="sl-benefits">{benefits.map(([icon, title, copy]) => <article key={title}><Icon name={icon} /><h3>{title}</h3><p>{copy}</p></article>)}</div><figure className="sl-wide-photo"><img src={photo("food-waste.jpg")} alt="A large pile of discarded vegetables, showing the scale of avoidable food waste" loading="lazy" width="1200" height="620"/><figcaption>Better decisions start before food becomes waste.</figcaption></figure></section>

      <section className="sl-story sl-container" aria-labelledby="problem-title"><div><p className="sl-kicker">THE BIGGER PICTURE</p><h2 id="problem-title">Food waste starts<br />with what we stock.</h2><p className="sl-section-copy">For small retailers, every restocking decision can mean the difference between selling stock and wasting it.</p><dl className="sl-statistics"><div><dt>1.05B <span>tonnes</span></dt><dd>of food waste generated globally in 2022, including inedible parts.</dd></div><div><dt>12<span>%</span></dt><dd>of that food waste came from the retail sector.</dd></div><div><dt>2030</dt><dd>The SDG 12.3 target year for halving per-capita global food waste at retail and consumer levels.</dd></div></dl><p className="sl-source">Sources: <a href="https://www.unep.org/resources/publication/food-waste-index-report-2024" target="_blank" rel="noreferrer">UNEP Food Waste Index 2024 ↗</a> · <a href="https://www.unep.org/indicator-1231b" target="_blank" rel="noreferrer">SDG 12.3 ↗</a></p><p className="sl-story-takeaway">Smarter restocking can help prevent waste before it happens. <span aria-hidden="true">↗</span></p></div><img className="sl-story-image" src={photo("retail-produce-2.jpg")} alt="Fruit and vegetables displayed on shelves in a small retail shop" width="1147" height="860" loading="lazy"/></section>

      <section className="sl-section sl-comparison sl-container" id="specifications" aria-labelledby="comparison-title"><div className="sl-centered"><p className="sl-kicker">MADE FOR YOUR EVERYDAY</p><h2 id="comparison-title">Why StockLess?</h2><p className="sl-section-copy">Designed for small retailers who need smarter inventory decisions<br className="sl-desktop-break"/> without the cost and complexity of enterprise systems.</p></div><p className="sl-table-hint">Compare features <span>Swipe to explore →</span></p><div className="sl-table-scroll" tabIndex={0} role="region" aria-label="Comparison of StockLess, ERP software and Excel"><table><caption className="sl-sr-only">How StockLess compares with typical ERP and spreadsheet workflows. Capabilities vary by product and setup.</caption><thead><tr><th scope="col">What matters to your shop</th><th scope="col" className="sl-featured"><span className="sl-kicker">PURPOSE-BUILT</span>StockLess</th><th scope="col">ERP software</th><th scope="col">Excel</th></tr></thead><tbody>{comparison.map(([feature, stockless, erp, excel]) => <tr key={feature}><th scope="row">{feature}</th><td className="sl-featured"><span className="sl-check" aria-hidden="true">✓</span>{stockless}</td><td>{erp}</td><td>{excel}</td></tr>)}</tbody></table></div><p className="sl-comparison-note">A guide to typical workflows. ERP and spreadsheet capabilities vary with product, configuration, and storage.</p><p className="sl-comparison-tagline">Smarter than spreadsheets. Simpler than enterprise systems.</p></section>

      <section className="sl-impact sl-container" aria-labelledby="impact-title"><div className="sl-sdg" aria-label="Supporting Sustainable Development Goal 12: Responsible consumption and production"><div><span>12</span><b>RESPONSIBLE<br/>CONSUMPTION<br/>AND PRODUCTION</b></div><svg viewBox="0 0 360 170" fill="none" aria-hidden="true"><path d="M176 86C138 39 110 28 76 35C7 49 9 132 76 139C122 145 153 102 181 78C217 35 247 27 282 36C344 53 344 127 282 137C247 143 216 116 195 96" stroke="white" strokeWidth="18"/><path d="m185 62-10 39-32-22 M208 116l-29-25 37-16" fill="white"/></svg><span className="sl-sdg-caption">A shared goal. An everyday action.</span></div><div><p className="sl-kicker">GOOD FOR YOUR SHOP. BETTER FOR THE PLANET.</p><h2 id="impact-title">Small decisions.<br />Less waste.</h2><p className="sl-impact-lede">Smarter restocking decisions can help small retailers save money while preventing food from becoming waste.</p><p>Every restocking decision matters. StockLess uses your existing sales data to help you identify unnecessary orders and potential excess stock. Less stock sitting on shelves can mean less food going to waste.</p><a className="sl-sdg-link" href="https://www.unep.org/indicator-1231b" target="_blank" rel="noreferrer"><span>SDG 12.3</span> Supporting responsible consumption <span aria-hidden="true">↗</span></a></div></section>

      <section className="sl-section sl-container" id="how-to" aria-labelledby="how-title"><div className="sl-section-header"><div><p className="sl-kicker">HOW IT WORKS</p><h2 id="how-title">From data to less waste.</h2><p className="sl-section-copy">Turn everyday sales data into smarter restocking decisions.</p></div><a className="sl-button" href={startHref}>Let’s get started <span aria-hidden="true">↗</span></a></div><ol className="sl-steps">{[
        ["Upload your sales data", "Import your existing sales CSV, or explore the sample data to see how StockLess works."],
        ["Prepare it with StockLess", "Confirm your columns and review missing values or date formats with guided checks."],
        ["Understand your demand", "See sales patterns, expected demand, and where your data needs more confidence."],
        ["Review your restocking plan", "Compare purchase scenarios to spot potential excess stock and control costs."],
      ].map(([title, copy], i) => <li key={title}><span className="sl-step-number">0{i + 1}</span><h3>{title}</h3><p>{copy}</p></li>)}</ol><div className="sl-final-cta"><div><p className="sl-kicker">MAKE YOUR NEXT ORDER A SMARTER ONE</p><h2>A little less stock.<br />A lot more possibility.</h2><a className="sl-button" href={startHref}>Open StockLess <span aria-hidden="true">↗</span></a><p>Use your own CSV or start with a sample.</p></div><img src={photo("retail-produce-2.jpg")} alt="Fresh produce ready for customers in a small shop" loading="lazy" width="1147" height="860"/></div></section>
    </main><footer className="sl-footer sl-container"><a href="#home" aria-label="Back to StockLess home"><Logo height={35}/></a><p>Smarter restocking. Less food waste.</p><a href="#home">Back to top ↑</a></footer>
  </div>;
}
