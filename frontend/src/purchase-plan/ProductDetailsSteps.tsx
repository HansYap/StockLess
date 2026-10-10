import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../i18n/index.ts";
import { Stocky, type StockyPose } from "../onboarding/Stocky.tsx";
import { type ProductPlanningContext, type ProductPurchasePlan } from "../engine.ts";
import { categoryLabel, foodCategories, productEstimateDetails } from "../components/product-estimates.ts";
import type { PurchaseProduct } from "./model.ts";
import { purchaseDate } from "./PurchaseDemandChart.tsx";
import { numberText } from "./SourceTag.tsx";
import "./product-steps.css";

export type StepKey = "cost" | "category" | "weight" | "expiry";
export interface StepState { readonly key: StepKey; readonly required: boolean; readonly done: boolean; readonly value?: string; readonly found?: string }
type Copy = (en: string, zh: string, ms: string) => string;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const amount = (raw: string, positive: boolean) => /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw.trim()) && Number.isFinite(Number(raw)) && (positive ? Number(raw) > 0 : Number(raw) >= 0);

/** Available impact details are optional to edit; expiry keeps its existing check. */
export function productStepStates(product: PurchaseProduct, plan: ProductPurchasePlan | undefined, canSave: boolean, c: Copy): StepState[] {
  const snapshot = product.readinessSnapshot;
  const details = snapshot ? productEstimateDetails(snapshot, product.key, product.planningContext) : undefined;
  const active = details?.active;
  const fileExpiry = plan?.expiry && "earliestDate" in plan.expiry ? plan.expiry : undefined;
  const steps: StepState[] = [];
  if (canSave && details) {
    const cost = details.cost.state === "estimated" ? `MYR ${details.cost.unitCost.toFixed(2)}` : undefined;
    steps.push({ key: "cost", required: false, done: cost !== undefined, value: cost, found: active?.unitCost === undefined ? cost : undefined });
    const category = active?.category ? active.category === "non_food" ? c("Not food", "非食品", "Bukan makanan") : categoryLabel(active.category) : undefined;
    steps.push({ key: "category", required: false, done: category !== undefined, value: category });
    const weight = details.notFood ? c("Not needed", "无需", "Tidak perlu") : details.mass.state === "available" ? `${Number(details.mass.kgPerUnit.toFixed(4))} kg` : undefined;
    steps.push({ key: "weight", required: false, done: weight !== undefined, value: weight, found: active?.kgPerUnit === undefined && !details.notFood ? weight : undefined });
  }
  const expiryValue = fileExpiry ? purchaseDate(fileExpiry.earliestDate, true) : active?.noExpiry ? c("Does not expire", "不会过期", "Tidak luput") : active?.expiryDate ? purchaseDate(active.expiryDate, true) : undefined;
  steps.push({ key: "expiry", required: canSave && !!details, done: !!expiryValue, value: expiryValue, found: fileExpiry ? expiryValue : undefined });
  return steps;
}

export const stepTitle = (key: StepKey, c: Copy) => ({
  cost: c("Purchase cost", "采购成本", "Kos belian"), category: c("Food category", "食品类别", "Kategori makanan"),
  weight: c("Weight per unit", "每单位重量", "Berat seunit"), expiry: c("Expiry date", "到期日", "Tarikh luput"),
})[key];

const ICON: Record<StepKey | "check" | "warn", ReactNode> = {
  cost: <><circle cx="9" cy="9" r="5.5" /><path d="M14.5 10.2a5.5 5.5 0 1 1-4.3 8.6" /><path d="M9 6.8v4.4M7.4 8h2.4" /></>,
  category: <><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" /><path d="M5 19 12 12" /></>,
  weight: <><path d="M12 4v16M6 20h12M4 8h16" /><path d="m4 8-2.5 6a2.5 2.5 0 0 0 5 0L4 8Zm16 0-2.5 6a2.5 2.5 0 0 0 5 0L20 8Z" /></>,
  expiry: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  warn: <><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
};
const Icon = ({ name, size = 22 }: { name: keyof typeof ICON; size?: number }) => <svg className="pp-steps__icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" focusable="false">{ICON[name]}</svg>;

function Guide({ pose, children, tone }: { pose: StockyPose; children: ReactNode; tone?: "error" | "happy" }) {
  return <div className={`pp-steps__guide${tone ? ` pp-steps__guide--${tone}` : ""}`}><Stocky pose={pose} size={tone === "happy" ? 56 : 44} /><div className="pp-steps__bubble">{children}</div></div>;
}

function Choice({ name, checked, label, sub, error, onPick }: { name: string; checked: boolean; label: string; sub?: string; error?: boolean; onPick: () => void }) {
  return <label className={`pp-steps__choice${checked ? " is-picked" : ""}${error ? " is-error" : ""}`}><input type="radio" name={name} checked={checked} onChange={onPick} /><span><b>{label}</b>{sub && <small>{sub}</small>}</span></label>;
}

export interface ProductStepsHandle { openAt: (key?: StepKey) => void }
interface Props {
  product: PurchaseProduct; plan?: ProductPurchasePlan; analysisDate: string; steps: StepState[];
  onPlanningChange?: (context: ProductPlanningContext) => void;
  scope?: "impact" | "expiry"; expiryNote?: ReactNode;
  onImpact?: () => void;
}

export const ProductDetailsSteps = forwardRef<ProductStepsHandle, Props>(function ProductDetailsSteps({ product, analysisDate, steps, onPlanningChange, scope = "impact", expiryNote, onImpact }, ref) {
  const language = useLanguage(), c: Copy = (en, zh, ms) => language === "zh" ? zh : language === "ms" ? ms : en;
  const snapshot = product.readinessSnapshot;
  const details = snapshot ? productEstimateDetails(snapshot, product.key, product.planningContext) : undefined;
  const active = details?.active;
  const required = steps.filter(step => step.required), left = required.filter(step => !step.done);
  const firstOpen = () => (left[0] ?? steps.find(step => !step.done && !step.required))?.key;
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<StepKey | "done">(() => firstOpen() ?? "done");
  const [pick, setPick] = useState<string>("");
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const root = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null);
  const index = current === "done" ? steps.length : steps.findIndex(step => step.key === current);
  const step = steps[index];
  const sectionTitle = scope === "expiry" ? c("Expiry check", "到期检查", "Semakan luput") : c("Impact dashboard details", "影响概览所需信息", "Butiran papan pemuka impak");
  const uploadedExpiry = scope === "expiry" && steps.some(item => item.key === "expiry" && item.found !== undefined);
  const expiryFileNotice = c("This expiry date is taken from your uploaded file.", "此到期日来自您上传的文件。", "Tarikh luput ini diambil daripada fail yang anda muat naik.");
  const expiryCorrection = c("To update this date, make the change in your file, then upload it again.", "如需更新此日期，可在文件中修改后再次上传。", "Untuk mengemas kini tarikh ini, ubah tarikh dalam fail anda, kemudian muat naik semula.");
  const summaryAction = (item: StepState) => item.key === "expiry" && item.found !== undefined ? c("View details", "查看详情", "Lihat butiran") : c("Change", "修改", "Ubah");

  const go = (key: StepKey | "done", focus = true) => {
    const target = key === "done" ? undefined : steps.find(item => item.key === key);
    setCurrent(key); setError(""); setOpen(true);
    setPick(key === "category" ? active?.category || "" : key === "expiry" ? active?.noExpiry ? "none" : active?.expiryDate ? "date" : "" : target?.done && target.found !== undefined ? "yes" : "");
    setRaw(key === "expiry" ? active?.expiryDate ?? "" : key === "cost" ? active?.unitCost?.toString() ?? "" : key === "weight" ? active?.kgPerUnit?.toString() ?? "" : "");
    if (focus) requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  };
  useImperativeHandle(ref, () => ({ openAt: key => { go(key ?? firstOpen() ?? "done"); requestAnimationFrame(() => root.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })); } }));
  // Answers are saved as you go; keep the step in sync when the product's saved answers change elsewhere.
  useEffect(() => { if (!open) setCurrent(firstOpen() ?? "done"); }, [open, left.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (changes: Partial<ProductPlanningContext>) => {
    if (!onPlanningChange || !snapshot?.evidenceKey) return;
    onPlanningChange({ ...active, evidenceKey: snapshot.evidenceKey, ...changes });
  };
  const advance = () => {
    const after = steps.slice(index + 1).find(item => !item.done && item.required) ?? steps.slice(index + 1)[0];
    go(after?.key ?? (left.some(item => item.key !== current) ? left.find(item => item.key !== current)!.key : "done"));
  };
  const needsAnswer = c("Pick one to continue.", "请选择一项后继续。", "Pilih satu untuk teruskan.");

  const next = () => {
    if (!step) return;
    if (step.key === "cost" || step.key === "weight") {
      const positive = step.key === "weight";
      if (step.key === "weight" && details?.notFood) return advance();
      if (pick === "yes" && step.found !== undefined) { save(step.key === "cost" ? { costConfirmed: true } : { weightConfirmed: true }); return advance(); }
      if (pick === "yes" && step.done) return advance();
      if (pick !== "change" && step.found !== undefined) return setError(needsAnswer);
      if (!amount(raw, positive)) return setError(positive ? c("Enter a weight above 0 kg.", "请输入大于 0 的重量（公斤）。", "Masukkan berat melebihi 0 kg.") : c("Enter a cost of 0 or more.", "请输入 0 或以上的成本。", "Masukkan kos 0 atau lebih."));
      save(step.key === "cost" ? { unitCost: Number(raw), costConfirmed: true } : { kgPerUnit: Number(raw), weightConfirmed: true }); return advance();
    }
    if (step.key === "category") {
      if (!pick) return setError(needsAnswer);
      save({ category: pick, categoryConfirmed: true, categorySource: "manual", categoryProvenance: undefined, isFood: pick !== "non_food" }); return advance();
    }
    if (step.key === "expiry") {
      if (step.found !== undefined) return advance();
      if (pick === "none") { save({ noExpiry: true, expiryDate: undefined }); return advance(); }
      if (pick === "date" && DATE.test(raw)) { save({ expiryDate: raw, noExpiry: undefined }); return advance(); }
      if (!step.required && !pick) return advance();
      return setError(pick === "date" ? c("Choose the expiry date.", "请选择到期日。", "Pilih tarikh luput.") : needsAnswer);
    }
  };
  const answered = !step ? true : step.key === "category" ? !!pick : step.key === "expiry" ? step.found !== undefined || pick === "none" || (pick === "date" && DATE.test(raw)) || !step.required
    : (step.key === "weight" && !!details?.notFood) || pick === "yes" || ((pick === "change" || step.found === undefined) && amount(raw, step.key === "weight"));

  const stepBody = () => {
    if (!step || !details && step.key !== "expiry") return null;
    const head = (question: string, why: string) => <><div className="pp-steps__qhead"><span className="pp-steps__qicon"><Icon name={step.key} size={24} /></span><div><span className="pp-steps__count">{c(`Step ${index + 1} of ${steps.length}`, `第 ${index + 1} 步，共 ${steps.length} 步`, `Langkah ${index + 1} daripada ${steps.length}`)} · {stepTitle(step.key, c)}</span><h4 ref={heading} tabIndex={-1}>{question}</h4></div></div>
      {error ? <Guide pose="careful" tone="error"><b role="alert">{error}</b> {why}</Guide> : <Guide pose="think">{why}</Guide>}</>;
    const source = (text: string) => <p className="pp-steps__source"><span>{c("Source", "来源", "Sumber")}</span>{text}</p>;
    if (step.key === "cost" || step.key === "weight") {
      const isCost = step.key === "cost", value = step.found ?? step.value;
      const label = isCost ? c("Your purchase cost for one unit (MYR)", "一个单位的采购成本（MYR）", "Kos belian anda untuk satu unit (MYR)") : c("Weight of one unit (kg)", "一个单位的重量（公斤）", "Berat satu unit (kg)");
      const input = <label className="pp-steps__field">{label}<input inputMode="decimal" value={raw} onChange={event => { setRaw(event.currentTarget.value); setError(""); }} /></label>;
      if (step.key === "weight" && details?.notFood) return <>{head(c("No weight needed", "无需重量", "Berat tidak diperlukan"), c("This product is not food, so it is left out of CO₂e.", "此商品不是食品，因此不计入 CO₂e。", "Produk ini bukan makanan, jadi tidak dikira dalam CO₂e."))}</>;
      const why = isCost ? c("Used for “Money tied up in excess”.", "用于计算“积压资金”。", "Digunakan untuk “Wang terikat dalam lebihan”.") : c("Turns units into kilograms for CO₂e.", "把件数换算成公斤，用于 CO₂e。", "Menukar unit kepada kilogram untuk CO₂e.");
      if (step.found === undefined && !step.done) return <>{head(isCost ? c("How much do you pay for one unit?", "一个单位的采购价是多少？", "Berapa anda bayar untuk satu unit?") : c("How much does one unit weigh?", "一个单位有多重？", "Berapa berat satu unit?"), why)}{input}</>;
      const sourceText = (isCost ? active?.unitCost : active?.kgPerUnit) !== undefined ? c("Entered by you", "由您输入", "Dimasukkan oleh anda") : c("From your file", "来自您的文件", "Daripada fail anda");
      return <>{head(isCost ? c(`Do you pay ${value} for one unit?`, `一个单位的采购价是 ${value} 吗？`, `Adakah anda bayar ${value} untuk satu unit?`) : c(`Does one unit weigh ${value}?`, `一个单位重 ${value} 吗？`, `Adakah satu unit seberat ${value}?`), why)}
        {sourceText && source(sourceText)}
        <div className="pp-steps__choices" role="radiogroup" aria-label={stepTitle(step.key, c)}><Choice name={`${step.key}-${product.key}`} checked={pick === "yes"} error={!!error && !pick} label={isCost ? c(`Yes, ${value} is right`, `是的，${value} 正确`, `Ya, ${value} betul`) : c(`Yes, ${value}`, `是的，${value}`, `Ya, ${value}`)} onPick={() => { setPick("yes"); setError(""); }} />
          <Choice name={`${step.key}-${product.key}`} checked={pick === "change"} error={!!error && !pick} label={isCost ? c("No, I pay a different price", "不是，价格不同", "Tidak, harga saya berbeza") : c("No, change the weight", "不是，修改重量", "Tidak, ubah berat")} onPick={() => { setPick("change"); setError(""); }} /></div>
        {pick === "change" && input}</>;
    }
    if (step.key === "category") {
      const suggestion = active?.categorySource === "ai" && active.category && active.category !== "non_food" ? active.category : undefined;
      const others = foodCategories.filter(item => item !== suggestion);
      const otherPicked = !!pick && pick !== suggestion && pick !== "non_food";
      return <>{head(c("What kind of food is this?", "这是哪类食品？", "Makanan jenis apa ini?"), c("Needed to estimate CO₂e. Pick the closest one.", "用于估算 CO₂e。请选择最接近的一项。", "Diperlukan untuk menganggar CO₂e. Pilih yang paling hampir."))}
        <div className={`pp-steps__choices pp-steps__choices--category${suggestion ? " has-suggestion" : ""}`} role="radiogroup" aria-label={stepTitle("category", c)}>
          {suggestion && <Choice name={`category-${product.key}`} checked={pick === suggestion} error={!!error && !pick} label={categoryLabel(suggestion)} sub={c("Suggested by AI", "AI 建议", "Dicadangkan oleh AI")} onPick={() => { setPick(suggestion); setError(""); }} />}
          <Choice name={`category-${product.key}`} checked={pick === "non_food"} error={!!error && !pick} label={c("Not food", "非食品", "Bukan makanan")} sub={c("Left out of CO₂e", "不计入 CO₂e", "Tidak dikira dalam CO₂e")} onPick={() => { setPick("non_food"); setError(""); }} />
          <label className={`pp-steps__choice pp-steps__choice--select${otherPicked ? " is-picked" : ""}${error && !pick ? " is-error" : ""}`}><span><b>{c("Another food category", "其他食品类别", "Kategori makanan lain")}</b>
            <select aria-label={c("Another food category", "其他食品类别", "Kategori makanan lain")} value={otherPicked ? pick : ""} onChange={event => { setPick(event.currentTarget.value); setError(""); }}><option value="">{c("Choose…", "请选择…", "Pilih…")}</option>{others.map(item => <option key={item} value={item}>{categoryLabel(item)}</option>)}</select></span></label>
        </div></>;
    }
    if (step.key === "expiry") {
      if (step.found !== undefined) return <>{head(c("Expiry date from your file", "文件中的到期日", "Tarikh luput daripada fail anda"), expiryFileNotice)}{source(c("From your file", "来自您的文件", "Daripada fail anda"))}<div className="pp-steps__note">{expiryNote}</div><p className="pp-small-note">{expiryCorrection}</p></>;
      const days = pick === "date" && DATE.test(raw) ? Math.round((Date.parse(raw) - Date.parse(analysisDate)) / 86400000) : undefined;
      const weekly = product.evidence?.recentAverage.value, stock = product.stock?.currentStock;
      const atRisk = days !== undefined && weekly !== undefined && stock !== undefined ? Math.max(0, Math.round(stock - weekly / 7 * Math.max(0, days))) : 0;
      return <>{head(c("When does the stock you have now expire?", "您现有的库存何时到期？", "Bilakah stok yang ada sekarang luput?"), step.required ? c("So StockLess can warn you before it goes off.", "这样 StockLess 能在过期前提醒您。", "Supaya StockLess boleh memberi amaran sebelum ia rosak.") : c("Optional here. Map expiry columns in Step 2 to check expiry.", "此处可选。在第 2 步对应到期列即可检查过期。", "Pilihan di sini. Padankan lajur luput dalam Langkah 2 untuk menyemak luput."))}
        <div className="pp-steps__choices" role="radiogroup" aria-label={stepTitle("expiry", c)}>
          <label className={`pp-steps__choice${pick === "date" ? " is-picked" : ""}${error && pick !== "none" && !DATE.test(raw) ? " is-error" : ""}`}><input type="radio" name={`expiry-${product.key}`} checked={pick === "date"} onChange={() => { setPick("date"); setError(""); }} /><span><b>{c("Pick a date", "选择日期", "Pilih tarikh")}</b><input type="date" aria-label={c("Expiry date", "到期日", "Tarikh luput")} min={analysisDate} value={raw} onChange={event => { setRaw(event.currentTarget.value); setPick("date"); setError(""); }} /></span></label>
          <Choice name={`expiry-${product.key}`} checked={pick === "none"} error={!!error && !pick} label={c("It does not expire", "不会过期", "Ia tidak luput")} sub={c("For example, household goods", "例如日用品", "Contohnya barangan rumah")} onPick={() => { setPick("none"); setError(""); }} />
        </div>
        {days !== undefined && days <= 28 && <p className="pp-steps__warn"><Icon name="warn" size={18} />{atRisk > 0 ? c(`Expires in ${days} days — about ${numberText(atRisk)} units may not sell in time.`, `${days} 天后到期——约 ${numberText(atRisk)} 件可能来不及售出。`, `Luput dalam ${days} hari — kira-kira ${numberText(atRisk)} unit mungkin tidak sempat dijual.`) : c(`Expires in ${days} days.`, `${days} 天后到期。`, `Luput dalam ${days} hari.`)}</p>}</>;
    }
    return null;
  };

  const doneCount = required.length - left.length;
  const progress = <div className="pp-steps__progress"><div className="pp-steps__progress-top"><h3>{sectionTitle}</h3><span className={left.length ? "" : "is-done"}>{scope === "impact" ? c("Optional details", "可选信息", "Butiran pilihan") : left.length ? c(`${left.length} required ${left.length > 1 ? "steps" : "step"} left`, `还剩 ${left.length} 个必填步骤`, `${left.length} langkah wajib lagi`) : c("All required steps done", "必填步骤已完成", "Semua langkah wajib selesai")}</span></div>
    {required.length > 0 && <div className="pp-steps__bar" aria-hidden="true">{required.map((item, i) => <span key={item.key} className={i < doneCount ? "is-on" : ""} />)}</div>}</div>;

  if (!open && scope === "expiry") {
    const expiry = steps.find(item => item.key === "expiry");
    return <section className="pp-expiry-details" data-guide="purchase-expiry" ref={root} aria-label={sectionTitle}>
      <div className="pp-expiry-details-head"><div><h3>{sectionTitle}</h3><p>{expiry?.value ?? c("Expiry date not confirmed", "尚未确认到期日", "Tarikh luput belum disahkan")}</p></div><button type="button" className="btn btn--ghost btn--small" onClick={() => go("expiry")}>{c("Review expiry", "查看到期信息", "Semak luput")}</button></div>
      <p className="pp-small-note">{c("Used for expiry warnings in your purchase plan. Checked dates from your file are included automatically.", "用于采购计划中的到期提醒。文件中已核对的日期会自动计入。", "Digunakan untuk amaran luput dalam pelan belian anda. Tarikh disemak daripada fail dikira secara automatik.")}</p>
    </section>;
  }

  if (!open) {
    const available = steps.filter(item => item.done).length;
    const missing = steps.length - available;
    const encouragement = missing ? available
      ? c(`I found ${available} of ${steps.length} details already. Just ${missing} more to complete this check — about 1 minute. You can keep planning.`, `我已找到 ${steps.length} 项信息中的 ${available} 项。再补充 ${missing} 项即可完成——约需 1 分钟。您也可以继续规划采购。`, `Saya sudah jumpa ${available} daripada ${steps.length} butiran. Hanya ${missing} lagi untuk melengkapkan semakan ini — kira-kira 1 minit. Anda boleh terus merancang.`)
      : c(`Let’s add these ${missing} details — about 1 minute. You can keep planning and come back later.`, `我们一起补充这 ${missing} 项信息吧——约需 1 分钟。您也可以继续规划，稍后再回来填写。`, `Mari tambah ${missing} butiran ini — kira-kira 1 minit. Anda boleh terus merancang dan kembali kemudian.`)
      : c("All your impact details are ready! View your estimates, or edit any details whenever you need.", "影响估算所需信息已齐全！您可以查看估算，也可以随时修改信息。", "Semua butiran impak anda sudah sedia! Lihat anggaran anda, atau edit butiran bila diperlukan.");
    return <section className={`pp-steps pp-steps--entry${missing ? "" : " is-ready"}`} ref={root} aria-label={sectionTitle}>
      <div className="pp-steps__entry"><Stocky pose={missing ? "hello" : "great"} size={64} /><div className="pp-steps__entry-text"><h3>{sectionTitle}</h3><p className="pp-small-note">{c("These details help estimate money tied up in excess stock and its estimated carbon footprint.", "这些信息用于估算多余库存占用的资金及其碳足迹。", "Butiran ini membantu menganggar wang terikat dalam stok berlebihan dan jejak karbonnya.")}</p>
        <div className="pp-steps__bubble">{encouragement}</div></div></div>
      <ul className="pp-steps__chips">{steps.map(item => <li key={item.key} className={item.done ? "is-done" : "is-todo"}>{stepTitle(item.key, c)} · {item.value ?? c("Not available", "暂无信息", "Tidak tersedia")}</li>)}</ul>
      <div className="pp-steps__entry-actions">{onImpact && <button type="button" className="btn btn--primary" onClick={onImpact}>{c("View impact dashboard →", "查看影响概览 →", "Lihat papan pemuka impak →")}</button>}<button type="button" className="btn btn--ghost" onClick={() => go("done")}>{c("Edit details", "修改信息", "Edit butiran")}</button></div>
    </section>;
  }

  return <section className="pp-steps" data-guide={scope === "expiry" ? "purchase-expiry" : undefined} ref={root} aria-label={sectionTitle}>
    {progress}
    <ol className="pp-steps__dots" aria-hidden="true">{steps.map((item, i) => <li key={item.key} className={`${item.done ? "is-done" : ""}${item.key === current ? " is-current" : ""}${item.required ? "" : " is-optional"}`}>{item.done ? "✓" : i + 1}</li>)}</ol>
    <div className="pp-steps__layout">
      <nav className="pp-steps__rail" aria-label={scope === "expiry" ? c("Expiry checks", "到期确认步骤", "Semakan tarikh luput") : c("Product checks", "商品确认步骤", "Semakan produk")}>{steps.map((item, i) => <button type="button" key={item.key} className={`${item.done ? "is-done" : ""}${item.key === current ? " is-current" : ""}`} aria-current={item.key === current ? "step" : undefined} onClick={() => go(item.key)}>
        <span className="pp-steps__dot">{item.done ? <Icon name="check" size={14} /> : i + 1}</span><span><b>{stepTitle(item.key, c)}</b> <small>{item.done ? item.value : item.required ? c("Required", "必填", "Wajib") : c("Optional", "可选", "Pilihan")}</small></span></button>)}
        <button type="button" className={`pp-steps__rail-done${current === "done" ? " is-current" : ""}`} onClick={() => go("done")} disabled={left.length > 0}><span className="pp-steps__dot"><Icon name="check" size={14} /></span><span><b>{c("Summary", "汇总", "Ringkasan")}</b></span></button></nav>
      <div className="pp-steps__card">{current === "done" || !step ? <>
        <h4 ref={heading} tabIndex={-1} className="pp-steps__ready">{scope === "impact" ? c("Details used for these estimates", "这些估算所用的信息", "Butiran digunakan untuk anggaran ini") : left.length ? c("A few steps are still open", "还有步骤未完成", "Beberapa langkah belum selesai") : c("This product is ready", "此商品已准备好", "Produk ini sudah sedia")}</h4>
        {scope === "impact" ? <Guide pose="idle">{c("Available details are used automatically. Add or edit only what you need.", "可用信息会自动计入估算。您可以按需补充或修改。", "Butiran tersedia digunakan secara automatik. Tambah atau edit hanya yang diperlukan.")}</Guide> : left.length ? <Guide pose="magnify" tone="error">{c(`Finish ${left.length} required ${left.length > 1 ? "steps" : "step"} first.`, `请先完成 ${left.length} 个必填步骤。`, `Lengkapkan ${left.length} langkah wajib dahulu.`)}</Guide> : <Guide pose={uploadedExpiry ? "idle" : "great"} tone={uploadedExpiry ? undefined : "happy"}>{uploadedExpiry ? expiryFileNotice : c("Great work! Everything I need is confirmed. You can still change any answer below.", "做得好！所需信息都已确认，仍可在下方修改任何答案。", "Bagus! Semua yang saya perlukan sudah disahkan. Anda masih boleh ubah jawapan di bawah.")}</Guide>}
        <ul className="pp-steps__summary">{steps.map(item => <li key={item.key}><span><Icon name={item.key} size={18} />{stepTitle(item.key, c)}</span><span><b>{item.value ?? (item.required ? c("Needs an answer", "需要回答", "Perlu jawapan") : c("Not set", "未设置", "Belum ditetapkan"))}</b><button type="button" className="pp-link-button" onClick={() => go(item.key)} aria-label={`${summaryAction(item)} ${stepTitle(item.key, c)}`}>{summaryAction(item)}</button></span></li>)}</ul>
        {uploadedExpiry && <p className="pp-small-note">{expiryCorrection}</p>}
        <div className="pp-steps__nav"><span /><button type="button" className="btn btn--ghost" onClick={() => setOpen(false)}>{c("Close", "收起", "Tutup")}</button></div>
      </> : <>
        {stepBody()}
        <div className="pp-steps__nav">{index > 0 ? <button type="button" className="btn btn--ghost" onClick={() => go(steps[index - 1].key)}>{c("← Back", "← 上一步", "← Kembali")}</button> : <span />}
          <span className="pp-steps__nav-right"><button type="button" className={`btn btn--primary${answered ? "" : " is-locked"}`} aria-disabled={!answered} onClick={next}>{c("Next →", "下一步 →", "Seterusnya →")}</button></span></div>
      </>}</div>
    </div>
    {scope === "impact" && current !== "done" && <button type="button" className="pp-link-button pp-steps__close" onClick={() => setOpen(false)}>{c("Close details", "收起信息", "Tutup butiran")}</button>}
  </section>;
});
