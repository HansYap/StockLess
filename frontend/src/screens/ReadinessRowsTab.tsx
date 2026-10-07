import { useMemo, useState } from "react";
import { getLocale, t, useLanguage } from "../i18n/index.ts";
import type { ReadinessSnapshot } from "../engine.ts";
import type { Finding, FindingType } from "../readiness/model.ts";
import { ReadinessIcon } from "./ReadinessIcon.tsx";

const ORDER: readonly FindingType[] = ["date", "quantity", "identity", "stock", "other", "tidy"];
const LABELS = {
  date: "Dates we couldn't read", quantity: "Quantity isn't a number", identity: "No product code",
  stock: "Stock counts to check", other: "Other things to check", tidy: "Repeated rows (latest kept)", unexplained: "Other reasons",
};
export function summariseRows(snapshot: ReadinessSnapshot, findings: readonly Finding[]) {
  const excluded = new Set(snapshot.rows.filter(row => row.useState === "excluded").map(row => row.sourceRow));
  const assigned = new Set<number>();
  const reasons: { type: FindingType | "unexplained"; sourceRows: number[]; example?: Finding; count: number }[] = [];
  // Assign each excluded row once, even when it has several findings or is part of a duplicate group.
  for (const type of ORDER) {
    const group = findings.filter(item => item.type === type);
    const sourceRows = [...new Set(group.flatMap(item => item.sourceRows))].filter(row => excluded.has(row) && !assigned.has(row)).sort((a, b) => a - b);
    sourceRows.forEach(row => assigned.add(row));
    if (sourceRows.length) reasons.push({ type, sourceRows, count: sourceRows.length, example: group.find(item => item.sourceRows.includes(sourceRows[0])) });
  }
  const remaining = [...excluded].filter(row => !assigned.has(row)).sort((a, b) => a - b);
  const unaccounted = Math.max(remaining.length, snapshot.reconciliation.rowsExcluded - assigned.size);
  if (unaccounted) reasons.push({ type: "unexplained", sourceRows: remaining, count: unaccounted });
  const used = new Set(snapshot.rows.filter(row => row.useState === "used").map(row => row.sourceRow));
  const tidied = new Set(findings.filter(item => item.type === "tidy").flatMap(item => item.sourceRows).filter(row => used.has(row))).size;
  return { ...snapshot.reconciliation, tidied, reasons };
}

export function ReadinessRowsTab({ snapshot, findings, onShowGroup, onDownload }: {
  snapshot: ReadinessSnapshot; findings: readonly Finding[]; onShowGroup: (type: FindingType) => void; onDownload: () => void;
}) {
  useLanguage();
  const { rowsIn, rowsUsed, rowsExcluded, tidied, reasons } = useMemo(() => summariseRows(snapshot, findings), [snapshot, findings]);
  const [picked, setPicked] = useState(0);
  const current = reasons[Math.min(picked, reasons.length - 1)];
  const number = (value: number) => value.toLocaleString(getLocale());
  const largest = Math.max(1, ...reasons.map(reason => reason.count));
  const heading = t(rowsExcluded === 1 ? "Why 1 row was left out" : `Why ${number(rowsExcluded)} rows were left out`);
  return <div className="rd-rows">
    <div className="rd-rows__head"><p className="rd-rows__headline"><b className="num">{number(rowsUsed)}</b> {t(`of ${number(rowsIn)} rows will be used`)}</p><span className="rd-rows__safe"><ReadinessIcon name="check" />{t("Your file isn't changed")}</span></div>
    <div className="rd-rows__bar" role="img" aria-label={t(`${number(rowsUsed)} rows used, ${number(rowsExcluded)} left out`)}>{rowsUsed > 0 && <span className="rd-rows__used" style={{ flexGrow: rowsUsed }} />}{rowsExcluded > 0 && <span className="rd-rows__out" style={{ flexGrow: rowsExcluded }} />}</div>
    <ul className="rd-rows__legend"><li><i className="rd-rows__key rd-rows__key--used" />{t("Used in the plan")} · <b className="num">{number(rowsUsed)}</b></li><li><i className="rd-rows__key rd-rows__key--out" />{t("Left out")} · <b className="num">{number(rowsExcluded)}</b></li><li><i className="rd-rows__key rd-rows__key--tidy" />{t("Tidied for you (still used)")} · <b className="num">{number(tidied)}</b></li></ul>
    {!current ? <p className="rd-empty">{t("Nothing to fix. Every row can be used.")}</p> : <div className="rd-rows__grid">
      <div className="rd-rows__reasons"><h3>{heading}</h3><div role="radiogroup" aria-label={heading}>{reasons.map((reason, index) => <button type="button" role="radio" key={reason.type} aria-checked={current === reason} tabIndex={current === reason ? 0 : -1} className="rd-rows__reason" onClick={() => setPicked(index)} onKeyDown={event => {
        const next = event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % reasons.length : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index + reasons.length - 1) % reasons.length : event.key === "Home" ? 0 : event.key === "End" ? reasons.length - 1 : -1;
        if (next < 0) return; event.preventDefault(); setPicked(next); (event.currentTarget.parentElement?.children[next] as HTMLButtonElement)?.focus();
      }}><span>{t(LABELS[reason.type])}</span><span className="rd-rows__meter" aria-hidden="true"><i style={{ width: `${reason.count / largest * 100}%` }} /></span><b className="num">{number(reason.count)}</b></button>)}</div></div>
      <div className="rd-rows__todo" aria-live="polite"><h3>{t("What to do")}</h3><b>{t(current.type === "tidy" ? "Nothing to fix" : current.type === "unexplained" ? "Download the list to see these rows" : current.count === 1 ? "Fix 1 row in your file" : `Fix ${number(current.count)} rows in your file`)}</b>
        {current.example && <p>{t(current.example.action)}</p>}{current.sourceRows.length > 0 && <p>{t("Rows")} <span className="num">{current.sourceRows.slice(0, 4).map(number).join(", ")}{current.sourceRows.length > 4 ? "..." : ""}</span>{current.example?.observed && <> · <code>{current.example.observed}</code></>}</p>}
        <p className="rd-rows__note">{t("Or continue now — these rows are simply left out of the plan.")}</p><button type="button" className="btn--link" onClick={() => current.type === "unexplained" ? onDownload() : onShowGroup(current.type)}>{t(current.type === "unexplained" ? "Download the list to see these rows" : "Show these rows in “What we found” ↓")}</button>
      </div>
    </div>}
  </div>;
}
