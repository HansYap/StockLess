import { useLanguage } from "../i18n/index.ts";
import { Stocky } from "../onboarding/Stocky.tsx";
import { ImpactIcon, type ImpactIconName } from "./ImpactIcon.tsx";
import "./data-sources.css";

type Copy = readonly [en: string, zh: string, ms: string];
interface Source { readonly name: string; readonly by: string; readonly url: string; readonly licence: string; readonly note?: Copy }
interface Group { readonly id: "carbon" | "food" | "retail" | "software"; readonly icon: ImpactIconName; readonly title: Copy; readonly items: readonly Source[] }

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
  { id: "carbon", icon: "globe", title: ["Food carbon (CO₂e) factors", "食品碳排放（CO₂e）系数", "Faktor karbon makanan (CO₂e)"], items: [
    { name: "SU-EATABLE LIFE food carbon footprint database", by: "Petersson et al. (2021), Scientific Data", url: "https://doi.org/10.6084/m9.figshare.13271111", licence: CC_BY },
    { name: "AGRIBALYSE v3.2 (détail par étape)", by: "ADEME", url: "https://data.ademe.fr/datasets/agribalyse-31-detail-par-etape", licence: "Licence Ouverte 2.0" },
    { name: "Food: greenhouse gas emissions across the supply chain", by: "Poore & Nemecek (2018) via Our World in Data", url: "https://ourworldindata.org/grapher/food-emissions-supply-chain", licence: CC_BY },
    { name: "The Big Climate Database", by: "CONCITO", url: "https://thebigclimatedatabase.com", licence: CC_BY },
    { name: "Per capita greenhouse gas emissions (Malaysia)", by: "Jones et al. (2025) via Our World in Data", url: "https://ourworldindata.org/grapher/per-capita-ghg-emissions", licence: CC_BY },
  ] },
  { id: "food", icon: "box", title: ["Food facts, weights and prices", "食品资料、重量与价格", "Fakta makanan, berat dan harga"], items: [
    { name: "FAO/INFOODS Density Database v2.0", by: "FAO/INFOODS", url: "https://www.fao.org/infoods/infoods/tables-and-databases/faoinfoods-databases/en/", licence: CC_BY },
    { name: "FoodKeeper data", by: "USDA FSIS", url: "https://catalog.data.gov/dataset/fsis-foodkeeper-data", licence: "Public domain" },
    { name: "Open Food Facts product database", by: "Open Food Facts contributors", url: "https://world.openfoodfacts.org/data", licence: "ODbL 1.0" },
    { name: "PriceCatcher daily prices", by: "KPDN via OpenDOSM", url: "https://open.dosm.gov.my/data-catalogue/pricecatcher", licence: CC_BY },
  ] },
  { id: "retail", icon: "trend", title: ["Retail sales used to test the forecasts", "用于测试预测的零售销售数据", "Jualan runcit untuk menguji ramalan"], items: [
    { name: "Retail Transactions and Stocks", by: "Smith (2026), Mendeley Data", url: "https://data.mendeley.com/datasets/27x8mjm8k4/1", licence: CC_BY },
    { name: "Retail sales of a pharmacy in Indonesia", by: "Gustriansyah (2022), Mendeley Data", url: "https://data.mendeley.com/datasets/2ym7v78wtd/1", licence: CC_BY },
    { name: "Online Retail II", by: "Chen (2012), UCI Machine Learning Repository", url: "https://archive.ics.uci.edu/dataset/502/online+retail+ii", licence: CC_BY },
    { name: "FreshRetailNet-50K", by: "Dingdong-Inc via Hugging Face", url: "https://huggingface.co/datasets/Dingdong-Inc/FreshRetailNet-50K", licence: CC_BY },
    { name: "Ta Feng grocery transactions", by: "Kaggle upload by chiranjivdas09", url: "https://www.kaggle.com/datasets/chiranjivdas09/ta-feng-grocery-dataset", licence: "CC0 1.0" },
    { name: "The Complete Journey", by: "dunnhumby via Kaggle", url: "https://dunnhumby.com/sourcefiles", licence: "dunnhumby terms", note: ["kept internal", "仅内部使用", "disimpan dalaman"] },
  ] },
  { id: "software", icon: "puzzle", title: ["Fonts and software in the site", "网站使用的字体与软件", "Fon dan perisian dalam laman"], items: [
    { name: "Noto Sans SC", by: "Google", url: "https://fonts.google.com/noto/specimen/Noto+Sans+SC", licence: "SIL OFL 1.1" },
    { name: "Transformers.js", by: "Hugging Face", url: "https://github.com/huggingface/transformers.js", licence: "Apache 2.0" },
  ] },
];
const LEGEND = [CC_BY, "Licence Ouverte 2.0", "ODbL 1.0", "CC0 1.0", "Public domain"] as const;
const licenceClass = (licence: string) => "ds-tag ds-tag--" + (licence.startsWith("dunnhumby") ? "terms" : licence.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-$/, ""));

/** Homepage section: every dataset and library with its licence and a link, credited as CC BY asks. */
export function DataSources() {
  const language = useLanguage();
  const say = ([en, zh, ms]: Copy) => language === "zh" ? zh : language === "ms" ? ms : en;
  const all = GROUPS.flatMap(group => group.items);
  const open = all.filter(item => !item.licence.startsWith("dunnhumby")).length;
  return <section className="ds" id="sources" aria-labelledby="ds-title">
    <div className="wrap">
      <div className="ds-head">
        <div>
          <p className="ds-hello" aria-hidden="true"><Stocky pose="point" size={60} /><span>{say(["Every number has a label, like stock on a shelf.", "每个数字都有标签，就像货架上的商品。", "Setiap angka ada label, macam stok di rak."])}</span></p>
          <p className="hp-k3"><span>{say(["Data sources & licences", "数据来源与许可", "Sumber data & lesen"])}</span></p>
          <h2 id="ds-title">{say(["Where our numbers ", "我们的数字", "Dari mana angka kami "])}<em>{say(["come from", "从哪里来", "datang"])}</em></h2>
          <p className="ds-lede">{say(["StockLess uses open data. Each source is listed with its licence and a link; CC BY sources are credited here as their licence asks.", "StockLess 使用开放数据。每个来源都列出许可和链接；CC BY 来源按其许可要求在此署名。", "StockLess menggunakan data terbuka. Setiap sumber disenaraikan bersama lesen dan pautan; sumber CC BY dikreditkan di sini seperti yang dikehendaki lesennya."])}</p>
          <ul className="ds-legend" aria-label={say(["Licences", "许可", "Lesen"])}>{LEGEND.map(licence => <li key={licence} className={licenceClass(licence)}>{licence}</li>)}</ul>
        </div>
        <ul className="ds-sum">
          <li><b>{all.length}</b><span>{say(["sources", "个来源", "sumber"])}</span></li>
          <li><b>{open}</b><span>{say(["open licences", "个开放许可", "lesen terbuka"])}</span></li>
          <li className="ds-sum--gold"><b>{GROUPS.length}</b><span>{say(["kinds of data", "类数据", "jenis data"])}</span></li>
        </ul>
      </div>
      <div className="ds-shelf" aria-hidden="true" />
      <div className="ds-groups">
        {GROUPS.map(group => <section key={group.id} className={`ds-group ds-group--${group.id}`} aria-labelledby={`ds-${group.id}`}>
          <h3 id={`ds-${group.id}`}><span className="ds-group__ic" aria-hidden="true"><ImpactIcon name={group.icon} size={24} /></span><span className="ds-group__title">{say(group.title)}</span><span className="ds-group__n">{group.items.length}</span></h3>
          <ul>{group.items.map(item => <li key={item.name}>
            <span className="ds-item"><a href={item.url} target="_blank" rel="noopener noreferrer"><b>{item.name}</b> <span aria-hidden="true">↗</span></a><small>{item.by}</small></span>
            {LICENCE_URL[item.licence]
              ? <a className={licenceClass(item.licence)} href={LICENCE_URL[item.licence]} target="_blank" rel="noopener noreferrer">{item.licence}</a>
              : <span className={licenceClass(item.licence)}>{item.licence}{item.note ? ` · ${say(item.note)}` : ""}</span>}
          </li>)}</ul>
        </section>)}
      </div>
      <p className="ds-figures"><ImpactIcon name="clipboard" size={20} /><span><b>{say(["Homepage figures:", "首页数据：", "Angka laman utama:"])}</b> UNEP Food Waste Index 2024 · SDG 12.3 · MSU Greenally (self-reported) · SWCorp · Vijayan et al. (2014) · Crippa et al. (2021)</span></p>
    </div>
  </section>;
}
