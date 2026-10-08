import { useCallback, useEffect, useState } from "react";
import { DecisionValidationError, OutcomeValidationError, estimatePurchaseCost, filterPurchaseDecisions,
  type DecisionResponse, type ProductPurchasePlan, type PurchaseDecision, type ReadinessSnapshot, type RecordedStockOutcome, type StockOutcomeKind, type OutcomeUnit } from "../engine.ts";
import { useLanguage } from "../i18n/index.ts";
import { getSavedDataset, savedPurchaseDecisions, savedStockOutcomes, savePurchaseDecision, updateSavedPurchaseDecision,
  saveStockOutcome, updateSavedStockOutcome, removeSavedDecision, removeSavedOutcome } from "../storage/saved-datasets.ts";
import "./decision-outcome-controls.css";

interface Props {
  readonly datasetId?: string;
  readonly product: { readonly key: string; readonly title: string; readonly sku?: string; readonly pack?: string };
  readonly snapshot: ReadinessSnapshot;
  readonly plan?: ProductPurchasePlan;
  readonly onChanged?: () => void;
}

export function malaysiaToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(item => item.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Explicit choices and measured outcomes are separate from autosaved recommendation previews. */
export function DecisionOutcomeControls({ datasetId, product, snapshot, plan, onChanged }: Props) {
  const language = useLanguage();
  const copy = (en: string, zh: string, ms: string) => language === "zh" ? zh : language === "ms" ? ms : en;
  const today = malaysiaToday();
  const [decisions, setDecisions] = useState<readonly PurchaseDecision[]>([]);
  const [historyFrom, setHistoryFrom] = useState("");
  const [historyTo, setHistoryTo] = useState("");
  const [outcomes, setOutcomes] = useState<readonly RecordedStockOutcome[]>([]);
  const [response, setResponse] = useState<DecisionResponse>("Followed");
  const [finalQuantity, setFinalQuantity] = useState("");
  const [decisionDate, setDecisionDate] = useState(today);
  const [restockDate, setRestockDate] = useState("");
  const [reason, setReason] = useState("");
  const [supplier, setSupplier] = useState("");
  const [editingDecision, setEditingDecision] = useState<string>();
  const [kind, setKind] = useState<StockOutcomeKind>("discarded");
  const [outcomeDate, setOutcomeDate] = useState(today);
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState<OutcomeUnit>("pieces");
  const [relatedDecision, setRelatedDecision] = useState("");
  const [editingOutcome, setEditingOutcome] = useState<string>();
  const [deleteTarget, setDeleteTarget] = useState<{ kind: "decision" | "outcome"; id: string }>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const recommendation = plan?.estimatedRestock.state === "available" ? plan.estimatedRestock.quantity.value : undefined;
  const expiryBlocked = plan?.estimatedRestock && "afterUnavailableReason" in plan.estimatedRestock && Boolean(plan.estimatedRestock.afterUnavailableReason);
  const sample = snapshot.sourceMode === "sample";
  const visibleDecisions = decisions.filter(item => (!historyFrom || item.decisionDate >= historyFrom) && (!historyTo || item.decisionDate <= historyTo));
  const canSave = !!datasetId && !sample;
  const load = useCallback(async () => {
    if (!datasetId) { setDecisions([]); setOutcomes([]); return; }
    const saved = await getSavedDataset(datasetId);
    setDecisions(saved ? filterPurchaseDecisions(savedPurchaseDecisions(saved), { datasetId, productKey: product.key }) : []);
    setOutcomes(saved ? savedStockOutcomes(saved).filter(item => item.productKey === product.key).sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt)) : []);
  }, [datasetId, product.key]);
  useEffect(() => { void load().catch(() => setError(copy("Saved history could not be read. Try again.", "无法读取已保存的历史，请重试。", "Sejarah tersimpan tidak dapat dibaca. Cuba lagi."))); }, [load, language]);
  useEffect(() => {
    setFinalQuantity(recommendation === undefined ? "" : String(recommendation));
    setEditingDecision(undefined); setEditingOutcome(undefined); setDeleteTarget(undefined);
    setResponse("Followed"); setReason(""); setSupplier(""); setRestockDate(""); setQuantity(""); setRelatedDecision(""); setError(undefined); setMessage(undefined);
  }, [product.key, datasetId]);
  useEffect(() => { if (!editingDecision && response === "Followed") setFinalQuantity(recommendation === undefined ? "" : String(recommendation)); }, [recommendation, editingDecision, response]);

  const describeError = (failure: unknown): string => {
    if (failure instanceof DecisionValidationError || failure instanceof OutcomeValidationError) {
      if (language === "en") return failure.message;
      const fields = Object.keys(failure.fields);
      if (fields.includes("reason")) return copy("Enter a reason for changing the recommendation.", "修改建议时，请填写原因。", "Masukkan sebab mengubah cadangan.");
      if (fields.includes("finalQuantity") || fields.includes("quantity")) return copy("Correct the quantity. Use a non-negative number; pieces must be whole numbers.", "请修正数量：使用非负数，件数必须为整数。", "Betulkan kuantiti. Gunakan nombor bukan negatif; bilangan unit mestilah nombor bulat.");
      if (fields.some(field => field.toLowerCase().includes("date"))) return copy("Correct the date. Recorded decisions and outcomes cannot be in the future.", "请修正日期：已记录的决定和实际结果不能使用未来日期。", "Betulkan tarikh. Keputusan dan hasil direkodkan tidak boleh bertarikh akan datang.");
    }
    return copy(failure instanceof Error ? failure.message : "Saving failed. Keep your inputs and try again.", "保存失败；输入已保留，请检查数据后重试。", "Simpanan gagal. Input dikekalkan; semak data dan cuba lagi.");
  };
  const act = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(undefined); setMessage(undefined);
    try { await action(); await load(); setMessage(success); onChanged?.(); return true; }
    catch (failure) { setError(describeError(failure)); return false; }
    finally { setBusy(false); }
  };
  const resetDecision = () => { setEditingDecision(undefined); setResponse("Followed"); setFinalQuantity(recommendation === undefined ? "" : String(recommendation)); setDecisionDate(today); setRestockDate(""); setReason(""); setSupplier(""); };
  const saveDecision = async () => {
    if (!datasetId || (!editingDecision && (recommendation === undefined || expiryBlocked))) return;
    const edit = { response, finalQuantity, decisionDate, restockDate, reason, supplier, referenceDate: today };
    const saved = await act(() => editingDecision ? updateSavedPurchaseDecision(datasetId, editingDecision, edit) : (() => {
      const cost = estimatePurchaseCost(snapshot, product.key, recommendation);
      return savePurchaseDecision(datasetId, { ...edit, recommendation: { productKey: product.key, productName: product.title,
        productCode: product.sku, packSize: product.pack, sourceName: snapshot.sourceName, sourceSha256: snapshot.sourceSha256,
        sourceMode: snapshot.sourceMode, analysisDate: snapshot.analysisDate, policyVersion: plan!.purchasePolicyVersion,
        snapshotId: snapshot.id, recommendedQuantity: recommendation!, quantityUnit: "pieces", inputs: plan!.inputs, plan,
        unitCost: cost.state === "estimated" ? cost.unitCost : undefined, currency: cost.state === "estimated" ? cost.currency : undefined } });
    })(), copy("Purchase decision saved.", "采购决定已保存。", "Keputusan pembelian disimpan."));
    if (saved) resetDecision();
  };
  const responseName = (value: DecisionResponse) => value === "Followed" ? copy("Followed", "遵循建议", "Ikut cadangan") : value === "Changed" ? copy("Changed", "修改建议", "Ubah cadangan") : copy("Ignored", "不采用建议", "Abaikan cadangan");
  const kindName = (value: StockOutcomeKind) => value === "discarded" ? copy("Discarded", "已丢弃", "Dibuang") : value === "expired" ? copy("Expired", "已过期", "Luput") : value === "sales" ? copy("Recorded sales", "实际销售", "Jualan direkodkan") : copy("Stock count", "库存盘点", "Kiraan stok");
  const unitName = (value: OutcomeUnit) => value === "pieces" ? copy("pieces", "件", "unit") : value === "kg" ? copy("kg", "公斤", "kg") : copy("litres", "升", "liter");

  return <section className="decision-outcomes" aria-label={copy("Purchase decisions and actual outcomes", "采购决定与实际结果", "Keputusan pembelian dan hasil sebenar")}>
    <h3>{copy("Record your purchase decision", "记录您的采购决定", "Rekod keputusan pembelian anda")}</h3>
    <p>{product.title}{product.sku && <> · {product.sku}</>}{product.pack && <> · {product.pack}</>}</p>
    {!canSave && <p className="decision-outcomes__note">{sample ? copy("Sample choices are illustrative and are excluded from business outcome history.", "示例选择仅供演示，不会计入实际经营结果历史。", "Pilihan sampel adalah ilustrasi dan tidak dimasukkan dalam sejarah hasil perniagaan.") : copy("Save this dataset before recording decisions or outcomes.", "请先保存此数据集，再记录决定或实际结果。", "Simpan set data ini sebelum merekod keputusan atau hasil.")}</p>}
    {recommendation === undefined || expiryBlocked ? <p>{copy("A usable purchase recommendation is required before saving a new decision. Return to readiness or correct planning evidence.", "保存新决定前需要可用的采购建议，请返回数据检查或修正计划依据。", "Cadangan pembelian yang boleh digunakan diperlukan sebelum keputusan baharu disimpan. Kembali ke kesediaan atau betulkan bukti perancangan.")}</p> : <p>{copy("Current recommendation", "当前建议", "Cadangan semasa")}: <strong>{recommendation} {unitName("pieces")}</strong></p>}
    <form onSubmit={event => { event.preventDefault(); void saveDecision(); }}>
      <fieldset disabled={!canSave || busy}>
        <legend>{editingDecision ? copy("Correct a recorded decision", "修正已记录的决定", "Betulkan keputusan direkodkan") : copy("Your final choice", "您的最终选择", "Pilihan akhir anda")}</legend>
        <div className="decision-outcomes__grid">
          <label>{copy("Response", "回应", "Tindakan")}<select value={response} onChange={event => { const next = event.target.value as DecisionResponse; setResponse(next); if (next === "Followed") { const original = decisions.find(item => item.id === editingDecision)?.recommendation.recommendedQuantity ?? recommendation; setFinalQuantity(original === undefined ? "" : String(original)); } }}>{(["Followed", "Changed", "Ignored"] as const).map(value => <option key={value} value={value}>{responseName(value)}</option>)}</select></label>
          <label>{copy("Final quantity", "最终数量", "Kuantiti akhir")}<input inputMode="numeric" value={finalQuantity} readOnly={response === "Followed"} onChange={event => setFinalQuantity(event.target.value)} /></label>
          <label>{copy("Decision date", "决定日期", "Tarikh keputusan")}<input type="date" value={decisionDate} max={today} onChange={event => setDecisionDate(event.target.value)} /></label>
          <label>{copy("Restock date (optional)", "补货日期（可选）", "Tarikh tambah stok (pilihan)")}<input type="date" value={restockDate} onChange={event => setRestockDate(event.target.value)} /></label>
          <label>{copy("Supplier (optional)", "供应商（可选）", "Pembekal (pilihan)")}<input value={supplier} onChange={event => setSupplier(event.target.value)} /></label>
          <label className="decision-outcomes__wide">{copy("Reason (optional)", "原因（可选）", "Sebab (pilihan)")}<input value={reason} onChange={event => setReason(event.target.value)} /></label>
        </div>
        <div className="decision-outcomes__actions"><button className="btn btn--primary" type="submit" disabled={!editingDecision && (recommendation === undefined || !!expiryBlocked)}>{copy("Save decision", "保存决定", "Simpan keputusan")}</button>{editingDecision && <button className="btn btn--ghost" type="button" onClick={resetDecision}>{copy("Cancel edit", "取消修改", "Batal suntingan")}</button>}</div>
      </fieldset>
    </form>
    <h4>{copy("Recorded decisions", "已记录的决定", "Keputusan direkodkan")}</h4>
    <div className="decision-outcomes__grid"><label>{copy("History from", "历史开始日期", "Sejarah dari")}<input type="date" value={historyFrom} onChange={event => setHistoryFrom(event.target.value)} /></label><label>{copy("History to", "历史结束日期", "Sejarah hingga")}<input type="date" value={historyTo} onChange={event => setHistoryTo(event.target.value)} /></label></div>
    {(historyFrom || historyTo) && <button type="button" onClick={() => { setHistoryFrom(""); setHistoryTo(""); }}>{copy("Clear history filter", "清除历史筛选", "Kosongkan penapis sejarah")}</button>}
    {visibleDecisions.length === 0 ? <p>{copy("No purchase decision recorded for this product and period.", "此商品与所选期间尚未记录采购决定。", "Tiada keputusan pembelian direkodkan untuk produk dan tempoh ini.")}</p> : <ul className="decision-outcomes__history">{visibleDecisions.map(item => <li key={item.id}>
      <strong>{responseName(item.response)} · {item.finalQuantity} {item.recommendation.quantityUnit === "pieces" ? unitName("pieces") : item.recommendation.quantityUnit}</strong> · {item.decisionDate}
      <p>{copy("Original recommendation", "原始建议", "Cadangan asal")}: {item.recommendation.recommendedQuantity} · {copy("Analysis date", "分析日期", "Tarikh analisis")}: {item.recommendation.analysisDate} · {copy("Dataset", "数据集", "Set data")}: {item.recommendation.sourceName}</p>
      {item.reason && <p>{item.reason}</p>}{item.restockDate && <p>{copy("Restock date", "补货日期", "Tarikh tambah stok")}: {item.restockDate}</p>}
      <div className="decision-outcomes__actions"><button type="button" disabled={busy} onClick={() => { setEditingDecision(item.id); setResponse(item.response); setFinalQuantity(String(item.finalQuantity)); setDecisionDate(item.decisionDate); setRestockDate(item.restockDate ?? ""); setReason(item.reason ?? ""); setSupplier(item.supplier ?? ""); }}>{copy("Edit decision", "修改决定", "Sunting keputusan")}</button><button type="button" disabled={busy} onClick={() => setDeleteTarget({ kind: "decision", id: item.id })}>{copy("Delete decision", "删除决定", "Padam keputusan")}</button></div>
    </li>)}</ul>}
    <h3>{copy("Record actual stock outcomes", "记录实际库存结果", "Rekod hasil stok sebenar")}</h3>
    <p>{copy("Recorded waste is separate from predicted excess. No record is different from a recorded zero.", "实际浪费与预测的过量库存分开记录。没有记录与记录为零不同。", "Sisa direkodkan berasingan daripada lebihan ramalan. Tiada rekod berbeza daripada sifar direkodkan.")}</p>
    <form onSubmit={event => { event.preventDefault(); if (!datasetId) return; void (async () => {
      const existing = outcomes.find(item => item.id === editingOutcome);
      const weight = snapshot.productWeights?.find(item => item.productKey === product.key);
      const conversion = existing?.unit === unit ? existing.conversion : unit === "pieces" && weight?.state === "usable"
        ? { kilogramsPerUnit: weight.value, source: `Validated weight at recording: ${weight.sourceColumn ?? "Weight per unit"}; source rows ${weight.sourceRows.join(", ")}` } : undefined;
      const input = { kind, date: outcomeDate, quantity, unit, referenceDate: today, decisionId: relatedDecision || undefined, conversion };
      const saved = await act(() => editingOutcome ? updateSavedStockOutcome(datasetId, editingOutcome, input) : saveStockOutcome(datasetId, { ...input, productKey: product.key }), copy("Actual outcome saved.", "实际结果已保存。", "Hasil sebenar disimpan."));
      if (saved) { setQuantity(""); setEditingOutcome(undefined); }
    })(); }}>
      <fieldset disabled={!canSave || busy}><legend>{editingOutcome ? copy("Correct an actual outcome", "修正实际结果", "Betulkan hasil sebenar") : copy("Observed record", "实际观测记录", "Rekod diperhatikan")}</legend>
        <div className="decision-outcomes__grid">
          <label>{copy("Outcome type", "结果类型", "Jenis hasil")}<select value={kind} onChange={event => setKind(event.target.value as StockOutcomeKind)}>{(["discarded", "expired", "sales", "stock"] as const).map(value => <option key={value} value={value}>{kindName(value)}</option>)}</select></label>
          <label>{copy("Outcome date", "实际发生日期", "Tarikh hasil")}<input type="date" value={outcomeDate} max={today} onChange={event => setOutcomeDate(event.target.value)} /></label>
          <label>{copy("Recorded quantity", "实际记录数量", "Kuantiti direkodkan")}<input inputMode="decimal" value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
          <label>{copy("Recorded unit", "记录单位", "Unit direkodkan")}<select value={unit} onChange={event => setUnit(event.target.value as OutcomeUnit)}>{(["pieces", "kg", "litres"] as const).map(value => <option key={value} value={value}>{unitName(value)}</option>)}</select></label>
          <label className="decision-outcomes__wide">{copy("Related decision (optional)", "关联决定（可选）", "Keputusan berkaitan (pilihan)")}<select value={relatedDecision} onChange={event => setRelatedDecision(event.target.value)}><option value="">{copy("None", "无", "Tiada")}</option>{decisions.map(item => <option key={item.id} value={item.id}>{item.decisionDate} · {responseName(item.response)} · {item.finalQuantity}</option>)}</select></label>
        </div>
        <div className="decision-outcomes__actions"><button className="btn btn--primary" type="submit">{copy("Save actual outcome", "保存实际结果", "Simpan hasil sebenar")}</button>{editingOutcome && <button type="button" onClick={() => { setEditingOutcome(undefined); setQuantity(""); }}>{copy("Cancel edit", "取消修改", "Batal suntingan")}</button>}</div>
      </fieldset>
    </form>
    {outcomes.length === 0 ? <p>{copy("No outcome recorded.", "尚无实际结果记录。", "Tiada hasil direkodkan.")}</p> : <ul className="decision-outcomes__history">{outcomes.map(item => <li key={item.id}><strong>{kindName(item.kind)} · {item.quantity} {unitName(item.unit)}</strong> · {item.date}{item.quantity === 0 && <p>{copy("Recorded zero", "已记录为零", "Sifar direkodkan")}</p>}<div className="decision-outcomes__actions"><button type="button" disabled={busy} onClick={() => { setEditingOutcome(item.id); setKind(item.kind); setOutcomeDate(item.date); setQuantity(String(item.quantity)); setUnit(item.unit); setRelatedDecision(item.decisionId ?? ""); }}>{copy("Edit outcome", "修改实际结果", "Sunting hasil")}</button><button type="button" disabled={busy} onClick={() => setDeleteTarget({ kind: "outcome", id: item.id })}>{copy("Delete outcome", "删除实际结果", "Padam hasil")}</button></div></li>)}</ul>}
    {deleteTarget && <div role="alertdialog" aria-label={copy("Confirm deletion", "确认删除", "Sahkan pemadaman")}><p>{deleteTarget.kind === "decision" ? copy("Delete this decision? Actual outcomes remain recorded.", "删除此决定？实际结果记录会保留。", "Padam keputusan ini? Hasil sebenar kekal direkodkan.") : copy("Delete this actual outcome?", "删除此实际结果记录？", "Padam hasil sebenar ini?")}</p><div className="decision-outcomes__actions"><button type="button" disabled={busy} onClick={() => { if (!datasetId) return; void act(() => deleteTarget.kind === "decision" ? removeSavedDecision(datasetId, deleteTarget.id) : removeSavedOutcome(datasetId, deleteTarget.id), copy("Record deleted.", "记录已删除。", "Rekod dipadam.")).then(success => { if (success) setDeleteTarget(undefined); }); }}>{copy("Confirm delete", "确认删除", "Sahkan padam")}</button><button type="button" onClick={() => setDeleteTarget(undefined)}>{copy("Cancel", "取消", "Batal")}</button></div></div>}
    {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
  </section>;
}
