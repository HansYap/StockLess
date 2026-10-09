import { t, useLanguage } from "../i18n/index.ts";

export function StorageExplanation({ onManage }: { readonly onManage: () => void }) {
  useLanguage();
  return <section className="storage-explanation">
    <div>
      <h2>{t("Saved in this browser")}</h2>
      <ul>
        <li>{t("Your upload and purchase plan are saved automatically when the plan is ready. Your latest 12 completed uploads are kept on this device; the oldest is removed when history is full.")}</li>
        <li>{t("Settings: column matches, product identifiers and analysis dates so you can reuse your setup.")}</li>
        <li>{t("Order quantities and supplier settings are saved automatically as you edit them.")}</li>
        <li>{t("Plan history: a copy is saved automatically when a plan is generated, so later edits do not rewrite that version.")}</li>
        <li>{t("Decisions: the purchase decisions you record (followed, changed or ignored) with their original recommendation, so you can review or correct them later.")}</li>
        <li>{t("Results: checked data, forecasts and outcomes you record so you can review earlier work.")}</li>
      </ul>
      <p>{t("Saved work belongs to this browser on this device. It may be lost when browser data is cleared; it is not synchronised to another browser.")}</p>
      <p>{t("Sample data is kept separate from your saved business decisions and outcomes.")}</p>
      <div className="stockless-dialog__actions"><button type="button" className="stockless-dialog__button stockless-dialog__button--primary" onClick={onManage}>{t("Manage saved uploads")}</button></div>
    </div>
  </section>;
}
