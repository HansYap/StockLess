import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n/index.ts";
import type { Finding } from "../readiness/model.ts";

const PAGE_SIZE = 25;
const ISSUE_LABELS = { date: "Dates we couldn't read", quantity: "Quantities to check", identity: "Rows with no product", stock: "Stock counts to check", other: "Other things to check", tidy: "Safe tidy-ups applied" };
type EvidenceEntry = { item: Finding; row: { sourceRow: number; used: boolean } | undefined };

export function ReadinessEvidenceTable({ findings, selectedFindingId, onClearSelection, onDownload }: {
  findings: readonly Finding[];
  selectedFindingId: string | null;
  onClearSelection: () => void;
  onDownload: () => void;
}) {
  const [page, setPage] = useState(0);
  const selected = findings.find(item => item.id === selectedFindingId);
  const entries = useMemo(() => (selected ? [selected] : findings).flatMap<EvidenceEntry>(item => {
    const evidence = item.rowEvidence ?? item.sourceRows.map(sourceRow => ({ sourceRow, used: item.status !== "out" }));
    return evidence.length ? evidence.map(row => ({ item, row })) : [{ item, row: undefined }];
  }), [findings, selected]);
  useEffect(() => setPage(0), [findings, selectedFindingId]);
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);

  return <section className="rd-card rd-evidence" aria-labelledby="readiness-evidence-title">
    <div className="rd-card__head"><div><h3 id="readiness-evidence-title">{t("Problems and tidy-ups")}</h3><p>{t("Every finding retains its source rows and original evidence.")}</p></div><button type="button" className="btn btn--ghost btn--small" onClick={onDownload}>{t("Download all row evidence")}</button></div>
    {selected && <div className="rd-evidence-selection"><div><small>{t("Affected rows for")}</small><b>{selected.name === "Unknown product" ? t(selected.name) : selected.name} · {selected.code}</b><span>{t(selected.reason)}</span></div><button type="button" className="btn btn--ghost btn--small" onClick={onClearSelection}>{t("Show all findings")}</button></div>}
    <div className="rd-table-scroll" role="region" aria-label={t("Problems and tidy-ups")} tabIndex={0}>
      <table><colgroup><col className="rd-evidence-col--row" /><col className="rd-evidence-col--product" /><col className="rd-evidence-col--issue" /><col className="rd-evidence-col--observed" /><col className="rd-evidence-col--advice" /><col className="rd-evidence-col--use" /></colgroup>
        <thead><tr><th scope="col">{t("Row")}</th><th scope="col">{t("Product")}</th><th scope="col">{t("Issue")}</th><th scope="col">{t("Observed value")}</th><th scope="col">{t("Reason and action")}</th><th scope="col">{t("Use")}</th></tr></thead>
        <tbody>{entries.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE).map(({ item, row }, index) => <tr key={item.id + "-" + (currentPage * PAGE_SIZE + index)}>
          <td className="num">{row?.sourceRow.toLocaleString() ?? "—"}</td>
          <td><b>{item.name === "Unknown product" ? t(item.name) : item.name}</b><small className="num">{item.code}</small></td>
          <td><span className={"rd-pill rd-pill--" + item.status}>{t(ISSUE_LABELS[item.type])}</span></td>
          <td>{item.observed ? <code>{item.observed}</code> : "—"}</td>
          <td><b>{t(item.reason)}</b><span>{t(item.action)}</span></td>
          <td><span className={"rd-pill rd-pill--" + (row ? row.used ? "in" : "out" : item.status)}>{t(row ? row.used ? "Still counted" : "Left out" : item.status === "done" ? "Done" : item.status === "out" ? "Left out" : "Still counted")}</span></td>
        </tr>)}</tbody>
      </table>
    </div>
    {entries.length > PAGE_SIZE && <div className="rd-pager"><button type="button" className="btn btn--ghost btn--small" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t("← Previous")}</button><span aria-live="polite">{currentPage + 1} / {pages}</span><button type="button" className="btn btn--ghost btn--small" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)}>{t("Next →")}</button></div>}
  </section>;
}
