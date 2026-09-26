import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react';
import { LanguageSwitcher } from '../components/LanguageSwitcher.tsx';
import { Logo } from '../components/Logo.tsx';
import { useLanguage, localizedWorkspaceHref } from '../i18n/index.ts';
import { homepageDesignMessages } from '../i18n/homepage-design.ts';
import '../homepage.css';
const HomeAssets = createContext<(name: string) => string>(name => '/homepage/' + name);
const StartNavigation = createContext<(_path?: string) => void>(() => {
  window.location.hash = 'workspace';
});
function useHomeAssets() {
  return useContext(HomeAssets);
}
function useStartNavigation() {
  return useContext(StartNavigation);
}
function useDesignLanguage() {
  const lang = useLanguage();
  return {
    lang,
    t: (key: string, values?: Record<string, string | number>) => {
      const text = homepageDesignMessages[lang]?.[key] ?? homepageDesignMessages.en[key] ?? key;
      return values ? text.replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? '{' + name + '}')) : text;
    }
  };
}
type HomePageProps = {
  startHref?: string;
  assetRoot?: string;
  imageSources?: Record<string, string>;
};
export function HomePage({
  startHref = '#workspace',
  assetRoot = '/homepage',
  imageSources
}: HomePageProps) {
  const {
    t
  } = useDesignLanguage();
  const start = () => {
    window.location.href = localizedWorkspaceHref(startHref);
  };
  return <HomeAssets.Provider value={name => imageSources?.[name] ?? assetRoot + '/' + name}><StartNavigation.Provider value={start}>
  <div className="sl-home" id="home">
   <a className="sl-skip" href="#home-main">Skip to content</a>
   <header className="sl-design-nav"><div className="sl-topnav"><a href="#home" aria-label="StockLess home"><Logo height={34} /></a><div className="sl-nav-actions"><LanguageSwitcher /><a href="#how-it-works">{t('nav.howItWorks')}</a></div></div></header>
   <main id="home-main"><LandingContent onStart={start} /></main>
  </div>
 </StartNavigation.Provider></HomeAssets.Provider>;
}
const PALE_GREEN = "#EDF7E9";
const LIGHT_GREEN = "#DDEFD6";
const SOFT_GREEN = "#DCEFD8";
const MINT_GREEN = "#B8DFBE";
const EXAMPLE_STOCK = 7;
const SUGGESTED_ORDER = 10;
const DEMAND_LOW = 7;
const DEMAND_HIGH = 28;
const WEEKLY_SALES = [5, 7, 5, 6, 3, 5, 2, 3];
const EXPECTED_SALES = [3.5, 4, 4.5, 5];
const FORECAST_LOW = [3, 2.4, 1.9, 1.75];
const FORECAST_HIGH = [4, 5.2, 6.3, 7];
function Eyebrow({
  children,
  style
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return <p style={{
    fontFamily: "var(--font-body)",
    fontSize: "var(--text-eyebrow)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
    color: "var(--teal)",
    marginBottom: "var(--space-3)",
    ...style
  }}>{children}</p>;
}
function Surface({
  children,
  style
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-card)",
    boxShadow: "var(--shadow-card)",
    padding: "var(--space-8)",
    ...style
  }}>{children}</div>;
}
function StartButton({
  children,
  onClick,
  style
}: {
  children?: ReactNode;
  onClick: () => void;
  style?: CSSProperties;
}) {
  return <button onClick={onClick} style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-2)",
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: "var(--text-body)",
    color: "#fff",
    background: "var(--teal)",
    border: "1px solid var(--teal-deep)",
    borderRadius: "var(--radius-btn)",
    padding: "11px 24px",
    cursor: "pointer",
    transition: "background var(--transition)",
    lineHeight: 1,
    ...style
  }} onMouseEnter={l => l.currentTarget.style.background = "var(--teal-deep)"} onMouseLeave={l => l.currentTarget.style.background = "var(--teal)"}>{children}<ArrowIcon /></button>;
}
function ArrowIcon() {
  return <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h10M8 3l4 4-4 4" /></svg>;
}
function Leaf({
  x,
  y,
  s,
  rot,
  fill,
  op
}: {
  x: number;
  y: number;
  s: number;
  rot: number;
  fill: string;
  op: number;
}) {
  return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`} opacity={op}><path d="M36 2C16 16 4 34 4 52c0 17 14 30 32 30s32-13 32-30C68 34 56 16 36 2Z" fill={fill} /><path d="M36 78V12" stroke="#FFFFFF" strokeOpacity=".55" strokeWidth="2.5" strokeLinecap="round" /><path d="M36 34 18 46M36 34l18 12M36 54 20 66M36 54l16 12" stroke="#FFFFFF" strokeOpacity=".35" strokeWidth="2" strokeLinecap="round" /></g>;
}
function DotPattern({
  x,
  y
}: {
  x: number;
  y: number;
}) {
  let e = [];
  for (let l = 0; l < 5; l++) for (let n = 0; n < 3; n++) e.push(<circle cx={l * 17} cy={n * 17} r="3" key={`${l}-${n}`} />);
  return <g transform={`translate(${x} ${y})`} fill="#9CC9A0" opacity=".55">{e}</g>;
}
function HeroDecor() {
  const photo = useHomeAssets();
  return <div className="sl-decor sl-decor--hero" aria-hidden="true"><svg viewBox="0 0 1536 620" preserveAspectRatio="xMidYMax slice"><path d="M0 0h1536v96c-320 132-520-40-880 40C380 178 220 78 0 214Z" fill={PALE_GREEN} /><path d="M1536 0v250c-150-84-250-150-296-250Z" fill={LIGHT_GREEN} /><path d="M0 620V440c250-70 500 62 800 8 300-54 520 66 736 14v158Z" fill={SOFT_GREEN} /><path d="M0 620V524c300-54 560 56 900 12 280-36 460 46 636 12v72Z" fill={MINT_GREEN} /><Leaf x={58} y={96} s={0.62} rot={-20} fill="#7FB27D" op={0.9} /><Leaf x={138} y={52} s={0.44} rot={30} fill="#95C293" op={0.85} /><Leaf x={26} y={214} s={0.4} rot={56} fill="#A8CFA2" op={0.8} /><Leaf x={150} y={268} s={0.32} rot={-10} fill="#8FBC8B" op={0.75} /><Leaf x={1358} y={120} s={0.46} rot={152} fill="#A6CEA4" op={0.85} /><Leaf x={1452} y={262} s={0.36} rot={198} fill="#9AC698" op={0.8} /><Leaf x={78} y={430} s={0.52} rot={16} fill="#8FBC8B" op={0.8} /><Leaf x={196} y={492} s={0.34} rot={-28} fill="#A5CDA0" op={0.75} /><DotPattern x={1432} y={150} /><DotPattern x={62} y={336} /></svg><img className="sl-basket" src={photo("design-basket.png")} alt="" /></div>;
}
function FooterDecor() {
  return <div className="sl-decor sl-decor--foot" aria-hidden="true"><svg viewBox="0 0 1536 460" preserveAspectRatio="xMidYMin slice"><path d="M0 460h1536V364c-320-132-520 40-880-40C380 282 220 382 0 246Z" fill={PALE_GREEN} /><path d="M0 460V236c250 70 500-62 800-8 300 54 520-66 736-14v246Z" fill={SOFT_GREEN} /><path d="M0 460V344c300 54 560-56 900-12 280 36 460-46 636-12v140Z" fill={MINT_GREEN} /><Leaf x={84} y={92} s={0.5} rot={196} fill="#8FBC8B" op={0.8} /><Leaf x={188} y={166} s={0.34} rot={148} fill="#A5CDA0" op={0.75} /><Leaf x={1372} y={104} s={0.46} rot={-24} fill="#A6CEA4" op={0.85} /><Leaf x={1462} y={196} s={0.32} rot={22} fill="#9AC698" op={0.8} /><DotPattern x={1430} y={54} /><DotPattern x={58} y={252} /></svg></div>;
}
function WorkflowIcon({
  n
}: {
  n: number;
}) {
  return <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="var(--teal)" strokeWidth="1.5">{[<path d="M8 13V7m0 0L5 10m3-3 3 3M3 16v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1" strokeLinecap="round" strokeLinejoin="round" key={"u"} />, <><path d="M3 6h5v9H3zM9 6h5v9H9z" strokeLinejoin="round" key={"c1"} /><path d="M5 3v3M11 3v3" strokeLinecap="round" key={"c2"} /></>, <path d="M4 8l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" key={"ch"} />, <><path d="M3 12h2m3-6h2m3 9h2" strokeLinecap="round" key={"r1"} /><path d="M3 15l3-6 3 4 3-5 3 7" strokeLinecap="round" strokeLinejoin="round" key={"r2"} /></>][n - 1]}</svg>;
}
function LandingContent({
  onStart
}: {
  onStart: () => void;
}) {
  return <><div className="sl-band"><HeroDecor /><Hero onStart={onStart} /></div><PurchasePreview /><WorkflowOverview /><BenefitsAndPrivacy /><StartBanner /><FoodWasteEvidence /><div className="sl-band"><FooterDecor /><Sustainability /><LandingFooter /></div></>;
}
function Hero({
  onStart
}: {
  onStart: () => void;
}) {
  let {
      t,
      lang: e
    } = useDesignLanguage(),
    l = e === "zh";
  return <section style={{
    textAlign: "center",
    padding: "var(--space-20) var(--space-6) var(--space-16)",
    maxWidth: "780px",
    margin: "0 auto"
  }}><div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "8px",
      marginBottom: "var(--space-5)"
    }}><span style={{
        width: "6px",
        height: "6px",
        borderRadius: "50%",
        background: "var(--amber-accent)",
        flexShrink: 0
      }} /><p style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-eyebrow)",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.12em",
        color: "var(--teal)",
        margin: 0
      }}>{t("hero.eyebrow")}</p></div><h1 id="home-title" style={{
      fontFamily: "var(--font-display)",
      fontWeight: 600,
      fontSize: "clamp(36px, 6vw, 64px)",
      letterSpacing: l ? "0.01em" : "-0.03em",
      lineHeight: 1.05,
      color: "var(--ink)",
      marginBottom: "var(--space-6)"
    }}>{t("hero.line1.plain")}<span style={{
        color: "var(--amber-accent)"
      }}>{t("hero.line1.accent")}</span><br />{t("hero.line2")}</h1><p style={{
      fontSize: "var(--text-lead)",
      color: "var(--muted)",
      lineHeight: 1.65,
      maxWidth: "520px",
      margin: "0 auto var(--space-8)"
    }}>{t("hero.subcopy")}</p><div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-5)",
      flexWrap: "wrap"
    }}><StartButton onClick={onStart}>{t("hero.cta")}</StartButton><a href="#how-it-works" style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontFamily: "var(--font-body)",
        fontWeight: 700,
        fontSize: "var(--text-body)",
        color: "var(--teal)"
      }}>{t("hero.link")}<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 2v10M3 8l4 4 4-4" /></svg></a></div></section>;
}
function PurchasePreview() {
  let {
      t: translate
    } = useDesignLanguage(),
    [plannedOrder, setPlannedOrder] = useState(9),
    [incomingStock, setIncomingStock] = useState(2),
    availableAfterOrder = EXAMPLE_STOCK + incomingStock + plannedOrder,
    verdict: "high" | "low" | "balanced" = availableAfterOrder > DEMAND_HIGH ? "high" : availableAfterOrder < DEMAND_LOW ? "low" : "balanced",
    verdictColors = {
      balanced: {
        dot: "var(--teal)",
        text: "var(--teal)",
        bg: "var(--teal-tint)",
        border: "var(--mint)"
      },
      high: {
        dot: "var(--amber-strong)",
        text: "var(--amber)",
        bg: "var(--amber-tint)",
        border: "#EBCF9F"
      },
      low: {
        dot: "var(--red)",
        text: "var(--red)",
        bg: "var(--red-tint)",
        border: "#E9B4B4"
      }
    }[verdict],
    verdictLabel = translate(verdict === "balanced" ? "ex.check.balanced" : verdict === "high" ? "ex.check.high" : "ex.check.low"),
    verdictHeading = translate(verdict === "balanced" ? "ex.check.balanced.head" : verdict === "high" ? "ex.check.high.head" : "ex.check.low.head"),
    verdictExplanation = translate(verdict === "balanced" ? "ex.check.balanced.body" : verdict === "high" ? "ex.check.high.body" : "ex.check.low.body", {
      total: availableAfterOrder,
      low: DEMAND_LOW,
      high: DEMAND_HIGH
    }),
    comparisonLabel = translate(verdict === "balanced" ? "ex.summary.within" : verdict === "high" ? "ex.summary.above" : "ex.summary.below"),
    chartWidth = 880,
    chartHeight = 250,
    chartLeft = 46,
    chartRight = 860,
    chartTop = 26,
    chartBottom = 196,
    chartMax = 8,
    chartSpacing = (chartRight - chartLeft) / (WEEKLY_SALES.length + EXPECTED_SALES.length - 1),
    chartX = (j: number) => chartLeft + j * chartSpacing,
    chartY = (j: number) => chartBottom - j / chartMax * (chartBottom - chartTop),
    historyPoints = WEEKLY_SALES.map((j, na) => `${chartX(na)},${chartY(j)}`).join(" "),
    forecastStartX = chartX(WEEKLY_SALES.length - 1),
    forecastStartY = chartY(WEEKLY_SALES[WEEKLY_SALES.length - 1]),
    expectedPoints = [`${forecastStartX},${forecastStartY}`, ...EXPECTED_SALES.map((j, na) => `${chartX(WEEKLY_SALES.length + na)},${chartY(j)}`)].join(" "),
    rangePoints = [`${forecastStartX},${forecastStartY}`, ...FORECAST_HIGH.map((j, na) => `${chartX(WEEKLY_SALES.length + na)},${chartY(j)}`), ...FORECAST_LOW.map((j, na) => `${chartX(WEEKLY_SALES.length + 3 - na)},${chartY(FORECAST_LOW[3 - na])}`)].join(" ");
  return <section style={{
    maxWidth: "1180px",
    margin: "0 auto var(--space-16)",
    padding: "0 var(--space-6)"
  }}><div style={{
      display: "flex",
      alignItems: "baseline",
      gap: "var(--space-3)",
      flexWrap: "wrap",
      marginBottom: "var(--space-4)"
    }}><span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        background: "var(--teal-tint)",
        border: "1px solid var(--mint)",
        borderRadius: "999px",
        padding: "6px 14px",
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-description)",
        fontWeight: 800,
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        color: "var(--teal-deep)"
      }}><span aria-hidden="true" style={{
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "var(--teal)"
        }} />{translate("example.chip")}</span><span style={{
        fontSize: "var(--text-body)",
        color: "var(--muted)"
      }}>{translate("ex.tryIt")}</span></div><div style={{
      position: "relative",
      border: "1px solid var(--line)",
      borderRadius: "18px",
      background: "#FBFDFC",
      boxShadow: "0 20px 60px rgba(22,49,59,.10)",
      overflow: "hidden"
    }}><div style={{
        padding: "var(--space-6) var(--space-8) 0"
      }}><div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-4)",
          flexWrap: "wrap"
        }}><span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "var(--text-secondary)",
            fontWeight: 600,
            color: "var(--ink-2)"
          }}><span aria-hidden="true">{"\u2190"}</span>{translate("ex.back")}</span><span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            border: "1px solid var(--line)",
            background: "#fff",
            borderRadius: "var(--radius-btn)",
            padding: "10px 16px",
            fontSize: "var(--text-secondary)",
            fontWeight: 700,
            color: "var(--ink)"
          }}><span aria-hidden="true">{"\u2193"}</span>{translate("ex.download")}</span></div><p style={{
          fontFamily: "var(--font-data)",
          fontSize: "var(--text-label)",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--muted)",
          margin: "var(--space-5) 0 0"
        }}>{translate("ex.eyebrow")}</p><h3 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "26px",
          letterSpacing: "-0.02em",
          color: "var(--ink)",
          margin: "6px 0 0"
        }}>{translate("ex.product")}</h3><p style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          fontSize: "var(--text-secondary)",
          color: "var(--muted)",
          margin: "7px 0 0"
        }}>{translate("ex.counted")}{" "}<span aria-hidden="true">{"\xB7"}</span>{" "}{translate("ex.age")}{" "}<span aria-hidden="true">{"\xB7"}</span><EvidenceSource kind="stockless" label={translate("ex.byStockLess")} /></p><div style={{
          display: "flex",
          gap: "var(--space-2)",
          margin: "var(--space-4) 0 0"
        }}><span style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--teal-tint)",
            color: "var(--teal-deep)",
            borderRadius: "999px",
            padding: "5px 12px",
            fontSize: "var(--text-secondary)",
            fontWeight: 700
          }}><span style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              background: "var(--teal)"
            }} />{translate("ex.ready")}</span><span style={{
            background: "#EDF1F0",
            color: "#51636A",
            borderRadius: "999px",
            padding: "5px 12px",
            fontSize: "var(--text-secondary)",
            fontWeight: 700
          }}>{translate("ex.steady")}</span></div></div><div className="ex-grid" style={{
        padding: "var(--space-6) var(--space-8) var(--space-8)"
      }}><div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          minWidth: 0
        }}><ExampleCard><div style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "var(--space-5)",
              flexWrap: "wrap"
            }}><div style={{
                minWidth: 0
              }}><h4 style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 700,
                  fontSize: "var(--text-section-head)",
                  color: "var(--ink)",
                  margin: 0
                }}>{translate("ex.demand.title")}</h4><p style={{
                  fontSize: "var(--text-secondary)",
                  color: "var(--muted)",
                  margin: "6px 0 0",
                  maxWidth: "440px",
                  lineHeight: 1.45
                }}>{translate("ex.demand.sub")}</p></div><div style={{
                background: "var(--teal-tint)",
                border: "1px solid var(--mint)",
                borderRadius: "var(--radius)",
                padding: "var(--space-4) var(--space-5)"
              }}><p style={{
                  fontSize: "var(--text-secondary)",
                  color: "var(--teal-deep)",
                  margin: 0
                }}>{translate("ex.demand.expected")}</p><p style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: "10px",
                  flexWrap: "wrap",
                  margin: "4px 0 0"
                }}><b style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 800,
                    fontSize: "28px",
                    color: "var(--teal)",
                    letterSpacing: "-0.02em"
                  }}>{DEMAND_LOW}{"\u2013"}{DEMAND_HIGH}{" "}<span style={{
                      fontSize: "16px",
                      fontWeight: 600
                    }}>{translate("ex.units")}</span></b><span style={{
                    fontSize: "var(--text-description)",
                    fontWeight: 700,
                    color: "var(--teal-deep)"
                  }}>{"\u2197 "}{translate("ex.steady")}</span></p></div></div><p style={{
              fontFamily: "var(--font-data)",
              fontSize: "var(--text-description)",
              color: "var(--muted)",
              margin: "var(--space-5) 0 0"
            }}>{translate("ex.unitsPerWeek")}</p><svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" style={{
              display: "block",
              marginTop: "4px"
            }} role="img" aria-label={translate("ex.demand.title")}>{[0, 4, 8].map(j => <g key={j}><line x1={chartLeft} y1={chartY(j)} x2={chartRight} y2={chartY(j)} stroke="var(--line-soft)" strokeWidth="1" /><text x={chartLeft - 12} y={chartY(j) + 4} textAnchor="end" fontFamily="Inter, sans-serif" fontSize="15" fill="var(--muted)">{j}</text></g>)}<polygon points={rangePoints} fill="var(--mint)" opacity=".22" /><line x1={forecastStartX} y1={chartTop - 2} x2={forecastStartX} y2={chartBottom} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="4 3" /><text x={forecastStartX} y={chartTop - 8} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="15" fill="var(--muted)">{translate("ex.today")}</text><polyline points={expectedPoints} fill="none" stroke="var(--teal)" strokeWidth="2.5" strokeDasharray="7 5" strokeLinecap="round" strokeLinejoin="round" /><polyline points={historyPoints} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />{WEEKLY_SALES.map((j, na) => <circle cx={chartX(na)} cy={chartY(j)} r="3.5" fill="var(--ink)" key={na} />)}{[...WEEKLY_SALES.map((j, na) => `W${na + 1}`), ...EXPECTED_SALES.map((j, na) => `F${na + 1}`)].map((j, na) => <text x={chartX(na)} y={chartBottom + 24} textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="15" fill={na >= WEEKLY_SALES.length ? "var(--teal)" : "var(--muted)"} key={j}>{j}</text>)}</svg><div style={{
              display: "flex",
              gap: "var(--space-5)",
              flexWrap: "wrap",
              justifyContent: "center",
              marginTop: "var(--space-3)"
            }}><ChartLegend label={translate("ex.legend.past")}><span style={{
                  width: "22px",
                  height: "2.5px",
                  background: "var(--ink)",
                  borderRadius: "2px"
                }} /></ChartLegend><ChartLegend label={translate("ex.legend.expected")}><span style={{
                  width: "22px",
                  height: 0,
                  borderTop: "2.5px dashed var(--teal)"
                }} /></ChartLegend><ChartLegend label={translate("ex.legend.range")}><span style={{
                  width: "22px",
                  height: "11px",
                  background: "var(--mint)",
                  opacity: 0.35,
                  borderRadius: "3px"
                }} /></ChartLegend></div></ExampleCard><ExampleCard><h4 style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-body)",
              color: "var(--ink)",
              margin: 0
            }}>{translate("ex.recent")}</h4><div className="ex-weeks" style={{
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(0, 1fr))",
              gap: "var(--space-2)",
              marginTop: "var(--space-3)"
            }}>{WEEKLY_SALES.map((j, na) => <div style={{
                background: "#F4F8F7",
                border: "1px solid var(--line-soft)",
                borderRadius: "var(--radius)",
                padding: "var(--space-3) var(--space-2)",
                textAlign: "center"
              }} key={na}><p style={{
                  fontFamily: "var(--font-data)",
                  fontSize: "var(--text-description)",
                  color: "var(--muted)",
                  margin: 0
                }}>{"W"}{na + 1}</p><p style={{
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "22px",
                  color: "var(--ink)",
                  margin: "4px 0 0"
                }}>{j}</p></div>)}</div></ExampleCard><ExampleCard><h4 style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-body)",
              color: "var(--ink)",
              margin: 0
            }}>{translate("ex.summary.title")}</h4><p style={{
              fontSize: "var(--text-secondary)",
              color: "var(--muted)",
              margin: "5px 0 0"
            }}>{translate("ex.summary.sub")}</p><div className="ex-summary" style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "var(--space-3)",
              marginTop: "var(--space-4)"
            }}><StockMetric label={translate("ex.summary.current")} value={EXAMPLE_STOCK} unit={translate("ex.units")} /><StockMetric label={translate("ex.summary.incoming")} value={incomingStock} unit={translate("ex.units")} /><StockMetric label={translate("ex.summary.recommended")} value={plannedOrder} unit={translate("ex.units")} note={translate("ex.summary.suggested", {
                n: SUGGESTED_ORDER
              })} highlight={true} /><StockMetric label={translate("ex.summary.total")} value={availableAfterOrder} unit={translate("ex.units")} note={comparisonLabel} /></div></ExampleCard></div><div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
          minWidth: 0
        }}><ExampleCard><div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              flexWrap: "wrap"
            }}><h4 style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "var(--text-section-head)",
                color: "var(--ink)",
                margin: 0
              }}>{translate("ex.plan.title")}</h4><span style={{
                background: "var(--teal-tint)",
                color: "var(--teal-deep)",
                borderRadius: "999px",
                padding: "4px 10px",
                fontSize: "var(--text-description)",
                fontWeight: 700
              }}>{translate("example.chip")}</span></div><p style={{
              fontSize: "var(--text-secondary)",
              color: "var(--muted)",
              margin: "6px 0 0",
              lineHeight: 1.45
            }}>{translate("ex.plan.sub")}</p><div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-4)",
              flexWrap: "wrap",
              background: "var(--teal-tint)",
              border: "1px solid var(--mint)",
              borderRadius: "var(--radius)",
              padding: "var(--space-4)",
              marginTop: "var(--space-4)"
            }}><div><p style={{
                  fontSize: "var(--text-secondary)",
                  color: "var(--teal-deep)",
                  margin: 0
                }}>{translate("ex.plan.suggests")}</p><p style={{
                  margin: "2px 0 0",
                  fontFamily: "var(--font-display)",
                  fontWeight: 800,
                  fontSize: "30px",
                  color: "var(--ink)",
                  letterSpacing: "-0.02em"
                }}>{SUGGESTED_ORDER}{" "}<span style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--muted)"
                  }}>{translate("ex.units")}</span></p></div><button type="button" onClick={() => setPlannedOrder(SUGGESTED_ORDER)} style={{
                background: "var(--teal)",
                color: "#fff",
                border: 0,
                borderRadius: "var(--radius-btn)",
                padding: "11px 18px",
                fontFamily: "var(--font-body)",
                fontSize: "var(--text-body)",
                fontWeight: 700,
                cursor: "pointer"
              }}>{translate("ex.plan.use", {
                  n: SUGGESTED_ORDER
                })}</button></div><QuantityControl label={translate("ex.plan.planned")} value={plannedOrder} min={0} max={100} onChange={setPlannedOrder} unit={translate("ex.units")} /><QuantityControl label={translate("ex.summary.incoming")} value={incomingStock} min={0} max={100} onChange={setIncomingStock} unit={translate("ex.units")} hint={translate("ex.plan.incomingHint")} /></ExampleCard><ExampleCard style={{
            background: verdictColors.bg,
            borderColor: verdictColors.border
          }}><div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-3)",
              flexWrap: "wrap"
            }}><h4 style={{
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                fontSize: "var(--text-body)",
                color: "var(--ink)",
                margin: 0
              }}>{translate("ex.check.title")}</h4><span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                fontSize: "var(--text-secondary)",
                fontWeight: 700,
                color: verdictColors.text
              }}><span style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: verdictColors.dot
                }} />{verdictLabel}</span></div><p style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-section-head)",
              color: "var(--ink)",
              margin: "var(--space-3) 0 0"
            }}>{verdictHeading}</p><p style={{
              fontSize: "var(--text-body)",
              lineHeight: 1.5,
              color: "var(--ink-2)",
              margin: "var(--space-2) 0 var(--space-3)"
            }}>{verdictExplanation}</p><EvidenceSource kind="stockless" label={translate("ex.byStockLess")} /><p style={{
              fontFamily: "var(--font-display)",
              fontWeight: 700,
              fontSize: "var(--text-body)",
              color: "var(--ink)",
              margin: "var(--space-5) 0 var(--space-3)"
            }}>{translate("ex.numbers")}</p><div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "var(--space-2)"
            }}><SourceMetric label={translate("ex.n.stock")} value={EXAMPLE_STOCK} unit={translate("ex.units")} source="file" /><SourceMetric label={translate("ex.n.incoming")} value={incomingStock} unit={translate("ex.units")} source="file" /><SourceMetric label={translate("ex.n.planned")} value={plannedOrder} unit={translate("ex.units")} source="file" /><SourceMetric label={translate("ex.n.low")} value={DEMAND_LOW} unit={translate("ex.units")} source="stockless" /><SourceMetric label={translate("ex.n.high")} value={DEMAND_HIGH} unit={translate("ex.units")} source="stockless" /><SourceMetric label={translate("ex.n.after")} value={availableAfterOrder} unit={translate("ex.units")} source="stockless" /></div></ExampleCard><div style={{
            display: "flex",
            gap: "var(--space-3)",
            background: "var(--amber-tint)",
            border: "1px solid #EBCF9F",
            borderRadius: "var(--radius)",
            padding: "var(--space-4)"
          }}><span aria-hidden="true" style={{
              color: "var(--amber-strong)",
              fontWeight: 800
            }}>{"!"}</span><div><p style={{
                fontWeight: 700,
                fontSize: "var(--text-body)",
                color: "#765A2D",
                margin: 0
              }}>{translate("ex.expiry.title")}</p><p style={{
                fontSize: "var(--text-secondary)",
                color: "#765A2D",
                margin: "3px 0 6px"
              }}>{translate("ex.expiry.none")}</p><p style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                flexWrap: "wrap",
                fontSize: "var(--text-secondary)",
                color: "#765A2D",
                margin: 0
              }}>{translate("ex.expiry.earliest")}{" "}<EvidenceSource kind="file" label={translate("ex.fromFile")} /></p></div></div></div></div></div></section>;
}
function ExampleCard({
  children,
  style
}: {
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return <div style={{
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-card)",
    padding: "var(--space-5)",
    ...style
  }}>{children}</div>;
}
function ChartLegend({
  children,
  label
}: {
  children?: ReactNode;
  label: string;
}) {
  return <span style={{
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "var(--text-description)",
    color: "var(--muted)"
  }}>{children}{label}</span>;
}
function EvidenceSource({
  kind,
  label
}: {
  kind: string;
  label: string;
}) {
  let e = kind === "stockless";
  return <span style={{
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "6px",
    padding: "3px 7px",
    background: e ? "var(--teal-tint)" : "#EDF1F0",
    color: e ? "var(--teal-deep)" : "#51636A",
    fontSize: "var(--text-description)",
    fontWeight: 600,
    lineHeight: 1.35
  }}>{label}</span>;
}
function StockMetric({
  label,
  value,
  unit,
  note,
  highlight
}: {
  label: string;
  value: number;
  unit: string;
  note?: string;
  highlight?: boolean;
}) {
  return <div style={{
    borderRadius: "var(--radius)",
    padding: "var(--space-3) var(--space-4)",
    background: highlight ? "var(--teal-tint)" : "#F4F8F7",
    border: `1px solid ${highlight ? "var(--mint)" : "var(--line-soft)"}`
  }}><p style={{
      fontSize: "var(--text-description)",
      color: "var(--muted)",
      margin: 0
    }}>{label}</p><p style={{
      margin: "4px 0 0",
      fontFamily: "var(--font-display)",
      fontWeight: 800,
      fontSize: "24px",
      color: "var(--ink)",
      letterSpacing: "-0.02em"
    }}>{value}{" "}<span style={{
        fontSize: "14px",
        fontWeight: 600,
        color: "var(--muted)"
      }}>{unit}</span></p>{note && <p style={{
      fontSize: "var(--text-description)",
      color: "var(--muted)",
      margin: "4px 0 0"
    }}>{note}</p>}</div>;
}
function QuantityControl({
  label,
  value,
  min,
  max,
  onChange,
  unit,
  hint
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  unit: string;
  hint?: string;
}) {
  let {
      t: translate
    } = useDesignLanguage(),
    clamp = (h: number) => Math.min(max, Math.max(min, h)),
    fillPercent = (value - min) / (max - min) * 100,
    stepperStyle: CSSProperties = {
      width: "34px",
      height: "34px",
      flex: "none",
      border: "1px solid var(--line)",
      background: "#fff",
      borderRadius: "8px",
      color: "var(--ink)",
      fontSize: "18px",
      lineHeight: 1,
      cursor: "pointer"
    };
  return <div style={{
    marginTop: "var(--space-5)"
  }}><div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "var(--space-3)",
      flexWrap: "wrap"
    }}><label style={{
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: "var(--text-body)",
        color: "var(--ink)"
      }}>{label}</label><span style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px"
      }}><button type="button" style={stepperStyle} aria-label={translate("ex.plan.decrease")} onClick={() => onChange(clamp(value - 1))}>{"\u2212"}</button><input type="number" value={value} min={min} max={max} aria-label={label} onChange={h => onChange(clamp(Number(h.target.value) || 0))} style={{
          width: "62px",
          height: "34px",
          textAlign: "center",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          fontFamily: "var(--font-data)",
          fontSize: "var(--text-body)",
          fontWeight: 600,
          color: "var(--ink)",
          background: "#fff"
        }} /><button type="button" style={stepperStyle} aria-label={translate("ex.plan.increase")} onClick={() => onChange(clamp(value + 1))}>{"+"}</button></span></div><input className="sl-range" type="range" min={min} max={max} value={value} aria-label={label} onChange={h => onChange(Number(h.target.value))} style={{
      marginTop: "var(--space-3)",
      "--sl-track": `linear-gradient(to right, var(--teal) ${fillPercent}%, #DCE6E3 ${fillPercent}%)`
    } as CSSProperties} /><div style={{
      display: "flex",
      justifyContent: "space-between",
      fontSize: "var(--text-description)",
      color: "var(--muted)"
    }}><span>{min}{" "}{unit}</span><span>{max}{" "}{unit}</span></div>{hint && <p style={{
      fontSize: "var(--text-description)",
      color: "var(--muted)",
      margin: "6px 0 0"
    }}>{hint}</p>}</div>;
}
function WorkflowOverview() {
  let {
      t: a,
      lang: t
    } = useDesignLanguage(),
    e = t === "zh";
  return <section id="how-it-works" style={{
    background: "var(--card)",
    borderTop: "1px solid var(--line)",
    borderBottom: "1px solid var(--line)"
  }}><div style={{
      maxWidth: "var(--page-max-width)",
      margin: "0 auto",
      padding: "var(--space-16) var(--space-6)"
    }}><Eyebrow style={{
        textAlign: "center"
      }}>{a("steps.eyebrow")}</Eyebrow><h2 style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: "var(--text-page-title)",
        letterSpacing: e ? "0.01em" : "-0.025em",
        textAlign: "center",
        marginBottom: "var(--space-16)",
        lineHeight: 1.15
      }}>{a("steps.heading.plain")}<span style={{
          color: "var(--teal)"
        }}>{a("steps.heading.accent")}</span></h2><div className="sl-workflow-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 0,
        position: "relative"
      }}><div style={{
          position: "absolute",
          top: "34px",
          left: "12.5%",
          right: "12.5%",
          height: "1px",
          background: "var(--line)",
          zIndex: 0
        }} />{[1, 2, 3, 4].map(l => <div style={{
          padding: "0 var(--space-4)",
          position: "relative",
          zIndex: 1
        }} key={l}><p style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "var(--text-step-num)",
            color: "var(--line-soft)",
            lineHeight: 1,
            marginBottom: "var(--space-4)",
            letterSpacing: "-0.04em",
            userSelect: "none"
          }}>{String(l).padStart(2, "0")}</p><div style={{
            width: "36px",
            height: "36px",
            background: "var(--teal-tint)",
            border: "1px solid var(--mint)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "var(--space-4)"
          }}><WorkflowIcon n={l} /></div><p style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "var(--text-body)",
            color: "var(--ink)",
            marginBottom: "var(--space-2)"
          }}>{a(`step.${l}.label`)}</p><p style={{
            fontSize: "var(--text-secondary)",
            color: "var(--muted)",
            lineHeight: 1.5
          }}>{a(`step.${l}.desc`)}</p></div>)}</div></div></section>;
}
function BenefitsAndPrivacy() {
  let a = useStartNavigation(),
    {
      t
    } = useDesignLanguage();
  return <section className="sl-responsive-pair" style={{
    maxWidth: "var(--page-max-width)",
    margin: "0 auto",
    padding: "var(--space-20) var(--space-6)",
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "var(--space-8)",
    alignItems: "start"
  }}><div><Eyebrow>{t("whatYouGet.eyebrow")}</Eyebrow><h2 style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: "28px",
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
        marginBottom: "var(--space-6)"
      }}>{t("whatYouGet.heading.plain").split(`
`).map((e, l) => <span key={l}>{l > 0 && <br />}{e}</span>)}<span style={{
          color: "var(--teal)"
        }}>{t("whatYouGet.heading.accent")}</span></h2><ul style={{
        margin: 0,
        padding: 0,
        listStyle: "none",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)"
      }}>{[1, 2, 3, 4, 5].map(e => <li style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "flex-start"
        }} key={e}><span style={{
            width: "18px",
            height: "18px",
            background: "var(--teal-tint)",
            border: "1px solid var(--mint)",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            marginTop: "1px"
          }}><svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4l2 2 4-4" /></svg></span><span style={{
            fontSize: "var(--text-body)",
            color: "var(--ink-2)",
            lineHeight: 1.5
          }}>{t(`whatYouGet.item.${e}`)}</span></li>)}</ul></div><Surface style={{
      alignSelf: "start"
    }}><Eyebrow>{t("privacy.eyebrow")}</Eyebrow><h3 style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: "22px",
        letterSpacing: "-0.015em",
        marginBottom: "var(--space-4)",
        lineHeight: 1.2
      }}><span style={{
          color: "var(--teal)"
        }}>{t("privacy.heading")}</span></h3><p style={{
        fontSize: "var(--text-body)",
        color: "var(--muted)",
        lineHeight: 1.65,
        marginBottom: "var(--space-6)"
      }}>{t("privacy.body")}</p><div style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)"
      }}>{["privacy.noUploads", "privacy.noAccount", "privacy.noTracking"].map(e => <div style={{
          display: "flex",
          gap: "var(--space-3)",
          alignItems: "center"
        }} key={e}><span style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: "var(--teal)",
            flexShrink: 0
          }} /><span style={{
            fontSize: "var(--text-secondary)",
            color: "var(--ink-2)"
          }}>{t(e)}</span></div>)}</div><div style={{
        marginTop: "var(--space-8)"
      }}><StartButton onClick={() => a("/upload")}>{t("cta.getStarted")}</StartButton></div></Surface></section>;
}
function StartBanner() {
  const photo = useHomeAssets();
  let a = useStartNavigation(),
    {
      t
    } = useDesignLanguage();
  return <section style={{
    maxWidth: "var(--page-max-width)",
    margin: "0 auto var(--space-20)",
    padding: "0 var(--space-6)"
  }}><div className="sl-responsive-pair" style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      borderRadius: "16px",
      overflow: "hidden",
      minHeight: "340px"
    }}><div style={{
        background: "var(--teal-tint)",
        padding: "var(--space-12)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        justifyContent: "center"
      }}><Eyebrow>{t("band.eyebrow")}</Eyebrow><h2 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "26px",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          color: "var(--ink)"
        }}>{t("band.heading.plain")}<span style={{
            color: "var(--amber-accent)"
          }}>{t("band.heading.accent")}</span></h2><div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)"
        }}><StartButton onClick={() => a("/upload")}>{t("band.cta")}</StartButton><p style={{
            fontSize: "var(--text-secondary)",
            color: "var(--muted)"
          }}>{t("band.subtext")}</p></div><div style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-3)",
          marginTop: "var(--space-2)"
        }}>{["band.item.1", "band.item.2", "band.item.3"].map(e => <div style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)"
          }} key={e}><span style={{
              width: "24px",
              height: "24px",
              borderRadius: "50%",
              background: "#fff",
              border: "1px solid var(--mint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}><svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--teal)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 5l2.5 2.5 4.5-5" /></svg></span><span style={{
              fontSize: "var(--text-body)",
              color: "var(--ink-2)",
              fontWeight: 700
            }}>{t(e)}</span></div>)}</div></div><div style={{
        minHeight: "340px",
        background: "var(--teal-tint)"
      }}><img src={photo("retail-produce-2.jpg")} alt={t("band.photo.alt")} style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: "block"
        }} /></div></div></section>;
}
function FoodWasteEvidence() {
  const photo = useHomeAssets();
  let {
      t: a
    } = useDesignLanguage(),
    t = [{
      figKey: "stat.1.figure",
      descKey: "stat.1.desc"
    }, {
      figKey: "stat.2.figure",
      descKey: "stat.2.desc"
    }, {
      figKey: "stat.3.figure",
      descKey: "stat.3.desc"
    }, {
      figKey: "stat.4.figure",
      descKey: "stat.4.desc"
    }];
  return <section style={{
    maxWidth: "var(--page-max-width)",
    margin: "0 auto var(--space-20)",
    padding: "0 var(--space-6)"
  }}><div style={{
      textAlign: "center",
      maxWidth: "640px",
      margin: "0 auto var(--space-8)"
    }}><Eyebrow>{a("foodWaste.eyebrow")}</Eyebrow><h2 style={{
        fontFamily: "var(--font-display)",
        fontWeight: 800,
        fontSize: "32px",
        letterSpacing: "-0.025em",
        lineHeight: 1.2,
        color: "var(--ink)",
        marginBottom: "var(--space-4)"
      }}>{a("foodWaste.heading")}</h2><p style={{
        fontSize: "var(--text-body)",
        color: "var(--muted)",
        lineHeight: 1.7
      }}>{a("foodWaste.body")}</p></div><div style={{
      position: "relative",
      borderRadius: "16px",
      overflow: "hidden",
      height: "390px"
    }}><img src={photo("food-waste.jpg")} alt={a("foodWaste.photo.alt")} style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block"
      }} /><div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to bottom, transparent 45%, rgba(16,41,27,.52) 100%)",
        pointerEvents: "none"
      }} /><p style={{
        position: "absolute",
        bottom: "20px",
        left: "24px",
        fontFamily: "var(--font-body)",
        fontWeight: 600,
        fontSize: "15px",
        color: "#fff",
        margin: 0,
        lineHeight: 1.4
      }}>{a("foodWaste.caption")}</p></div><div className="sl-stats" style={{
      marginTop: "var(--space-10)"
    }}>{t.map(({
        figKey: e,
        descKey: l
      }, n) => <div className={n > 0 ? "sl-stat sl-stat--ruled" : "sl-stat"} key={e}><p style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "28px",
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
          color: "var(--ink)",
          marginBottom: "var(--space-2)"
        }}>{a(e)}</p><p style={{
          fontSize: "var(--text-secondary)",
          color: "var(--muted)",
          lineHeight: 1.55
        }}>{a(l)}</p></div>)}</div><p style={{
      marginTop: "var(--space-5)",
      fontSize: "var(--text-description)",
      color: "var(--muted-2)",
      textAlign: "center"
    }}>{a("foodWaste.sources")}</p></section>;
}
function Sustainability() {
  let {
    t: a
  } = useDesignLanguage();
  return <section style={{
    maxWidth: "var(--page-max-width)",
    margin: "0 auto var(--space-20)",
    padding: "0 var(--space-6)"
  }}><div className="sl-responsive-pair" style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      borderRadius: "16px",
      overflow: "hidden",
      minHeight: "320px"
    }}><div style={{
        background: "#bd8c2b",
        padding: "var(--space-10)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between"
      }}><div style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-4)"
        }}><span style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "72px",
            color: "#fff",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            flexShrink: 0
          }}>{"12"}</span><p style={{
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            fontSize: "13px",
            color: "rgba(255,255,255,.85)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            lineHeight: 1.4,
            marginTop: "6px"
          }}>{a("sdg.responsible")}</p></div><svg viewBox="0 0 240 120" width="100%" fill="none" stroke="#fff" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" style={{
          opacity: 0.9,
          margin: "20px 0",
          display: "block"
        }}><path d="M60 26C22 26 22 94 60 94 98 94 142 26 180 26c38 0 38 68 0 68-38 0-82-68-120-68Z" /></svg><p style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "15px",
          color: "#fff",
          lineHeight: 1.3
        }}>{a("sdg.tagline")}</p></div><div style={{
        background: "#fff",
        padding: "var(--space-10)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "var(--space-5)"
      }}><Eyebrow>{a("sdg.eyebrow")}</Eyebrow><h2 style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "28px",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          color: "var(--ink)"
        }}>{a("sdg.heading")}</h2><p style={{
          fontSize: "var(--text-lead)",
          color: "var(--ink-2)",
          lineHeight: 1.65
        }}>{a("sdg.lead")}</p><p style={{
          fontSize: "var(--text-body)",
          color: "var(--muted)",
          lineHeight: 1.7
        }}>{a("sdg.body")}</p></div></div></section>;
}
function LandingFooter() {
  let {
    t: a
  } = useDesignLanguage();
  return <footer style={{
    borderTop: "1px solid var(--line)",
    maxWidth: "var(--page-max-width)",
    margin: "0 auto",
    padding: "var(--space-8) var(--space-6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "var(--space-4)",
    flexWrap: "wrap"
  }}><Logo height={28} /><p style={{
      fontSize: "var(--text-secondary)",
      color: "var(--muted)"
    }}>{a("footer.tagline")}</p><a href="#" onClick={t => {
      t.preventDefault(), window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }} style={{
      fontFamily: "var(--font-body)",
      fontSize: "var(--text-secondary)",
      color: "var(--teal)",
      fontWeight: 700
    }}>{a("footer.backToTop")}{" \u2191"}</a></footer>;
}
function SourceMetric({
  label,
  value,
  unit,
  source
}: {
  label: string;
  value: number;
  unit: string;
  source: string;
}) {
  const {
    t
  } = useDesignLanguage();
  return <div style={{
    background: '#fff',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
    padding: 'var(--space-3)'
  }}><p style={{
      fontSize: 'var(--text-description)',
      color: 'var(--muted)',
      margin: 0
    }}>{label}</p><p style={{
      margin: '3px 0 6px',
      fontFamily: 'var(--font-data)',
      fontWeight: 600,
      fontSize: 'var(--text-body)',
      color: 'var(--ink)'
    }}>{value} {unit}</p><EvidenceSource kind={source} label={t(source === 'file' ? 'ex.fromFile' : 'ex.byStockLess')} /></div>;
}
