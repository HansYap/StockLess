import { useEffect, useMemo, useRef, useState } from "react";
import { addCalendarDays, buildImportedOutcomeEvidence, compareOutcomePeriods, compareFinancialHistoryPeriods, reviewDecisionOutcomes,
  type ReadinessSnapshot, type PurchaseDecision, type RecordedStockOutcome, type OutcomeUnit, type RecordedOutcomeSummary, type HistoricalFinancialSummary } from "../engine.ts";
import { getLocale, useLanguage } from "../i18n/index.ts";
import { getSavedDataset, savedPurchaseDecisions, savedStockOutcomes } from "../storage/saved-datasets.ts";
import { malaysiaToday } from "./DecisionOutcomeControls.tsx";
import "./decision-outcome-controls.css";

interface Props {
  readonly datasetId?: string;
  readonly currentSnapshot: ReadinessSnapshot;
  readonly onLoaded?: () => void;
}

/** Historical estimates and actual waste are compared independently, using explicit periods. */
export function OutcomePeriodComparison({ datasetId, currentSnapshot, onLoaded }: Props) {
  const language = useLanguage();
  const copy = (en: string, zh: string, ms: string) => language === "zh" ? zh : language === "ms" ? ms : en;
  // Default periods end today, so outcomes recorded after the analysis date are included.
  const today = malaysiaToday();
  const [firstStart, setFirstStart] = useState(() => addCalendarDays(today, -55));
  const [firstEnd, setFirstEnd] = useState(() => addCalendarDays(today, -28));
  const [secondStart, setSecondStart] = useState(() => addCalendarDays(today, -27));
  const [secondEnd, setSecondEnd] = useState(today);
  const [unit, setUnit] = useState<OutcomeUnit | "">("");
  const [decisions, setDecisions] = useState<readonly PurchaseDecision[]>([]);
  const [outcomes, setOutcomes] = useState<readonly RecordedStockOutcome[]>([]);
  const [imported, setImported] = useState<readonly RecordedStockOutcome[]>([]);
  const [returnCount, setReturnCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadedCallback = useRef(onLoaded); loadedCallback.current = onLoaded;
  useEffect(() => {
    let active = true;
    setDecisions([]); setOutcomes([]); setImported([]); setReturnCount(0); setLoadError(false);
    if (!datasetId || currentSnapshot.sourceMode === "sample") return;
    setLoading(true);
    void getSavedDataset(datasetId).then(saved => {
      if (!active) return;
      setDecisions(saved ? savedPurchaseDecisions(saved) : []);
      setOutcomes(saved ? savedStockOutcomes(saved) : []);
      const source = buildImportedOutcomeEvidence(currentSnapshot, datasetId, { expectedSourceSha256: saved?.envelope.session.dataset?.sourceSha256 });
      setImported(source.outcomes); setReturnCount(source.returns.length);
      loadedCallback.current?.();
    }).catch(() => { if (active) setLoadError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [datasetId, currentSnapshot.id, currentSnapshot.sourceSha256]);
  const periods = { first: { start: firstStart, end: firstEnd }, second: { start: secondStart, end: secondEnd } };
  const comparison = useMemo(() => {
    try {
      return { waste: compareOutcomePeriods(outcomes, { datasetId: datasetId ?? "", ...periods, kinds: ["discarded", "expired"], unit: unit || undefined }),
        financial: compareFinancialHistoryPeriods(decisions, { datasetId: datasetId ?? "", ...periods }) };
    } catch { return undefined; }
  }, [datasetId, firstStart, firstEnd, secondStart, secondEnd, unit, outcomes, decisions]);
  const number = (value: number) => value.toLocaleString(getLocale(), { maximumFractionDigits: 3 });
  const unitName = (value: OutcomeUnit) => value === "pieces" ? copy("pieces", "件", "unit") : value === "kg" ? copy("kg", "公斤", "kg") : copy("litres", "升", "liter");
  const explain = (reason: string) => {
    if (language === "en") return reason;
    if (reason.includes("same inclusive")) return copy(reason, "两个期间必须包含相同天数。请选择等长期间。", "Kedua-dua tempoh mestilah mempunyai bilangan hari yang sama. Pilih tempoh sama panjang.");
    if (/units|conversion/.test(reason)) return copy(reason, "记录单位不兼容或缺少已知重量换算，请选择相同单位。", "Unit rekod tidak serasi atau penukaran berat diketahui tiada. Pilih unit yang sama.");
    if (/financial|cost|price/.test(reason)) return copy(reason, "缺少该期间保存时已验证的成本证据，无法比较历史金额。", "Bukti kos disahkan pada masa simpanan tiada untuk tempoh ini; jumlah sejarah tidak dapat dibandingkan.");
    return copy(reason, "此期间缺少可用的实际结果记录。请记录实际数量与单位后再比较。", "Rekod hasil sebenar yang boleh digunakan tiada untuk tempoh ini. Rekod kuantiti dan unit sebenar sebelum membandingkan.");
  };
  const wasteSummary = (summary: RecordedOutcomeSummary) => <div>
    <strong>{summary.state === "recorded" ? `${number(summary.quantity)} ${unitName(summary.unit)}` : copy(summary.state === "no_record" ? "No record" : "Unavailable", summary.state === "no_record" ? "没有记录" : "不可用", summary.state === "no_record" ? "Tiada rekod" : "Tidak tersedia")}</strong>
    {summary.state === "recorded" ? <p>{summary.quantity === 0 ? copy("Recorded zero", "已记录为零", "Sifar direkodkan") : copy("Recorded actual waste", "实际浪费记录", "Sisa sebenar direkodkan")} · {copy("Records", "记录数", "Rekod")}: {summary.recordCount}</p> : <p>{explain(summary.reason)}</p>}
  </div>;
  const financialSummary = (summary: HistoricalFinancialSummary) => <div>
    <strong>{summary.state === "estimated" ? `MYR ${number(summary.amount)}` : copy("Unavailable", "不可用", "Tidak tersedia")}</strong>
    <p>{copy("Included decisions", "计入的决定", "Keputusan disertakan")}: {summary.includedCount} · {copy("Excluded decisions", "排除的决定", "Keputusan dikecualikan")}: {summary.excludedCount}</p>
    {summary.state !== "estimated" && <p>{explain(summary.reason)}</p>}
  </div>;
  const reviews = datasetId ? decisions.filter(item => item.datasetId === datasetId).map(item => ({ decision: item, review: (() => {
    try { return reviewDecisionOutcomes(item, [...outcomes, ...imported], periods.second); } catch { return undefined; }
  })() })) : [];

  return <section className="decision-outcomes" aria-label={copy("Historical periods and actual outcomes", "历史期间与实际结果", "Tempoh sejarah dan hasil sebenar")}>
    <h2>{copy("Review recorded history across periods", "按期间查看已记录的历史", "Semak sejarah direkodkan mengikut tempoh")}</h2>
    <p>{copy("Actual waste and historical estimated purchase commitments remain separate. Comparisons require equal-length periods and compatible units.", "实际浪费与历史采购承诺估算分开显示。比较需要等长期间和兼容单位。", "Sisa sebenar dan anggaran komitmen belian sejarah kekal berasingan. Perbandingan memerlukan tempoh sama panjang dan unit serasi.")}</p>
    {!datasetId || currentSnapshot.sourceMode === "sample" ? <p>{copy("Save a retailer dataset to review business outcome history. Sample results are excluded.", "请保存商户数据集后查看经营结果历史，示例数据不会计入。", "Simpan set data peruncit untuk menyemak sejarah hasil perniagaan. Hasil sampel dikecualikan.")}</p> : <>
      <div className="decision-outcomes__grid">
        <label>{copy("First period start", "第一个期间开始", "Mula tempoh pertama")}<input type="date" value={firstStart} onChange={event => setFirstStart(event.target.value)} /></label>
        <label>{copy("First period end", "第一个期间结束", "Akhir tempoh pertama")}<input type="date" value={firstEnd} onChange={event => setFirstEnd(event.target.value)} /></label>
        <label>{copy("Second period start", "第二个期间开始", "Mula tempoh kedua")}<input type="date" value={secondStart} onChange={event => setSecondStart(event.target.value)} /></label>
        <label>{copy("Second period end", "第二个期间结束", "Akhir tempoh kedua")}<input type="date" value={secondEnd} onChange={event => setSecondEnd(event.target.value)} /></label>
        <label>{copy("Waste comparison unit", "浪费比较单位", "Unit perbandingan sisa")}<select value={unit} onChange={event => setUnit(event.target.value as OutcomeUnit | "")}><option value="">{copy("Use compatible recorded units", "使用兼容的记录单位", "Gunakan unit rekod serasi")}</option>{(["pieces", "kg", "litres"] as const).map(value => <option value={value} key={value}>{unitName(value)}</option>)}</select></label>
      </div>
      {loading && <p role="status">{copy("Loading recorded history…", "正在加载已记录的历史…", "Memuatkan sejarah direkodkan…")}</p>}
      {loadError && <p role="alert">{copy("Saved history could not be read. Reopen this dataset and try again.", "无法读取已保存的历史，请重新打开数据集后重试。", "Sejarah tersimpan tidak dapat dibaca. Buka semula set data dan cuba lagi.")}</p>}
      {!comparison ? <p role="alert">{copy("Choose valid reporting-period dates before comparing.", "比较前请选择有效的期间日期。", "Pilih tarikh tempoh pelaporan yang sah sebelum membandingkan.")}</p> : <>
        <h3>{copy("Recorded actual waste", "实际浪费记录", "Sisa sebenar direkodkan")}</h3>
        <div className="decision-outcomes__grid"><div><h4>{copy("First period", "第一个期间", "Tempoh pertama")}</h4>{wasteSummary(comparison.waste.first)}</div><div><h4>{copy("Second period", "第二个期间", "Tempoh kedua")}</h4>{wasteSummary(comparison.waste.second)}</div></div>
        <p>{comparison.waste.state === "compared" ? `${copy("Recorded waste change", "实际浪费变化", "Perubahan sisa direkodkan")}: ${number(comparison.waste.change)} ${unitName(comparison.waste.unit)}` : `${copy("Comparison unavailable", "比较不可用", "Perbandingan tidak tersedia")}: ${explain(comparison.waste.reason)}`}</p>
        <h3>{copy("Historical financial estimates", "历史财务估算", "Anggaran kewangan sejarah")}</h3>
        <p>{copy("Uses the validated Unit Cost preserved when each decision was recorded. These are estimated purchase commitments, not measured profit or achieved savings.", "使用记录每项决定时保留的已验证单位成本。这些是采购承诺估算，并非实际利润或已实现节省。", "Menggunakan Unit Cost disahkan yang dikekalkan semasa setiap keputusan direkodkan. Ini anggaran komitmen belian, bukan keuntungan diukur atau penjimatan tercapai.")}</p>
        <div className="decision-outcomes__grid"><div><h4>{copy("First period estimate", "第一个期间估算", "Anggaran tempoh pertama")}</h4>{financialSummary(comparison.financial.first)}</div><div><h4>{copy("Second period estimate", "第二个期间估算", "Anggaran tempoh kedua")}</h4>{financialSummary(comparison.financial.second)}</div></div>
        <p>{comparison.financial.state === "compared" ? `${copy("Estimated purchase-commitment difference", "采购承诺估算差额", "Perbezaan anggaran komitmen belian")}: MYR ${number(comparison.financial.change)}` : `${copy("Comparison unavailable", "比较不可用", "Perbandingan tidak tersedia")}: ${explain(comparison.financial.reason)}`}</p>
      </>}
      <h3>{copy("Decision follow-up in the second period", "第二个期间的决定后续结果", "Susulan keputusan dalam tempoh kedua")}</h3>
      <p>{copy("Later imported sales and stock counts are observations. Returns are separate; a stock decrease never becomes an inferred waste record.", "后续导入的销售与库存盘点属于观测记录。退货单独保留，库存减少不会被推断成浪费。", "Jualan import kemudian dan kiraan stok ialah pemerhatian. Pulangan diasingkan; pengurangan stok tidak menjadi rekod sisa tersirat.")}</p>
      <p>{copy("Imported return records kept separate", "单独保留的导入退货记录", "Rekod pulangan import diasingkan")}: {returnCount}</p>
      {!reviews.length ? <p>{copy("No purchase decision recorded.", "尚未记录采购决定。", "Tiada keputusan pembelian direkodkan.")}</p> : <ul className="decision-outcomes__history">{reviews.map(({ decision, review }) => <li key={decision.id}><strong>{decision.recommendation.productName}</strong>{decision.recommendation.productCode && <> · {decision.recommendation.productCode}</>}{decision.recommendation.packSize && <> · {decision.recommendation.packSize}</>}
        <p>{copy("Original recommendation", "原始建议", "Cadangan asal")}: {decision.recommendation.recommendedQuantity} · {copy("Final quantity", "最终数量", "Kuantiti akhir")}: {decision.finalQuantity} · {decision.decisionDate}</p>
        {!review?.records.length ? <p>{copy("No outcome recorded", "尚无实际结果记录", "Tiada hasil direkodkan")}</p> : <ul>{review.records.map(record => <li key={record.id}>{record.date} · {record.kind === "sales" ? copy("Recorded sales", "实际销售", "Jualan direkodkan") : record.kind === "stock" ? copy("Stock count", "库存盘点", "Kiraan stok") : record.kind === "expired" ? copy("Expired stock", "过期库存", "Stok luput") : copy("Discarded stock", "丢弃库存", "Stok dibuang")} · {number(record.quantity)} {unitName(record.unit)}{record.quantity === 0 && <> · {copy("Recorded zero", "已记录为零", "Sifar direkodkan")}</>}{record.provenance && <> · {record.provenance.sourceName} · {copy("Source rows", "来源行", "Baris sumber")}: {record.provenance.sourceRows.join(", ")}</>}</li>)}</ul>}
      </li>)}</ul>}
    </>}
  </section>;
}
