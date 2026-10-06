import { t, useLanguage } from "../i18n/index.ts";

export function StorageExplanation({ onManage }: { onManage: () => void }) {
  useLanguage();
  return <details className="storage-explanation">
    <summary>{t("How saved information is used")}</summary>
    <div>
      <h2>{t("Saved in this browser")}</h2>
      <ul>
        <li>{t("Datasets: imported records and source details so you can reopen your work.")}</li>
        <li>{t("Settings: column matches, product identifiers and analysis dates so you can reuse your setup.")}</li>
        <li>{t("Plans and supplier terms: saved order quantities and terms so you can continue planning.")}</li>
        <li>{t("Decisions: a copy of the recommendation when you save a decision, so later changes do not rewrite it.")}</li>
        <li>{t("Results: checked data, forecasts and outcomes you record so you can review earlier work.")}</li>
      </ul>
      <p>{t("Saved work belongs to this browser on this device. It may be lost when browser data is cleared; it is not synchronised to another browser.")}</p>
      <p>{t("Sample data is kept separate from your saved business decisions and outcomes.")}</p>
      <button type="button" className="btn btn--ghost" onClick={onManage}>{t("Inspect and remove saved information")}</button>
    </div>
  </details>;
}
