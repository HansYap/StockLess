import { useState } from "react";
import { useLanguage } from "../i18n/index.ts";
import { Stocky } from "../onboarding/Stocky.tsx";
import { ImpactIcon, type ImpactIconName } from "./ImpactIcon.tsx";
import "./data-sources.css";

type Copy = readonly [en: string, zh: string, ms: string];
type SourceIconName = "plate" | "steps" | "chain" | "db" | "person" | "beaker" | "fridge" | "barcode" | "tag";
interface Source { readonly name: string; readonly short: string; readonly icon?: SourceIconName; readonly by: string; readonly url: string; readonly licence: string }
interface Group { readonly id: "carbon" | "food" | "retail" | "software"; readonly icon: ImpactIconName; readonly title: Copy; readonly blurb: Copy; readonly items: readonly Source[] }

const CC_BY = "CC BY 4.0";
/** Licence pages, so every label can be checked. */
const LICENCE_URL: Record<string, string> = {
  [CC_BY]: "https://creativecommons.org/licenses/by/4.0/",
  "Licence Ouverte 2.0": "https://www.etalab.gouv.fr/licence-ouverte-open-licence/",
  "ODbL 1.0": "https://opendatacommons.org/licenses/odbl/1-0/",
  "CC0 1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
  "SIL OFL 1.1": "https://openfontlicense.org/",
  "Apache 2.0": "https://www.apache.org/licenses/LICENSE-2.0",
};

/** From the team's source register (StockLess_Sources_I3). */
const GROUPS: readonly Group[] = [
  { id: "carbon", icon: "globe", title: ["Food carbon factors", "食品碳排放系数", "Faktor karbon makanan"], blurb: ["CO₂e for each food", "每种食品的 CO₂e", "CO₂e bagi setiap makanan"], items: [
    { name: "SU-EATABLE LIFE food carbon footprint database", short: "SU-EATABLE LIFE", icon: "plate", by: "Petersson et al. (2021), Scientific Data", url: "https://doi.org/10.6084/m9.figshare.13271111", licence: CC_BY },
    { name: "AGRIBALYSE v3.2 (détail par étape)", short: "AGRIBALYSE 3.2", icon: "steps", by: "ADEME", url: "https://data.ademe.fr/datasets/agribalyse-31-detail-par-etape", licence: "Licence Ouverte 2.0" },
    { name: "Food: greenhouse gas emissions across the supply chain", short: "Supply-chain emissions", icon: "chain", by: "Poore & Nemecek (2018) via Our World in Data", url: "https://ourworldindata.org/grapher/food-emissions-supply-chain", licence: CC_BY },
    { name: "The Big Climate Database", short: "Big Climate Database", icon: "db", by: "CONCITO", url: "https://thebigclimatedatabase.com", licence: CC_BY },
    { name: "Per capita greenhouse gas emissions (Malaysia)", short: "Malaysia per person", icon: "person", by: "Jones et al. (2025) via Our World in Data", url: "https://ourworldindata.org/grapher/per-capita-ghg-emissions", licence: CC_BY },
  ] },
  { id: "food", icon: "box", title: ["Food facts & prices", "食品资料与价格", "Fakta & harga makanan"], blurb: ["Shelf life, density, prices", "保质期、密度、价格", "Hayat simpanan, ketumpatan, harga"], items: [
    { name: "FAO/INFOODS Density Database v2.0", short: "FAO/INFOODS density", icon: "beaker", by: "FAO/INFOODS", url: "https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/", licence: CC_BY },
    { name: "FoodKeeper data", short: "FoodKeeper", icon: "fridge", by: "USDA FSIS", url: "https://catalog.data.gov/dataset/fsis-foodkeeper-data", licence: "Public domain" },
    { name: "Open Food Facts product database", short: "Open Food Facts", icon: "barcode", by: "Open Food Facts contributors", url: "https://world.openfoodfacts.org/data", licence: "ODbL 1.0" },
    { name: "PriceCatcher daily prices", short: "PriceCatcher", icon: "tag", by: "KPDN via OpenDOSM", url: "https://open.dosm.gov.my/data-catalogue/pricecatcher", licence: CC_BY },
  ] },
  { id: "retail", icon: "trend", title: ["Retail sales used to test the forecasts", "用于测试预测的零售销售数据", "Jualan runcit untuk menguji ramalan"], blurb: ["Sales to test forecasts", "用于测试预测的销售", "Jualan untuk uji ramalan"], items: [
    { name: "Retail Transactions and Stocks", short: "Retail Transactions", by: "Smith (2026), Mendeley Data", url: "https://data.mendeley.com/datasets/27x8mjm8k4/1", licence: CC_BY },
    { name: "Retail sales of a pharmacy in Indonesia", short: "Pharmacy sales", by: "Gustriansyah (2022), Mendeley Data", url: "https://data.mendeley.com/datasets/2ym7v78wtd/1", licence: CC_BY },
    { name: "Online Retail II", short: "Online Retail II", by: "Chen (2012), UCI Machine Learning Repository", url: "https://archive.ics.uci.edu/dataset/502/online+retail+ii", licence: CC_BY },
    { name: "FreshRetailNet-50K", short: "FreshRetailNet-50K", by: "Dingdong-Inc via Hugging Face", url: "https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K", licence: CC_BY },
    { name: "Ta Feng grocery transactions", short: "Ta Feng grocery", by: "Kaggle upload by chiranjivdas09", url: "https://www.kaggle.com/datasets/chiranjivdas09/ta-feng-grocery-dataset", licence: "CC0 1.0" },
  ] },
  { id: "software", icon: "puzzle", title: ["Fonts and software in the site", "网站使用的字体与软件", "Fon dan perisian dalam laman"], blurb: ["Fonts and code libraries", "字体与代码库", "Fon dan pustaka kod"], items: [
    { name: "Noto Sans SC", short: "Noto Sans SC", by: "Google", url: "https://fonts.google.com/noto/specimen/Noto+Sans+SC", licence: "SIL OFL 1.1" },
    { name: "Transformers.js", short: "Transformers.js", by: "Hugging Face", url: "https://github.com/huggingface/transformers.js", licence: "Apache 2.0" },
  ] },
];
/** Groups kept in the register but not shown on the site yet. */
const HIDDEN: ReadonlySet<Group["id"]> = new Set(["retail", "software"]);
const SHOWN = GROUPS.filter(group => !HIDDEN.has(group.id));
const licenceClass = (licence: string) => "ds-tag ds-tag--" + licence.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, "");

const BLUE = "#5b86b3", BLUE_MID = "#8fb3dc", BLUE_LIGHT = "#bfd6f2", AMBER = "#a9790b", AMBER_DEEP = "#8a6208", AMBER_LIGHT = "#f6d08a", LEAF = "#34b08f", INK = "#33474f";

/** One drawn icon per source, in the flat style of ImpactIcon. */
function SourceIcon({ name }: { name: SourceIconName }) {
  return <svg viewBox="0 0 48 48" width={48} height={48} aria-hidden="true" focusable="false">
    {name === "plate" && <><circle cx="24" cy="26" r="14" fill="#fff" stroke={BLUE} strokeWidth="2.2" /><path d="M22 31c0-7 5-12 13-12 0 7-5 12-13 12z" fill={LEAF} /><path d="M22 31c2-4 5-7 9-9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" fill="none" /></>}
    {name === "steps" && <><rect x="7" y="27" width="9" height="13" rx="2.5" fill={BLUE_LIGHT} /><rect x="19.5" y="19" width="9" height="21" rx="2.5" fill={BLUE_MID} /><rect x="32" y="10" width="9" height="30" rx="2.5" fill={BLUE} /></>}
    {name === "chain" && <><circle cx="9" cy="24" r="6" fill={LEAF} /><circle cx="24" cy="24" r="6" fill={BLUE_MID} /><circle cx="39" cy="24" r="6" fill={BLUE} /><path d="M17 21l2 3-2 3M32 21l2 3-2 3" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" /></>}
    {name === "db" && <><path d="M11 12v24c0 3 6 5.5 13 5.5s13-2.5 13-5.5V12" fill={BLUE_LIGHT} stroke={BLUE} strokeWidth="2.2" /><path d="M11 24c0 3 6 5.5 13 5.5S37 27 37 24" fill="none" stroke={BLUE} strokeWidth="2.2" /><ellipse cx="24" cy="12" rx="13" ry="5.5" fill="#eaf0f8" stroke={BLUE} strokeWidth="2.2" /></>}
    {name === "person" && <><circle cx="17" cy="17" r="6" fill={BLUE} /><path d="M6 40c0-8 5-13 11-13s11 5 11 13z" fill={BLUE_MID} /><path d="M29 23a6 6 0 0 1 11-2.5 4.5 4.5 0 1 1 1.5 8.8H31a4 4 0 0 1-2-6.3z" fill="#fff" stroke={BLUE} strokeWidth="2" /></>}
    {name === "beaker" && <><path d="M13 29h22l4 7.5a3 3 0 0 1-2.7 4.5H11.7A3 3 0 0 1 9 36.5z" fill={AMBER_LIGHT} /><path d="M18 7h12M20 7v11l-10.5 19a3 3 0 0 0 2.6 4.5h23.8a3 3 0 0 0 2.6-4.5L28 18V7" fill="none" stroke={AMBER} strokeWidth="2.2" strokeLinejoin="round" /></>}
    {name === "fridge" && <><rect x="12" y="5" width="24" height="38" rx="5" fill="#fff" stroke={AMBER} strokeWidth="2.2" /><path d="M12 18h24M17 10v4M17 23v8" stroke={AMBER} strokeWidth="2.2" strokeLinecap="round" /><circle cx="28" cy="31" r="6" fill={AMBER_LIGHT} /><path d="M28 28v3l2 1.5" stroke={AMBER_DEEP} strokeWidth="1.6" strokeLinecap="round" fill="none" /></>}
    {name === "barcode" && <><rect x="6" y="10" width="36" height="28" rx="5" fill="#fff" stroke={AMBER} strokeWidth="2.2" /><path d="M12 16v16M16 16v16M21 16v16M24 16v16M29 16v16M32 16v16M36 16v16" stroke={INK} strokeWidth="2" /></>}
    {name === "tag" && <><path d="M7 23V10a3 3 0 0 1 3-3h13l18 18-16 16z" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="2.2" strokeLinejoin="round" /><circle cx="15" cy="15" r="3.2" fill="#fff" stroke={AMBER} strokeWidth="1.6" /><path d="M22 27l6-6M24 31l7-7" stroke={AMBER_DEEP} strokeWidth="2" strokeLinecap="round" /></>}
  </svg>;
}

/** The picture on each group card. */
function GroupArt({ group }: { group: Group }) {
  if (group.id === "carbon") return <svg viewBox="0 0 180 140" aria-hidden="true" focusable="false">
    <circle cx="90" cy="72" r="48" fill={BLUE_LIGHT} />
    <path d="M58 56c10 2 12 10 7 17s-1 15 10 17 5 15 0 21M104 30c-5 8 0 15 8 17s15 0 20 8M108 92c5-4 13-3 18 2" stroke={LEAF} strokeWidth="7" strokeLinecap="round" fill="none" />
    <circle cx="90" cy="72" r="48" fill="none" stroke={BLUE} strokeWidth="3.5" />
    <path d="M134 26a10 10 0 0 1 18-4 8 8 0 1 1 3 15h-20a6.5 6.5 0 0 1-1-11zM18 60a9 9 0 0 1 16-4 7 7 0 1 1 2 13H19a6 6 0 0 1-1-9z" fill="#fff" stroke={BLUE} strokeWidth="2.5" />
  </svg>;
  if (group.id === "food") return <svg viewBox="0 0 180 140" aria-hidden="true" focusable="false">
    <path d="M10 120h160" stroke="#d9b382" strokeWidth="8" strokeLinecap="round" />
    <rect x="18" y="34" width="44" height="80" rx="7" fill="#fff" stroke={AMBER} strokeWidth="3" />
    <path d="M18 60h44M28 42v8M28 68v18" stroke={AMBER} strokeWidth="3" strokeLinecap="round" />
    <path d="M76 58h30l7 12v44H69V70z" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="3" strokeLinejoin="round" />
    <path d="M78 80v24M83 80v24M89 80v24M93 80v24M98 80v24" stroke={INK} strokeWidth="2.5" />
    <path d="M124 22h26l17 17-20 20-23-23z" fill={AMBER_LIGHT} stroke={AMBER} strokeWidth="3" strokeLinejoin="round" />
    <circle cx="133" cy="31" r="4" fill="#fff" />
    <path d="M128 84h30l9 30h-48z" fill="#fff" stroke={AMBER} strokeWidth="3" strokeLinejoin="round" />
  </svg>;
  return <ImpactIcon name={group.icon} size={72} />;
}

/** Homepage section: picture cards pick a kind of data; each source is a tile that flips to show its maker, licence and link. */
export function DataSources() {
  const language = useLanguage();
  const say = ([en, zh, ms]: Copy) => language === "zh" ? zh : language === "ms" ? ms : en;
  const [openId, setOpenId] = useState<Group["id"]>(SHOWN[0]?.id ?? "carbon");
  const [flipped, setFlipped] = useState<string | null>(null);
  const open = SHOWN.find(group => group.id === openId) ?? SHOWN[0];
  return <section className="ds" id="sources" aria-labelledby="ds-title">
    <div className="wrap">
      <div className="ds-head">
        <p className="ds-hello" aria-hidden="true"><Stocky pose="point" size={60} /><span>{say(["Every number has a label, like stock on a shelf.", "每个数字都有标签，就像货架上的商品。", "Setiap angka ada label, macam stok di rak."])}</span></p>
        <p className="hp-k3"><span>{say(["Data sources & licences", "数据来源与许可", "Sumber data & lesen"])}</span></p>
        <h2 id="ds-title">{say(["Where our numbers ", "我们的数字", "Dari mana angka kami "])}<em>{say(["come from", "从哪里来", "datang"])}</em></h2>
        <p className="ds-lede">{say(["Pick a card, then tap or hover a tile for details.", "选择一张卡片，再点按或悬停图块查看详情。", "Pilih kad, kemudian ketik atau tuding jubin untuk butiran."])}</p>
      </div>
      <div className="ds-cats">
        {SHOWN.map(group => <button key={group.id} type="button" className={`ds-cat ds-cat--${group.id}${group.id === open?.id ? " is-on" : ""}`} aria-pressed={group.id === open?.id} aria-controls="ds-tiles" onClick={() => { setOpenId(group.id); setFlipped(null); }}>
          <span className="ds-cat__art"><GroupArt group={group} /></span>
          <span className="ds-cat__text">
            <span className="ds-cat__title">{say(group.title)}</span>
            <span className="ds-cat__blurb">{say(group.blurb)}</span>
            <span className="ds-cat__n">{group.items.length}</span>
          </span>
        </button>)}
      </div>
      {open && <ul id="ds-tiles" className={`ds-tiles ds-tiles--${open.id}`} aria-label={say(open.title)}>
        {open.items.map(item => {
          const isFlipped = flipped === item.name;
          return <li key={item.name} className={`ds-tile${isFlipped ? " is-flipped" : ""}`}>
            <div className="ds-tile__in">
              <button type="button" className="ds-tile__face ds-tile__front" aria-expanded={isFlipped} onClick={() => setFlipped(item.name)}>
                <span className="ds-tile__ic">{item.icon ? <SourceIcon name={item.icon} /> : <ImpactIcon name={open.icon} size={40} />}</span>
                <b>{item.short}</b>
                <span className={licenceClass(item.licence)}>{item.licence}</span>
              </button>
              <div className="ds-tile__face ds-tile__back">
                <span className="ds-tile__about"><b>{item.name}</b><small>{item.by}</small></span>
                <span className="ds-tile__links">
                  <a className="ds-tile__go" href={item.url} target="_blank" rel="noopener noreferrer">{say(["View data", "查看数据", "Lihat data"])} <span aria-hidden="true">↗</span></a>
                  {LICENCE_URL[item.licence] && <a className="ds-tile__lic" href={LICENCE_URL[item.licence]} target="_blank" rel="noopener noreferrer">{item.licence}</a>}
                  {isFlipped && <button type="button" className="ds-tile__back-btn" onClick={() => setFlipped(null)}>{say(["Back", "返回", "Kembali"])}</button>}
                </span>
              </div>
            </div>
          </li>;
        })}
      </ul>}
      <p className="ds-figures"><ImpactIcon name="clipboard" size={20} /><span><b>{say(["Homepage figures:", "首页数据：", "Angka laman utama:"])}</b> UNEP Food Waste Index 2024 · SDG 12.3 · MSU Greenally (self-reported) · SWCorp · Vijayan et al. (2014) · Crippa et al. (2021)</span></p>
    </div>
  </section>;
}
